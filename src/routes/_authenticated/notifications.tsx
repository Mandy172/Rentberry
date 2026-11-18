import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { Icon } from "@/components/icon";
import { EmptyState, PageTitle } from "@/components/page-title";
import { BRAND } from "@/lib/config";
import { markNotificationsRead } from "@/lib/messages.functions";
import { notificationsQueryOptions } from "@/lib/queries";
import { cn } from "@/lib/utils";
import { safeNextPath } from "@/lib/validation";

export const Route = createFileRoute("/_authenticated/notifications")({
  head: () => ({ meta: [{ title: `Notifications | ${BRAND.name}` }, { name: "description", content: "Your rental and message updates." }, { property: "og:title", content: `Notifications | ${BRAND.name}` }, { property: "og:description", content: "Your rental and message updates." }] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(notificationsQueryOptions),
  component: NotificationsPage,
  errorComponent: ({ error }) => <p className="p-8 text-center text-destructive">{error instanceof Error ? error.message : String(error)}</p>,
});

function NotificationsPage() {
  const { data } = useSuspenseQuery(notificationsQueryOptions);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const hasUnread = data.some((n) => !n.read);

  // Opening the page marks everything read (keeps the highlight for this visit).
  useEffect(() => {
    if (!hasUnread) return;
    markNotificationsRead().then(() => queryClient.invalidateQueries({ queryKey: ["me"], exact: true }));
  }, [hasUnread, queryClient]);

  return (
    <section className="px-4 py-10 md:py-14">
      <div className="mx-auto max-w-3xl">
        <PageTitle title="Notifications" />
        {data.length === 0 ? (
          <EmptyState icon="notifications" title="You're all caught up" body="Rental requests and messages will show up here." />
        ) : (
          <ul className="mt-8 space-y-3">
            {data.map((n) => (
              <li key={n.id}>
                <button
                  type="button"
                  onClick={() => navigate({ href: safeNextPath(n.href, "/notifications") })}
                  className={cn("flex w-full gap-4 rounded-2xl bg-card p-5 text-left shadow-sm transition hover:shadow-md", !n.read && "ring-2 ring-honey")}
                >
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-honey-soft">
                    <Icon name={n.title.startsWith("New message") ? "chat_bubble" : "real_estate_agent"} size={20} />
                  </span>
                  <div className="min-w-0">
                    <p className="font-semibold">{n.title}</p>
                    <p className="text-muted-foreground">{n.body}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{new Date(n.createdAt).toLocaleString("en-IN")}</p>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
