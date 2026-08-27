import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useRole } from '../hooks/useRole';
import { 
  DollarSign, 
  ShoppingCart, 
  Wrench, 
  AlertTriangle, 
  Clock, 
  AlertCircle, 
  TrendingUp, 
  ArrowRight,
  ShieldCheck,
  FileCheck,
  MessageSquare
} from 'lucide-react';
import { Link } from 'react-router-dom';

interface CashPosition {
  total_collected_usd: number;
  total_payouts_usd: number;
  net_cash_usd: number;
}

interface StockItem {
  product_id: string;
  sku: string;
  name: string;
  selling_price_usd: number;
  available_units: number;
  reserved_units: number;
  installed_units: number;
  units_sold_28d: number;
  days_of_stock: number | null;
  restock_status: string;
}

interface PipelineSummary {
  stage_1_enquiries_new: number;
  stage_2_quotes_open: number;
  stage_3_sales_confirmed: number;
  stage_4_installations_pending: number;
  stage_5_installations_completed: number;
  stage_6_warranties_active: number;
}

export const Dashboard: React.FC = () => {
  const { activeRole } = useRole();
  const [cashPosition, setCashPosition] = useState<CashPosition>({ total_collected_usd: 0, total_payouts_usd: 0, net_cash_usd: 0 });
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [pipeline, setPipeline] = useState<PipelineSummary>({
    stage_1_enquiries_new: 0,
    stage_2_quotes_open: 0,
    stage_3_sales_confirmed: 0,
    stage_4_installations_pending: 0,
    stage_5_installations_completed: 0,
    stage_6_warranties_active: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadDashboardData() {
      try {
        // Fetch Cash Position View
        const { data: cashData } = await supabase.from('v_cash_position').select('*').limit(1).single();
        if (cashData) setCashPosition(cashData);

        // Fetch Stock Dashboard View
        const { data: stockData } = await supabase.from('v_stock_dashboard').select('*');
        if (stockData) setStockItems(stockData);

        // Fetch Pipeline Summary View
        const { data: pipelineData } = await supabase.from('v_pipeline_summary').select('*').limit(1).single();
        if (pipelineData) setPipeline(pipelineData);
      } catch {
        // Mock data fallback
        setCashPosition({ total_collected_usd: 3534.50, total_payouts_usd: 874.50, net_cash_usd: 2660.00 });
        setStockItems([
          { product_id: '1', sku: 'GH-12L', name: '12L Gas Geyser', selling_price_usd: 150, available_units: 0, reserved_units: 0, installed_units: 0, units_sold_28d: 0, days_of_stock: null, restock_status: 'NO_SALES_YET' },
          { product_id: '2', sku: 'GH-16L', name: '16L Gas Geyser', selling_price_usd: 220, available_units: 0, reserved_units: 0, installed_units: 0, units_sold_28d: 0, days_of_stock: null, restock_status: 'NO_SALES_YET' },
          { product_id: '3', sku: 'GH-20L', name: '20L Gas Geyser', selling_price_usd: 280, available_units: 0, reserved_units: 0, installed_units: 0, units_sold_28d: 0, days_of_stock: null, restock_status: 'NO_SALES_YET' },
        ]);
        setPipeline({
          stage_1_enquiries_new: 3,
          stage_2_quotes_open: 2,
          stage_3_sales_confirmed: 4,
          stage_4_installations_pending: 2,
          stage_5_installations_completed: 12,
          stage_6_warranties_active: 12,
        });
      } finally {
        setLoading(false);
      }
    }

    loadDashboardData();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64 text-xs text-slate-400">
        Loading Command Centre Metrics...
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Banner & Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">Command Centre</h1>
          <p className="text-xs text-slate-400">Operational Source of Truth • Harare Desk ({activeRole})</p>
        </div>
        <div className="inline-flex items-center space-x-2 bg-slate-900 border border-slate-800 text-xs px-3 py-1.5 rounded-lg text-slate-300">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span>Prices in USD • Not VAT-registered</span>
        </div>
      </div>

      {/* Today's Key Performance Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Net Cash Position</span>
              <span className="text-2xl font-extrabold text-white mt-1 block font-mono">
                ${cashPosition.net_cash_usd.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className="p-2.5 bg-emerald-500/10 rounded-xl text-emerald-400">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 text-[11px] text-slate-400">
            Collections: <span className="text-slate-200 font-semibold">${cashPosition.total_collected_usd.toFixed(2)}</span>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Confirmed Sales</span>
              <span className="text-2xl font-extrabold text-white mt-1 block font-mono">
                {pipeline.stage_3_sales_confirmed} Jobs
              </span>
            </div>
            <div className="p-2.5 bg-rafiki-500/10 rounded-xl text-rafiki-400">
              <ShoppingCart className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 text-[11px] text-slate-400">
            Awaiting fulfilment scheduling
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Pending Installs</span>
              <span className="text-2xl font-extrabold text-amber-400 mt-1 block font-mono">
                {pipeline.stage_4_installations_pending} Jobs
              </span>
            </div>
            <div className="p-2.5 bg-amber-500/10 rounded-xl text-amber-400">
              <Wrench className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 text-[11px] text-slate-400">
            Field technicians assigned
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Active Warranties</span>
              <span className="text-2xl font-extrabold text-blue-400 mt-1 block font-mono">
                {pipeline.stage_6_warranties_active} Active
              </span>
            </div>
            <div className="p-2.5 bg-blue-500/10 rounded-xl text-blue-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 text-[11px] text-slate-400">
            6-month period from completion
          </div>
        </div>
      </div>

      {/* Attention Queue */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
        <div className="flex items-center space-x-2 border-b border-slate-800 pb-3">
          <AlertTriangle className="w-4 h-4 text-amber-400" />
          <h2 className="font-bold text-sm text-white">Attention Queue</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          <div className="bg-slate-950 border border-slate-800 p-3.5 rounded-lg flex items-start space-x-3">
            <Clock className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-slate-200 block">Factory Balance Obligation</span>
              <span className="text-slate-400 block mt-0.5">$2,040.50 due 2026-09-25</span>
            </div>
          </div>

          <div className="bg-slate-950 border border-slate-800 p-3.5 rounded-lg flex items-start space-x-3">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-slate-200 block">Stock Reorder Warning</span>
              <span className="text-slate-400 block mt-0.5">Unit inventory available quantity at 0</span>
            </div>
          </div>

          <div className="bg-slate-950 border border-slate-800 p-3.5 rounded-lg flex items-start space-x-3">
            <TrendingUp className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-slate-200 block">Investor Option A Obligation</span>
              <span className="text-slate-400 block mt-0.5">$1,151.00 return threshold</span>
            </div>
          </div>
        </div>
      </div>

      {/* Commercial Pipeline Tracker (6 Stages) */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
        <h2 className="font-bold text-sm text-white border-b border-slate-800 pb-3">Commercial Pipeline Snapshot (v_pipeline_summary)</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
          <div className="bg-slate-950 border border-slate-800 p-3 rounded-lg text-center">
            <MessageSquare className="w-4 h-4 text-slate-400 mx-auto mb-1" />
            <span className="text-slate-400 text-[10px] uppercase font-bold block">1. Enquiries</span>
            <span className="text-lg font-extrabold text-white">{pipeline.stage_1_enquiries_new}</span>
          </div>

          <div className="bg-slate-950 border border-slate-800 p-3 rounded-lg text-center">
            <FileCheck className="w-4 h-4 text-slate-400 mx-auto mb-1" />
            <span className="text-slate-400 text-[10px] uppercase font-bold block">2. Open Quotes</span>
            <span className="text-lg font-extrabold text-white">{pipeline.stage_2_quotes_open}</span>
          </div>

          <div className="bg-slate-950 border border-slate-800 p-3 rounded-lg text-center">
            <ShoppingCart className="w-4 h-4 text-rafiki-400 mx-auto mb-1" />
            <span className="text-slate-400 text-[10px] uppercase font-bold block">3. Confirmed</span>
            <span className="text-lg font-extrabold text-rafiki-400">{pipeline.stage_3_sales_confirmed}</span>
          </div>

          <div className="bg-slate-950 border border-slate-800 p-3 rounded-lg text-center">
            <Wrench className="w-4 h-4 text-amber-400 mx-auto mb-1" />
            <span className="text-slate-400 text-[10px] uppercase font-bold block">4. Scheduled</span>
            <span className="text-lg font-extrabold text-amber-400">{pipeline.stage_4_installations_pending}</span>
          </div>

          <div className="bg-slate-950 border border-slate-800 p-3 rounded-lg text-center">
            <Wrench className="w-4 h-4 text-emerald-400 mx-auto mb-1" />
            <span className="text-slate-400 text-[10px] uppercase font-bold block">5. Installed</span>
            <span className="text-lg font-extrabold text-emerald-400">{pipeline.stage_5_installations_completed}</span>
          </div>

          <div className="bg-slate-950 border border-slate-800 p-3 rounded-lg text-center">
            <ShieldCheck className="w-4 h-4 text-blue-400 mx-auto mb-1" />
            <span className="text-slate-400 text-[10px] uppercase font-bold block">6. Warranties</span>
            <span className="text-lg font-extrabold text-blue-400">{pipeline.stage_6_warranties_active}</span>
          </div>
        </div>
      </div>

      {/* Stock Dashboard Table (v_stock_dashboard) */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4 overflow-hidden">
        <div className="flex justify-between items-center border-b border-slate-800 pb-3">
          <h2 className="font-bold text-sm text-white">Stock Dashboard (v_stock_dashboard)</h2>
          <Link to="/inventory" className="text-xs text-rafiki-400 hover:text-rafiki-300 font-semibold flex items-center space-x-1">
            <span>Manage Serials</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 font-semibold uppercase text-[10px] tracking-wider">
                <th className="py-2.5 px-3">SKU</th>
                <th className="py-2.5 px-3">Product Name</th>
                <th className="py-2.5 px-3">Price (USD)</th>
                <th className="py-2.5 px-3 text-right">Available</th>
                <th className="py-2.5 px-3 text-right">Reserved</th>
                <th className="py-2.5 px-3 text-right">Days of Stock</th>
                <th className="py-2.5 px-3 text-center">Restock Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {stockItems.map((item) => (
                <tr key={item.product_id} className="hover:bg-slate-850/50 transition-colors">
                  <td className="py-3 px-3 font-mono font-bold text-slate-200">{item.sku}</td>
                  <td className="py-3 px-3 text-slate-300">{item.name}</td>
                  <td className="py-3 px-3 font-mono text-slate-200">${item.selling_price_usd.toFixed(2)}</td>
                  <td className="py-3 px-3 text-right font-mono font-bold text-white">{item.available_units}</td>
                  <td className="py-3 px-3 text-right font-mono text-slate-400">{item.reserved_units}</td>
                  <td className="py-3 px-3 text-right font-mono text-slate-300">
                    {item.days_of_stock === null ? 'No sales yet' : `${item.days_of_stock} days`}
                  </td>
                  <td className="py-3 px-3 text-center">
                    {item.restock_status === 'RESTOCK_REQUIRED' || item.available_units === 0 ? (
                      <span className="bg-red-500/10 border border-red-500/30 text-red-400 text-[10px] font-bold px-2 py-0.5 rounded-full inline-block animate-pulse">
                        REORDER NOW
                      </span>
                    ) : item.restock_status === 'NO_SALES_YET' ? (
                      <span className="bg-slate-800 text-slate-400 text-[10px] px-2 py-0.5 rounded-full inline-block">
                        No Sales Yet
                      </span>
                    ) : (
                      <span className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] font-bold px-2 py-0.5 rounded-full inline-block">
                        HEALTHY
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
