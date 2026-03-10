import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function parseRssItems(xml: string): { title: string; description: string; url: string; pubDate: string }[] {
  const items: { title: string; description: string; url: string; pubDate: string }[] = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;

  while ((match = itemRegex.exec(xml)) !== null) {
    const itemXml = match[1];

    const titleMatch = itemXml.match(/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>/) ||
                       itemXml.match(/<title>([\s\S]*?)<\/title>/);
    const linkMatch = itemXml.match(/<link>([\s\S]*?)<\/link>/);
    const pubDateMatch = itemXml.match(/<pubDate>([\s\S]*?)<\/pubDate>/);
    const descMatch = itemXml.match(/<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>/) ||
                      itemXml.match(/<description>([\s\S]*?)<\/description>/);

    const title = titleMatch?.[1]?.trim() || "";
    const url = linkMatch?.[1]?.trim() || "";
    const pubDate = pubDateMatch?.[1]?.trim() || "";

    // description에서 HTML 태그 제거하고 출처 추출
    const rawDesc = descMatch?.[1]?.trim() || "";
    const cleanDesc = rawDesc.replace(/<[^>]*>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').trim();

    if (title && url) {
      items.push({ title, description: cleanDesc, url, pubDate });
    }
  }

  return items;
}

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

    console.log("Google News search query:", query);

    // Google News RSS 검색
    const rssUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=ko&gl=KR&ceid=KR:ko`;

    const response = await fetch(rssUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; NewsBot/1.0)",
        "Accept": "application/rss+xml, application/xml, text/xml",
      },
    });

    if (!response.ok) {
      console.error(`Google News RSS error: ${response.status}`);
      return new Response(
        JSON.stringify({ success: false, error: `News fetch failed (${response.status})` }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const xml = await response.text();
    const allItems = parseRssItems(xml);

    const articles = allItems.slice(0, 5).map((item) => ({
      title: item.title,
      description: item.description || formatRelativeDate(item.pubDate),
      url: item.url,
      date: formatRelativeDate(item.pubDate),
    }));

    console.log(`Found ${articles.length} Google News articles`);

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
