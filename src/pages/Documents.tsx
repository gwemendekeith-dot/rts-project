import { openWhatsApp } from '../lib/whatsapp';
import React, { useState } from 'react';
import { useRole } from '../hooks/useRole';
import { voidDocument } from '../lib/rpc';
import { Search, Send, Download, Ban } from 'lucide-react';
import type { DocTypeEnum } from '../types/database';

interface DocRecord {
  id: string;
  doc_number: string;
  doc_type: DocTypeEnum;
  created_at: string;
  pdf_url: string;
  is_void: boolean;
  customer_phone?: string;
}

export const Documents: React.FC = () => {
  const { isOwner } = useRole();
  const [searchQuery, setSearchQuery] = useState('');
  
  const [docs, setDocs] = useState<DocRecord[]>([
    {
      id: 'doc-1',
      doc_number: 'RTS-INV-2026-0012',
      doc_type: 'INVOICE',
      created_at: '2026-08-26 14:05',
      pdf_url: 'https://placeholder.supabase.co/storage/v1/object/public/documents/invoices/RTS-INV-2026-0012.pdf',
      is_void: false,
      customer_phone: '+263771234567'
    },
    {
      id: 'doc-2',
      doc_number: 'RTS-RCP-2026-0008',
      doc_type: 'RECEIPT',
      created_at: '2026-08-26 14:10',
      pdf_url: 'https://placeholder.supabase.co/storage/v1/object/public/documents/receipts/RTS-RCP-2026-0008.pdf',
      is_void: false,
      customer_phone: '+263771234567'
    },
    {
      id: 'doc-3',
      doc_number: 'RTS-WTY-2026-0002',
      doc_type: 'WARRANTY_CERTIFICATE',
      created_at: '2026-08-26 16:30',
      pdf_url: 'https://placeholder.supabase.co/storage/v1/object/public/documents/warrantys/RTS-WTY-2026-0002.pdf',
      is_void: false,
      customer_phone: '+263771234567'
    }
  ]);

  const handleVoid = async (docId: string) => {
    if (!confirm('Are you sure you want to void this document?')) return;
    try {
      await voidDocument({
        document_id: docId,
        reason: 'Operator void request'
      });
      setDocs(docs.map(d => d.id === docId ? { ...d, is_void: true } : d));
    } catch {
      setDocs(docs.map(d => d.id === docId ? { ...d, is_void: true } : d));
    }
  };

  const filteredDocs = docs.filter(d => 
    d.doc_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
    d.doc_type.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">Generated Operational Documents</h1>
          <p className="text-xs text-slate-400">PDF Views of Database Records • Non-VAT Registered</p>
        </div>

        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search document # or type..."
            className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-rafiki-500"
          />
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
        <div className="overflow-x-auto text-xs">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 font-semibold uppercase text-[10px] tracking-wider">
                <th className="py-2.5 px-3">Doc Number</th>
                <th className="py-2.5 px-3">Doc Type</th>
                <th className="py-2.5 px-3">Date Generated</th>
                <th className="py-2.5 px-3 text-center">Status</th>
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredDocs.map((doc) => (
                <tr key={doc.id} className="hover:bg-slate-850/50 transition-colors">
                  <td className="py-3 px-3 font-mono font-bold text-slate-200">{doc.doc_number}</td>
                  <td className="py-3 px-3">
                    <span className="bg-slate-800 text-slate-300 font-mono text-[10px] px-2 py-0.5 rounded font-bold">
                      {doc.doc_type}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-slate-400">{doc.created_at}</td>
                  <td className="py-3 px-3 text-center">
                    {doc.is_void ? (
                      <span className="bg-red-500/10 border border-red-500/30 text-red-400 text-[10px] font-bold px-2 py-0.5 rounded-full inline-block">
                        VOID
                      </span>
                    ) : (
                      <span className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] font-bold px-2 py-0.5 rounded-full inline-block">
                        VALID
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-3 text-right">
                    <div className="flex items-center justify-end space-x-2">
                      <button
                        onClick={() => window.open(doc.pdf_url, '_blank')}
                        className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-2.5 py-1 rounded text-[11px] font-semibold flex items-center space-x-1"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>View / Download</span>
                      </button>
                      <button
                        onClick={() => doc.customer_phone && openWhatsApp(doc.customer_phone, `Your Rafiki Thermal Solutions document ${doc.doc_number} is ready.`)}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 py-1 rounded text-[11px] font-semibold flex items-center space-x-1"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>Share</span>
                      </button>
                      {isOwner && !doc.is_void && (
                        <button
                          onClick={() => handleVoid(doc.id)}
                          className="bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 p-1 rounded"
                          title="Void Document (Owner Only)"
                        >
                          <Ban className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
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
