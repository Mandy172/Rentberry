import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Icon } from "@/components/icon";
import { PageTitle } from "@/components/page-title";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/form-field";
import { supabase } from "@/integrations/supabase/client";
import { AGREEMENT_TEMPLATES, BRAND, CAMPUS_LOCATIONS, CATEGORIES, CONDITIONS, MEDIA_ROUTE_PREFIX, UPLOAD_LIMITS } from "@/lib/config";
import { publishListing, saveDraft } from "@/lib/listings.functions";
import { draftQueryOptions } from "@/lib/queries";
import type { ListingDraft } from "@/lib/types";
import { cn } from "@/lib/utils";
import { detailsSchema, firstError, locationSchema, photosSchema, pricingSchema, TITLE_MAX } from "@/lib/validation";

export const Route = createFileRoute("/_authenticated/post-item")({
  head: () => ({ meta: [{ title: `Post an item | ${BRAND.name}` }, { name: "description", content: "List something to lend on campus." }, { property: "og:title", content: `Post an item | ${BRAND.name}` }, { property: "og:description", content: "List something to lend on campus." }] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(draftQueryOptions),
  component: PostItemPage,
  errorComponent: ({ error }) => <p className="p-8 text-center text-destructive">{error instanceof Error ? error.message : String(error)}</p>,
});

const EMPTY: ListingDraft = {
  title: "",
  category: "",
  condition: "",
  description: "",
  tags: [],
  hourlyRate: null,
  dailyRate: null,
  flatRate: null,
  quantity: 1,
  deposit: 0,
  available: true,
  rules: ["Return clean and on time", "No subletting", "Report any damage right away"],
  agreementTemplate: "standard",
  media: [],
  location: "",
};

const STEPS = ["Details", "Pricing", "Photos", "Pickup"] as const;
const STEP_SCHEMAS = [detailsSchema, pricingSchema, photosSchema, locationSchema];

function numOrNull(v: string) {
  if (v.trim() === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function PostItemPage() {
  const { data: saved } = useSuspenseQuery(draftQueryOptions);
  const { me } = Route.useRouteContext();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<ListingDraft>(() => ({ ...EMPTY, ...(saved?.draft ?? {}) }));
  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState<Partial<Record<keyof ListingDraft | "form", string>>>({});
  const [savedAt, setSavedAt] = useState<string | null>(saved?.updatedAt ?? null);
  const [publishing, setPublishing] = useState(false);
  const [uploading, setUploading] = useState(0);
  const [tagInput, setTagInput] = useState("");
  const [ruleInput, setRuleInput] = useState("");
  const dirty = useRef(false);

  const update = (patch: Partial<ListingDraft>) => {
    dirty.current = true;
    setDraft((d) => ({ ...d, ...patch }));
  };

  // Autosave the draft a moment after the last change.
  useEffect(() => {
    if (!dirty.current) return;
    const t = window.setTimeout(async () => {
      const res = await saveDraft({ data: draft });
      if (res.ok) {
        setSavedAt(res.savedAt);
        queryClient.setQueryData(draftQueryOptions.queryKey, () => ({ draft, updatedAt: res.savedAt }));
      }
    }, 1200);
    return () => window.clearTimeout(t);
  }, [draft, queryClient]);

  function validateStep(i: number) {
    const schema = STEP_SCHEMAS[i];
    if (!schema) return true;
    const r = schema.safeParse(draft);
    setErrors(r.success ? {} : (firstError(r.error) as Partial<Record<keyof ListingDraft, string>>));
    return r.success;
  }

  async function onFiles(files: FileList | null) {
    if (!files) return;
    const room = UPLOAD_LIMITS.maxFiles - draft.media.length;
    const list = Array.from(files).slice(0, room);
    if (files.length > room) toast.error(`Up to ${UPLOAD_LIMITS.maxFiles} files per listing.`);
    for (const file of list) {
      if (!UPLOAD_LIMITS.accept.includes(file.type)) {
        toast.error(`${file.name}: only ${UPLOAD_LIMITS.acceptLabel} files are allowed.`);
        continue;
      }
      if (file.size > UPLOAD_LIMITS.maxBytes) {
        toast.error(`${file.name} is larger than 10MB.`);
        continue;
      }
      setUploading((n) => n + 1);
      const ext = file.type === "image/jpeg" ? "jpg" : file.type.split("/")[1];
      const path = `${me.id}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("listing-media").upload(path, file, { contentType: file.type });
      setUploading((n) => n - 1);
      if (error) {
        toast.error(`${file.name} didn't upload. Try again.`);
        continue;
      }
      const item = { url: `${MEDIA_ROUTE_PREFIX}${path}`, type: file.type.startsWith("video/") ? ("video" as const) : ("image" as const) };
      dirty.current = true;
      setDraft((d) => ({ ...d, media: [...d.media, item] }));
    }
  }

  async function onPublish() {
    for (let i = 0; i < STEP_SCHEMAS.length; i++) {
      if (!validateStep(i)) {
        setStep(i);
        return;
      }
    }
    setPublishing(true);
    const res = await publishListing({ data: draft });
    setPublishing(false);
    if (!res.ok) {
      if ("fieldErrors" in res && res.fieldErrors) setErrors(res.fieldErrors as Partial<Record<keyof ListingDraft, string>>);
      { toast.error(res.error); return; }
    }
    dirty.current = false;
    queryClient.removeQueries({ queryKey: draftQueryOptions.queryKey });
    queryClient.invalidateQueries({ queryKey: ["me", "listings"] });
    queryClient.invalidateQueries({ queryKey: ["listings"] });
    toast.success("Your item is live!");
    navigate({ to: "/items/$id", params: { id: res.id } });
  }

  return (
    <section className="px-4 py-10 md:py-14">
      <div className="mx-auto max-w-3xl">
        <PageTitle
          title="Post an item"
          subtitle={savedAt ? `Draft saved ${new Date(savedAt).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}` : "Your progress saves automatically."}
        />
        <ol className="mt-8 grid grid-cols-4 gap-2" aria-label="Steps">
          {STEPS.map((s, i) => (
            <li key={s}>
              <button
                type="button"
                onClick={() => (i < step || validateStep(step)) && setStep(i)}
                className={cn("w-full rounded-xl border-b-4 px-2 py-3 text-sm font-semibold", i === step ? "border-honey bg-card" : i < step ? "border-ink/30 text-muted-foreground" : "border-border text-muted-foreground")}
                aria-current={i === step ? "step" : undefined}
              >
                {i + 1}. {s}
              </button>
            </li>
          ))}
        </ol>

        <div className="mt-6 space-y-6 rounded-2xl bg-card p-6 shadow-card md:p-8">
          {step === 0 && (
            <>
              <Field label="Title" htmlFor="title" error={errors.title} hint={`${draft.title.length}/${TITLE_MAX}`}>
                <Input id="title" maxLength={TITLE_MAX} value={draft.title} onChange={(e) => update({ title: e.target.value })} placeholder="e.g. Drone 4K Mini" />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Category" htmlFor="category" error={errors.category}>
                  <Select id="category" value={draft.category} onChange={(e) => update({ category: e.target.value as ListingDraft["category"] })}>
                    <option value="">Choose…</option>
                    {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </Select>
                </Field>
                <Field label="Condition" htmlFor="condition" error={errors.condition}>
                  <Select id="condition" value={draft.condition} onChange={(e) => update({ condition: e.target.value })}>
                    <option value="">Choose…</option>
                    {CONDITIONS.map((c) => <option key={c} value={c}>{c}</option>)}
                  </Select>
                </Field>
              </div>
              <Field label="Description" htmlFor="description" error={errors.description} hint="What's included, how to use it, anything to watch out for.">
                <Textarea id="description" maxLength={2000} rows={6} value={draft.description} onChange={(e) => update({ description: e.target.value })} />
              </Field>
              <Field label="Tags" htmlFor="tags" error={errors.tags} hint="Press Enter to add. Up to 10.">
                <Input
                  id="tags"
                  value={tagInput}
                  maxLength={24}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key !== "Enter") return;
                    e.preventDefault();
                    const t = tagInput.trim().toLowerCase();
                    if (t && !draft.tags.includes(t) && draft.tags.length < 10) update({ tags: [...draft.tags, t] });
                    setTagInput("");
                  }}
                />
                <Chips items={draft.tags.map((t) => `#${t}`)} onRemove={(i) => update({ tags: draft.tags.filter((_, j) => j !== i) })} />
              </Field>
            </>
          )}

          {step === 1 && (
            <>
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="Daily rate (₹)" htmlFor="daily" error={errors.dailyRate}>
                  <Input id="daily" type="number" min={0} inputMode="decimal" value={draft.dailyRate ?? ""} onChange={(e) => update({ dailyRate: numOrNull(e.target.value) })} />
                </Field>
                <Field label="Hourly rate (₹)" htmlFor="hourly" error={errors.hourlyRate}>
                  <Input id="hourly" type="number" min={0} inputMode="decimal" value={draft.hourlyRate ?? ""} onChange={(e) => update({ hourlyRate: numOrNull(e.target.value) })} />
                </Field>
                <Field label="Flat rate (₹)" htmlFor="flat" error={errors.flatRate}>
                  <Input id="flat" type="number" min={0} inputMode="decimal" value={draft.flatRate ?? ""} onChange={(e) => update({ flatRate: numOrNull(e.target.value) })} />
                </Field>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Quantity" htmlFor="qty" error={errors.quantity}>
                  <Input id="qty" type="number" min={1} max={99} value={draft.quantity} onChange={(e) => update({ quantity: Math.trunc(Number(e.target.value) || 0) })} />
                </Field>
                <Field label="Refundable deposit (₹)" htmlFor="deposit" error={errors.deposit}>
                  <Input id="deposit" type="number" min={0} value={draft.deposit} onChange={(e) => update({ deposit: Number(e.target.value) || 0 })} />
                </Field>
              </div>
              <Field label="Rental agreement" htmlFor="agreement" error={errors.agreementTemplate}>
                <div className="grid gap-3" id="agreement">
                  {AGREEMENT_TEMPLATES.map((t) => (
                    <label key={t.value} className={cn("flex cursor-pointer gap-3 rounded-xl border-2 p-4", draft.agreementTemplate === t.value ? "border-honey bg-honey-soft" : "border-input")}>
                      <input type="radio" name="agreement" className="mt-1 accent-ink" checked={draft.agreementTemplate === t.value} onChange={() => update({ agreementTemplate: t.value })} />
                      <span>
                        <span className="block font-semibold">{t.label}</span>
                        <span className="text-sm text-muted-foreground">{t.summary}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </Field>
              <Field label="House rules" htmlFor="rules" error={errors.rules} hint="Press Enter to add.">
                <Input
                  id="rules"
                  value={ruleInput}
                  maxLength={200}
                  onChange={(e) => setRuleInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key !== "Enter") return;
                    e.preventDefault();
                    const r = ruleInput.trim();
                    if (r && draft.rules.length < 20) update({ rules: [...draft.rules, r] });
                    setRuleInput("");
                  }}
                />
                <Chips items={draft.rules} onRemove={(i) => update({ rules: draft.rules.filter((_, j) => j !== i) })} />
              </Field>
              <label className="flex items-center gap-3 font-semibold">
                <input type="checkbox" className="size-5 accent-ink" checked={draft.available} onChange={(e) => update({ available: e.target.checked })} />
                Available to rent right away
              </label>
            </>
          )}

          {step === 2 && (
            <Field label="Photos & video" htmlFor="files" error={errors.media} hint={`${UPLOAD_LIMITS.acceptLabel}, up to 10MB each, ${UPLOAD_LIMITS.maxFiles} files. Add at least one photo.`}>
              <label htmlFor="files" className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-input p-10 text-center transition hover:border-ring">
                <Icon name="add_photo_alternate" size={40} />
                <span className="font-semibold">{uploading ? `Uploading ${uploading}…` : "Choose files"}</span>
                <input id="files" type="file" multiple accept={UPLOAD_LIMITS.accept.join(",")} className="sr-only" onChange={(e) => { onFiles(e.target.files); e.target.value = ""; }} />
              </label>
              {draft.media.length > 0 && (
                <ul className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-5">
                  {draft.media.map((m, i) => (
                    <li key={m.url} className="relative aspect-square overflow-hidden rounded-xl bg-muted">
                      {m.type === "video" ? (
                        <video src={m.url} className="size-full object-cover" muted />
                      ) : (
                        <img src={m.url} alt="" className="size-full object-cover" />
                      )}
                      <button type="button" aria-label="Remove file" onClick={() => update({ media: draft.media.filter((_, j) => j !== i) })} className="absolute right-1 top-1 flex size-7 items-center justify-center rounded-full bg-card/90">
                        <Icon name="close" size={16} />
                      </button>
                      {i === 0 && <span className="absolute bottom-1 left-1 rounded-full bg-honey px-2 text-xs font-semibold">Cover</span>}
                    </li>
                  ))}
                </ul>
              )}
            </Field>
          )}

          {step === 3 && (
            <Field label="Pickup spot on campus" htmlFor="location" error={errors.location}>
              <div className="grid gap-2 sm:grid-cols-2" id="location">
                {CAMPUS_LOCATIONS.map((l) => (
                  <label key={l} className={cn("flex cursor-pointer items-center gap-3 rounded-xl border-2 p-3", draft.location === l ? "border-honey bg-honey-soft" : "border-input")}>
                    <input type="radio" name="location" className="accent-ink" checked={draft.location === l} onChange={() => update({ location: l })} />
                    <Icon name="location_on" size={20} /> {l}
                  </label>
                ))}
              </div>
            </Field>
          )}

          <div className="flex justify-between gap-3 border-t pt-6">
            <Button type="button" variant="outline" disabled={step === 0} onClick={() => setStep((s) => s - 1)}>Back</Button>
            {step < STEPS.length - 1 ? (
              <Button type="button" onClick={() => validateStep(step) && setStep((s) => s + 1)} disabled={uploading > 0}>Continue</Button>
            ) : (
              <Button type="button" variant="ink" onClick={onPublish} disabled={publishing || uploading > 0}>
                {publishing ? "Publishing…" : "Publish listing"}
              </Button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function Chips({ items, onRemove }: { items: string[]; onRemove: (i: number) => void }) {
  if (!items.length) return null;
  return (
    <ul className="flex flex-wrap gap-2">
      {items.map((t, i) => (
        <li key={`${t}-${i}`} className="flex items-center gap-1 rounded-full bg-honey-soft py-1 pl-3 pr-1 text-sm">
          {t}
          <button type="button" aria-label={`Remove ${t}`} onClick={() => onRemove(i)} className="flex size-6 items-center justify-center rounded-full hover:bg-card">
            <Icon name="close" size={14} />
          </button>
        </li>
      ))}
    </ul>
  );
}
