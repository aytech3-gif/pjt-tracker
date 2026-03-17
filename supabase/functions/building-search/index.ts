import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function safeJsonParse(str: string) {
  try {
    const m = str.match(/\[[\s\S]*\]|\{[\s\S]*\}/);
    return m ? JSON.parse(m[0]) : null;
  } catch {
    return null;
  }
}

/** Fetch with timeout */
async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs = 8000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/** Race a promise against a timeout — returns fallback on timeout */
function raceTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>(resolve => setTimeout(() => resolve(fallback), ms)),
  ]);
}

/**
 * 1단계: Firecrawl 웹 검색 (timeout 5초로 단축)
 */
async function searchWeb(query: string): Promise<string> {
  const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");
  if (!FIRECRAWL_API_KEY) return "";

  try {
    const response = await fetchWithTimeout(
      "https://api.firecrawl.dev/v1/search",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: `${query} 시행 시공 프로젝트 사업실적`,
          limit: 8,
          lang: "ko",
          country: "kr",
        }),
      },
      5000
    );

    if (!response.ok) return "";

    const data = await response.json();
    const results = data?.data || data?.results || [];
    if (!Array.isArray(results) || results.length === 0) return "";

    const seen = new Set<string>();
    const unique = results.filter((r: any) => {
      const key = r.url || r.title || "";
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    return unique
      .slice(0, 8)
      .map((r: any, i: number) => `[${i + 1}] ${r.title || ""}\n${r.description || r.snippet || ""}`)
      .join("\n\n");
  } catch {
    return "";
  }
}

/**
 * 2단계: AI 구조화 (timeout 12초로 단축, 프롬프트 경량화)
 */
async function structureWithAI(query: string, webContext: string, apiKey: string) {
  const hasWeb = webContext.length > 0;
  const contextBlock = hasWeb ? `\n\n웹검색결과:\n${webContext}` : "";

  const response = await fetchWithTimeout(
    "https://ai.gateway.lovable.dev/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          {
            role: "system",
            content: `한국 건설 프로젝트 전문가. 키워드 관련 프로젝트를 JSON 배열로 반환.
항목: name,address,developer,builder,designer,scale,purpose,area,status,date,summary
${hasWeb ? "웹결과+지식 활용." : "학습 지식 활용."}15~20개 목표. 불확실→"확인필요". JSON만 반환.
[{"name":"...","address":"...","developer":"...","builder":"...","designer":"...","scale":"...","purpose":"...","area":"...","status":"...","date":"...","summary":"..."}]`,
          },
          {
            role: "user",
            content: `"${query}" 관련 프로젝트${contextBlock}`,
          },
        ],
      }),
    },
    12000
  );

  if (!response.ok) {
    if (response.status === 429 || response.status === 402) throw new Error(`AI_${response.status}`);
    throw new Error("AI structuring failed");
  }

  const result = await response.json();
  return safeJsonParse(result.choices?.[0]?.message?.content || "[]") || [];
}

/**
 * 3단계: 공공데이터포털 (timeout 4초)
 */
async function searchPublicData(query: string) {
  const serviceKey = Deno.env.get("PUBLIC_DATA_SERVICE_KEY");
  if (!serviceKey) return [];

  const url = `http://apis.data.go.kr/1613000/ArchPmsService_v2/getApBasisOulnInfo?serviceKey=${serviceKey}&numOfRows=20&pageNo=1&type=json&platPlc=${encodeURIComponent(query)}`;

  try {
    const response = await fetchWithTimeout(url, {}, 4000);
    if (!response.ok) return [];

    const data = await response.json();
    const items = data?.response?.body?.items?.item || data?.response?.body?.items || [];
    if (!Array.isArray(items)) return [];

    return items.map((item: any) => ({
      name: item.bldNm || "정보 없음",
      address: item.platPlc || item.newPlatPlc || "정보 없음",
      developer: "확인필요",
      builder: "확인필요",
      scale: `지상${item.grndFlrCnt || "?"}층/지하${item.ugndFlrCnt || "?"}층`,
      purpose: item.mainPurpsCdNm || "정보 없음",
      area: item.totArea ? `연면적 ${item.totArea} m²` : "정보 없음",
      structure: item.strctCdNm || "정보 없음",
      status: item.useAprvDay ? "준공" : item.stcnsDay ? "착공" : "예정",
      date: item.useAprvDay || item.stcnsDay || item.pmsDay || "",
      source: "공공데이터포털",
    }));
  } catch {
    return [];
  }
}

/** DB 저장 (non-blocking) */
function saveResultsInBackground(userEmail: string, query: string, merged: any[]) {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !supabaseKey) return;

    const sb = createClient(supabaseUrl, supabaseKey);
    const rows = merged.map((item: any) => ({
      user_email: userEmail,
      search_query: query,
      project_name: (item.name || "").slice(0, 500),
      project_address: (item.address || "").slice(0, 500),
      developer: (item.developer || "").slice(0, 500),
      builder: (item.builder || "").slice(0, 500),
      designer: (item.designer || "").slice(0, 500),
      scale: (item.scale || "").slice(0, 200),
      purpose: (item.purpose || "").slice(0, 200),
      area: (item.area || "").slice(0, 200),
      status: (item.status || "").slice(0, 100),
      date: (item.date || "").slice(0, 100),
      source: (item.source || "").slice(0, 100),
      summary: (item.summary || "").slice(0, 2000),
    }));

    sb.from("search_results").insert(rows).then(({ error }) => {
      if (error) console.error("Save error:", error.message);
    });
  } catch {}
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    let body: any;
    try { body = await req.json(); } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON body" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const query = typeof body?.query === "string" ? body.query.trim() : "";
    const userEmail = typeof body?.userEmail === "string" ? body.userEmail.trim() : "";

    if (!query) {
      return new Response(JSON.stringify({ error: "query is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    console.log(`Query: "${query}"`);

    // ── 모든 소스 병렬 실행 (웹검색 4초 제한 후 AI 시작) ──
    // 공공데이터는 독립 실행
    const publicPromise = raceTimeout(searchPublicData(query), 4000, []);

    // 웹검색 → AI 파이프라인 (웹검색 4초 내 완료되면 컨텍스트 활용, 아니면 AI 단독)
    const aiPromise = (async () => {
      const webText = await raceTimeout(searchWeb(query), 4000, "");
      return structureWithAI(query, webText, LOVABLE_API_KEY);
    })();

    const [aiResult, pubResult] = await Promise.allSettled([aiPromise, publicPromise]);

    const aiItems = aiResult.status === "fulfilled" ? aiResult.value : [];
    const pub = pubResult.status === "fulfilled" ? pubResult.value : [];

    // Tag results
    const taggedAI = (Array.isArray(aiItems) ? aiItems : []).map((item: any, idx: number) => ({
      ...item,
      id: `ai-${idx}-${Date.now()}`,
      source: "🌐 웹 검색 + AI",
    }));

    const taggedPub = (Array.isArray(pub) ? pub : []).map((item: any, idx: number) => ({
      ...item,
      id: `pub-${idx}-${Date.now()}`,
      source: "🏛️ 공공데이터포털",
    }));

    // Deduplicate
    const seen = new Set<string>();
    const merged: any[] = [];
    for (const item of [...taggedAI, ...taggedPub]) {
      const key = `${item.name}_${item.address}`.toLowerCase().replace(/\s/g, "");
      if (!seen.has(key)) {
        seen.add(key);
        merged.push(item);
      }
    }

    if (userEmail && merged.length > 0) saveResultsInBackground(userEmail, query, merged);

    return new Response(JSON.stringify({ results: merged }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    console.error("building-search error:", e);
    if (e.message === "AI_429") {
      return new Response(JSON.stringify({ error: "요청이 너무 많습니다. 잠시 후 다시 시도해주세요." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (e.message === "AI_402") {
      return new Response(JSON.stringify({ error: "AI 크레딧이 부족합니다." }),
        { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    return new Response(JSON.stringify({ error: e.message || "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});