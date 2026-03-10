import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PUBLIC_DATA_SERVICE_KEY =
  "8ba79f6074e014e65ce8a844502f6729ae1f1b5553407dacbc1e65282b3b40f6";

function safeJsonParse(str: string) {
  try {
    const m = str.match(/\[[\s\S]*\]|\{[\s\S]*\}/);
    return m ? JSON.parse(m[0]) : null;
  } catch {
    return null;
  }
}

/**
 * 1단계: Firecrawl 웹 검색으로 실시간 정보 수집
 */
async function searchWeb(query: string): Promise<string> {
  const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");
  if (!FIRECRAWL_API_KEY) {
    console.warn("FIRECRAWL_API_KEY not configured, skipping web search");
    return "";
  }

  try {
    const response = await fetch("https://api.firecrawl.dev/v1/search", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: `${query} 건설 프로젝트 시행사 시공사`,
        limit: 10,
        lang: "ko",
        country: "kr",
        scrapeOptions: {
          formats: ["markdown"],
          onlyMainContent: true,
        },
      }),
    });

    if (!response.ok) {
      console.error("Firecrawl search error:", response.status);
      return "";
    }

    const data = await response.json();
    const results = data?.data || data?.results || [];

    if (!Array.isArray(results) || results.length === 0) return "";

    // 검색 결과를 텍스트로 요약
    return results
      .slice(0, 8)
      .map((r: any, i: number) =>
        `[${i + 1}] ${r.title || ""}\n${r.description || r.snippet || ""}\n${r.markdown?.slice(0, 800) || ""}`
      )
      .join("\n\n---\n\n");
  } catch (e) {
    console.error("Web search error:", e);
    return "";
  }
}

/**
 * 2단계: AI가 웹 검색 결과 + 자체 지식으로 구조화된 프로젝트 정보 생성
 */
async function structureWithAI(query: string, webContext: string, apiKey: string) {
  const hasWebContext = webContext.trim().length > 0;

  const contextBlock = hasWebContext
    ? `\n\n아래는 "${query}"에 대한 실시간 웹 검색 결과입니다. 이 정보를 우선적으로 활용하되, 부족한 부분은 당신의 지식으로 보완하세요:\n\n${webContext}`
    : "";

  const response = await fetch(
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
            content: `당신은 대한민국 건축물 및 건설 프로젝트 정보 전문가입니다.
사용자의 검색 키워드를 분석하여 건설 프로젝트 정보를 구조화하세요.

${hasWebContext ? "웹 검색 결과가 제공되면 우선 활용하고, 부족한 부분은 당신의 학습된 지식으로 보완하세요." : "웹 검색 결과가 없으므로, 당신의 학습된 지식을 최대한 활용하여 해당 프로젝트 정보를 제공하세요."}

추출 항목:
- name: 프로젝트/건물 명칭
- address: 위치/주소 (최대한 상세하게)
- developer: 시행사/건축주/조합
- builder: 시공사/건설사
- designer: 설계사
- scale: 건물규모 (지상n층/지하n층)
- purpose: 용도 (주거, 업무, 상업 등)
- area: 연면적 또는 대지면적
- structure: 구조
- status: 현황 (인허가전/착공예정/착공/준공 등)
- date: 관련 일자
- summary: 프로젝트 요약 설명 (2-3문장)

중요: 
- 확인된 정보를 사용하되, 불확실한 항목은 "확인필요"로 표시하세요.
- 재개발/재건축 사업도 포함하세요. 인허가 전이라도 알려진 정보를 모두 포함하세요.
- 반드시 JSON 배열로 반환하세요. 관련 프로젝트가 여러 개면 모두 포함하세요.
- 해당 키워드로 전혀 관련 프로젝트를 알 수 없는 경우에만 빈 배열 []을 반환하세요.

결과 형식:
[{"name":"...","address":"...","developer":"...","builder":"...","designer":"...","scale":"...","purpose":"...","area":"...","structure":"...","status":"...","date":"...","summary":"..."}]`,
          },
          {
            role: "user",
            content: `"${query}" 프로젝트 정보를 찾아주세요.${contextBlock}`,
          },
        ],
      }),
    }
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
  const encodedQuery = encodeURIComponent(query);
  const url = `http://apis.data.go.kr/1613000/ArchPmsService_v2/getApBasisOulnInfo?serviceKey=${PUBLIC_DATA_SERVICE_KEY}&numOfRows=10&pageNo=1&type=json&platPlc=${encodedQuery}`;

  try {
    const response = await fetch(url);
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
      developer: item.bjdongCd || "정보 없음",
      builder: "정보 없음",
      scale: `지상${item.grndFlrCnt || "?"}층/지하${item.ugndFlrCnt || "?"}층`,
      purpose: item.mainPurpsCdNm || "정보 없음",
      area: item.totArea ? `연면적 ${item.totArea} m²` : "정보 없음",
      structure: item.strctCdNm || "정보 없음",
      status: item.useAprvDay ? "준공" : item.stcnsDay ? "착공" : "예정",
      date: item.useAprvDay || item.stcnsDay || item.pmsDay || "",
      permitDate: item.pmsDay || "",
      startDate: item.stcnsDay || "",
      approvalDate: item.useAprvDay || "",
      source: "공공데이터포털",
    }));
  } catch (e) {
    console.error("Public data API error:", e);
    return [];
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { query, userEmail } = await req.json();
    if (!query || typeof query !== "string") {
      return new Response(
        JSON.stringify({ error: "query is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "LOVABLE_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Query: "${query}", User: ${userEmail}`);

    // 1단계: 웹 검색 + 공공데이터 병렬 실행
    const [webContext, publicResults] = await Promise.allSettled([
      searchWeb(query),
      searchPublicData(query),
    ]);

    const webText = webContext.status === "fulfilled" ? webContext.value : "";
    const pub = publicResults.status === "fulfilled" ? publicResults.value : [];

    console.log(`Web search: ${webText.length} chars, Public data: ${pub.length} items`);

    // 2단계: AI가 웹 검색 결과 + 자체 지식으로 구조화
    const aiStructured = await structureWithAI(query, webText, LOVABLE_API_KEY);
    console.log(`AI structured: ${Array.isArray(aiStructured) ? aiStructured.length : 0} items`);

    // Tag results
    const taggedAI = (Array.isArray(aiStructured) ? aiStructured : []).map((item: any, idx: number) => ({
      ...item,
      id: `web-${idx}-${Date.now()}`,
      source: webText ? "🌐 웹 검색 + AI" : "🤖 AI Intelligence",
    }));

    const taggedPub = (Array.isArray(pub) ? pub : []).map((item: any, idx: number) => ({
      ...item,
      id: `pub-${idx}-${Date.now()}`,
      source: "🏛️ 공공데이터포털",
    }));

    // Merge with deduplication
    const seen = new Set<string>();
    const merged: any[] = [];
    for (const item of [...taggedAI, ...taggedPub]) {
      const key = `${item.name}_${item.address}`.toLowerCase().replace(/\s/g, "");
      if (!seen.has(key)) {
        seen.add(key);
        merged.push(item);
      }
    }

    // Save results to DB for accumulation
    if (userEmail && merged.length > 0) {
      try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const sb = createClient(supabaseUrl, supabaseKey);

        const rows = merged.map((item: any) => ({
          user_email: userEmail,
          search_query: query,
          project_name: item.name || "",
          project_address: item.address || "",
          developer: item.developer || "",
          builder: item.builder || "",
          designer: item.designer || "",
          scale: item.scale || "",
          purpose: item.purpose || "",
          area: item.area || "",
          status: item.status || "",
          date: item.date || "",
          source: item.source || "",
          summary: item.summary || "",
        }));

        await sb.from("search_results").insert(rows);
      } catch (saveErr) {
        console.error("Failed to save results:", saveErr);
      }
    }

    return new Response(JSON.stringify({ results: merged }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("building-search error:", e);

    if (e.message === "AI_429") {
      return new Response(
        JSON.stringify({ error: "요청이 너무 많습니다. 잠시 후 다시 시도해주세요." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (e.message === "AI_402") {
      return new Response(
        JSON.stringify({ error: "AI 크레딧이 부족합니다." }),
        { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: e.message || "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
