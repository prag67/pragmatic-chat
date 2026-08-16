import { cn } from '../../lib/cn';
export function Input({ className, ...p }: any){
  return <input className={cn("w-full h-10 px-3.5 rounded-xl bg-white border border-sand-200 shadow-soft text-sm placeholder:text-mist-500 focus:ring-2 focus:ring-jade/20 focus:border-jade outline-none transition", className)} {...p} />
}
export function Textarea({ className, ...p }: any){
  return <textarea className={cn("w-full min-h-[88px] p-3.5 rounded-2xl bg-white border border-sand-200 shadow-soft text-sm placeholder:text-mist-500 focus:ring-2 focus:ring-jade/20 focus:border-jade outline-none transition resize-none", className)} {...p} />
}
