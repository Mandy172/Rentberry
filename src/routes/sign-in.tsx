import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { Icon } from "@/components/icon";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/form-field";
import { supabase } from "@/integrations/supabase/client";
import { sendCode, submitSelfie, verifyCode } from "@/lib/auth.functions";
import { BRAND } from "@/lib/config";
import { useMe, useSession } from "@/lib/session";
import { safeNextPath } from "@/lib/validation";

export const Route = createFileRoute("/sign-in")({
  validateSearch: z.object({
    next: z.string().max(300).optional().catch(undefined),
    step: z.enum(["phone", "selfie"]).optional().catch(undefined),
  }),
  head: () => ({
    meta: [
      { title: `Sign in | ${BRAND.name}` },
      { name: "description", content: `Verify with your phone and a live selfie to join ${BRAND.name}.` },
      { property: "og:title", content: `Sign in | ${BRAND.name}` },
      { property: "og:description", content: `Join the ${BRAND.communityShort} campus rental marketplace.` },
    ],
  }),
  component: SignInPage,
});

type Step = "phone" | "code" | "selfie";

function SignInPage() {
  const search = Route.useSearch();
  const next = safeNextPath(search.next);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { ready, session } = useSession();
  const { ready: meReady, me } = useMe();
  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [normalized, setNormalized] = useState("");
  const [code, setCode] = useState("");
  const [mockCode, setMockCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Already signed in: verified members go on; unverified ones finish the selfie step.
  useEffect(() => {
    if (!ready || !meReady || !session) return;
    if (me?.verified) navigate({ to: next, replace: true });
    else if (me) setStep("selfie");
  }, [ready, meReady, session, me, next, navigate]);

  async function onSendCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const res = await sendCode({ data: { phone } });
    setBusy(false);
    if (!res.ok) { setError(res.error); return; }
    setNormalized(res.phone);
    setMockCode(res.mockCode);
    setStep("code");
  }

  async function onVerify(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const res = await verifyCode({ data: { phone: normalized, code } });
    if (!res.ok) {
      setBusy(false);
      { setError(res.error); return; }
    }
    const { error: otpErr } = await supabase.auth.verifyOtp({ token_hash: res.tokenHash, type: "magiclink" });
    setBusy(false);
    if (otpErr) { setError("We could not sign you in. Request a new code."); return; }
    await queryClient.invalidateQueries({ queryKey: ["me"] });
    if (res.needsSelfie) setStep("selfie");
    else navigate({ to: next, replace: true });
  }

  return (
    <section className="bg-hero px-4 py-16 md:py-24">
      <div className="mx-auto max-w-lg rounded-3xl bg-card p-6 shadow-xl md:p-10">
        <Steps step={step} />
        {step === "phone" && (
          <form onSubmit={onSendCode} className="mt-8 space-y-6">
            <div>
              <h1 className="text-3xl font-semibold">Sign in to {BRAND.name}</h1>
              <p className="mt-2 text-muted-foreground">We'll text you a 6-digit code. New here? This creates your account.</p>
            </div>
            <Field label="Mobile number" htmlFor="phone" error={error ?? undefined}>
              <div className="flex items-center gap-2">
                <span className="flex h-12 items-center rounded-xl bg-muted px-3 font-semibold">+91</span>
                <Input id="phone" type="tel" inputMode="tel" autoComplete="tel-national" placeholder="98765 43210" value={phone} onChange={(e) => setPhone(e.target.value)} required />
              </div>
            </Field>
            <Button type="submit" size="lg" className="w-full" disabled={busy}>{busy ? "Sending…" : "Send code"}</Button>
          </form>
        )}

        {step === "code" && (
          <form onSubmit={onVerify} className="mt-8 space-y-6">
            <div>
              <h1 className="text-3xl font-semibold">Enter your code</h1>
              <p className="mt-2 text-muted-foreground">Sent to {normalized}.</p>
            </div>
            {mockCode && (
              <p className="rounded-xl bg-honey-soft p-3 text-sm">
                <strong>Demo mode:</strong> SMS isn't connected yet, so use code <strong>{mockCode}</strong>.
              </p>
            )}
            <Field label="6-digit code" htmlFor="code" error={error ?? undefined}>
              <Input id="code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} pattern="\d{6}" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} required className="text-center text-2xl tracking-[0.5em]" />
            </Field>
            <Button type="submit" size="lg" className="w-full" disabled={busy || code.length !== 6}>{busy ? "Checking…" : "Verify"}</Button>
            <button type="button" className="w-full text-sm font-semibold underline underline-offset-4" onClick={() => { setStep("phone"); setCode(""); setError(null); }}>
              Use a different number
            </button>
          </form>
        )}

        {step === "selfie" && (
          <SelfieStep
            onDone={async () => {
              await queryClient.invalidateQueries({ queryKey: ["me"] });
              navigate({ to: next, replace: true });
            }}
          />
        )}
      </div>
    </section>
  );
}

function Steps({ step }: { step: Step }) {
  const items = [
    { key: "phone", label: "Phone" },
    { key: "code", label: "Code" },
    { key: "selfie", label: "Selfie" },
  ];
  const idx = items.findIndex((i) => i.key === step);
  return (
    <ol className="flex items-center gap-2 text-sm" aria-label="Verification steps">
      {items.map((it, i) => (
        <li key={it.key} className="flex flex-1 items-center gap-2">
          <span className={`flex size-7 items-center justify-center rounded-full font-semibold ${i <= idx ? "bg-honey" : "bg-muted text-muted-foreground"}`}>{i + 1}</span>
          <span className={i === idx ? "font-semibold" : "text-muted-foreground"}>{it.label}</span>
          {i < items.length - 1 && <span className="h-px flex-1 bg-border" aria-hidden />}
        </li>
      ))}
    </ol>
  );
}

function SelfieStep({ onDone }: { onDone: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const mounted = useRef(false);
  const [name, setName] = useState("");
  const [shot, setShot] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function startCamera() {
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: 720, height: 720 }, audio: false });
      if (!mounted.current) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = stream;
      attach();
    } catch {
      if (mounted.current) setCameraError("We couldn't open your camera. Allow camera access and try again.");
    }
  }

  function attach() {
    const v = videoRef.current;
    if (v && streamRef.current && v.srcObject !== streamRef.current) {
      v.srcObject = streamRef.current;
      v.play().catch(() => {});
    }
  }

  function stopCamera() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }

  useEffect(() => {
    mounted.current = true;
    startCamera();
    return () => {
      mounted.current = false;
      stopCamera();
    };
  }, []);

  useEffect(() => {
    if (!shot) attach();
  });

  function capture() {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return;
    const canvas = document.createElement("canvas");
    const size = Math.min(v.videoWidth, v.videoHeight);
    canvas.width = size;
    canvas.height = size;
    canvas.getContext("2d")!.drawImage(v, (v.videoWidth - size) / 2, (v.videoHeight - size) / 2, size, size, 0, 0, size, size);
    setShot(canvas.toDataURL("image/jpeg", 0.85));
    stopCamera();
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!shot) { setError("Take your selfie first."); return; }
    setError(null);
    setBusy(true);
    const res = await submitSelfie({ data: { dataUrl: shot, name } });
    setBusy(false);
    if (!res.ok) { setError(res.error); return; }
    onDone();
  }

  return (
    <form onSubmit={onSubmit} className="mt-8 space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">Quick live selfie</h1>
        <p className="mt-2 text-muted-foreground">Only a fingerprint of the photo is kept as proof. The image itself is never stored.</p>
      </div>
      <Field label="Your name" htmlFor="name" hint="Shown to classmates you rent with.">
        <Input id="name" autoComplete="name" maxLength={60} value={name} onChange={(e) => setName(e.target.value)} required />
      </Field>
      <div className="overflow-hidden rounded-2xl bg-ink">
        {shot ? (
          <img src={shot} alt="Your selfie" className="aspect-square w-full object-cover" />
        ) : (
          <video ref={videoRef} playsInline muted autoPlay className="aspect-square w-full -scale-x-100 object-cover" />
        )}
      </div>
      {cameraError && <p className="text-sm font-medium text-destructive" role="alert">{cameraError}</p>}
      <div className="flex gap-3">
        {shot ? (
          <Button type="button" variant="outline" className="flex-1" onClick={() => { setShot(null); startCamera(); }}>
            <Icon name="replay" /> Retake
          </Button>
        ) : (
          <Button type="button" variant="ink" className="flex-1" onClick={cameraError ? startCamera : capture}>
            <Icon name="photo_camera" /> {cameraError ? "Try camera again" : "Take selfie"}
          </Button>
        )}
      </div>
      {error && <p className="text-sm font-medium text-destructive" role="alert">{error}</p>}
      <Button type="submit" size="lg" className="w-full" disabled={busy || !shot}>{busy ? "Verifying…" : "Finish verification"}</Button>
    </form>
  );
}
