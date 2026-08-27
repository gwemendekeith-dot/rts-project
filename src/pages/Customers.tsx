import React, { useState } from 'react';
import { 
  Phone, 
  MapPin, 
  ShoppingCart, 
  Wrench, 
  ShieldCheck, 
  ChevronRight, 
  ArrowLeft
} from 'lucide-react';

interface Customer360 {
  id: string;
  customer_number: string;
  full_name: string;
  phone: string;
  email: string;
  address: string;
  lifetime_spend_usd: number;
  outstanding_balance_usd: number;
  sales: { sale_number: string; total: number; status: string }[];
  installations: { job_number: string; status: string; date: string }[];
  warranties: { warranty_number: string; serial: string; expiry: string }[];
}

export const Customers: React.FC = () => {
  const [customers] = useState<Customer360[]>([
    {
      id: 'cust-1',
      customer_number: 'RTS-CUST-2026-0001',
      full_name: 'Tendai Moyo',
      phone: '+263 77 123 4567',
      email: 'tendai.moyo@gmail.com',
      address: '14 Borrowdale Road, Harare',
      lifetime_spend_usd: 220.00,
      outstanding_balance_usd: 70.00,
      sales: [
        { sale_number: 'RTS-INV-2026-0012', total: 220.00, status: 'CONFIRMED' }
      ],
      installations: [
        { job_number: 'RTS-INS-2026-0004', status: 'SCHEDULED', date: '2026-08-28' }
      ],
      warranties: [
        { warranty_number: 'RTS-WTY-2026-0002', serial: 'GH-16L-001', expiry: '2027-02-26' }
      ]
    },
    {
      id: 'cust-2',
      customer_number: 'RTS-CUST-2026-0002',
      full_name: 'Farai Chitate',
      phone: '+263 71 888 2222',
      email: 'farai.chitate@yahoo.com',
      address: '88 Sam Nujoma Street, Harare',
      lifetime_spend_usd: 150.00,
      outstanding_balance_usd: 0.00,
      sales: [
        { sale_number: 'RTS-INV-2026-0009', total: 150.00, status: 'INSTALLED' }
      ],
      installations: [
        { job_number: 'RTS-INS-2026-0003', status: 'COMPLETED', date: '2026-08-25' }
      ],
      warranties: [
        { warranty_number: 'RTS-WTY-2026-0001', serial: 'GH-12L-004', expiry: '2027-02-25' }
      ]
    }
  ]);

  const [selectedCustomer, setSelectedCustomer] = useState<Customer360 | null>(null);

  if (selectedCustomer) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <button
          onClick={() => setSelectedCustomer(null)}
          className="text-xs text-slate-400 hover:text-slate-200 flex items-center space-x-1"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Customers List</span>
        </button>

        <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl flex flex-col sm:flex-row justify-between items-start gap-4">
          <div>
            <div className="flex items-center space-x-3">
              <h1 className="text-2xl font-extrabold text-white tracking-tight">{selectedCustomer.full_name}</h1>
              <span className="bg-slate-800 text-slate-300 font-mono text-[10px] px-2.5 py-0.5 rounded-full font-bold">
                {selectedCustomer.customer_number}
              </span>
            </div>
            <div className="mt-2 space-y-1 text-xs text-slate-400">
              <div className="flex items-center space-x-2">
                <Phone className="w-3.5 h-3.5 text-slate-500" />
                <span>{selectedCustomer.phone} • {selectedCustomer.email}</span>
              </div>
              <div className="flex items-center space-x-2">
                <MapPin className="w-3.5 h-3.5 text-slate-500" />
                <span>{selectedCustomer.address}</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs font-mono">
            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
              <span className="text-[10px] text-slate-400 font-sans block">Lifetime Spend</span>
              <span className="text-lg font-extrabold text-emerald-400">${selectedCustomer.lifetime_spend_usd.toFixed(2)}</span>
            </div>
            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
              <span className="text-[10px] text-slate-400 font-sans block">Balance Due</span>
              <span className="text-lg font-extrabold text-amber-400">${selectedCustomer.outstanding_balance_usd.toFixed(2)}</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl space-y-3">
            <h3 className="font-bold text-white flex items-center space-x-2 border-b border-slate-800 pb-2">
              <ShoppingCart className="w-4 h-4 text-rafiki-400" />
              <span>Sales History</span>
            </h3>
            {selectedCustomer.sales.map((s, idx) => (
              <div key={idx} className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 space-y-1">
                <div className="flex justify-between font-mono font-bold text-slate-200">
                  <span>{s.sale_number}</span>
                  <span>${s.total.toFixed(2)}</span>
                </div>
                <span className="text-[10px] text-emerald-400 font-semibold">{s.status}</span>
              </div>
            ))}
          </div>

          <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl space-y-3">
            <h3 className="font-bold text-white flex items-center space-x-2 border-b border-slate-800 pb-2">
              <Wrench className="w-4 h-4 text-amber-400" />
              <span>Installations</span>
            </h3>
            {selectedCustomer.installations.map((i, idx) => (
              <div key={idx} className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 space-y-1">
                <span className="font-mono font-bold text-slate-200 block">{i.job_number}</span>
                <span className="text-[10px] text-slate-400">{i.status} • {i.date}</span>
              </div>
            ))}
          </div>

          <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl space-y-3">
            <h3 className="font-bold text-white flex items-center space-x-2 border-b border-slate-800 pb-2">
              <ShieldCheck className="w-4 h-4 text-blue-400" />
              <span>Warranties</span>
            </h3>
            {selectedCustomer.warranties.map((w, idx) => (
              <div key={idx} className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 space-y-1">
                <span className="font-mono font-bold text-rafiki-400 block">{w.warranty_number}</span>
                <span className="text-[10px] text-slate-400 block">Serial: <strong className="text-slate-200 font-mono">{w.serial}</strong></span>
                <span className="text-[10px] text-blue-400 font-semibold">Expires: {w.expiry}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">Customer Database</h1>
          <p className="text-xs text-slate-400">Customer 360 Profile & Lifetime Commercial History</p>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
        <div className="overflow-x-auto text-xs">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 font-semibold uppercase text-[10px] tracking-wider">
                <th className="py-2.5 px-3">Customer ID</th>
                <th className="py-2.5 px-3">Full Name</th>
                <th className="py-2.5 px-3">Phone</th>
                <th className="py-2.5 px-3 text-right">Lifetime Spend</th>
                <th className="py-2.5 px-3 text-right">Balance Due</th>
                <th className="py-2.5 px-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {customers.map((c) => (
                <tr key={c.id} className="hover:bg-slate-850/50 transition-colors">
                  <td className="py-3 px-3 font-mono text-slate-400">{c.customer_number}</td>
                  <td className="py-3 px-3 font-bold text-slate-200">{c.full_name}</td>
                  <td className="py-3 px-3 text-slate-300">{c.phone}</td>
                  <td className="py-3 px-3 text-right font-mono font-bold text-emerald-400">${c.lifetime_spend_usd.toFixed(2)}</td>
                  <td className="py-3 px-3 text-right font-mono font-bold text-amber-400">${c.outstanding_balance_usd.toFixed(2)}</td>
                  <td className="py-3 px-3 text-center">
                    <button
                      onClick={() => setSelectedCustomer(c)}
                      className="text-rafiki-400 hover:text-rafiki-300 font-semibold text-[11px] inline-flex items-center space-x-0.5"
                    >
                      <span>View 360</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
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
