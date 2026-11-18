import { Link } from "@tanstack/react-router";
import { useMe, useSession } from "@/lib/session";
import { buttonVariants } from "./ui/button";
import { AppNav } from "./app-nav";
import { Icon } from "./icon";
import { Logo } from "./logo";
import { UserMenu } from "./user-menu";

const PUBLIC_LINKS = [
  { to: "/blog", label: "Blog" },
  { to: "/earnings", label: "Earnings" },
  { to: "/browse", label: "Browse Items" },
] as const;

export function SiteHeader() {
  const { session } = useSession();
  const { me } = useMe();
  const verified = !!me?.verified;

  return (
    <header className="sticky top-0 z-40 border-b border-ink/5 bg-card/95 backdrop-blur">
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between gap-4 px-4 md:px-6">
        <Logo />
        {verified && me ? (
          <>
            <AppNav unread={me.unread} />
            <div className="flex items-center gap-3">
              <Link to="/post-item" className={buttonVariants({ className: "hidden h-12 sm:flex" })}>
                <Icon name="edit_note" />
                Post Item
              </Link>
              <UserMenu name={me.name} />
            </div>
          </>
        ) : (
          <nav aria-label="Main" className="flex items-center gap-2 md:gap-8">
            {PUBLIC_LINKS.map((l) => (
              <Link
                key={l.to}
                to={l.to}
                className="hidden text-lg text-muted-foreground transition hover:text-foreground md:inline"
              >
                {l.label}
              </Link>
            ))}
            <Link
              to="/sign-in"
              search={session ? { step: "selfie" } : {}}
              className={buttonVariants({ className: "h-12 px-6" })}
            >
              {session ? "Finish Verification" : "Sign In"}
            </Link>
          </nav>
        )}
      </div>
    </header>
  );
}
