import { Link } from "@tanstack/react-router";
import { BRAND, PLATFORM_FEE_LABEL } from "@/lib/config";
import { buttonVariants } from "../ui/button";
import { Icon } from "../icon";

const STATS = [
  { value: "Free", label: "to browse and to list your items" },
  { value: PLATFORM_FEE_LABEL, label: "fee, only when an owner gets paid" },
  { value: "Stripe", label: "handles every payment and payout" },
];

export function Hero() {
  return (
    <section className="bg-hero px-4 py-20 md:py-28">
      <div className="mx-auto max-w-5xl text-center">
        <p className="mx-auto inline-flex items-center gap-2 rounded-full bg-card/70 px-5 py-2.5 font-semibold shadow-sm">
          <Icon name="school" />
          Exclusive to {BRAND.communityShort} • Free to join
        </p>
        <h1 className="mt-10 text-5xl font-semibold leading-[1.05] md:text-7xl">
          Borrow what you need.
          <br />
          <span className="underline decoration-honey decoration-[6px] underline-offset-[10px]">Earn</span> from what you own.
        </h1>
        <p className="mx-auto mt-8 max-w-3xl text-lg leading-relaxed md:text-2xl md:leading-relaxed">
          {BRAND.name} is the peer-to-peer rental marketplace for the {BRAND.community} community. Rent tools, party gear and
          equipment from classmates, or list your own and get paid when someone borrows it.
        </p>
        <dl className="mx-auto mt-14 grid max-w-4xl gap-8 sm:grid-cols-3">
          {STATS.map((s) => (
            <div key={s.value}>
              <dt className="sr-only">{s.label}</dt>
              <dd className="font-heading text-5xl font-semibold">{s.value}</dd>
              <dd className="mt-2 text-sm font-semibold uppercase tracking-wide text-ink/50">{s.label}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-14 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Link to="/browse" className={buttonVariants({ variant: "ink", size: "lg" })}>
            <Icon name="search" />
            Browse Items Near You
          </Link>
          <Link to="/earnings" className={buttonVariants({ variant: "soft", size: "lg" })}>
            <Icon name="payments" />
            Estimate Your Earnings
          </Link>
        </div>
      </div>
    </section>
  );
}
