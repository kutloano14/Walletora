import { serve } from "https://deno.land/std@0.184.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { to, subject, message, user_email, user_id } = body;

    // Validate required fields
    if (!to || !subject || !message) {
      return new Response(
        JSON.stringify({
          error: "Missing required fields: to, subject, message",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Log email for debugging
    console.log("📧 Support Email:");
    console.log("To:", to);
    console.log("From:", user_email);
    console.log("Subject:", subject);
    console.log("Message:", message);

    // Success response
    return new Response(
      JSON.stringify({
        success: true,
        message: "Email logged successfully",
        email_to: to,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in send-support-email:", error);

    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({
        error: errorMessage,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
