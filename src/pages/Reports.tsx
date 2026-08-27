import { useQuery } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { exportOperationsTracker } from '../lib/xlsx';

const usd = (value: number) => `$${Number(value ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;

type DashboardRow = {
  sales_today: number;
  revenue_today: number;
  cash_collected_today: number;
  installations_today: number;
  current_cash_balance: number;
  obligations_due_soon: number;
  quotes_expiring_soon: number;
  low_stock_skus: number;
};

type StockRow = {
  sku: string;
  quantity_available: number;
  days_of_stock_remaining: number | null;
  restock_status: string;
};

type ObligationRow = {
  id: string;
  description: string;
  due_date: string;
  total_amount: number;
  amount_paid: number;
};

export function Reports() {
  const dash = useQuery({
    queryKey: ['v_dashboard'],
    queryFn: async (): Promise<DashboardRow | null> => {
      const { data, error } = await supabase.from('v_dashboard').select('*').single();
      if (error) throw error;
      return data as unknown as DashboardRow;
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

  const obligations = useQuery({
    queryKey: ['obligations'],
    queryFn: async (): Promise<ObligationRow[]> => {
      const { data, error } = await supabase.from('obligations').select('*').neq('status', 'SETTLED');
      if (error) throw error;
      return (data ?? []) as unknown as ObligationRow[];
    },
  });

  if (dash.isLoading) return <div className="p-10 text-center text-slate-400">Loading...</div>;
  if (dash.error) return <div className="p-10 text-center text-red-400">Unable to load reports.</div>;

  const dashboard = dash.data;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Reporting &amp; Exports</h1>
        <button
          onClick={() => void exportOperationsTracker()}
          className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700"
        >
          Export Tracker (.xlsx)
        </button>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="mb-4 text-lg font-semibold text-slate-800">Weekly Snapshot</h2>
        <p className="mb-4 text-sm text-slate-500">The 4 mandatory weekly numbers for operations review.</p>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <StatCard label="Units Sold (Today)" value={dashboard?.sales_today ?? 0} />
          <StatCard label="Units Installed (Today)" value={dashboard?.installations_today ?? 0} />
          <StatCard label="Stock Remaining (12L)" value={stock.data?.find(row => row.sku === 'GH-12L')?.quantity_available ?? 0} />
          <StatCard label="Cash Collected (Today)" value={usd(dashboard?.cash_collected_today ?? 0)} />
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="mb-4 text-lg font-semibold text-slate-800">Investor Snapshot</h2>
        <p className="mb-4 text-sm text-slate-500">Keith supplies, Thokozani co-signs. Generated from live data.</p>

        <div className="grid gap-6 md:grid-cols-2">
          <div>
            <h3 className="mb-2 text-sm font-semibold uppercase text-slate-500">Financial Position</h3>
            <ul className="space-y-2 text-sm">
              <li className="flex justify-between"><span className="text-slate-600">Current Cash Balance:</span> <span className="font-bold">{usd(dashboard?.current_cash_balance ?? 0)}</span></li>
              <li className="flex justify-between"><span className="text-slate-600">Revenue (Today):</span> <span className="font-bold">{usd(dashboard?.revenue_today ?? 0)}</span></li>
              {obligations.data?.map(obligation => (
                <li key={obligation.id} className="flex justify-between border-t border-slate-100 pt-2">
                  <span className="text-slate-600">{obligation.description} (Due {obligation.due_date}):</span>
                  <span className="font-bold text-red-600">{usd(obligation.total_amount - obligation.amount_paid)}</span>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="mb-2 text-sm font-semibold uppercase text-slate-500">Operational Health</h3>
            <ul className="space-y-2 text-sm">
              <li className="flex justify-between"><span className="text-slate-600">Low Stock SKUs:</span> <span className={`font-bold ${dashboard?.low_stock_skus ? 'text-red-600' : 'text-emerald-600'}`}>{dashboard?.low_stock_skus ?? 0}</span></li>
              <li className="flex justify-between"><span className="text-slate-600">Obligations Due Soon:</span> <span className="font-bold">{dashboard?.obligations_due_soon ?? 0}</span></li>
              <li className="flex justify-between"><span className="text-slate-600">Quotes Expiring:</span> <span className="font-bold">{dashboard?.quotes_expiring_soon ?? 0}</span></li>
            </ul>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="mb-4 text-lg font-semibold text-slate-800">Batch 2 Reorder Trigger</h2>
        <p className="mb-4 text-sm text-slate-500">The single most important metric. Reorder at ~30 days or Month 4.</p>
        <div className="grid gap-4 md:grid-cols-3">
          {stock.data?.map(row => (
            <div key={row.sku} className={`rounded-lg border p-4 ${row.restock_status === 'REORDER_NOW' ? 'border-red-300 bg-red-50' : 'border-slate-200 bg-slate-50'}`}>
              <div className="text-xs font-semibold uppercase text-slate-500">{row.sku}</div>
              <div className="mt-1 text-2xl font-bold text-slate-900">{row.quantity_available} units</div>
              <div className={`mt-2 text-sm font-medium ${row.restock_status === 'REORDER_NOW' ? 'text-red-600' : 'text-slate-500'}`}>
                {row.days_of_stock_remaining !== null ? `${row.days_of_stock_remaining} days left` : 'No sales yet'}
              </div>
              {row.restock_status === 'REORDER_NOW' && (
                <div className="mt-2 inline-block rounded bg-red-600 px-2 py-1 text-xs font-bold text-white">REORDER NOW</div>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
      <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 text-xl font-bold text-slate-900">{value}</div>
    </div>
  );
}
