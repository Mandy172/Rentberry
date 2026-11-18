import { Icon } from "../icon";

const ITEMS = [
  { icon: "verified_user", title: "Verified", body: "phone + selfie for every member" },
  { icon: "lock", title: "Stripe", body: "payments & payouts" },
  { icon: "signature", title: "Signed", body: "agreement on every rental" },
  { icon: "photo_camera", title: "Photo", body: "check-in at pickup & return" },
];

export function TrustStrip() {
  return (
    <section className="bg-ink px-4 py-16 text-ink-foreground md:py-20">
      <ul className="mx-auto grid max-w-7xl gap-12 sm:grid-cols-2 lg:grid-cols-4">
        {ITEMS.map((i) => (
          <li key={i.title} className="text-center">
            <Icon name={i.icon} size={44} />
            <p className="mt-5 font-heading text-4xl font-semibold text-honey">{i.title}</p>
            <p className="mt-3 text-lg text-ink-foreground/80">{i.body}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
