import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid JSON body" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const query = typeof body.query === "string" ? body.query.trim() : "";
    if (!query) {
      return new Response(
        JSON.stringify({ success: false, error: "Query is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("News search query:", query);

    const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");

    // Firecrawl로 실제 뉴스 검색 (실제 URL 포함)
    if (FIRECRAWL_API_KEY) {
      try {
        const response = await fetch("https://api.firecrawl.dev/v1/search", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            query: `${query} 뉴스 최신`,
            limit: 8,
            lang: "ko",
            country: "kr",
            tbs: "qdr:y", // 최근 1년 이내
          }),
        });

        if (response.ok) {
          const data = await response.json();
          const results = data?.data || data?.results || [];

          if (Array.isArray(results) && results.length > 0) {
            const articles = results
              .filter((r: any) => r.url && r.title)
              .map((r: any) => ({
                title: r.title || "",
                description: r.description || r.snippet || "",
                url: r.url || "",
                date: extractDate(r),
              }))
              .slice(0, 5);

            console.log(`Found ${articles.length} news articles via Firecrawl`);

            return new Response(
              JSON.stringify({ success: true, articles }),
              { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
        } else {
          console.error("Firecrawl news search error:", response.status);
        }
      } catch (e) {
        console.error("Firecrawl news error:", e);
      }
    }

    // Firecrawl 실패 시 AI 폴백 (Google 검색 링크 생성)
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ success: true, articles: [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiResponse = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash-lite",
          messages: [
            {
              role: "system",
              content: `당신은 대한민국 건설/부동산 뉴스 전문가입니다.
사용자의 검색 키워드에 대해 최근 실제 보도된 뉴스 기사 정보를 제공하세요.

반드시 아래 JSON 배열 형식으로만 응답하세요:
[{"title":"실제 기사 제목","description":"기사 요약 1-2문장","date":"YYYY-MM 또는 YYYY"}]

규칙:
- 최대 5개 기사를 반환
- 가장 최근 뉴스를 우선으로
- 실제로 보도된 내용만 작성 (환각 금지)
- 날짜는 가능한 정확하게
- 관련 뉴스가 없으면 빈 배열 []을 반환`,
            },
            {
              role: "user",
              content: `"${query}" 관련 최근 뉴스를 찾아주세요.`,
            },
          ],
        }),
      }
    );

    if (!aiResponse.ok) {
      return new Response(
        JSON.stringify({ success: true, articles: [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const result = await aiResponse.json();
    const content = result.choices?.[0]?.message?.content || "[]";

    let articles: any[] = [];
    try {
      const match = content.match(/\[[\s\S]*\]/);
      articles = match ? JSON.parse(match[0]) : [];
    } catch {
      articles = [];
    }

    // AI 결과에는 URL이 없으므로 Google 뉴스 검색 링크 생성
    articles = articles.map((a: any) => ({
      ...a,
      url: `https://www.google.com/search?q=${encodeURIComponent(a.title + " " + query)}&tbm=nws`,
    }));

    console.log(`Found ${articles.length} news articles via AI fallback`);

    return new Response(
      JSON.stringify({ success: true, articles }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("News search error:", error);
    const message = error instanceof Error ? error.message : "Failed to search news";
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function extractDate(result: any): string {
  // Try to extract date from metadata or content
  if (result.publishedDate) return result.publishedDate;
  if (result.metadata?.publishedTime) return result.metadata.publishedTime.slice(0, 10);
  if (result.metadata?.date) return result.metadata.date;
  return "";
}
