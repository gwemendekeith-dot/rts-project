import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useRole } from '../hooks/useRole';

type Filter = 'ALL' | 'ACTIVE' | 'EXPIRING' | 'EXPIRED';
type Warranty = {
  id: string; warranty_number: string; start_date: string | null; expiry_date: string | null;
  status: string; service_notes: string | null;
  customers: { first_name: string; last_name: string | null; phone: string } | null;
  serial_numbers: { serial_number: string; products: { description: string | null } | null } | null;
};

export function Warranties() {
  const queryClient = useQueryClient();
  const { isOwner } = useRole();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('ALL');
  const query = useQuery({ queryKey: ['warranties'], queryFn: async () => { const { data, error } = await supabase.from('warranties').select('*, customers(*), serial_numbers(*, products(*))').order('expiry_date', { ascending: true }); if (error) throw error; return (data ?? []) as unknown as Warranty[]; } });
  const rows = useMemo(() => { const term = search.toLowerCase(); const now = Date.now(); return (query.data ?? []).filter(warranty => { const name = `${warranty.customers?.first_name ?? ''} ${warranty.customers?.last_name ?? ''}`.toLowerCase(); const serial = warranty.serial_numbers?.serial_number.toLowerCase() ?? ''; const days = warranty.expiry_date ? (new Date(warranty.expiry_date).getTime() - now) / 86_400_000 : null; return (!term || name.includes(term) || serial.includes(term) || warranty.warranty_number.toLowerCase().includes(term)) && (filter === 'ALL' || (filter === 'ACTIVE' && warranty.status === 'ACTIVE') || (filter === 'EXPIRED' && warranty.status === 'EXPIRED') || (filter === 'EXPIRING' && warranty.status === 'ACTIVE' && days !== null && days <= 30)); }); }, [filter, query.data, search]);
  async function saveNotes(id: string, notes: string) { const { error } = await supabase.from('warranties').update({ service_notes: notes }).eq('id', id); if (error) alert(error.message); else await queryClient.invalidateQueries({ queryKey: ['warranties'] }); }
  if (query.isLoading) return <div className="p-10 text-center text-slate-400">Loading warranties...</div>;
  if (query.error) return <div className="p-10 text-center text-red-400">Could not load warranties.</div>;
  return <div className="mx-auto max-w-5xl space-y-4"><h1 className="text-2xl font-bold text-white">Warranty Register</h1><div className="flex flex-wrap gap-3"><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search serial, customer, or warranty" className="w-full max-w-sm rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white" /><div className="flex gap-1">{(['ALL', 'ACTIVE', 'EXPIRING', 'EXPIRED'] as Filter[]).map(item => <button key={item} onClick={() => setFilter(item)} className={`rounded-md px-3 py-1.5 text-xs ${filter === item ? 'bg-amber-500 text-slate-900' : 'bg-slate-800 text-slate-400'}`}>{item === 'EXPIRING' ? 'Expiring <=30d' : item}</button>)}</div></div><section className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900"><table className="w-full text-left text-sm"><thead><tr className="border-b border-slate-800 text-xs uppercase text-slate-500"><th className="px-5 py-3">Warranty</th><th>Serial</th><th>Customer</th><th>Installed</th><th>Expiry</th><th>Status</th><th>Notes</th></tr></thead><tbody>{rows.map(warranty => <WarrantyRow key={warranty.id} warranty={warranty} isOwner={isOwner} onSave={saveNotes} />)}</tbody></table>{rows.length === 0 && <p className="p-5 text-sm text-slate-500">No warranties match.</p>}</section></div>;
}

function WarrantyRow({ warranty, isOwner, onSave }: { warranty: Warranty; isOwner: boolean; onSave: (id: string, notes: string) => Promise<void> }) {
  const [editing, setEditing] = useState(false);
  const [notes, setNotes] = useState(warranty.service_notes ?? '');
  const days = warranty.expiry_date ? Math.ceil((new Date(warranty.expiry_date).getTime() - Date.now()) / 86_400_000) : null;
  const expiring = warranty.status === 'ACTIVE' && days !== null && days <= 30;
  const tone = warranty.status === 'EXPIRED' ? 'bg-slate-800 text-slate-500' : expiring ? 'bg-amber-500/10 text-amber-300' : warranty.status === 'ACTIVE' ? 'bg-emerald-500/10 text-emerald-300' : 'bg-slate-800 text-slate-400';
  return <tr className="border-b border-slate-800 last:border-0"><td className="px-5 py-3 font-mono text-amber-400">{warranty.warranty_number}</td><td className="font-mono text-slate-200">{warranty.serial_numbers?.serial_number ?? '-'}</td><td className="text-slate-300">{warranty.customers?.first_name} {warranty.customers?.last_name ?? ''}<div className="text-xs text-slate-500">{warranty.customers?.phone}</div></td><td className="text-slate-400">{warranty.start_date ?? '-'}</td><td className="text-slate-400">{warranty.expiry_date ?? '-'}</td><td><span className={`rounded-full px-2 py-1 text-xs font-semibold ${tone}`}>{expiring ? `Expires in ${days}d` : warranty.status}</span></td><td className="min-w-48 pr-5 text-xs text-slate-400">{editing ? <div className="flex gap-1"><input value={notes} onChange={event => setNotes(event.target.value)} className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-white" /><button onClick={async () => { await onSave(warranty.id, notes); setEditing(false); }} className="rounded bg-amber-500 px-2 py-1 text-slate-900">Save</button></div> : <button onClick={() => isOwner && setEditing(true)} className="text-left hover:text-slate-200">{warranty.service_notes || '-'}{isOwner && '  Edit'}</button>}</td></tr>;
}
