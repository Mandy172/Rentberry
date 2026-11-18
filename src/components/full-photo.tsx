import { cn } from "@/lib/utils";

/**
 * Shows the whole photo (never cropped) inside a fixed frame. A blurred copy of the same
 * photo fills any empty space so tall or wide pictures still look tidy.
 */
export function FullPhoto({
  src,
  alt,
  className,
  imgClassName,
  loading,
}: {
  src: string;
  alt: string;
  className?: string;
  imgClassName?: string;
  loading?: "lazy" | "eager";
}) {
  return (
    <div className={cn("relative overflow-hidden bg-muted", className)}>
      <img src={src} alt="" aria-hidden="true" loading={loading} className="absolute inset-0 size-full scale-110 object-cover opacity-60 blur-2xl" />
      <img src={src} alt={alt} loading={loading} className={cn("relative size-full object-contain", imgClassName)} />
    </div>
  );
}
