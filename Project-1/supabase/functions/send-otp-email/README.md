# send-otp-email

Supabase Edge Function used by the Forgot Password screen to send OTP emails without EmailJS.

## Option 1: Resend

```bash
supabase secrets set EMAIL_PROVIDER=resend
supabase secrets set RESEND_API_KEY=your_resend_api_key
supabase secrets set OTP_FROM_EMAIL="SmartFash <your_verified_sender@yourdomain.com>"
supabase functions deploy send-otp-email
```

For quick testing, Resend also supports `SmartFash <onboarding@resend.dev>`, but production should use a verified sender/domain.

This project sets `verify_jwt = false` for this function in `supabase/config.toml` so the Expo app can call it with the public Supabase client during password recovery.

## Option 2: Gmail API

Set `EMAIL_PROVIDER=gmail` to send with Gmail API, even if a Resend key is still configured:

```bash
supabase secrets set EMAIL_PROVIDER=gmail
supabase secrets set GMAIL_CLIENT_ID=your_google_oauth_client_id
supabase secrets set GMAIL_CLIENT_SECRET=your_google_oauth_client_secret
supabase secrets set GMAIL_REFRESH_TOKEN=your_google_oauth_refresh_token
supabase secrets set GMAIL_FROM_EMAIL=your_gmail_address
supabase secrets set GMAIL_FROM_NAME=SmartFash
supabase functions deploy send-otp-email
```

The Expo app calls this function with `supabase.functions.invoke("send-otp-email")`.
