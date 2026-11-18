import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { Icon } from "@/components/icon";
import { EmptyState, PageTitle } from "@/components/page-title";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/form-field";
import { BRAND } from "@/lib/config";
import { sendMessage } from "@/lib/messages.functions";
import { conversationsQueryOptions, messagesQueryOptions } from "@/lib/queries";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/messages")({
  validateSearch: z.object({ c: z.string().uuid().optional().catch(undefined) }),
  head: () => ({ meta: [{ title: `Messages | ${BRAND.name}` }, { name: "description", content: "Chat with owners and borrowers." }, { property: "og:title", content: `Messages | ${BRAND.name}` }, { property: "og:description", content: "Chat with owners and borrowers." }] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(conversationsQueryOptions),
  component: MessagesPage,
  errorComponent: ({ error }) => <p className="p-8 text-center text-destructive">{error instanceof Error ? error.message : String(error)}</p>,
});

function MessagesPage() {
  const { c } = Route.useSearch();
  const { me } = Route.useRouteContext();
  const navigate = useNavigate({ from: "/messages" });
  const { data: conversations } = useSuspenseQuery(conversationsQueryOptions);
  const active = conversations.find((x) => x.id === c) ?? null;

  if (conversations.length === 0) {
    return (
      <section className="px-4 py-10 md:py-14">
        <div className="mx-auto max-w-5xl">
          <PageTitle title="Messages" />
          <EmptyState icon="chat_bubble" title="No conversations yet" body="Message an owner from any item page.">
            <Link to="/browse" className={buttonVariants()}>Browse items</Link>
          </EmptyState>
        </div>
      </section>
    );
  }

  return (
    <section className="px-4 py-10 md:py-14">
      <div className="mx-auto max-w-6xl">
        <PageTitle title="Messages" />
        <div className="mt-8 grid min-h-[60dvh] overflow-hidden rounded-2xl bg-card shadow-card md:grid-cols-[320px_1fr]">
          <ul className={cn("border-r", active && "hidden md:block")}>
            {conversations.map((cv) => (
              <li key={cv.id}>
                <button
                  type="button"
                  onClick={() => navigate({ search: { c: cv.id } })}
                  className={cn("flex w-full items-center gap-3 border-b px-4 py-4 text-left transition hover:bg-muted", cv.id === c && "bg-honey-soft")}
                >
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-honey font-bold">{cv.otherName.charAt(0)}</span>
                  <span className="min-w-0">
                    <span className="block truncate font-semibold">{cv.otherName}</span>
                    <span className="block truncate text-sm text-muted-foreground">{cv.listingTitle}</span>
                    {cv.lastMessage && <span className="block truncate text-sm">{cv.lastMessage}</span>}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {active ? (
            <Thread key={active.id} conversationId={active.id} title={active.listingTitle} otherName={active.otherName} listingId={active.listingId} myId={me.id} onBack={() => navigate({ search: {} })} />
          ) : (
            <div className="hidden items-center justify-center p-10 text-muted-foreground md:flex">Pick a conversation</div>
          )}
        </div>
      </div>
    </section>
  );
}

function Thread({ conversationId, title, otherName, listingId, myId, onBack }: { conversationId: string; title: string; otherName: string; listingId: string | null; myId: string; onBack: () => void }) {
  const { data: messages = [] } = useQuery(messagesQueryOptions(conversationId));
  const queryClient = useQueryClient();
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  async function onSend(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    setBusy(true);
    const res = await sendMessage({ data: { conversationId, body } });
    setBusy(false);
    if (!res.ok) { toast.error(res.error); return; }
    setBody("");
    queryClient.invalidateQueries({ queryKey: ["me", "messages", conversationId] });
    queryClient.invalidateQueries({ queryKey: ["me", "conversations"] });
  }

  return (
    <div className="flex min-h-[60dvh] flex-col">
      <div className="flex items-center gap-3 border-b px-4 py-3">
        <button type="button" onClick={onBack} className="md:hidden" aria-label="Back to conversations"><Icon name="arrow_back" /></button>
        <div className="min-w-0">
          <p className="font-semibold">{otherName}</p>
          {listingId ? (
            <Link to="/items/$id" params={{ id: listingId }} className="block truncate text-sm text-muted-foreground hover:underline">{title}</Link>
          ) : (
            <p className="truncate text-sm text-muted-foreground">{title}</p>
          )}
        </div>
      </div>
      <div className="flex-1 space-y-2 overflow-y-auto p-4">
        {messages.length === 0 && <p className="py-10 text-center text-muted-foreground">Say hi and ask about pickup times.</p>}
        {messages.map((m) => {
          const mine = m.senderId === myId;
          return (
            <div key={m.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
              <p className={cn("max-w-[75%] whitespace-pre-line rounded-2xl px-4 py-2.5", mine ? "bg-honey" : "bg-muted")}>{m.body}</p>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>
      <form onSubmit={onSend} className="flex gap-2 border-t p-3">
        <label className="flex-1">
          <span className="sr-only">Message</span>
          <Input value={body} onChange={(e) => setBody(e.target.value)} maxLength={1000} placeholder="Write a message…" />
        </label>
        <Button type="submit" className="h-12" disabled={busy || !body.trim()} aria-label="Send">
          <Icon name="send" />
        </Button>
      </form>
    </div>
  );
}
