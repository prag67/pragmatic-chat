import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiJson } from '../lib/api';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Card, CardHeader, CardContent } from './ui/card';

type UserRow = { id:string; email:string; name:string; role:string; createdAt:string };

export function AdminPanel(){
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();
  const { data: users, isLoading, error } = useQuery({
    queryKey:['admin-users'],
    queryFn: ()=> apiJson('/api/admin/users') as Promise<UserRow[]>,
    enabled: open,
    retry:false,
  });
  const [target, setTarget] = useState('');
  const [amount, setAmount] = useState('100');
  const adjust = useMutation({
    mutationFn: ({userId, amount}:{userId:string; amount:number})=> apiJson('/api/admin/balances/adjust', { method:'POST', body: JSON.stringify({ userId, amount, reason:'admin panel' })}),
    onSuccess: ()=>{ qc.invalidateQueries({queryKey:['admin-users']}); alert('ปรับเครดิตแล้ว'); }
  });

  if(!open) return <Button variant="outline" size="sm" className="w-full" onClick={()=>setOpen(true)}>แอดมิน · Admin</Button>;
  if(error) return <Card className="mt-2"><CardContent className="p-3 text-xs text-mist-500">ต้องเป็น admin ({(error as any).message}) <Button variant="ghost" size="sm" onClick={()=>setOpen(false)}>ปิด</Button></CardContent></Card>;

  return (
    <Card className="mt-2 border-ink/10">
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <h4 className="text-sm font-semibold">แอดมิน</h4>
        <div className="flex gap-1"><Badge variant="ink">admin</Badge><Button variant="ghost" size="sm" onClick={()=>setOpen(false)}>ปิด</Button></div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="text-xs text-mist-500">รายการผู้ใช้ 100 ล่าสุด — ปรับเครดิตได้</div>
        <div className="max-h-48 overflow-y-auto space-y-1">
          {isLoading && <div className="text-xs">โหลด…</div>}
          {users?.map(u=> (
            <div key={u.id} className="flex items-center gap-2 p-2 rounded-xl border border-sand-200 bg-sand-100/50 text-xs">
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{u.email}</div>
                <div className="text-mist-500">{u.role}</div>
              </div>
              <Button variant="jade" size="sm" onClick={()=>{ setTarget(u.id); }}>เลือก</Button>
            </div>
          ))}
        </div>
        <div className="border-t border-sand-200 pt-2 space-y-2">
          <div className="text-xs font-medium">ปรับเครดิต</div>
          <Input placeholder="userId (เลือกจากด้านบน)" value={target} onChange={(e:any)=>setTarget(e.target.value)} />
          <Input placeholder="จำนวน (+100 / -50)" value={amount} onChange={(e:any)=>setAmount(e.target.value)} />
          <Button variant="plum" size="sm" className="w-full" disabled={!target || !amount} onClick={()=>adjust.mutate({userId:target, amount: parseInt(amount,10)})} >ปรับ {amount}</Button>
          {adjust.isError && <div className="text-xs text-red-600">{(adjust.error as any).message}</div>}
        </div>
      </CardContent>
    </Card>
  );
}
