import { useState } from 'react';
import { usePresets, useCreatePreset, useUpdatePreset, useDeletePreset } from '../lib/presets';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card, CardHeader, CardContent } from './ui/card';
import { Badge } from './ui/badge';

export function PresetsModal(){
  const [open, setOpen] = useState(false);
  const { data: presets, isLoading } = usePresets();
  const create = useCreatePreset();
  const update = useUpdatePreset();
  const del = useDeletePreset();
  const [title, setTitle] = useState('');
  const [dataJson, setDataJson] = useState('{"model":"qwen-plus","temperature":0.7}');
  const [editing, setEditing] = useState<string|null>(null);

  const onCreate = async()=>{
    let data:any;
    try{ data=JSON.parse(dataJson);}catch{ alert('JSON ไม่ถูกต้อง'); return; }
    if(editing){
      await update.mutateAsync({ id: editing, title, data });
      setEditing(null);
    } else {
      await create.mutateAsync({ title: title || 'preset', data });
    }
    setTitle(''); setDataJson('{"model":"qwen-plus","temperature":0.7}');
  };

  return (
    <div>
      <Button variant="outline" size="sm" className="w-full" onClick={()=>setOpen(v=>!v)}>{open ? 'ซ่อนพรีเซ็ต' : 'พรีเซ็ต · Presets'}</Button>
      {open && (
        <Card className="mt-2 border-plum/10">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold">พรีเซ็ตของคุณ</h4>
              <Badge variant="plum">{presets?.length ?? 0}</Badge>
            </div>
            <p className="text-[11px] text-mist-500">บันทึกการตั้งค่าโมเดล/พรอมต์เป็น JSON</p>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <Input placeholder="ชื่อพรีเซ็ต" value={title} onChange={(e:any)=>setTitle(e.target.value)} />
              <textarea className="w-full rounded-xl border border-sand-200 bg-white px-3 py-2 text-xs font-mono min-h-[72px] focus:ring-2 focus:ring-plum/20" placeholder='{"model":"qwen-plus"}' value={dataJson} onChange={(e:any)=>setDataJson(e.target.value)} />
              <div className="flex gap-2">
                <Button variant="plum" size="sm" onClick={onCreate} disabled={!title.trim()}>{editing ? 'บันทึก' : 'สร้างพรีเซ็ต'}</Button>
                {editing && <Button variant="ghost" size="sm" onClick={()=>{setEditing(null); setTitle(''); setDataJson('{"model":"qwen-plus"}');}}>ยกเลิก</Button>}
              </div>
            </div>
            <div className="max-h-48 overflow-y-auto space-y-1">
              {isLoading && <div className="text-xs text-mist-500">โหลด…</div>}
              {presets?.map(p=>(
                <div key={p.id} className="flex items-start gap-2 p-2 rounded-xl border border-sand-200 bg-sand-100/50">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{p.title}</div>
                    <div className="text-[11px] font-mono text-mist-500 truncate">{JSON.stringify(p.data)}</div>
                  </div>
                  <button className="text-[11px] text-jade hover:underline" onClick={()=>{ setEditing(p.id); setTitle(p.title); setDataJson(JSON.stringify(p.data, null, 2)); }}>แก้</button>
                  <button className="text-[11px] text-red-600 hover:underline" onClick={()=>{ if(confirm('ลบพรีเซ็ต?')) del.mutate(p.id); }}>ลบ</button>
                </div>
              ))}
              {presets?.length===0 && <div className="text-xs text-mist-500 text-center border border-dashed rounded-xl p-3">ยังไม่มีพรีเซ็ต — สร้างด้านบน</div>}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
