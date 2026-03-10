import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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

async function searchWithAI(query: string, apiKey: string) {
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
사용자의 검색 키워드에 대해 건축물대장 기본개요 정보를 기반으로 관련 건설 프로젝트 정보를 제공하세요.

검색 및 추출 항목:
1. bldNm (건물명칭), platPlc (대지위치/주소)
2. archArea (건축면적), totArea (연면적)
3. strctCdNm (구조명칭), mainPurpsCdNm (주용도명칭)
4. grndFlrCnt (지상층수), ugndFlrCnt (지하층수)
5. pmsDay (허가일), stcnsDay (착공일), useAprvDay (사용승인일)
6. 시행사(건축주), 시공사(건설사), 설계사 정보

반드시 아래 키를 가진 JSON 배열로 반환하세요:
[{"name":"건물명","address":"주소","developer":"시행사","builder":"시공사","designer":"설계사","scale":"지상n층/지하n층","purpose":"용도","area":"연면적","structure":"구조","status":"착공/준공/예정","date":"YYYY-MM-DD","permitDate":"허가일","startDate":"착공일","approvalDate":"사용승인일"}]
검색 결과가 없으면 빈 배열 []을 반환하세요. JSON만 반환하고 다른 텍스트는 포함하지 마세요.`,
          },
          {
            role: "user",
            content: query,
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
    throw new Error("AI search failed");
  }

  const result = await response.json();
  const content = result.choices?.[0]?.message?.content || "[]";
  return safeJsonParse(content) || [];
}

async function searchPublicData(query: string) {
  // 공공데이터포털 건축물대장 기본개요 API
  // This API requires sigunguCd/bjdongCd, so we try a keyword-based approach
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
    const { query } = await req.json();
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

    // Run both searches in parallel
    const [aiResults, publicResults] = await Promise.allSettled([
      searchWithAI(query, LOVABLE_API_KEY),
      searchPublicData(query),
    ]);

    const ai = aiResults.status === "fulfilled" ? aiResults.value : [];
    const pub = publicResults.status === "fulfilled" ? publicResults.value : [];

    // Tag AI results
    const taggedAI = (Array.isArray(ai) ? ai : []).map((item: any, idx: number) => ({
      ...item,
      id: `ai-${idx}-${Date.now()}`,
      source: "🤖 AI Intelligence",
    }));

    // Tag public data results
    const taggedPub = (Array.isArray(pub) ? pub : []).map((item: any, idx: number) => ({
      ...item,
      id: `pub-${idx}-${Date.now()}`,
      source: "🏛️ 공공데이터포털",
    }));

    // Merge: AI results first, then public data (deduplicate by name+address)
    const seen = new Set<string>();
    const merged: any[] = [];
    for (const item of [...taggedAI, ...taggedPub]) {
      const key = `${item.name}_${item.address}`.toLowerCase().replace(/\s/g, "");
      if (!seen.has(key)) {
        seen.add(key);
        merged.push(item);
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
