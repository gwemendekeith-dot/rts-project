import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

const fmtUSD = (value: number) => `$${Number(value).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
const daysUntil = (date: string) => Math.ceil((new Date(date).getTime() - Date.now()) / 86_400_000);

type PipelineRow = { stage: string; count: number };
type StockRow = {
  sku: string;
  quantity_available: number;
  days_of_stock_remaining: number | null;
  restock_status: string;
};
type AttentionData = {
  obligations: Array<{ description: string; due_date: string; total_amount: number; amount_paid: number }>;
  installs: Array<{ job_number: string; address: string; scheduled_date: string }>;
  quotes: Array<{ quote_number: string; customer_id: string; valid_until: string }>;
};

export function Dashboard() {
  const dash = useQuery({
    queryKey: ['v_dashboard'],
    queryFn: async () => {
      const { data, error } = await supabase.from('v_dashboard').select('*').single();
      if (error) throw error;
      return data;
    },
  });

  const pipeline = useQuery({
    queryKey: ['v_pipeline_summary'],
    queryFn: async (): Promise<PipelineRow[]> => {
      const { data, error } = await supabase.from('v_pipeline_summary').select('*');
      if (error) throw error;
      return (data ?? []) as unknown as PipelineRow[];
    },
  });

  const stock = useQuery({
    queryKey: ['v_stock_dashboard'],
    queryFn: async (): Promise<StockRow[]> => {
      const { data, error } = await supabase.from('v_stock_dashboard').select('*');
      if (error) throw error;
      return (data ?? []) as unknown as StockRow[];
    },
  });

  const attention = useQuery({
    queryKey: ['attention_queue'],
    queryFn: async (): Promise<AttentionData> => {
      const cutoff30 = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);
      const cutoff2 = new Date(Date.now() + 2 * 86_400_000).toISOString().slice(0, 10);
      const today = new Date().toISOString().slice(0, 10);
      const [obligations, installs, quotes] = await Promise.all([
        supabase.from('obligations').select('description,due_date,total_amount,amount_paid')
          .neq('status', 'SETTLED').lte('due_date', cutoff30),
        supabase.from('installations').select('job_number,address,scheduled_date')
          .eq('scheduled_date', today).in('status', ['SCHEDULED', 'ASSIGNED', 'IN_PROGRESS']),
        supabase.from('quotes').select('quote_number,customer_id,valid_until')
          .in('status', ['SENT', 'VIEWED']).lte('valid_until', cutoff2),
      ]);
      const failed = [obligations, installs, quotes].find(result => result.error);
      if (failed?.error) throw failed.error;
      return {
        obligations: obligations.data ?? [],
        installs: installs.data ?? [],
        quotes: quotes.data ?? [],
      };
    },
  });

  if (dash.isLoading || pipeline.isLoading || stock.isLoading || attention.isLoading) {
    return <div className="p-10 text-center text-slate-400">Loading dashboard...</div>;
  }

  const metrics = dash.data;
  const hasUrgentItems = Boolean(
    (metrics?.obligations_due_soon ?? 0) > 0 ||
    (attention.data?.installs.length ?? 0) > 0 ||
    (metrics?.quotes_expiring_soon ?? 0) > 0,
  );

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <h1 className="text-2xl font-bold text-white">Command Centre</h1>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <Card label="Sales Today" value={metrics?.sales_today ?? 0} />
        <Card label="Revenue Today" value={fmtUSD(metrics?.revenue_today ?? 0)} accent />
        <Card label="Cash Collected" value={fmtUSD(metrics?.cash_collected_today ?? 0)} accent />
        <Card label="Installs Today" value={metrics?.installations_today ?? 0} />
        <Card label="Cash Balance" value={fmtUSD(metrics?.current_cash_balance ?? 0)} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="rounded-xl border border-slate-800 bg-slate-900 p-5">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Needs Attention</h2>
          <ul className="space-y-2 text-sm">
            {(metrics?.obligations_due_soon ?? 0) > 0 && (
              <li className="rounded-md bg-red-500/10 px-3 py-2 text-red-300">
                {metrics.obligations_due_soon} obligation(s) due within 30 days
              </li>
            )}
            {attention.data?.installs.map(install => (
              <li key={install.job_number} className="rounded-md bg-amber-500/10 px-3 py-2 text-amber-300">
                Install {install.job_number} today - {install.address}
              </li>
            ))}
            {(metrics?.quotes_expiring_soon ?? 0) > 0 && (
              <li className="rounded-md bg-amber-500/10 px-3 py-2 text-amber-300">
                {metrics.quotes_expiring_soon} quote(s) expiring in 48h
              </li>
            )}
            {attention.data?.obligations.map(obligation => (
              <li key={`${obligation.description}-${obligation.due_date}`} className="rounded-md bg-slate-950 px-3 py-2 text-slate-400">
                {obligation.description} - {fmtUSD(obligation.total_amount - obligation.amount_paid)} due in {daysUntil(obligation.due_date)}d
              </li>
            ))}
            {!hasUrgentItems && <li className="text-slate-500">Nothing urgent - all clear.</li>}
          </ul>
        </section>

        <section className="rounded-xl border border-slate-800 bg-slate-900 p-5">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Sales Pipeline</h2>
          <ul className="space-y-2">
            {pipeline.data?.map(item => (
              <li key={item.stage} className="flex items-center justify-between text-sm">
                <span className="text-slate-400">{item.stage}</span>
                <span className="rounded-full bg-slate-700 px-2.5 py-0.5 text-xs font-semibold text-white">{item.count}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-xl border border-slate-800 bg-slate-900 p-5">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Stock &amp; Days Remaining</h2>
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs uppercase text-slate-500"><th className="py-1">SKU</th><th>Avail</th><th>Days</th><th>Status</th></tr></thead>
            <tbody>
              {stock.data?.map(item => (
                <tr key={item.sku} className="border-t border-slate-800">
                  <td className="py-2 font-medium text-slate-300">{item.sku}</td>
                  <td className="text-slate-400">{item.quantity_available}</td>
                  <td className="text-slate-400">{item.days_of_stock_remaining ?? '-'}</td>
                  <td><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${item.restock_status === 'REORDER_NOW' ? 'bg-red-500/10 text-red-300' : item.restock_status === 'NO_SALES_YET' ? 'bg-slate-800 text-slate-500' : 'bg-emerald-500/10 text-emerald-300'}`}>{item.restock_status === 'REORDER_NOW' ? 'REORDER NOW' : item.restock_status === 'NO_SALES_YET' ? 'No sales yet' : 'OK'}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </div>
  );
}

function Card({ label, value, accent = false }: { label: string; value: string | number; accent?: boolean }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
      <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
      <div className={`mt-1 text-2xl font-bold ${accent ? 'text-amber-400' : 'text-white'}`}>{value}</div>
    </div>
  );
}
