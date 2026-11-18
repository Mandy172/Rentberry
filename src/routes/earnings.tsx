import { createFileRoute } from "@tanstack/react-router";
import { EarningsSection } from "@/components/home/earnings-section";
import { BRAND } from "@/lib/config";

export const Route = createFileRoute("/earnings")({
  head: () => ({
    meta: [
      { title: `Earnings estimator | ${BRAND.name}` },
      { name: "description", content: "Work out what your items could earn on campus after the 12.5% fee." },
      { property: "og:title", content: `Earnings estimator | ${BRAND.name}` },
      { property: "og:description", content: "See what your items could earn on campus." },
    ],
  }),
  component: () => <EarningsSection asPageHeading />,
});
