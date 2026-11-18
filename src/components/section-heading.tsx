import { cn } from "@/lib/utils";

export function SectionHeading({ title, subtitle, className, as: As = "h2" }: { title: string; subtitle?: string; className?: string; as?: "h1" | "h2" }) {
  return (
    <div className={cn("text-center", className)}>
      <As className="text-4xl font-semibold md:text-5xl">{title}</As>
      <span className="mx-auto mt-5 block h-1 w-16 rounded-full bg-honey" aria-hidden />
      {subtitle && <p className="mt-5 text-lg text-muted-foreground md:text-xl">{subtitle}</p>}
    </div>
  );
}
