import { createContext, useContext, useEffect, useState } from 'react';
import { apiFetch, apiJson } from './api';

type User = { id:string; email:string; name:string; role:string; image?:string|null };
type Session = { user: User | null };

const Ctx = createContext<{ user: User|null; loading:boolean; refresh:()=>Promise<void>; signOut:()=>Promise<void> }>({ user:null, loading:true, refresh: async()=>{}, signOut: async()=>{} });

export function AuthProvider({ children }: any){
  const [user, setUser] = useState<User|null>(null);
  const [loading, setLoading] = useState(true);
  const refresh = async()=>{
    try{
      const res = await apiFetch('/api/auth/get-session');
      if(!res.ok){ setUser(null); return; }
      const data = await res.json();
      setUser(data?.user ?? null);
    } finally { setLoading(false); }
  };
  useEffect(()=>{ refresh(); },[]);
  const signOut = async()=>{ await apiFetch('/api/auth/sign-out',{method:'POST'}); setUser(null); };
  return <Ctx.Provider value={{user,loading,refresh,signOut}}>{children}</Ctx.Provider>;
}
export const useAuth = ()=> useContext(Ctx);

export async function signUp(email:string,password:string,name:string){
  return apiJson('/api/auth/sign-up/email',{method:'POST', body: JSON.stringify({email,password,name})});
}
export async function signIn(email:string,password:string){
  return apiJson('/api/auth/sign-in/email',{method:'POST', body: JSON.stringify({email,password})});
}
