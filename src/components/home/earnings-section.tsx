import { CATEGORIES } from "@/lib/config";
import { EarningsCalculator } from "../earnings-calculator";
import { Icon } from "../icon";

export function EarningsSection({ asPageHeading = false }: { asPageHeading?: boolean }) {
  const Heading = asPageHeading ? "h1" : "h2";
  return (
    <section id="earnings" className="scroll-mt-20 bg-ink px-4 py-16 text-ink-foreground md:py-24">
      <div className="mx-auto grid max-w-7xl items-start gap-12 lg:grid-cols-2">
        <div>
          <Heading className="font-heading text-4xl font-semibold leading-tight md:text-6xl">See what your items could earn</Heading>
          <p className="mt-6 text-lg leading-relaxed text-ink-foreground/85 md:text-2xl md:leading-relaxed">
            {"You set the price. We don't promise numbers, so here is the arithmetic instead: what you charge, how often it rents, and our fee."}
          </p>
          <ul className="mt-10 space-y-4">
            {CATEGORIES.slice(0, 5).map((c) => (
              <li key={c.value} className="flex items-center gap-5 rounded-2xl border border-ink-foreground/10 bg-ink-foreground/[0.06] p-6">
                <Icon name={c.icon} size={32} />
                <div>
                  <p className="text-lg font-semibold">{c.label}</p>
                  <p className="text-ink-foreground/55">{c.examples}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
        <EarningsCalculator />
      </div>
    </section>
  );
}
