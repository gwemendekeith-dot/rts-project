import { openWhatsApp } from '../lib/whatsapp';
import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useRole } from '../hooks/useRole';
import { voidDocument } from '../lib/rpc';
import { Search, Send, Download, Ban } from 'lucide-react';
import type { DocTypeEnum } from '../types/database';

interface DocRecord {
  id: string;
  document_number: string;
  document_type: DocTypeEnum;
  created_at: string;
  file_reference: string | null;
  status: 'DRAFT' | 'ISSUED' | 'VOID';
  customers: { phone: string } | null;
}

export const Documents: React.FC = () => {
  const { isOwner } = useRole();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');

  const docsQuery = useQuery({
    queryKey: ['documents'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('documents')
        .select('id, document_number, document_type, created_at, file_reference, status, customers(phone)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as DocRecord[];
    },
  });

  const handleVoid = async (docId: string) => {
    if (!confirm('Are you sure you want to void this document?')) return;
    try {
      await voidDocument({
        document_id: docId,
        reason: 'Operator void request'
      });
      await queryClient.invalidateQueries({ queryKey: ['documents'] });
    } catch (error: unknown) {
      alert(error instanceof Error ? error.message : String(error));
    }
  };

  if (docsQuery.isLoading) return <div className="p-10 text-center text-slate-400">Loading documents...</div>;
  if (docsQuery.error) return <div className="p-10 text-center text-red-400">Could not load documents.</div>;
  const docs = docsQuery.data ?? [];
  const filteredDocs = docs.filter(d =>
    d.document_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
    d.document_type.toLowerCase().includes(searchQuery.toLowerCase())
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
                  <td className="py-3 px-3 font-mono font-bold text-slate-200">{doc.document_number}</td>
                  <td className="py-3 px-3">
                    <span className="bg-slate-800 text-slate-300 font-mono text-[10px] px-2 py-0.5 rounded font-bold">
                      {doc.document_type}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-slate-400">{doc.created_at}</td>
                  <td className="py-3 px-3 text-center">
                    {doc.status === 'VOID' ? (
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
                        disabled={!doc.file_reference}
                        onClick={() => {
                          if (!doc.file_reference) return;
                          const { data } = supabase.storage.from('documents').getPublicUrl(doc.file_reference);
                          window.open(data.publicUrl, '_blank', 'noopener,noreferrer');
                        }}
                        className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-2.5 py-1 rounded text-[11px] font-semibold flex items-center space-x-1"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>View / Download</span>
                      </button>
                      <button
                        disabled={!doc.customers?.phone || !doc.file_reference}
                        onClick={() => {
                          if (!doc.customers?.phone || !doc.file_reference) return;
                          const { data } = supabase.storage.from('documents').getPublicUrl(doc.file_reference);
                          openWhatsApp(doc.customers.phone, `Your Rafiki Thermal Solutions document ${doc.document_number} is ready: ${data.publicUrl}`);
                        }}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 py-1 rounded text-[11px] font-semibold flex items-center space-x-1"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>Share</span>
                      </button>
                      {isOwner && doc.status !== 'VOID' && (
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
              {filteredDocs.length === 0 && (
                <tr><td colSpan={5} className="py-8 text-center text-slate-500">No database documents match this search.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
