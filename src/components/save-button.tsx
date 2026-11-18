import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { toggleSaved } from "@/lib/listings.functions";
import { cn } from "@/lib/utils";
import { Icon } from "./icon";

export function SaveButton({ listingId, initialSaved }: { listingId: string; initialSaved: boolean }) {
  const [saved, setSaved] = useState(initialSaved);
  const [busy, setBusy] = useState(false);
  const queryClient = useQueryClient();

  async function onClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (busy) return;
    setBusy(true);
    setSaved(!saved);
    const res = await toggleSaved({ data: { listingId } });
    setBusy(false);
    if (!res.ok) {
      setSaved(saved);
      toast.error(res.error);
      return;
    }
    setSaved(res.saved);
    queryClient.invalidateQueries({ queryKey: ["me", "savedIds"] });
    queryClient.invalidateQueries({ queryKey: ["me", "saved"] });
  }

  return (
    <button
      type="button"
      aria-pressed={saved}
      aria-label={saved ? "Remove from saved" : "Save item"}
      onClick={onClick}
      className={cn(
        "flex size-10 items-center justify-center rounded-full bg-card/95 shadow transition hover:scale-105",
        saved && "text-rust",
      )}
    >
      <Icon name="favorite" filled={saved} />
    </button>
  );
}
