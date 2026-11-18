import { createFileRoute } from "@tanstack/react-router";
import { SectionHeading } from "@/components/section-heading";
import { BRAND } from "@/lib/config";

const POSTS = [
  { title: "How to price your first rental", date: "Nov 10, 2026", excerpt: "Start at 5–10% of the replacement cost per day, then adjust once you see demand around campus." },
  { title: "Five things every hostel room is hiding", date: "Oct 28, 2026", excerpt: "Speakers, extension boards, drafters, induction cooktops and fest costumes — classmates are searching for them right now." },
  { title: `Why ${BRAND.name} verifies every member`, date: "Oct 14, 2026", excerpt: "Phone codes plus a live selfie keep the marketplace limited to real people in our campus community." },
];

export const Route = createFileRoute("/blog")({
  head: () => ({
    meta: [
      { title: `Blog | ${BRAND.name}` },
      { name: "description", content: "Tips for borrowing and lending on campus." },
      { property: "og:title", content: `The ${BRAND.name} Blog` },
      { property: "og:description", content: "Tips for borrowing and lending on campus." },
    ],
  }),
  component: BlogPage,
});

function BlogPage() {
  return (
    <section className="px-4 py-16 md:py-24">
      <div className="mx-auto max-w-4xl">
        <SectionHeading as="h1" title={`The ${BRAND.name} Blog`} subtitle="Tips for borrowing and lending on campus" />
        <ul className="mt-14 space-y-6">
          {POSTS.map((p) => (
            <li key={p.title}>
              <article className="rounded-2xl bg-card p-8 shadow-sm">
                <p className="text-sm text-muted-foreground">{p.date}</p>
                <h2 className="mt-2 text-2xl font-semibold">{p.title}</h2>
                <p className="mt-3 leading-relaxed text-muted-foreground">{p.excerpt}</p>
              </article>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
