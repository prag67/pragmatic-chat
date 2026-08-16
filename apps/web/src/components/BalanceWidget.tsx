import { useState } from 'react';
import { useBalance, useTransactions } from '../lib/balances';
import { useAuth } from '../lib/auth';
import { Badge } from './ui/badge';
import { Card, CardContent } from './ui/card';

export function BalanceWidget(){
  const { user } = useAuth();
  const { data: bal, isLoading } = useBalance();
  const [showTx, setShowTx] = useState(false);
  const { data: txs } = useTransactions(20);
  if(!user) return null;
  if(isLoading) return <div className="text-xs text-mist-500 p-3 rounded-xl bg-sand-100 border border-sand-200">โหลดเครดิต…</div>;
  return (
    <div className="space-y-2">
      <Card className="border-jade/10">
        <CardContent className="p-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[11px] tracking-wide uppercase text-mist-500 font-medium">เครดิตคงเหลือ</div>
              <div className="text-lg font-semibold font-display">{bal?.tokenCredits ?? 0} <span className="text-xs font-normal text-mist-500">tokens</span></div>
            </div>
            <Badge variant="jade">คงเหลือ</Badge>
          </div>
          <div className="text-[11px] text-mist-500 mt-1">อัปเดต {bal?.updatedAt ? new Date(bal.updatedAt).toLocaleString('th-TH') : '-'}</div>
          <button onClick={()=>setShowTx(v=>!v)} className="mt-2 text-xs text-jade hover:underline">{showTx ? 'ซ่อนประวัติ' : 'ดูประวัติธุรกรรม'}</button>
        </CardContent>
      </Card>
      {showTx && (
        <div className="rounded-xl border border-sand-200 bg-white max-h-48 overflow-y-auto">
          {(txs?.length ?? 0)===0 ? <div className="p-3 text-xs text-mist-500 text-center">ยังไม่มีธุรกรรม</div> : txs!.map(t=>(
            <div key={t.id} className="flex items-center justify-between px-3 py-2 border-b border-sand-100 last:border-0 text-xs">
              <div><span className={`inline-flex px-2 py-0.5 rounded-lg text-[11px] font-medium ${t.amount>=0 ? 'bg-jade-50 text-jade-700 border border-jade/20' : 'bg-red-50 text-red-700 border border-red-100'}`}>{t.amount>0?`+${t.amount}`:t.amount} {t.type}</span> {t.reason && <span className="text-mist-500 ml-1">{t.reason}</span>}</div>
              <span className="text-mist-500">{new Date(t.createdAt).toLocaleDateString('th-TH')}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
