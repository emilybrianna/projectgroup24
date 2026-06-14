import { supabase } from "@/lib/supabase";

type SendOtpEmailData = {
  toEmail: string;
  toName: string;
  otp: string;
};

export async function sendOtpEmail({ toEmail, toName, otp }: SendOtpEmailData) {
  const { data, error } = await supabase.functions.invoke("send-otp-email", {
    body: {
      toEmail,
      toName,
      otp,
    },
  });

  if (error) {
    let functionMessage = "";

    if ("context" in error && error.context instanceof Response) {
      try {
        const body = await error.context.clone().json();
        functionMessage = body?.message || body?.error || "";
      } catch {
        functionMessage = "";
      }
    }

    throw new Error(
      functionMessage ||
        error.message ||
        "Failed to send OTP email. Please make sure the Supabase send-otp-email function is deployed and configured."
    );
  }

  if (data?.error) {
    throw new Error(data.error);
  }
}
