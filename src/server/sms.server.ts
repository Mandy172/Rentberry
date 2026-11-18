import { BRAND, MOCK_OTP_CODE } from "@/lib/config";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/twilio";

/** Mock mode (fixed code 123456, no SMS) until Twilio is connected and a sending number is set. */
export function isMockSms() {
  return !(process.env["LOVABLE_API_KEY"] && process.env["TWILIO_API_KEY"] && process.env["TWILIO_FROM_NUMBER"]);
}

export function generateOtp() {
  if (isMockSms()) return MOCK_OTP_CODE;
  const n = (crypto.getRandomValues(new Uint32Array(1))[0] ?? 0) % 1_000_000;
  return n.toString().padStart(6, "0");
}

export function toHex(buf: ArrayBuffer) {
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function hashCode(value: string) {
  return toHex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
}

export async function sendOtpSms(phone: string, code: string) {
  if (isMockSms()) return { ok: true as const, mock: true };
  const res = await fetch(`${GATEWAY_URL}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env["LOVABLE_API_KEY"]}`,
      "X-Connection-Api-Key": process.env["TWILIO_API_KEY"]!,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      To: phone,
      From: process.env["TWILIO_FROM_NUMBER"]!,
      Body: `${code} is your ${BRAND.name} verification code. It expires in 10 minutes.`,
    }),
  });
  if (!res.ok) {
    console.error("[sms] Twilio error", res.status, await res.text());
    return { ok: false as const, mock: false };
  }
  return { ok: true as const, mock: false };
}
