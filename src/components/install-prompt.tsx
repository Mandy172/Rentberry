import { useEffect, useState } from "react";
import { BRAND } from "@/lib/config";
import { Icon } from "./icon";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "bb-install-dismissed";

/** The offline-fallback worker only runs on the published site: never in the editor preview or dev. */
function canRegisterServiceWorker() {
  if (!import.meta.env.PROD || !("serviceWorker" in navigator)) return false;
  if (window.self !== window.top) return false;
  const host = window.location.hostname;
  return !(host === "localhost" || host.startsWith("id-preview--") || host.endsWith(".lovableproject.com"));
}

export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIosHint, setShowIosHint] = useState(false);

  useEffect(() => {
    if (canRegisterServiceWorker()) navigator.serviceWorker.register("/sw.js").catch(() => {});

    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone;
    if (standalone || sessionStorage.getItem(DISMISS_KEY) || window.self !== window.top) return;

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);

    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const timer = isIos ? window.setTimeout(() => setShowIosHint(true), 4000) : undefined;
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.clearTimeout(timer);
    };
  }, []);

  if (!deferred && !showIosHint) return null;

  const dismiss = () => {
    sessionStorage.setItem(DISMISS_KEY, "1");
    setDeferred(null);
    setShowIosHint(false);
  };

  return (
    <div
      role="dialog"
      aria-label={`Install ${BRAND.name}`}
      className="fixed inset-x-3 bottom-20 z-50 mx-auto flex max-w-md items-center gap-3 rounded-2xl bg-ink p-4 text-ink-foreground shadow-2xl lg:bottom-6"
    >
      <img src="/icons/icon-192.png" alt="" width={44} height={44} className="rounded-xl bg-card" />
      <div className="min-w-0 flex-1">
        <p className="font-semibold">Install {BRAND.name}</p>
        <p className="text-sm text-ink-foreground/70">
          {deferred ? (
            "Add it to your home screen for one-tap access."
          ) : (
            <>
              Tap <Icon name="ios_share" size={16} className="align-middle" /> Share, then {'"Add to Home Screen".'}
            </>
          )}
        </p>
      </div>
      {deferred && (
        <button
          type="button"
          onClick={async () => {
            await deferred.prompt();
            await deferred.userChoice;
            dismiss();
          }}
          className="rounded-lg bg-honey px-4 py-2 font-semibold text-ink"
        >
          Install
        </button>
      )}
      <button type="button" onClick={dismiss} aria-label="Dismiss install prompt" className="p-1 text-ink-foreground/70 hover:text-ink-foreground">
        <Icon name="close" />
      </button>
    </div>
  );
}
