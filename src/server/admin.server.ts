import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export class AdminError extends Error {}

function safeEqual(a: string, b: string) {
  const ea = new TextEncoder().encode(a);
  const eb = new TextEncoder().encode(b);
  let diff = ea.length ^ eb.length;
  for (let i = 0; i < Math.max(ea.length, eb.length); i++) diff |= (ea[i] ?? 0) ^ (eb[i] ?? 0);
  return diff === 0;
}

/**
 * Admin actions need two things: the admin role on the signed-in account (checked through
 * the caller's own client) and the admin password from the ADMIN_PASSCODE secret.
 * The password stops anyone who gets into the admin phone's session (e.g. via the demo SMS code).
 */
export async function requireAdmin(supabase: SupabaseClient<Database>, userId: string, passcode: string) {
  const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (!isAdmin) throw new AdminError("Admins only.");
  const expected = process.env["ADMIN_PASSCODE"];
  if (!expected) throw new AdminError("The admin password hasn't been set up yet.");
  if (!safeEqual(passcode, expected)) throw new AdminError("Wrong admin password.");
}
