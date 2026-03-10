import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    const { userEmail } = await req.json();
    if (!userEmail) {
      return new Response(
        JSON.stringify({ error: "userEmail is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get accumulated results from DB
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: results, error: dbError } = await supabase
      .from("search_results")
      .select("*")
      .eq("user_email", userEmail)
      .order("searched_at", { ascending: false });

    if (dbError) {
      console.error("DB query error:", dbError);
      return new Response(
        JSON.stringify({ error: "데이터 조회 실패" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!results || results.length === 0) {
      return new Response(
        JSON.stringify({ error: "누적된 검색 결과가 없습니다." }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate CSV
    const headers = ["검색일시", "검색어", "프로젝트명", "주소", "시행사", "시공사", "설계사", "규모", "용도", "연면적", "현황", "일자", "출처"];
    const rows = results.map((r: any) => [
      new Date(r.searched_at).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" }),
      r.search_query,
      r.project_name,
      r.project_address,
      r.developer,
      r.builder,
      r.designer,
      r.scale,
      r.purpose,
      r.area,
      r.status,
      r.date,
      r.source,
    ]);

    const csvContent = "\uFEFF" + [headers, ...rows]
      .map(row => row.map((cell: string) => `"${(cell || "").replace(/"/g, '""')}"`).join(","))
      .join("\n");

    // Convert to base64 for email attachment
    const encoder = new TextEncoder();
    const csvBytes = encoder.encode(csvContent);
    const base64Csv = btoa(String.fromCharCode(...csvBytes));

    // Send email via Resend
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) {
      return new Response(
        JSON.stringify({ error: "RESEND_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const today = new Date().toISOString().slice(0, 10);
    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "PJT-Tracker <onboarding@resend.dev>",
        to: ["aytech3@gmail.com"],
        subject: `[PJT-Tracker] 누적 검색결과 (${today}) - ${results.length}건`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #A50034;">📊 PJT-Tracker 누적 검색결과</h2>
            <p style="color: #555;">안녕하세요, ${userEmail}님</p>
            <p style="color: #555;">지금까지 검색하신 모든 현장 정보를 정리하여 보내드립니다.</p>
            <div style="background: #f5f5f5; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <p style="margin: 5px 0;"><strong>총 검색 결과:</strong> ${results.length}건</p>
              <p style="margin: 5px 0;"><strong>발송 일시:</strong> ${new Date().toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })}</p>
            </div>
            <p style="color: #555;">첨부된 CSV 파일을 Excel에서 열어 확인하세요.</p>
            <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;" />
            <p style="color: #999; font-size: 12px;">LG PJT-Tracker Intelligence</p>
          </div>
        `,
        attachments: [
          {
            filename: `PJT-Tracker_누적결과_${today}.csv`,
            content: base64Csv,
          },
        ],
      }),
    });

    if (!emailResponse.ok) {
      const errText = await emailResponse.text();
      console.error("Resend error:", emailResponse.status, errText);
      return new Response(
        JSON.stringify({ error: "이메일 전송 실패. 잠시 후 다시 시도해주세요." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, count: results.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    console.error("send-results-email error:", e);
    return new Response(
      JSON.stringify({ error: e.message || "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
