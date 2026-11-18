import { SectionHeading } from "../section-heading";

const STEPS = [
  { n: 1, title: "Verify once", body: "Sign in with your phone number and a quick live selfie." },
  { n: 2, title: "Find or list", body: "Browse what classmates are lending, or post your item in minutes." },
  { n: 3, title: "Request & agree", body: "Pick dates, sign the rental agreement, and pay securely through Stripe." },
  { n: 4, title: "Meet on campus", body: "Hand off at a campus spot with photo check-in at pickup and return." },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="scroll-mt-24 px-4 py-20 md:py-28">
      <div className="mx-auto max-w-7xl">
        <SectionHeading title="How it works" subtitle="From request to return in four steps" />
        <ol className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s) => (
            <li key={s.n} className="rounded-2xl bg-card p-7 shadow-sm">
              <span className="flex size-12 items-center justify-center rounded-full bg-honey font-heading text-xl font-semibold">{s.n}</span>
              <h3 className="mt-5 text-xl font-semibold">{s.title}</h3>
              <p className="mt-2 leading-relaxed text-muted-foreground">{s.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
