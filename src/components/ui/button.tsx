import { cn } from "@/lib/utils";
import Link from "next/link";

const base =
  "inline-flex items-center justify-center gap-1.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none";

const variants: Record<string, string> = {
  primary: "bg-brand text-brand-ink hover:bg-brand-dark",
  secondary: "bg-white text-foreground border border-border hover:bg-gray-50",
  ghost: "text-foreground hover:bg-gray-100",
  danger: "bg-red-600 text-white hover:bg-red-700",
  success: "bg-emerald-600 text-white hover:bg-emerald-700",
  subtle: "bg-brand/10 text-brand-strong hover:bg-brand/20",
};

const sizes: Record<string, string> = {
  sm: "px-2.5 py-1.5 text-xs",
  md: "px-3.5 py-2",
  lg: "px-5 py-2.5 text-base",
};

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
};

export function Button({ className, variant = "primary", size = "md", ...props }: ButtonProps) {
  return (
    <button className={cn(base, variants[variant], sizes[size], className)} {...props} />
  );
}

export function LinkButton({
  href,
  className,
  variant = "primary",
  size = "md",
  children,
}: {
  href: string;
  className?: string;
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
  children: React.ReactNode;
}) {
  return (
    <Link href={href} className={cn(base, variants[variant], sizes[size], className)}>
      {children}
    </Link>
  );
}
