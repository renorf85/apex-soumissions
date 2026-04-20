import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface EmailRequest {
  to: string;
  clientName: string;
  soumissionNumber: string;
  pdfBase64: string;
  fileName: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      throw new Error("RESEND_API_KEY not configured");
    }

    const { to, clientName, soumissionNumber, pdfBase64, fileName } =
      (await req.json()) as EmailRequest;

    if (!to || !pdfBase64) {
      return new Response(
        JSON.stringify({ error: "Champs requis manquants (to, pdfBase64)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const subject = soumissionNumber
      ? `Votre soumission ${soumissionNumber} – Apex Désamiantage`
      : "Votre soumission – Apex Désamiantage";

    const htmlBody = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1e293b;">
        <div style="text-align: center; padding: 24px 0 16px;">
          <img src="https://apexsoumission.netlify.app/assets/logo-apex-full.png" alt="Apex Désamiantage" style="max-width: 200px; height: auto;" />
        </div>
        <hr style="border: none; border-top: 2px solid #e2e8f0; margin: 0 0 24px;" />
        <h2 style="color: #1e293b; margin-bottom: 16px;">Bonjour ${clientName || ""},</h2>
        <p style="line-height: 1.6;">Veuillez trouver ci-joint votre soumission${soumissionNumber ? ` <strong>${soumissionNumber}</strong>` : ""}.</p>
        <p style="line-height: 1.6;">N'hésitez pas à nous contacter pour toute question.</p>
        <br/>
        <p>Cordialement,</p>
        <p style="margin-bottom: 4px;"><strong>Apex Désamiantage</strong></p>
        <div style="margin-top: 24px; padding-top: 16px; border-top: 2px solid #e2e8f0; font-size: 13px; color: #64748b; line-height: 1.8;">
          <p style="margin: 0;">689 rue des Caryers, Québec (QC) G3G 2B4</p>
          <p style="margin: 0;">(418) 558-8378</p>
          <p style="margin: 0;"><a href="mailto:info@apexdesamiantage.com" style="color: #3b82f6; text-decoration: none;">info@apexdesamiantage.com</a></p>
          <p style="margin: 0;">RBQ : 5847-5401-01</p>
        </div>
        <p style="color: #94a3b8; font-size: 11px; margin-top: 24px;">Ce courriel a été envoyé automatiquement depuis notre système de soumissions.</p>
      </div>
    `;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Apex Désamiantage <soumissions@apexdesamiantage.com>",
        to: [to],
        subject: subject,
        html: htmlBody,
        attachments: [
          {
            filename: fileName || "Soumission.pdf",
            content: pdfBase64,
          },
        ],
      }),
    });

    const resData = await res.json();

    if (!res.ok) {
      console.error("Resend error:", resData);
      return new Response(
        JSON.stringify({ error: resData.message || "Erreur envoi courriel" }),
        { status: res.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, id: resData.id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Edge function error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Erreur interne" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
