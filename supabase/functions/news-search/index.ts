import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function formatRelativeDate(pubDate: string): string {
  try {
    const date = new Date(pubDate);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffHours < 1) return "방금 전";
    if (diffHours < 24) return `${diffHours}시간 전`;
    if (diffDays < 7) return `${diffDays}일 전`;
    return date.toLocaleDateString("ko-KR", { month: "short", day: "numeric" });
  } catch {
    return "";
  }
}

/**
 * Firecrawl 웹 검색으로 뉴스 기사 검색
 */
async function searchNewsWithFirecrawl(query: string) {
  const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");
  if (!FIRECRAWL_API_KEY) {
    throw new Error("FIRECRAWL_API_KEY not configured");
  }

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
      tbs: "qdr:m", // 최근 1개월
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error("Firecrawl search error:", response.status, errText);
    throw new Error(`Firecrawl search failed (${response.status})`);
  }

  const data = await response.json();
  const results = data?.data || data?.results || [];

  if (!Array.isArray(results)) return [];

  return results
    .filter((r: any) => r.title && r.url)
    .slice(0, 5)
    .map((r: any) => ({
      title: (r.title || "").replace(/<[^>]*>/g, "").trim(),
      description: (r.description || r.snippet || "").replace(/<[^>]*>/g, "").trim(),
      url: r.url,
      date: r.publishedDate ? formatRelativeDate(r.publishedDate) : "",
    }));
}

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

    const articles = await searchNewsWithFirecrawl(query);
    console.log(`Found ${articles.length} news articles via Firecrawl`);

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
