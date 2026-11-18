import { Link } from "@tanstack/react-router";
import { useId, useState } from "react";
import { BRAND, CURRENCY, formatMoney, PLATFORM_FEE_LABEL } from "@/lib/config";
import { estimateEarnings } from "@/lib/pricing";
import { buttonVariants } from "./ui/button";

function clampNumber(value: string, max: number) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(n, max);
}

export function EarningsCalculator() {
  const [price, setPrice] = useState("400");
  const [days, setDays] = useState("6");
  const priceId = useId();
  const daysId = useId();

  const dailyPrice = clampNumber(price, 1_000_000);
  const rentedDays = clampNumber(days, 31);
  const { gross, fee, net } = estimateEarnings(dailyPrice, rentedDays);
  const inputCls = "h-14 w-full rounded-xl border-2 border-input bg-card px-4 text-lg outline-none focus:border-ring";

  return (
    <div className="overflow-hidden rounded-3xl border-t-8 border-honey bg-card p-6 text-card-foreground shadow-xl md:p-10">
      <h2 className="text-center text-3xl font-semibold">Earnings Estimate</h2>
      <div className="mt-8 space-y-6">
        <div>
          <label htmlFor={priceId} className="mb-2 block font-semibold">Your daily price</label>
          <div className="flex items-center gap-3">
            <span aria-hidden>{CURRENCY.symbol}</span>
            <input id={priceId} type="number" inputMode="decimal" min={0} value={price} onChange={(e) => setPrice(e.target.value)} className={inputCls} />
            <span className="shrink-0">per day</span>
          </div>
        </div>
        <div>
          <label htmlFor={daysId} className="mb-2 block font-semibold">{"Days it's rented in a month"}</label>
          <div className="flex items-center gap-3">
            <input id={daysId} type="number" inputMode="numeric" min={0} max={31} value={days} onChange={(e) => setDays(e.target.value)} className={inputCls} />
            <span className="shrink-0">days</span>
          </div>
        </div>
      </div>
      <div className="mt-8 rounded-2xl bg-background p-6 text-center" aria-live="polite">
        <p className="text-muted-foreground">
          {formatMoney(dailyPrice)} × {rentedDays} days = {formatMoney(gross)}
        </p>
        <p className="text-muted-foreground">
          - {PLATFORM_FEE_LABEL} {BRAND.name} fee ({formatMoney(Math.round(fee))})
        </p>
        <p className="mt-1 text-sm text-muted-foreground">{"You'd receive about"}</p>
        <p className="mt-2 font-heading text-5xl font-semibold">{formatMoney(Math.round(net))}</p>
        <p className="mt-4 text-sm text-muted-foreground">An estimate, not a promise. What you earn depends on demand near you.</p>
      </div>
      <Link to="/post-item" className={buttonVariants({ size: "lg", className: "mt-8 w-full" })}>
        Start Listing Items
      </Link>
    </div>
  );
}
