import { Link, useLocation } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { Icon } from "./icon";

export const APP_LINKS = [
  { to: "/browse", label: "Browse", icon: "home" },
  { to: "/saved", label: "Saved", icon: "favorite" },
  { to: "/my-listings", label: "My Listings", icon: "view_list" },
  { to: "/my-rentals", label: "My Rentals", icon: "real_estate_agent" },
  { to: "/messages", label: "Messages", icon: "chat_bubble" },
  { to: "/notifications", label: "Notifications", icon: "notifications" },
] as const;

export function AppNav({ unread }: { unread: number }) {
  const pathname = useLocation({ select: (l) => l.pathname });
  return (
    <>
      <nav aria-label="App" className="hidden items-center gap-1 lg:flex">
        {APP_LINKS.map((l) => {
          const active = pathname.startsWith(l.to);
          return (
            <Link
              key={l.to}
              to={l.to}
              aria-current={active ? "page" : undefined}
              title={l.label}
              className={cn(
                "relative flex items-center gap-2 whitespace-nowrap rounded-xl px-3 py-2.5 text-muted-foreground transition hover:text-foreground",
                active && "bg-honey-soft font-semibold text-foreground",
              )}
            >
              <Icon name={l.icon} filled={active} />
              <span className="sr-only 2xl:not-sr-only">{l.label}</span>
              {l.to === "/notifications" && unread > 0 && (
                <span className="rounded-full bg-ink px-1.5 text-xs font-semibold text-honey">{unread}</span>
              )}
              {active && <span className="absolute inset-x-6 -bottom-0.5 h-0.5 rounded-full bg-honey" aria-hidden />}
            </Link>
          );
        })}
      </nav>

      <nav
        aria-label="App"
        className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-6 border-t bg-card pb-[env(safe-area-inset-bottom)] lg:hidden"
      >
        {APP_LINKS.map((l) => {
          const active = pathname.startsWith(l.to);
          return (
            <Link
              key={l.to}
              to={l.to}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative flex flex-col items-center gap-0.5 py-2 text-[11px] text-muted-foreground",
                active && "font-semibold text-foreground",
              )}
            >
              <Icon name={l.icon} filled={active} className={cn(active && "text-ink")} />
              <span className="truncate">{l.label.replace("My ", "")}</span>
              {l.to === "/notifications" && unread > 0 && (
                <span className="absolute right-3 top-1.5 size-2 rounded-full bg-rust" aria-label={`${unread} unread`} />
              )}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
