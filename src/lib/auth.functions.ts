import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { MOCK_OTP_CODE } from "./config";
import { normalizePhone } from "./validation";
import type { Me } from "./types";

const OTP_TTL_MS = 10 * 60 * 1000;
const RESEND_COOLDOWN_MS = 30 * 1000;
const MAX_ATTEMPTS = 5;
const MAX_SELFIE_BYTES = 3 * 1024 * 1024;

type Fail = { ok: false; error: string };

/** Phone numbers map to a stable internal sign-in address; members never see or use it. */
function phoneLoginEmail(phone: string) {
  return `p${phone.replace(/\D/g, "")}@phone.borrowbee.local`;
}

export const sendCode = createServerFn({ method: "POST" })
  .inputValidator((d: { phone: string }) => z.object({ phone: z.string().max(32) }).parse(d))
  .handler(async ({ data }): Promise<{ ok: true; phone: string; mockCode: string | null } | Fail> => {
    const phone = normalizePhone(data.phone);
    if (!phone) return { ok: false, error: "Enter a valid 10-digit mobile number." };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sms = await import("@/server/sms.server");

    const { data: existing } = await supabaseAdmin
      .from("otp_challenges")
      .select("last_sent_at")
      .eq("phone", phone)
      .maybeSingle();
    if (existing && Date.now() - Date.parse(existing.last_sent_at) < RESEND_COOLDOWN_MS) {
      return { ok: false, error: "Please wait a few seconds before requesting another code." };
    }

    const code = sms.generateOtp();
    const { error } = await supabaseAdmin.from("otp_challenges").upsert({
      phone,
      code_hash: await sms.hashCode(`${phone}:${code}`),
      expires_at: new Date(Date.now() + OTP_TTL_MS).toISOString(),
      attempts: 0,
      last_sent_at: new Date().toISOString(),
    });
    if (error) {
      console.error("[sendCode]", error);
      return { ok: false, error: "We could not send the SMS. Try again shortly." };
    }

    const sent = await sms.sendOtpSms(phone, code);
    if (!sent.ok) return { ok: false, error: "We could not send the SMS. Try again shortly." };
    return { ok: true, phone, mockCode: sms.isMockSms() ? MOCK_OTP_CODE : null };
  });

export const verifyCode = createServerFn({ method: "POST" })
  .inputValidator((d: { phone: string; code: string }) =>
    z.object({ phone: z.string().max(32), code: z.string().max(12) }).parse(d),
  )
  .handler(async ({ data }): Promise<{ ok: true; tokenHash: string; needsSelfie: boolean } | Fail> => {
    const phone = normalizePhone(data.phone);
    if (!phone) return { ok: false, error: "Code expired. Request a new one." };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sms = await import("@/server/sms.server");

    const { data: challenge } = await supabaseAdmin
      .from("otp_challenges")
      .select("*")
      .eq("phone", phone)
      .maybeSingle();
    if (!challenge || Date.parse(challenge.expires_at) < Date.now()) {
      return { ok: false, error: "Code expired. Request a new one." };
    }
    if (challenge.attempts >= MAX_ATTEMPTS) {
      await supabaseAdmin.from("otp_challenges").delete().eq("phone", phone);
      return { ok: false, error: "Too many attempts. Request a new code." };
    }
    await supabaseAdmin
      .from("otp_challenges")
      .update({ attempts: challenge.attempts + 1 })
      .eq("phone", phone);

    if (!/^\d{6}$/.test(data.code) || (await sms.hashCode(`${phone}:${data.code}`)) !== challenge.code_hash) {
      return { ok: false, error: "That code is not right. Check the SMS and try again." };
    }
    await supabaseAdmin.from("otp_challenges").delete().eq("phone", phone);

    const email = phoneLoginEmail(phone);
    const { data: member } = await supabaseAdmin
      .from("member_private")
      .select("user_id, verified_at")
      .eq("phone", phone)
      .maybeSingle();
    if (!member) {
      const { error: createErr } = await supabaseAdmin.auth.admin.createUser({ email, email_confirm: true });
      if (createErr && !/already/i.test(createErr.message)) {
        console.error("[verifyCode] createUser", createErr);
        return { ok: false, error: "We could not sign you in. Try again shortly." };
      }
    }

    const { data: link, error: linkErr } = await supabaseAdmin.auth.admin.generateLink({ type: "magiclink", email });
    if (linkErr || !link?.properties?.hashed_token || !link.user) {
      console.error("[verifyCode] generateLink", linkErr);
      return { ok: false, error: "We could not sign you in. Try again shortly." };
    }
    const userId = link.user.id;
    if (!member) {
      await supabaseAdmin.from("profiles").upsert({ id: userId }, { onConflict: "id", ignoreDuplicates: true });
      const { error: mpErr } = await supabaseAdmin
        .from("member_private")
        .upsert({ user_id: userId, phone }, { onConflict: "user_id", ignoreDuplicates: true });
      if (mpErr) {
        console.error("[verifyCode] member_private", mpErr);
        return { ok: false, error: "We could not sign you in. Try again shortly." };
      }
    } else if (member.user_id !== userId) {
      console.error("[verifyCode] phone/user mismatch");
      return { ok: false, error: "We could not sign you in. Try again shortly." };
    }

    return { ok: true, tokenHash: link.properties.hashed_token, needsSelfie: !member?.verified_at };
  });

function decodeBase64(b64: string) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

/**
 * Accepts a live camera capture as a JPEG data URL. Only a SHA-256 fingerprint of the
 * image is kept as proof a capture happened; the image itself is never stored.
 */
export const submitSelfie = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { dataUrl: string; name: string }) =>
    z.object({ dataUrl: z.string().max(5_000_000), name: z.string().max(200) }).parse(d),
  )
  .handler(async ({ data, context }): Promise<{ ok: true } | Fail> => {
    const name = data.name.trim();
    if (name.length < 2 || name.length > 60) return { ok: false, error: "Enter your name (2–60 characters)." };

    const match = /^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/.exec(data.dataUrl);
    if (!match) return { ok: false, error: "Selfie must be captured with your camera." };
    const bytes = decodeBase64(match[1] ?? "");
    if (bytes.length < 5_000 || bytes.length > MAX_SELFIE_BYTES) return { ok: false, error: "Selfie capture failed. Try again." };
    if (bytes[0] !== 0xff || bytes[1] !== 0xd8) return { ok: false, error: "Selfie capture failed. Try again." };

    const { data: own } = await context.supabase
      .from("member_private")
      .select("user_id")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!own) return { ok: false, error: "Your session expired. Start again." };

    const { toHex } = await import("@/server/sms.server");
    const selfieHash = toHex(await crypto.subtle.digest("SHA-256", bytes));
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [a, b] = await Promise.all([
      supabaseAdmin
        .from("member_private")
        .update({ selfie_hash: selfieHash, verified_at: new Date().toISOString() })
        .eq("user_id", context.userId),
      supabaseAdmin.from("profiles").update({ display_name: name }).eq("id", context.userId),
    ]);
    if (a.error || b.error) {
      console.error("[submitSelfie]", a.error, b.error);
      return { ok: false, error: "We could not save your verification. Try again." };
    }
    return { ok: true };
  });

export const getMe = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<Me | null> => {
    const [{ data: priv }, { data: profile }, { count }] = await Promise.all([
      context.supabase.from("member_private").select("*").eq("user_id", context.userId).maybeSingle(),
      context.supabase.from("profiles").select("display_name").eq("id", context.userId).maybeSingle(),
      context.supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", context.userId)
        .eq("read", false),
    ]);
    if (!priv) return null;
    return {
      id: context.userId,
      name: profile?.display_name ?? "",
      phoneLast4: priv.phone.slice(-4),
      verified: !!priv.verified_at,
      stripeConnected: priv.stripe_connected,
      unread: count ?? 0,
    };
  });
