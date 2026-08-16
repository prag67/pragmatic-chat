import { cn } from '../../lib/cn';
export function Button({ variant="primary", size="md", className, ...p }: any) {
  const base = "inline-flex items-center justify-center font-medium transition-all focus-visible:ring-2 disabled:opacity-50 disabled:pointer-events-none";
  const variants: any = {
    primary: "bg-ink text-white hover:bg-ink-800 shadow-soft active:scale-[0.98]",
    jade: "bg-jade text-white hover:bg-jade-600 shadow-soft active:scale-[0.98]",
    ghost: "hover:bg-sand-100 text-ink-800",
    outline: "border border-sand-300 bg-white hover:bg-sand-100",
    subtle: "bg-sand-100 hover:bg-sand-200 text-ink",
  };
  const sizes: any = {
    sm: "h-8 px-3 text-sm rounded-xl",
    md: "h-9 px-4 text-sm rounded-xl",
    lg: "h-11 px-6 text-sm rounded-2xl",
    icon: "h-9 w-9 rounded-xl",
  };
  return <button className={cn(base, variants[variant], sizes[size], className)} {...p} />;
}
