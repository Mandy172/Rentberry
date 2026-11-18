import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

type Client = SupabaseClient<Database>;

export const NOT_VERIFIED = "Verify your identity to continue.";

/** Reads the caller's own private row through RLS; null unless phone + selfie verification are done. */
export async function getVerifiedMember(supabase: Client, userId: string) {
  const { data } = await supabase
    .from("member_private")
    .select("user_id, verified_at, stripe_account_id, stripe_connected")
    .eq("user_id", userId)
    .maybeSingle();
  return data?.verified_at ? data : null;
}

export async function getDisplayName(supabase: Client, userId: string) {
  const { data } = await supabase.from("profiles").select("display_name").eq("id", userId).maybeSingle();
  return data?.display_name || "Campus member";
}

export async function notify(
  admin: Client,
  userId: string,
  n: { title: string; body: string; href: string },
) {
  const { error } = await admin.from("notifications").insert({ user_id: userId, ...n });
  if (error) console.error("[notify]", error);
}
