import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { EarningsSection } from "@/components/home/earnings-section";
import { FeaturedListings } from "@/components/home/featured-listings";
import { Hero } from "@/components/home/hero";
import { HowItWorks } from "@/components/home/how-it-works";
import { TrustStrip } from "@/components/home/trust-strip";
import { WhyRentBerry } from "@/components/home/why-rentberry";
import { BRAND } from "@/lib/config";
import { listingsQueryOptions } from "@/lib/queries";

const featured = listingsQueryOptions({ limit: 3 });

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: `${BRAND.name} | Campus rentals at ${BRAND.communityShort}` },
      { name: "description", content: `Borrow what you need and earn from what you own. The rental marketplace for the ${BRAND.community} community.` },
      { property: "og:title", content: `${BRAND.name} | Campus rentals at ${BRAND.communityShort}` },
      { property: "og:description", content: `Borrow what you need and earn from what you own on ${BRAND.name}.` },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(featured),
  component: HomePage,
});

function HomePage() {
  const { data } = useSuspenseQuery(featured);
  return (
    <>
      <Hero />
      <FeaturedListings listings={data} />
      <TrustStrip />
      <WhyRentBerry />
      <HowItWorks />
      <EarningsSection />
    </>
  );
}
