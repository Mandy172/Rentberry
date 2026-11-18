import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { meQueryOptions } from "./queries";

type SessionState = { ready: boolean; session: Session | null };
const SessionContext = createContext<SessionState>({ ready: false, session: null });

/** Single auth listener for the app; refreshes member data whenever the session changes. */
export function SessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SessionState>({ ready: false, session: null });
  const queryClient = useQueryClient();

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      setState({ ready: true, session });
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") {
        queryClient.invalidateQueries({ queryKey: ["me"] });
      }
    });
    supabase.auth.getSession().then(({ data }) => setState({ ready: true, session: data.session }));
    return () => sub.subscription.unsubscribe();
  }, [queryClient]);

  return <SessionContext.Provider value={state}>{children}</SessionContext.Provider>;
}

export function useSession() {
  return useContext(SessionContext);
}

/** Current member (null when signed out). */
export function useMe() {
  const { ready, session } = useSession();
  const q = useQuery({ ...meQueryOptions, enabled: ready && !!session });
  return { ready: ready && (!session || !q.isPending), me: session ? (q.data ?? null) : null };
}
