import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { meQueryOptions } from "@/lib/queries";

// Member-only screens. Sessions live in the browser, so these render client-side only.
// Every server function behind them re-checks the caller independently.
export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ context, location }) => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw redirect({ to: "/sign-in", search: { next: location.href } });
    const me = await context.queryClient.fetchQuery(meQueryOptions).catch(() => null);
    if (!me) throw redirect({ to: "/sign-in", search: { next: location.href } });
    if (!me.verified) throw redirect({ to: "/sign-in", search: { next: location.href, step: "selfie" } });
    return { me };
  },
  pendingComponent: () => <div className="p-16 text-center text-muted-foreground">Loading…</div>,
  component: () => <Outlet />,
});
