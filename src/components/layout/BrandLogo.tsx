import { cn } from "@/lib/utils";

type BrandLogoProps = {
  compact?: boolean;
  className?: string;
};

export default function BrandLogo({
  compact = false,
  className,
}: BrandLogoProps) {
  return (
    <div className={cn("inline-flex items-center", className)} aria-label="CampusCord">
      {compact ? (
        <img
          src="/images/logo/campus-cord-logo-sidebar-collapsed.png"
          alt="CampusCord"
          className="block h-10 w-10 object-contain"
        />
      ) : (
        <img
          src="/images/logo/campus-cord-logo.png"
          alt="CampusCord"
          className="block h-10 w-auto max-w-none"
        />
      )}
    </div>
  );
}
