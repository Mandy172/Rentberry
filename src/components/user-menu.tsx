import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Icon } from "./icon";

export function UserMenu({ name, isAdmin = false }: { name: string; isAdmin?: boolean }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/", replace: true });
  }

  return (
    <details className="group relative">
      <summary
        className="flex size-12 cursor-pointer list-none items-center justify-center rounded-full bg-honey text-lg font-bold [&::-webkit-details-marker]:hidden"
        aria-label="Account menu"
      >
        {name.charAt(0).toUpperCase() || "R"}
      </summary>
      <div className="absolute right-0 z-50 mt-2 w-56 rounded-xl border bg-popover p-2 shadow-lg">
        <p className="truncate px-3 py-2 text-sm font-semibold">{name}</p>
        {isAdmin && (
          <Link to="/admin" className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold hover:bg-muted">
            <Icon name="admin_panel_settings" size={20} /> Admin
          </Link>
        )}
        <Link to="/post-item" className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-muted sm:hidden">
          <Icon name="edit_note" size={20} /> Post Item
        </Link>
        <Link to="/earnings" className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-muted">
          <Icon name="payments" size={20} /> Earnings
        </Link>
        <Link to="/blog" className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-muted">
          <Icon name="article" size={20} /> Blog
        </Link>
        <button
          type="button"
          onClick={signOut}
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-muted"
        >
          <Icon name="logout" size={20} /> Sign out
        </button>
      </div>
    </details>
  );
}
