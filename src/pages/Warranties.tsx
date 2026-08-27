import React, { useState } from 'react';
import { Search } from 'lucide-react';

interface WarrantyRecord {
  id: string;
  warranty_number: string;
  serial_number: string;
  product_name: string;
  customer_name: string;
  customer_phone: string;
  start_date: string;
  expiry_date: string;
  status: 'ACTIVE' | 'EXPIRED' | 'VOID';
}

export const Warranties: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  
  const [warranties] = useState<WarrantyRecord[]>([
    {
      id: 'wty-1',
      warranty_number: 'RTS-WTY-2026-0001',
      serial_number: 'GH-12L-004',
      product_name: '12L Gas Geyser',
      customer_name: 'Farai Chitate',
      customer_phone: '+263 71 888 2222',
      start_date: '2026-08-25',
      expiry_date: '2027-02-25',
      status: 'ACTIVE'
    },
    {
      id: 'wty-2',
      warranty_number: 'RTS-WTY-2026-0002',
      serial_number: 'GH-16L-001',
      product_name: '16L Gas Geyser',
      customer_name: 'Tendai Moyo',
      customer_phone: '+263 77 123 4567',
      start_date: '2026-08-26',
      expiry_date: '2027-02-26',
      status: 'ACTIVE'
    }
  ]);

  const filteredWarranties = warranties.filter(w => 
    w.serial_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
    w.warranty_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
    w.customer_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">Warranty Ledger</h1>
          <p className="text-xs text-slate-400">6-Month Automated Installation Expiry Ledger</p>
        </div>

        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by serial number (GH-16L-001)..."
            className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-rafiki-500"
          />
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
        <div className="overflow-x-auto text-xs">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 font-semibold uppercase text-[10px] tracking-wider">
                <th className="py-2.5 px-3">Warranty #</th>
                <th className="py-2.5 px-3">Serial Number</th>
                <th className="py-2.5 px-3">Product</th>
                <th className="py-2.5 px-3">Customer</th>
                <th className="py-2.5 px-3">Install Date</th>
                <th className="py-2.5 px-3">Expiry Date</th>
                <th className="py-2.5 px-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredWarranties.map((w) => (
                <tr key={w.id} className="hover:bg-slate-850/50 transition-colors">
                  <td className="py-3 px-3 font-mono font-bold text-rafiki-400">{w.warranty_number}</td>
                  <td className="py-3 px-3 font-mono font-extrabold text-white">{w.serial_number}</td>
                  <td className="py-3 px-3 text-slate-300">{w.product_name}</td>
                  <td className="py-3 px-3 text-slate-300">{w.customer_name}</td>
                  <td className="py-3 px-3 text-slate-400">{w.start_date}</td>
                  <td className="py-3 px-3 text-blue-400 font-semibold">{w.expiry_date}</td>
                  <td className="py-3 px-3 text-center">
                    <span className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] font-bold px-2.5 py-0.5 rounded-full inline-block">
                      {w.status}
                    </span>
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
