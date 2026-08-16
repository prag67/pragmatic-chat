import { cn } from '../../lib/cn';
export function Badge({ variant="sand", className, ...p }: any){
  const v:any={sand:"bg-sand-100 text-ink border border-sand-200", jade:"bg-jade-50 text-jade-700 border border-jade-100", plum:"bg-plum-50 text-plum border border-purple-100", ink:"bg-ink text-white"};
  return <span className={cn("inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium", v[variant], className)} {...p} />
}
