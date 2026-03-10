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

/** Fetch with timeout to prevent hanging */
async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs = 10000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * 1단계: Firecrawl 웹 검색 (단일 최적화 쿼리, description만 사용으로 속도 극대화)
 */
async function searchWeb(query: string): Promise<string> {
  const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");
  if (!FIRECRAWL_API_KEY) {
    console.warn("FIRECRAWL_API_KEY not configured, skipping web search");
    return "";
  }

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
          limit: 5,
          lang: "ko",
          country: "kr",
        }),
      },
      8000
    );

    if (!response.ok) {
      console.error("Firecrawl search error:", response.status);
      return "";
    }

    const data = await response.json();
    const results = data?.data || data?.results || [];

    if (!Array.isArray(results) || results.length === 0) return "";

    // URL 기준 중복 제거
    const seen = new Set<string>();
    const unique = results.filter((r: any) => {
      const key = r.url || r.title || "";
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    return unique
      .slice(0, 5)
      .map(
        (r: any, i: number) =>
          `[${i + 1}] ${r.title || ""}\n${r.description || r.snippet || ""}`
      )
      .join("\n\n");
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") {
      console.warn("Web search timed out");
    } else {
      console.error("Web search error:", e);
    }
    return "";
  }
}

/**
 * 2단계: AI가 웹 검색 결과 + 자체 지식으로 구조화된 프로젝트 정보 생성
 */
async function structureWithAI(
  query: string,
  webContext: string,
  apiKey: string
) {
  const hasWebContext = webContext.trim().length > 0;

  const contextBlock = hasWebContext
    ? `\n\n아래는 "${query}"에 대한 웹 검색 결과입니다. 이 정보와 당신의 지식을 모두 활용하세요:\n\n${webContext}`
    : "";

  const response = await fetchWithTimeout(
    "https://ai.gateway.lovable.dev/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `당신은 대한민국 건설 프로젝트 정보 전문가입니다.
검색 키워드를 분석하여 관련된 모든 건설 프로젝트를 최대한 많이 찾아 구조화하세요.

${hasWebContext ? "웹 검색 결과를 우선 활용하되, 반드시 당신의 학습된 지식으로 보완하여 더 많은 프로젝트를 찾으세요." : "당신의 학습된 지식을 최대한 활용하여 프로젝트 정보를 제공하세요."}

추출 항목: name(명칭), address(주소), developer(시행사), builder(시공사), designer(설계사), scale(규모), purpose(용도), area(면적), structure(구조), status(현황), date(일자), summary(요약 1문장)

지시사항:
- 특정 회사명이 포함되면 그 회사의 알려진 모든 프로젝트를 나열
- 준공/착공/인허가/계획 단계 모두 포함
- 최소 5개 이상 찾도록 노력
- 불확실한 항목은 "확인필요"로 표시
- JSON 배열만 반환

[{"name":"...","address":"...","developer":"...","builder":"...","designer":"...","scale":"...","purpose":"...","area":"...","structure":"...","status":"...","date":"...","summary":"..."}]`,
          },
          {
            role: "user",
            content: `"${query}" 관련 프로젝트를 가능한 많이 찾아주세요.${contextBlock}`,
          },
        ],
      }),
    },
    30000
  );

  if (!response.ok) {
    const errText = await response.text();
    console.error("AI gateway error:", response.status, errText);
    if (response.status === 429 || response.status === 402) {
      throw new Error(`AI_${response.status}`);
    }
    throw new Error("AI structuring failed");
  }

  const result = await response.json();
  const content = result.choices?.[0]?.message?.content || "[]";
  return safeJsonParse(content) || [];
}

/**
 * 3단계: 공공데이터포털 건축물대장 검색
 */
async function searchPublicData(query: string) {
  const serviceKey = Deno.env.get("PUBLIC_DATA_SERVICE_KEY");
  if (!serviceKey) {
    console.warn("PUBLIC_DATA_SERVICE_KEY not configured, skipping public data");
    return [];
  }

  const encodedQuery = encodeURIComponent(query);
  const url = `http://apis.data.go.kr/1613000/ArchPmsService_v2/getApBasisOulnInfo?serviceKey=${serviceKey}&numOfRows=10&pageNo=1&type=json&platPlc=${encodedQuery}`;

  try {
    const response = await fetchWithTimeout(url, {}, 8000);
    if (!response.ok) return [];

    const data = await response.json();
    const items =
      data?.response?.body?.items?.item ||
      data?.response?.body?.items ||
      [];

    if (!Array.isArray(items)) return [];

    return items.map((item: any) => ({
      name: item.bldNm || "정보 없음",
      address: item.platPlc || item.newPlatPlc || "정보 없음",
      developer: item.bldNm ? "확인필요" : "정보 없음",
      builder: "확인필요",
      scale: `지상${item.grndFlrCnt || "?"}층/지하${item.ugndFlrCnt || "?"}층`,
      purpose: item.mainPurpsCdNm || "정보 없음",
      area: item.totArea ? `연면적 ${item.totArea} m²` : "정보 없음",
      structure: item.strctCdNm || "정보 없음",
      status: item.useAprvDay ? "준공" : item.stcnsDay ? "착공" : "예정",
      date: item.useAprvDay || item.stcnsDay || item.pmsDay || "",
      source: "공공데이터포털",
    }));
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") {
      console.warn("Public data API timed out");
    } else {
      console.error("Public data API error:", e);
    }
    return [];
  }
}

/** DB 저장 (non-blocking, 응답 지연 방지) */
function saveResultsInBackground(
  userEmail: string,
  query: string,
  merged: any[]
) {
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

    // Fire and forget — don't await
    sb.from("search_results")
      .insert(rows)
      .then(({ error }) => {
        if (error) console.error("Failed to save results:", error.message);
      });
  } catch (e) {
    console.error("Save setup error:", e);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    let body: any;
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: "Invalid JSON body" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const query =
      typeof body?.query === "string" ? body.query.trim() : "";
    const userEmail =
      typeof body?.userEmail === "string" ? body.userEmail.trim() : "";

    if (!query) {
      return new Response(
        JSON.stringify({ error: "query is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "LOVABLE_API_KEY not configured" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log(`Query: "${query}", User: ${userEmail}`);

    // 1단계: 웹 검색 + 공공데이터 병렬 실행
    const [webContext, publicResults] = await Promise.allSettled([
      searchWeb(query),
      searchPublicData(query),
    ]);

    const webText =
      webContext.status === "fulfilled" ? webContext.value : "";
    const pub =
      publicResults.status === "fulfilled" ? publicResults.value : [];

    console.log(
      `Web search: ${webText.length} chars, Public data: ${pub.length} items`
    );

    // 2단계: AI가 웹 검색 결과 + 자체 지식으로 구조화
    const aiStructured = await structureWithAI(
      query,
      webText,
      LOVABLE_API_KEY
    );
    console.log(
      `AI structured: ${Array.isArray(aiStructured) ? aiStructured.length : 0} items`
    );

    // Tag results
    const taggedAI = (Array.isArray(aiStructured) ? aiStructured : []).map(
      (item: any, idx: number) => ({
        ...item,
        id: `ai-${idx}-${Date.now()}`,
        source: webText ? "🌐 웹 검색 + AI" : "🤖 AI Intelligence",
      })
    );

    const taggedPub = (Array.isArray(pub) ? pub : []).map(
      (item: any, idx: number) => ({
        ...item,
        id: `pub-${idx}-${Date.now()}`,
        source: "🏛️ 공공데이터포털",
      })
    );

    // Merge with deduplication
    const seen = new Set<string>();
    const merged: any[] = [];
    for (const item of [...taggedAI, ...taggedPub]) {
      const key = `${item.name}_${item.address}`
        .toLowerCase()
        .replace(/\s/g, "");
      if (!seen.has(key)) {
        seen.add(key);
        merged.push(item);
      }
    }

    // Non-blocking DB save
    if (userEmail && merged.length > 0) {
      saveResultsInBackground(userEmail, query, merged);
    }

    return new Response(JSON.stringify({ results: merged }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("building-search error:", e);

    if (e.message === "AI_429") {
      return new Response(
        JSON.stringify({
          error: "요청이 너무 많습니다. 잠시 후 다시 시도해주세요.",
        }),
        {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
    if (e.message === "AI_402") {
      return new Response(
        JSON.stringify({ error: "AI 크레딧이 부족합니다." }),
        {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({ error: e.message || "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
