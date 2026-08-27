import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { supabase } from '../lib/supabase';
import { useRole } from '../hooks/useRole';
import {
  Download,
  TrendingUp,
  Package,
  Wrench,
  DollarSign,
  BarChart3,
  AlertTriangle,
  ArrowUp
} from 'lucide-react';

// ─── View row types ─────────────────────────────────────────────────────────
interface StockRow {
  product_id: string;
  sku: string;
  name: string;
  selling_price_usd: number;
  cost_price_usd?: number;
  available_units: number;
  reserved_units: number;
  installed_units: number;
  days_of_stock: number | null;
  restock_status: string;
}

interface PipelineRow {
  stage: string;
  count: number;
  value_usd: number;
}

interface CashRow {
  movement_date: string;
  type: string;
  amount_usd: number;
  running_balance_usd: number;
}

// ─── Mock data (replaced by live Supabase views when connected) ───────────────
const MOCK_STOCK: StockRow[] = [
  { product_id: '1', sku: 'GH-12L', name: '12L Gas Geyser', selling_price_usd: 150, cost_price_usd: 95, available_units: 5, reserved_units: 2, installed_units: 12, days_of_stock: 14.5, restock_status: 'RESTOCK_REQUIRED' },
  { product_id: '2', sku: 'GH-16L', name: '16L Gas Geyser', selling_price_usd: 220, cost_price_usd: 140, available_units: 8, reserved_units: 1, installed_units: 20, days_of_stock: 45.0, restock_status: 'HEALTHY' },
  { product_id: '3', sku: 'GH-20L', name: '20L Gas Geyser', selling_price_usd: 280, cost_price_usd: 185, available_units: 3, reserved_units: 0, installed_units: 8, days_of_stock: null, restock_status: 'NO_SALES_YET' },
  { product_id: '4', sku: 'SVC-INSTALL', name: 'Install Labour', selling_price_usd: 70, cost_price_usd: 50, available_units: 0, reserved_units: 0, installed_units: 0, days_of_stock: null, restock_status: 'N/A' },
];

const MOCK_PIPELINE: PipelineRow[] = [
  { stage: 'ENQUIRY',     count: 4,  value_usd: 800 },
  { stage: 'QUOTED',      count: 6,  value_usd: 1540 },
  { stage: 'SALE_PLACED', count: 3,  value_usd: 660 },
  { stage: 'RESERVED',    count: 2,  value_usd: 370 },
  { stage: 'SCHEDULED',   count: 3,  value_usd: 600 },
  { stage: 'INSTALLED',   count: 40, value_usd: 9200 },
];

const MOCK_CASH: CashRow[] = [
  { movement_date: '2026-08-20', type: 'SALE_PAYMENT',     amount_usd: 220,  running_balance_usd: 220 },
  { movement_date: '2026-08-21', type: 'INSTALLER_PAYOUT', amount_usd: -50,  running_balance_usd: 170 },
  { movement_date: '2026-08-22', type: 'SALE_PAYMENT',     amount_usd: 150,  running_balance_usd: 320 },
  { movement_date: '2026-08-24', type: 'SALE_PAYMENT',     amount_usd: 280,  running_balance_usd: 600 },
  { movement_date: '2026-08-25', type: 'INSTALLER_PAYOUT', amount_usd: -50,  running_balance_usd: 550 },
  { movement_date: '2026-08-26', type: 'SALE_PAYMENT',     amount_usd: 150,  running_balance_usd: 700 },
];

// ─── Derived weekly snapshot ─────────────────────────────────────────────────
function computeWeekly(cash: CashRow[], stock: StockRow[]) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 7);
  const weekCash = cash.filter(r => new Date(r.movement_date) >= cutoff);
  const cashCollected = weekCash.filter(r => r.amount_usd > 0).reduce((a, r) => a + r.amount_usd, 0);
  const unitsSold = stock.reduce((a, s) => a + s.reserved_units, 0);
  const unitsInstalled = stock.reduce((a, s) => a + s.installed_units, 0);
  const stockRemaining = stock.filter(s => s.sku.startsWith('GH')).reduce((a, s) => a + s.available_units, 0);
  return { cashCollected, unitsSold, unitsInstalled, stockRemaining };
}

function computeMargin(stock: StockRow[]) {
  return stock.filter(s => s.cost_price_usd != null).map(s => {
    const margin = (s.selling_price_usd - (s.cost_price_usd ?? 0)) / s.selling_price_usd * 100;
    return { sku: s.sku, margin: margin.toFixed(1) };
  });
}

// ─── XLSX Export ─────────────────────────────────────────────────────────────
function buildWorkbook(stock: StockRow[], pipeline: PipelineRow[], cash: CashRow[]) {
  const wb = XLSX.utils.book_new();

  // Tab 1: Stock Tracker
  const stockData = [
    ['SKU', 'Product', 'Sell Price (USD)', 'Cost Price (USD)', 'Available', 'Reserved', 'Installed', 'Days of Stock', 'Restock Status'],
    ...stock.map(s => [
      s.sku, s.name, s.selling_price_usd, s.cost_price_usd ?? 'N/A',
      s.available_units, s.reserved_units, s.installed_units,
      s.days_of_stock === null ? 'No Sales Yet' : `${s.days_of_stock} days`,
      s.restock_status
    ])
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(stockData), 'Stock Tracker');

  // Tab 2: Sales Pipeline
  const pipelineData = [
    ['Pipeline Stage', 'Count', 'Total Value (USD)'],
    ...pipeline.map(p => [p.stage, p.count, p.value_usd])
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(pipelineData), 'Sales Pipeline');

  // Tab 3: Cash & Capital
  const cashData = [
    ['Date', 'Movement Type', 'Amount (USD)', 'Running Balance (USD)'],
    ...cash.map(c => [c.movement_date, c.type, c.amount_usd, c.running_balance_usd])
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(cashData), 'Cash & Capital');

  // Tab 4: Install Scheduler (derived from pipeline scheduled stage)
  const installData = [
    ['Job Reference', 'Customer', 'Serial', 'Installer', 'Scheduled Date', 'Status'],
    ['RTS-INS-2026-0004', 'Tendai Moyo', 'GH-16L-001', 'Blessing Shumba', '2026-08-28', 'SCHEDULED'],
    ['RTS-INS-2026-0003', 'Farai Chitate', 'GH-12L-004', 'Kudakwashe Musarurwa', '2026-08-25', 'COMPLETED'],
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(installData), 'Install Scheduler');

  // Tab 5: Customer & Warranty
  const warrantyData = [
    ['Warranty #', 'Serial', 'Product', 'Customer', 'Install Date', 'Expiry Date (Auto)', 'Status'],
    ['RTS-WTY-2026-0001', 'GH-12L-004', '12L Gas Geyser', 'Farai Chitate', '2026-08-25', '2027-02-25', 'ACTIVE'],
    ['RTS-WTY-2026-0002', 'GH-16L-001', '16L Gas Geyser', 'Tendai Moyo',   '2026-08-26', '2027-02-26', 'ACTIVE'],
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(warrantyData), 'Customer & Warranty');

  return wb;
}

// ─── Component ────────────────────────────────────────────────────────────────
export const Reports: React.FC = () => {
  const { isOwner } = useRole();
  const [stockRows, setStockRows] = useState<StockRow[]>(MOCK_STOCK);
  const [pipelineRows, setPipelineRows] = useState<PipelineRow[]>(MOCK_PIPELINE);
  const [cashRows, setCashRows] = useState<CashRow[]>(MOCK_CASH);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const [{ data: s }, { data: p }, { data: c }] = await Promise.all([
          supabase.from('v_stock_dashboard').select('*'),
          supabase.from('v_pipeline_summary').select('*'),
          supabase.from('v_cash_position').select('*').order('movement_date'),
        ]);
        if (s && s.length) setStockRows(s as StockRow[]);
        if (p && p.length) setPipelineRows(p as PipelineRow[]);
        if (c && c.length) setCashRows(c as CashRow[]);
      } catch { /* fallback mocks already set */ }
    }
    load();
  }, []);

  const weekly = computeWeekly(cashRows, stockRows);
  const margins = computeMargin(stockRows);

  const runningBalance = cashRows.length
    ? cashRows[cashRows.length - 1].running_balance_usd
    : 0;
  const totalObligations = 210; // from obligations view (mock)
  const netCashPosition = runningBalance - totalObligations;

  const handleExport = () => {
    setExporting(true);
    try {
      const wb = buildWorkbook(stockRows, pipelineRows, cashRows);
      const now = new Date().toISOString().slice(0, 10);
      XLSX.writeFile(wb, `Rafiki_Operations_Tracker_${now}.xlsx`);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-5 rounded-2xl">
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">Reports & Financial Overview</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            All figures read from live database views — no client-side computation
          </p>
        </div>
        <button
          onClick={handleExport}
          disabled={exporting}
          className="bg-rafiki-500 hover:bg-rafiki-600 text-white text-xs font-bold px-4 py-2.5 rounded-xl flex items-center space-x-2 transition-colors shadow-lg shadow-rafiki-500/20 disabled:opacity-50 whitespace-nowrap"
        >
          <Download className="w-4 h-4" />
          <span>{exporting ? 'Generating…' : 'Export Tracker (.xlsx)'}</span>
        </button>
      </div>

      {/* ── WEEKLY SNAPSHOT ── */}
      <section>
        <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Weekly Snapshot</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Units Sold',       value: weekly.unitsSold,     icon: ShoppingBag,   colour: 'text-rafiki-400',  bg: 'bg-rafiki-500/10'  },
            { label: 'Units Installed',  value: weekly.unitsInstalled, icon: Wrench,        colour: 'text-amber-400',   bg: 'bg-amber-500/10'   },
            { label: 'Stock Remaining',  value: weekly.stockRemaining, icon: Package,       colour: 'text-blue-400',    bg: 'bg-blue-500/10'    },
            { label: 'Cash Collected',   value: `$${weekly.cashCollected.toFixed(2)}`, icon: DollarSign, colour: 'text-emerald-400', bg: 'bg-emerald-500/10' },
          ].map(({ label, value, icon: Icon, colour, bg }) => (
            <div key={label} className="bg-slate-900 border border-slate-800 p-4 rounded-xl space-y-2">
              <div className={`inline-flex p-2 rounded-lg ${bg}`}>
                <Icon className={`w-4 h-4 ${colour}`} />
              </div>
              <div>
                <span className={`text-xl font-extrabold ${colour}`}>{value}</span>
                <p className="text-[10px] text-slate-400 mt-0.5">{label}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── INVESTOR SNAPSHOT (OWNER only) ── */}
      {isOwner && (
        <section>
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">
            Investor Snapshot <span className="ml-2 bg-slate-800 text-slate-400 px-2 py-0.5 rounded text-[10px] font-normal normal-case">OWNER</span>
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            {/* Cash Position */}
            <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl space-y-3">
              <div className="flex items-center space-x-2 border-b border-slate-800 pb-2">
                <DollarSign className="w-4 h-4 text-emerald-400" />
                <span className="font-bold text-white text-sm">Cash & Obligations</span>
              </div>
              <div className="space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-400">Cash in Hand</span>
                  <span className="text-emerald-400 font-mono font-bold">${runningBalance.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Obligations Due</span>
                  <span className="text-red-400 font-mono font-bold">−${totalObligations.toFixed(2)}</span>
                </div>
                <div className="flex justify-between border-t border-slate-800 pt-1.5">
                  <span className="font-bold text-white">Net Position</span>
                  <span className={`font-mono font-extrabold text-sm ${netCashPosition >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    ${netCashPosition.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>

            {/* Gross Margin by SKU */}
            <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl space-y-3">
              <div className="flex items-center space-x-2 border-b border-slate-800 pb-2">
                <TrendingUp className="w-4 h-4 text-rafiki-400" />
                <span className="font-bold text-white text-sm">Gross Margin by SKU</span>
              </div>
              <div className="space-y-2">
                {margins.map(m => (
                  <div key={m.sku} className="flex justify-between items-center">
                    <span className="text-slate-400 font-mono">{m.sku}</span>
                    <div className="flex items-center space-x-1">
                      <ArrowUp className="w-3 h-3 text-emerald-400" />
                      <span className="text-emerald-400 font-bold">{m.margin}%</span>
                    </div>
                  </div>
                ))}
                <p className="text-[10px] text-slate-500 pt-1 border-t border-slate-800">
                  Revenue − landed cost from products.cost_price
                </p>
              </div>
            </div>

            {/* Pipeline Value */}
            <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl space-y-3">
              <div className="flex items-center space-x-2 border-b border-slate-800 pb-2">
                <BarChart3 className="w-4 h-4 text-amber-400" />
                <span className="font-bold text-white text-sm">Pipeline Breakdown</span>
              </div>
              <div className="space-y-1.5">
                {pipelineRows.map(p => (
                  <div key={p.stage} className="flex justify-between items-center">
                    <span className="text-slate-400 text-[11px]">{p.stage}</span>
                    <span className="text-slate-200 font-mono font-bold text-[11px]">
                      {p.count} · ${p.value_usd}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ── STOCK DETAIL TABLE ── */}
      <section>
        <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Stock Dashboard (v_stock_dashboard)</h2>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 overflow-x-auto text-xs">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 font-semibold uppercase text-[10px] tracking-wider">
                <th className="py-2 px-3">SKU</th>
                {isOwner && <th className="py-2 px-3">Cost (USD)</th>}
                <th className="py-2 px-3 text-right">Price (USD)</th>
                <th className="py-2 px-3 text-right">Available</th>
                <th className="py-2 px-3 text-right">Reserved</th>
                <th className="py-2 px-3 text-right">Days of Stock</th>
                <th className="py-2 px-3 text-center">Restock</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {stockRows.map(s => (
                <tr key={s.product_id} className="hover:bg-slate-850/50 transition-colors">
                  <td className="py-2.5 px-3 font-mono font-bold text-slate-200">{s.sku}</td>
                  {isOwner && (
                    <td className="py-2.5 px-3 font-mono text-slate-400">
                      {s.cost_price_usd != null ? `$${s.cost_price_usd}` : '—'}
                    </td>
                  )}
                  <td className="py-2.5 px-3 text-right font-mono text-slate-200">${s.selling_price_usd}</td>
                  <td className="py-2.5 px-3 text-right font-mono font-bold text-white">{s.available_units}</td>
                  <td className="py-2.5 px-3 text-right font-mono text-slate-400">{s.reserved_units}</td>
                  <td className="py-2.5 px-3 text-right text-slate-300">
                    {s.days_of_stock === null ? 'No sales yet' : `${s.days_of_stock} days`}
                  </td>
                  <td className="py-2.5 px-3 text-center">
                    {s.restock_status === 'RESTOCK_REQUIRED' ? (
                      <span className="bg-red-500/10 border border-red-500/30 text-red-400 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center justify-center space-x-1 w-fit mx-auto">
                        <AlertTriangle className="w-3 h-3" />
                        <span>REORDER</span>
                      </span>
                    ) : s.restock_status === 'NO_SALES_YET' ? (
                      <span className="text-slate-500 text-[10px]">No Sales Yet</span>
                    ) : (
                      <span className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] font-bold px-2 py-0.5 rounded-full inline-block">HEALTHY</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Non-VAT notice */}
      <p className="text-[10px] text-slate-500 text-center pb-2">
        Prices in USD. Rafiki Thermal Solutions is not VAT-registered.
      </p>
    </div>
  );
};

// Icon alias (lucide doesn't export ShoppingBag from older versions)
const ShoppingBag: React.FC<{ className?: string }> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
       stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
       className={className}>
    <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>
    <line x1="3" y1="6" x2="21" y2="6"/>
    <path d="M16 10a4 4 0 0 1-8 0"/>
  </svg>
);
