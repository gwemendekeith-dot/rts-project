import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

type Row = Record<string, unknown>;
const configs = {
  enquiries: { title: 'Enquiries', table: 'enquiries', order: 'created_at', columns: ['enquiry_number', 'status', 'source', 'created_at'] },
  quotes: { title: 'Quotes', table: 'quotes', order: 'created_at', columns: ['quote_number', 'status', 'total', 'valid_until'] },
  payments: { title: 'Payments', table: 'payments', order: 'payment_date', columns: ['payment_number', 'amount', 'payment_method', 'status', 'payment_date'] },
  settings: { title: 'System Settings', table: 'system_settings', order: 'updated_at', columns: ['key', 'value'] },
} as const;
type WorkspaceKind = keyof typeof configs;

export function DataWorkspace({ kind }: { kind: WorkspaceKind }) {
  const config = configs[kind];
  const query = useQuery({ queryKey: [kind], queryFn: async () => { const { data, error } = await supabase.from(config.table).select('*').order(config.order, { ascending: false }); if (error) throw error; return (data ?? []) as unknown as Row[]; } });
  if (query.isLoading) return <div className="p-10 text-center text-slate-400">Loading {config.title.toLowerCase()}...</div>;
  if (query.error) return <div className="p-10 text-center text-red-400">Could not load {config.title.toLowerCase()}: {query.error instanceof Error ? query.error.message : String(query.error)}</div>;
  return <div className="mx-auto max-w-5xl space-y-5"><h1 className="text-2xl font-bold text-white">{config.title}</h1><section className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900"><table className="w-full text-left text-sm"><thead><tr className="border-b border-slate-800 text-xs uppercase text-slate-500">{config.columns.map(column => <th key={column} className="px-5 py-3">{column.replace(/_/g, ' ')}</th>)}</tr></thead><tbody>{query.data?.map((row, index) => <tr key={String(row.id ?? index)} className="border-b border-slate-800 last:border-0"><>{config.columns.map(column => <td key={column} className="px-5 py-3 text-slate-300">{String(row[column] ?? '-')}</td>)}</></tr>)}{query.data?.length === 0 && <tr><td colSpan={config.columns.length} className="p-8 text-center text-slate-500">No records yet.</td></tr>}</tbody></table></section></div>;
}
