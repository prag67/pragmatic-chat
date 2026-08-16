import { useState } from 'react';
import { useAuth, signIn, signUp } from '../lib/auth';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card, CardHeader, CardContent } from './ui/card';
import { Badge } from './ui/badge';

export function AuthPanel(){
  const { user, loading, refresh, signOut } = useAuth();
  const [mode, setMode] = useState<'in'|'up'>('in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if(loading) return <div className="p-4 text-sm text-mist-500">กำลังโหลด…</div>;
  if(user){
    return (
      <div className="flex items-center gap-3">
        <div className="h-8 w-8 rounded-full bg-jade text-white grid place-items-center text-sm font-semibold">{user.name?.[0] ?? user.email[0].toUpperCase()}</div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium truncate">{user.name || user.email}</div>
          <div className="text-xs text-mist-500 truncate">{user.email}</div>
        </div>
        <Button variant="ghost" size="sm" onClick={signOut}>ออก</Button>
      </div>
    );
  }

  const submit = async(e:any)=>{
    e.preventDefault(); setErr(null); setBusy(true);
    try{
      if(mode==='up'){ await signUp(email,password,name); }
      else { await signIn(email,password); }
      await refresh();
    }catch(ex:any){ setErr(ex.message || 'ผิดพลาด'); }
    finally{ setBusy(false); }
  };

  return (
    <Card className="border-jade/10">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">{mode==='in' ? 'เข้าสู่ระบบ' : 'สมัครสมาชิก'}</h3>
          <Badge variant="jade">@{mode==='in' ? 'pragmaticonline.com' : 'ใหม่'}</Badge>
        </div>
        <p className="text-xs text-mist-500 mt-1">อนุญาตเฉพาะอีเมล @pragmaticonline.com (ทดสอบ @example.com ได้)</p>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-3">
          {mode==='up' && <Input placeholder="ชื่อ" value={name} onChange={(e:any)=>setName(e.target.value)} required />}
          <Input placeholder="อีเมล (name@pragmaticonline.com)" type="email" value={email} onChange={(e:any)=>setEmail(e.target.value)} required />
          <Input placeholder="รหัสผ่าน (≥8 ตัว)" type="password" value={password} onChange={(e:any)=>setPassword(e.target.value)} required minLength={8} />
          {err && <div className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-xl p-2">{err}</div>}
          <Button type="submit" variant="jade" className="w-full" disabled={busy}>{busy ? 'กำลังดำเนินการ…' : mode==='in' ? 'เข้าสู่ระบบ' : 'สร้างบัญชี'}</Button>
          <div className="text-xs text-center text-mist-500">
            {mode==='in' ? 'ยังไม่มีบัญชี?' : 'มีบัญชีแล้ว?'} <button type="button" className="text-jade hover:underline" onClick={()=>setMode(mode==='in'?'up':'in')}>{mode==='in' ? 'สมัครสมาชิก' : 'เข้าสู่ระบบ'}</button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
