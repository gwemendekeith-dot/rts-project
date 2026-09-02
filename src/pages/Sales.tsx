import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

type SaleRow = {
  id: string;
  sale_number: string;
  sale_date: string;
  total_amount: number;
  amount_paid: number;
  balance_due: number;
  payment_status: string;
  fulfilment_status: string;
  customers: { first_name: string; last_name: string | null; phone: string } | null;
};

const usd = (value: number) => `$${Number(value ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;

export function Sales() {
  const [params] = useSearchParams();
  const search = (params.get('search') ?? '').trim().toLowerCase();
  const query = useQuery({
    queryKey: ['sales'],
    queryFn: async () => {
      const { data, error } = await supabase.from('sales').select('*, customers(first_name,last_name,phone)').order('sale_date', { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as SaleRow[];
    },
  });
  if (query.isLoading) return <div className="p-10 text-center text-slate-400">Loading sales...</div>;
  if (query.error) return <div className="p-10 text-center text-red-400">Could not load sales: {query.error instanceof Error ? query.error.message : String(query.error)}</div>;
  const rows = (query.data ?? []).filter(sale => !search || sale.sale_number.toLowerCase().includes(search) || `${sale.customers?.first_name ?? ''} ${sale.customers?.last_name ?? ''}`.toLowerCase().includes(search) || sale.customers?.phone.includes(search));
  return <div className="mx-auto max-w-5xl space-y-5"><header className="flex items-center justify-between"><div><h1 className="text-2xl font-bold text-white">Sales</h1><p className="text-sm text-slate-400">Commercial sale ledger from the database</p></div><Link to="/new-sale" className="rounded-lg bg-amber-500 px-3 py-2 text-xs font-semibold text-slate-900">+ New Sale</Link></header><section className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900"><table className="w-full text-left text-sm"><thead><tr className="border-b border-slate-800 text-xs uppercase text-slate-500"><th className="px-5 py-3">Sale</th><th>Customer</th><th>Date</th><th>Total</th><th>Balance</th><th>Status</th></tr></thead><tbody>{rows.map(sale => <tr key={sale.id} className="border-b border-slate-800 last:border-0 hover:bg-slate-800"><td className="px-5 py-3"><Link className="font-mono text-amber-400" to={`/sales/${sale.id}`}>{sale.sale_number}</Link></td><td className="text-slate-300">{sale.customers?.first_name} {sale.customers?.last_name ?? ''}<div className="text-xs text-slate-500">{sale.customers?.phone}</div></td><td className="text-slate-400">{new Date(sale.sale_date).toLocaleDateString()}</td><td className="text-slate-200">{usd(sale.total_amount)}</td><td className="text-slate-300">{usd(sale.balance_due)}</td><td><span className="mr-1 rounded bg-slate-800 px-2 py-1 text-xs text-amber-300">{sale.payment_status.replace(/_/g, ' ')}</span><span className="rounded bg-slate-800 px-2 py-1 text-xs text-slate-400">{sale.fulfilment_status.replace(/_/g, ' ')}</span></td></tr>)}{rows.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-slate-500">No sales found.</td></tr>}</tbody></table></section></div>;
}
