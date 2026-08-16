import { useModels } from '../lib/models';
export function ModelSelector({ value, onChange }: { value: string; onChange:(v:string)=>void }){
  const { data, isLoading } = useModels();
  const models = data?.data ?? [];
  return (
    <select value={value} onChange={e=>onChange(e.target.value)} className="rounded-xl border border-sand-200 bg-white px-2 py-1 text-xs">
      {isLoading ? <option>โหลด…</option> : models.map(m=> <option key={m.id} value={m.id}>{m.id}</option>)}
      {!isLoading && models.length===0 && <option value="qwen-plus">qwen-plus</option>}
    </select>
  );
}
