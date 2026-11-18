import { Link } from "@tanstack/react-router";
import { BRAND } from "@/lib/config";
import { Logo } from "./logo";

export function SiteFooter() {
  return (
    <footer className="bg-ink pb-24 text-ink-foreground/70 lg:pb-0">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 md:grid-cols-4 md:px-6">
        <div className="md:col-span-2">
          <div className="text-ink-foreground">
            <Logo />
          </div>
          <p className="mt-4 max-w-sm leading-relaxed">
            The rental marketplace for the {BRAND.community} community. Borrow from classmates, earn from what you own.
          </p>
        </div>
        <nav aria-label="Marketplace">
          <h2 className="mb-3 font-semibold text-honey">Marketplace</h2>
          <ul className="space-y-2">
            <li><Link to="/browse" className="hover:text-ink-foreground">Browse Items</Link></li>
            <li><Link to="/post-item" className="hover:text-ink-foreground">Post an Item</Link></li>
            <li><Link to="/earnings" className="hover:text-ink-foreground">Earnings Estimator</Link></li>
          </ul>
        </nav>
        <nav aria-label="Company">
          <h2 className="mb-3 font-semibold text-honey">{BRAND.name}</h2>
          <ul className="space-y-2">
            <li><Link to="/blog" className="hover:text-ink-foreground">Blog</Link></li>
            <li><Link to="/" hash="how-it-works" className="hover:text-ink-foreground">How it works</Link></li>
            <li><a href={`mailto:${BRAND.supportEmail}`} className="hover:text-ink-foreground">Support</a></li>
          </ul>
        </nav>
      </div>
      <div className="border-t border-ink-foreground/10 py-6 text-center text-sm">
        © {new Date().getFullYear()} {BRAND.name}. For {BRAND.communityShort} students, faculty and staff.
      </div>
    </footer>
  );
}
