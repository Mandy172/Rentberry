import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { ConversationSummary, Message, Notification } from "./types";

export const contactOwner = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { listingId: string }) => z.object({ listingId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<{ ok: true; conversationId: string | null } | { ok: false; error: string }> => {
    const { getVerifiedMember } = await import("@/server/member.server");
    if (!(await getVerifiedMember(context.supabase, context.userId))) {
      return { ok: false, error: "Verify your identity to message." };
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: listing } = await supabaseAdmin
      .from("listings")
      .select("id, owner_id, title")
      .eq("id", data.listingId)
      .maybeSingle();
    if (!listing || listing.owner_id === context.userId) return { ok: true, conversationId: null };

    const me = context.userId;
    const other = listing.owner_id;
    const { data: existing } = await supabaseAdmin
      .from("conversations")
      .select("id")
      .eq("listing_id", listing.id)
      .or(`and(participant_a.eq.${me},participant_b.eq.${other}),and(participant_a.eq.${other},participant_b.eq.${me})`)
      .maybeSingle();
    if (existing) return { ok: true, conversationId: existing.id };
    const { data: convo, error } = await supabaseAdmin
      .from("conversations")
      .insert({ listing_id: listing.id, listing_title: listing.title, participant_a: me, participant_b: other })
      .select("id")
      .single();
    if (error) return { ok: false, error: "Could not start the conversation." };
    return { ok: true, conversationId: convo.id };
  });

export const listConversations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ConversationSummary[]> => {
    const { data, error } = await context.supabase
      .from("conversations")
      .select(
        "*, a:profiles!conversations_participant_a_fkey(display_name), b:profiles!conversations_participant_b_fkey(display_name), messages(body, created_at)",
      )
      .order("updated_at", { ascending: false })
      .order("created_at", { referencedTable: "messages", ascending: false })
      .limit(1, { referencedTable: "messages" });
    if (error) throw new Error(error.message);
    return data.map((c) => {
      const otherIsA = c.participant_b === context.userId;
      const other = otherIsA ? c.a : c.b;
      return {
        id: c.id,
        listingId: c.listing_id,
        listingTitle: c.listing_title,
        otherName: other?.display_name || "Campus member",
        lastMessage: c.messages?.[0]?.body ?? null,
        updatedAt: c.updated_at,
      };
    });
  });

export const getMessages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { conversationId: string }) => z.object({ conversationId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<Message[]> => {
    const { data: rows, error } = await context.supabase
      .from("messages")
      .select("id, sender_id, body, created_at")
      .eq("conversation_id", data.conversationId)
      .order("created_at", { ascending: true })
      .limit(500);
    if (error) throw new Error(error.message);
    return rows.map((m) => ({ id: m.id, senderId: m.sender_id, body: m.body, createdAt: m.created_at }));
  });

export const sendMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { conversationId: string; body: string }) =>
    z.object({ conversationId: z.string().uuid(), body: z.string().max(5000) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { getVerifiedMember, getDisplayName, notify } = await import("@/server/member.server");
    if (!(await getVerifiedMember(context.supabase, context.userId))) {
      return { ok: false as const, error: "Verify your identity to message." };
    }
    // RLS: only participants can read the conversation.
    const { data: convo } = await context.supabase
      .from("conversations")
      .select("id, participant_a, participant_b")
      .eq("id", data.conversationId)
      .maybeSingle();
    if (!convo) return { ok: false as const, error: "Conversation not found." };

    const text = data.body.trim().slice(0, 1000);
    if (!text) return { ok: false as const, error: "Message is empty." };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("messages")
      .insert({ conversation_id: convo.id, sender_id: context.userId, body: text });
    if (error) return { ok: false as const, error: "Could not send. Try again." };
    await supabaseAdmin.from("conversations").update({ updated_at: new Date().toISOString() }).eq("id", convo.id);

    const recipient = convo.participant_a === context.userId ? convo.participant_b : convo.participant_a;
    const name = await getDisplayName(supabaseAdmin, context.userId);
    await notify(supabaseAdmin, recipient, {
      title: `New message from ${name}`,
      body: text.length > 80 ? `${text.slice(0, 80)}…` : text,
      href: `/messages?c=${convo.id}`,
    });
    return { ok: true as const };
  });

export const listNotifications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<Notification[]> => {
    const { data, error } = await context.supabase
      .from("notifications")
      .select("*")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return data.map((n) => ({ id: n.id, title: n.title, body: n.body, href: n.href, read: n.read, createdAt: n.created_at }));
  });

export const markNotificationsRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await context.supabase.from("notifications").update({ read: true }).eq("user_id", context.userId).eq("read", false);
    return { ok: true as const };
  });
