declare const Deno: {
  env: {
    get(name: string): string | undefined;
  };
  serve(handler: (req: Request) => Response | Promise<Response>): void;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type SendOtpRequest = {
  toEmail?: string;
  toName?: string;
  otp?: string;
};

type EmailMessage = {
  toEmail: string;
  toName: string;
  otp: string;
};

function getRequiredSecret(name: string) {
  const value = Deno.env.get(name);

  if (!value) {
    throw new Error(`${name} is not configured in Supabase Edge Function secrets.`);
  }

  return value;
}

function buildTextEmail({ toName, otp }: Pick<EmailMessage, "toName" | "otp">) {
  return [
    `Hi ${toName || "there"},`,
    "",
    `Your SmartFash OTP is ${otp}.`,
    "This OTP expires in 10 minutes.",
    "",
    "If you did not request this, you can ignore this email.",
  ].join("\n");
}

function buildHtmlEmail({ toName, otp }: Pick<EmailMessage, "toName" | "otp">) {
  return `
    <div style="font-family: Arial, sans-serif; color: #111827; line-height: 1.5;">
      <p>Hi ${toName || "there"},</p>
      <p>Your SmartFash password reset OTP is:</p>
      <p style="font-size: 28px; font-weight: 700; letter-spacing: 4px;">${otp}</p>
      <p>This OTP expires in 10 minutes.</p>
      <p>If you did not request this, you can ignore this email.</p>
    </div>
  `;
}

async function sendResendOtp({ toEmail, toName, otp }: EmailMessage) {
  const apiKey = getRequiredSecret("RESEND_API_KEY");
  const fromEmail = Deno.env.get("OTP_FROM_EMAIL") || "SmartFash <onboarding@resend.dev>";

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: fromEmail,
      to: [toEmail],
      subject: "SmartFash Password Reset OTP",
      text: buildTextEmail({ toName, otp }),
      html: buildHtmlEmail({ toName, otp }),
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || data.error || "Resend failed to send OTP email.");
  }
}

function base64UrlEncode(value: string) {
  const bytes = new TextEncoder().encode(value);
  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function getGmailAccessToken() {
  const clientId = getRequiredSecret("GMAIL_CLIENT_ID");
  const clientSecret = getRequiredSecret("GMAIL_CLIENT_SECRET");
  const refreshToken = getRequiredSecret("GMAIL_REFRESH_TOKEN");

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }).toString(),
  });

  const data = await response.json();

  if (!response.ok || !data.access_token) {
    throw new Error(data.error_description || data.error || "Unable to get Gmail access token.");
  }

  return data.access_token as string;
}

async function sendGmailOtp(toEmail: string, toName: string, otp: string) {
  const fromEmail = getRequiredSecret("GMAIL_FROM_EMAIL");
  const fromName = Deno.env.get("GMAIL_FROM_NAME") || "SmartFash";
  const accessToken = await getGmailAccessToken();

  const email = [
    `From: ${fromName} <${fromEmail}>`,
    `To: ${toEmail}`,
    "Subject: SmartFash Password Reset OTP",
    "MIME-Version: 1.0",
    'Content-Type: text/plain; charset="UTF-8"',
    "",
    buildTextEmail({ toName, otp }),
  ].join("\r\n");

  const response = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      raw: base64UrlEncode(email),
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error?.message || "Gmail failed to send OTP email.");
  }
}

async function sendOtpEmail(message: EmailMessage) {
  const provider = Deno.env.get("EMAIL_PROVIDER")?.toLowerCase();

  if (provider === "gmail") {
    await sendGmailOtp(message.toEmail, message.toName, message.otp);
    return;
  }

  if (provider === "resend" || Deno.env.get("RESEND_API_KEY")) {
    await sendResendOtp(message);
    return;
  }

  await sendGmailOtp(message.toEmail, message.toName, message.otp);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { toEmail, toName, otp } = (await req.json()) as SendOtpRequest;

    if (!toEmail || !toName || !otp) {
      return new Response(JSON.stringify({ error: "toEmail, toName, and otp are required." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await sendOtpEmail({ toEmail, toName, otp });

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Failed to send OTP email.",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
