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

    const apiKey = Deno.env.get("FIRECRAWL_API_KEY");
    if (!apiKey) {
      console.error("FIRECRAWL_API_KEY not configured");
      return new Response(
        JSON.stringify({ success: false, error: "Firecrawl not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("News search query:", query);

    const response = await fetch("https://api.firecrawl.dev/v1/search", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: `${query} 건설 부동산 뉴스`,
        limit: 5,
        lang: "ko",
        country: "kr",
        tbs: "qdr:m",
      }),
    });

    let data: Record<string, unknown>;
    try {
      data = await response.json();
    } catch {
      console.error("Failed to parse Firecrawl response");
      return new Response(
        JSON.stringify({ success: false, error: "Invalid response from search API" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!response.ok) {
      console.error("Firecrawl search error:", JSON.stringify(data));
      return new Response(
        JSON.stringify({ success: false, error: (data.error as string) || `Search failed (${response.status})` }),
        { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const rawResults = Array.isArray(data.data) ? data.data : [];

    const articles = rawResults
      .filter((item: any) => item.url && typeof item.url === "string" && item.url.startsWith("http"))
      .slice(0, 5)
      .map((item: any) => ({
        title: (typeof item.title === "string" && item.title) || "제목 없음",
        description: (typeof item.description === "string" && item.description) || "",
        url: item.url,
      }));

    console.log(`Found ${articles.length} valid news articles`);

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
