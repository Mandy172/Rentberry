import { BRAND } from "@/lib/config";
import { Icon } from "../icon";
import { SectionHeading } from "../section-heading";

const REASONS = [
  { icon: "payments", accent: "border-t-honey", title: "Earn from idle stuff", body: "That camera, drafter or speaker sitting in your hostel room can pay for itself. You set the price and the rules." },
  { icon: "handshake", accent: "border-t-neutral-accent", title: "Only verified classmates", body: "Every member confirms their phone and takes a live selfie, so you always know who you're lending to on campus." },
  { icon: "eco", accent: "border-t-ink", title: "Buy less, share more", body: "Borrow the things you only need once a semester instead of buying them. Better for your wallet and the planet." },
];

export function WhyBorrowBee() {
  return (
    <section className="bg-cream px-4 py-20 md:py-28">
      <div className="mx-auto max-w-7xl">
        <SectionHeading title={`Why ${BRAND.name}`} subtitle="A simpler way to get, and share, the things we only need sometimes" />
        <div className="mt-14 grid gap-8 border-t border-ink/5 pt-14 md:grid-cols-3">
          {REASONS.map((r) => (
            <article key={r.title} className={`rounded-2xl border-t-8 ${r.accent} bg-card p-8 text-center shadow-sm md:p-10`}>
              <Icon name={r.icon} size={56} />
              <h3 className="mt-6 text-2xl font-semibold">{r.title}</h3>
              <p className="mt-3 leading-relaxed text-muted-foreground">{r.body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
