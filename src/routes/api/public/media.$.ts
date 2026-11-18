import { createFileRoute } from "@tanstack/react-router";

// Serves listing photos/videos from the private listing-media bucket. Every object in that
// bucket is meant to be public (it backs public listings); paths are strictly validated.
const PATH_RE = /^[0-9a-f-]{36}\/[0-9a-f-]{36}\.(png|jpe?g|webp|mp4)$/i;
const TYPES: Partial<Record<string, string>> = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", mp4: "video/mp4" };

export const Route = createFileRoute("/api/public/media/$")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const path = params._splat ?? "";
        const m = PATH_RE.exec(path);
        if (!m) return new Response("Not found", { status: 404 });
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data, error } = await supabaseAdmin.storage.from("listing-media").download(path);
        if (error || !data) return new Response("Not found", { status: 404 });
        return new Response(data.stream(), {
          headers: {
            "Content-Type": TYPES[(m[1] ?? "").toLowerCase()] ?? "application/octet-stream",
            "Cache-Control": "public, max-age=31536000, immutable",
            "X-Content-Type-Options": "nosniff",
          },
        });
      },
    },
  },
});
