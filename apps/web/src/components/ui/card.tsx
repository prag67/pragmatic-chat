import { cn } from '../../lib/cn';
export function Card({ className, ...p }: any){ return <div className={cn("bg-white rounded-2xl border border-sand-200 shadow-soft", className)} {...p} /> }
export function CardHeader({ className, ...p }: any){ return <div className={cn("p-5 pb-3", className)} {...p} /> }
export function CardContent({ className, ...p }: any){ return <div className={cn("p-5 pt-0", className)} {...p} /> }
