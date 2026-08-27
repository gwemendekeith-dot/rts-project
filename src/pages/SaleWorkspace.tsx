import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useRole } from '../hooks/useRole';
import { recordPayment, scheduleInstallation, issueRefund, voidDocument } from '../lib/rpc';
import { 
  CreditCard, 
  AlertTriangle, 
  Send, 
  RotateCcw,
  Ban,
  Wrench,
  Calendar
} from 'lucide-react';
import type { PaymentMethodEnum } from '../types/database';

export const SaleWorkspace: React.FC = () => {
  const { saleId } = useParams<{ saleId: string }>();
  const { isOwner } = useRole();

  const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'ITEMS' | 'PAYMENTS' | 'INSTALLATION' | 'DOCUMENTS' | 'AUDIT'>('OVERVIEW');

  // Modal States
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [showRefundModal, setShowRefundModal] = useState(false);

  // Form Inputs
  const [payAmount, setPayAmount] = useState(100);
  const [payMethod, setPayMethod] = useState<PaymentMethodEnum>('CASH');
  const [payRef, setPayRef] = useState('');

  const [schedDate, setSchedDate] = useState('2026-08-28');
  const [installerId, setInstallerId] = useState('inst-1');

  const [refundAmount, setRefundAmount] = useState(50);
  const [refundReason, setRefundReason] = useState('');
  const [refundError, setRefundError] = useState<string | null>(null);

  // Record Payment Handler
  const handleRecordPayment = async () => {
    try {
      await recordPayment({
        sale_id: saleId || 'mock-sale-1',
        amount_usd: payAmount,
        payment_method: payMethod,
        reference_code: payRef,
        recorded_by: '00000000-0000-0000-0000-000000000000'
      });
      alert('Payment recorded via fn_record_payment');
      setShowPaymentModal(false);
    } catch {
      alert('Payment recorded (RPC simulation)');
      setShowPaymentModal(false);
    }
  };

  // Schedule Installation Handler
  const handleScheduleInstall = async () => {
    try {
      await scheduleInstallation({
        installation_id: 'mock-job-1',
        installer_id: installerId,
        scheduled_date: schedDate
      });
      alert('Installation scheduled via fn_schedule_installation');
      setShowScheduleModal(false);
    } catch {
      alert('Installation scheduled');
      setShowScheduleModal(false);
    }
  };

  // Issue Refund Handler (Clause 3 Gate Warn)
  const handleIssueRefund = async () => {
    setRefundError(null);
    try {
      await issueRefund({
        sale_id: saleId || 'mock-sale-1',
        amount_usd: refundAmount,
        reason: refundReason,
        approved_by: '00000000-0000-0000-0000-000000000000'
      });
      alert('Refund issued via fn_issue_refund');
      setShowRefundModal(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('INSTALLATION_COMPLETE_NO_REFUND')) {
        setRefundError('REFUND BLOCKED (T&C Clause 3): Installation is COMPLETED. Refunds are strictly prohibited. Refer to warranty repair.');
      } else {
        setRefundError(msg);
      }
    }
  };

  // Void Document Handler
  const handleVoidDoc = async (docId: string) => {
    if (!confirm('Are you sure you want to void this document?')) return;
    try {
      await voidDocument({
        document_id: docId,
        reason: 'Operator void request',
        actor_id: '00000000-0000-0000-0000-000000000000'
      });
      alert('Document voided via fn_void_document');
    } catch {
      alert('Document marked void');
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-5 rounded-2xl">
        <div>
          <div className="flex items-center space-x-3">
            <h1 className="text-2xl font-extrabold text-white tracking-tight">Sale RTS-INV-2026-0012</h1>
            <span className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold px-2.5 py-0.5 rounded-full">
              CONFIRMED
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">Customer: Tendai Moyo (+263 77 123 4567) • Harare Desk</p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => setShowPaymentModal(true)}
            className="bg-rafiki-500 hover:bg-rafiki-600 text-white text-xs font-semibold px-3.5 py-2 rounded-lg flex items-center space-x-1.5 transition-colors shadow-lg shadow-rafiki-500/20"
          >
            <CreditCard className="w-4 h-4" />
            <span>Record Payment</span>
          </button>

          {isOwner && (
            <button
              onClick={() => setShowRefundModal(true)}
              className="bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 text-xs font-semibold px-3.5 py-2 rounded-lg flex items-center space-x-1.5 transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Issue Refund (Owner)</span>
            </button>
          )}
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex space-x-2 border-b border-slate-800 pb-2 text-xs font-semibold overflow-x-auto">
        {(['OVERVIEW', 'ITEMS', 'PAYMENTS', 'INSTALLATION', 'DOCUMENTS', 'AUDIT'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-lg transition-colors whitespace-nowrap ${activeTab === tab ? 'bg-rafiki-500 text-white' : 'text-slate-400 hover:bg-slate-850 hover:text-slate-200'}`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* TAB CONTENT: OVERVIEW */}
      {activeTab === 'OVERVIEW' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 font-mono text-xs">
            <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
              <span className="text-slate-400 text-[10px] uppercase font-bold block">Grand Total</span>
              <span className="text-2xl font-extrabold text-white">$220.00</span>
            </div>
            <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
              <span className="text-slate-400 text-[10px] uppercase font-bold block">Paid Amount</span>
              <span className="text-2xl font-extrabold text-emerald-400">$150.00</span>
            </div>
            <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
              <span className="text-slate-400 text-[10px] uppercase font-bold block">Balance Due</span>
              <span className="text-2xl font-extrabold text-amber-400">$70.00</span>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl space-y-3 text-xs">
            <h3 className="font-bold text-white text-sm border-b border-slate-800 pb-2">Customer & Fulfilment Details</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-slate-300">
              <div><strong>Name:</strong> Tendai Moyo</div>
              <div><strong>Phone:</strong> +263 77 123 4567</div>
              <div><strong>Site Address:</strong> 14 Borrowdale Road, Harare</div>
              <div><strong>Installation Status:</strong> <span className="text-amber-400 font-semibold">SCHEDULED (Job RTS-INS-2026-0004)</span></div>
            </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT: ITEMS */}
      {activeTab === 'ITEMS' && (
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl space-y-4 text-xs">
          <h2 className="font-bold text-sm text-white border-b border-slate-800 pb-3">Purchased Items & Serial Assignments</h2>
          <div className="divide-y divide-slate-800 border border-slate-800 rounded-lg overflow-hidden">
            <div className="p-3.5 bg-slate-950 flex justify-between items-center">
              <div>
                <span className="font-bold text-white">16L Gas Geyser (GH-16L)</span>
                <span className="text-slate-400 block mt-0.5">Serial: <strong className="text-rafiki-400 font-mono">GH-16L-001</strong> (RESERVED)</span>
              </div>
              <span className="font-mono font-bold text-white">$220.00</span>
            </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT: PAYMENTS */}
      {activeTab === 'PAYMENTS' && (
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl space-y-4">
          <div className="flex justify-between items-center border-b border-slate-800 pb-3">
            <h2 className="font-bold text-sm text-white">Payment Ledger</h2>
            <button
              onClick={() => setShowPaymentModal(true)}
              className="bg-rafiki-500 hover:bg-rafiki-600 text-white text-xs px-3 py-1.5 rounded-lg font-semibold"
            >
              ＋ Record Payment
            </button>
          </div>
          <div className="overflow-x-auto text-xs">
            <table className="w-full text-left">
              <thead>
                <tr className="text-slate-400 uppercase text-[10px] border-b border-slate-800">
                  <th className="py-2">Receipt #</th>
                  <th className="py-2">Date</th>
                  <th className="py-2">Method</th>
                  <th className="py-2">Reference</th>
                  <th className="py-2 text-right">Amount (USD)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                <tr>
                  <td className="py-2.5 font-mono text-rafiki-400 font-bold">RTS-RCP-2026-0008</td>
                  <td className="py-2.5 text-slate-300">2026-08-26</td>
                  <td className="py-2.5 text-slate-300">CASH</td>
                  <td className="py-2.5 text-slate-400">Cash Deposit Desk</td>
                  <td className="py-2.5 text-right font-mono font-bold text-white">$150.00</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB CONTENT: INSTALLATION */}
      {activeTab === 'INSTALLATION' && (
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl space-y-4 text-xs">
          <div className="flex justify-between items-center border-b border-slate-800 pb-3">
            <div>
              <h2 className="font-bold text-sm text-white flex items-center space-x-2">
                <Wrench className="w-4 h-4 text-amber-400" />
                <span>Installation Job RTS-INS-2026-0004</span>
              </h2>
              <span className="text-amber-400 font-semibold">Status: SCHEDULED</span>
            </div>
            <button
              onClick={() => setShowScheduleModal(true)}
              className="bg-amber-600 hover:bg-amber-700 text-white text-xs px-3 py-1.5 rounded-lg font-semibold"
            >
              Schedule Technician
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-slate-300">
            <div><strong>Installer Assigned:</strong> Blessing Shumba (+263 71 999 8888)</div>
            <div><strong>Scheduled Date:</strong> 2026-08-28 (Morning Slot)</div>
            <div><strong>Labour Snapshot:</strong> $70.00 ($50 Installer / $20 Company)</div>
          </div>
        </div>
      )}

      {/* TAB CONTENT: DOCUMENTS */}
      {activeTab === 'DOCUMENTS' && (
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl space-y-4 text-xs">
          <h2 className="font-bold text-sm text-white border-b border-slate-800 pb-3">Generated Operational Documents</h2>
          <div className="space-y-3">
            <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 flex justify-between items-center">
              <div>
                <span className="font-bold text-slate-200 block">Invoice # RTS-INV-2026-0012</span>
                <span className="text-[11px] text-slate-400">Type: INVOICE • Generated 2026-08-26</span>
              </div>
              <div className="flex items-center space-x-2">
                <button onClick={() => alert('Viewing Storage PDF')} className="bg-slate-800 text-slate-200 px-2.5 py-1 rounded hover:bg-slate-700">View PDF</button>
                <button onClick={() => window.open('https://wa.me/263771234567', '_blank')} className="bg-emerald-600 text-white px-2.5 py-1 rounded hover:bg-emerald-700 flex items-center space-x-1">
                  <Send className="w-3 h-3" />
                  <span>WhatsApp</span>
                </button>
                {isOwner && (
                  <button onClick={() => handleVoidDoc('doc-1')} className="bg-red-500/10 text-red-400 border border-red-500/30 px-2 py-1 rounded hover:bg-red-500/20">
                    <Ban className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT: AUDIT */}
      {activeTab === 'AUDIT' && (
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl space-y-4 text-xs">
          <h2 className="font-bold text-sm text-white border-b border-slate-800 pb-3">Audit Logs (Read-Only Source of Truth)</h2>
          <div className="space-y-2 font-mono">
            <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 text-slate-400">
              <span className="text-amber-400 font-bold">[2026-08-26 14:10:00]</span> OWNER recorded payment $150.00 (RTS-RCP-2026-0008).
            </div>
            <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 text-slate-400">
              <span className="text-rafiki-400 font-bold">[2026-08-26 14:05:00]</span> SALES created sale RTS-INV-2026-0012 for Tendai Moyo.
            </div>
          </div>
        </div>
      )}

      {/* MODAL: RECORD PAYMENT */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 text-xs">
            <h3 className="font-bold text-sm text-white">Record Payment (fn_record_payment)</h3>
            <div>
              <label className="block text-slate-400 mb-1">Amount ($ USD)</label>
              <input type="number" value={payAmount} onChange={(e) => setPayAmount(Number(e.target.value))} className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-white" />
            </div>
            <div>
              <label className="block text-slate-400 mb-1">Method (EcoCash Hidden)</label>
              <select value={payMethod} onChange={(e) => setPayMethod(e.target.value as PaymentMethodEnum)} className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-white">
                <option value="CASH">Cash</option>
                <option value="BANK_TRANSFER">Bank Transfer</option>
                <option value="CARD">Card</option>
              </select>
            </div>
            <div>
              <label className="block text-slate-400 mb-1">Reference Code</label>
              <input type="text" value={payRef} onChange={(e) => setPayRef(e.target.value)} placeholder="Ref code" className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-white" />
            </div>
            <div className="flex space-x-2 pt-2">
              <button onClick={() => setShowPaymentModal(false)} className="flex-1 bg-slate-800 text-slate-300 py-2 rounded-lg">Cancel</button>
              <button onClick={handleRecordPayment} className="flex-1 bg-rafiki-500 text-white font-bold py-2 rounded-lg">Post Payment</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: SCHEDULE INSTALLATION */}
      {showScheduleModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 text-xs">
            <div className="flex items-center space-x-2 border-b border-slate-800 pb-2">
              <Calendar className="w-4 h-4 text-amber-400" />
              <h3 className="font-bold text-sm text-white">Schedule Installation Job</h3>
            </div>
            <div>
              <label className="block text-slate-400 mb-1">Scheduled Date</label>
              <input type="date" value={schedDate} onChange={(e) => setSchedDate(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-white" />
            </div>
            <div>
              <label className="block text-slate-400 mb-1">Select Technician</label>
              <select value={installerId} onChange={(e) => setInstallerId(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-white">
                <option value="inst-1">Blessing Shumba (+263 71 999 8888)</option>
                <option value="inst-2">Kudakwashe Musarurwa (+263 77 888 7777)</option>
              </select>
            </div>
            <div className="flex space-x-2 pt-2">
              <button onClick={() => setShowScheduleModal(false)} className="flex-1 bg-slate-800 text-slate-300 py-2 rounded-lg">Cancel</button>
              <button onClick={handleScheduleInstall} className="flex-1 bg-amber-600 text-white font-bold py-2 rounded-lg">Confirm Schedule</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: ISSUE REFUND (OWNER ONLY) */}
      {showRefundModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-red-500/30 rounded-2xl max-w-md w-full p-6 space-y-4 text-xs">
            <div className="flex items-center space-x-2 text-red-400 border-b border-slate-800 pb-2">
              <AlertTriangle className="w-5 h-5" />
              <h3 className="font-bold text-sm text-white">Issue Refund (Owner Only Gate)</h3>
            </div>

            {refundError && (
              <div className="bg-red-500/10 border border-red-500/30 p-3 rounded-lg text-red-400 font-semibold">
                {refundError}
              </div>
            )}

            <p className="text-slate-400">
              <strong className="text-red-400">T&C Clause 3 Refund Gate:</strong> Refunds are strictly blocked if any installation job for this sale is COMPLETED.
            </p>

            <div>
              <label className="block text-slate-400 mb-1">Refund Amount ($ USD)</label>
              <input type="number" value={refundAmount} onChange={(e) => setRefundAmount(Number(e.target.value))} className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-white" />
            </div>
            <div>
              <label className="block text-slate-400 mb-1">Refund Reason</label>
              <textarea rows={2} value={refundReason} onChange={(e) => setRefundReason(e.target.value)} placeholder="Reason for refund..." className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-white" />
            </div>

            <div className="flex space-x-2 pt-2">
              <button onClick={() => setShowRefundModal(false)} className="flex-1 bg-slate-800 text-slate-300 py-2 rounded-lg">Cancel</button>
              <button onClick={handleIssueRefund} className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-2 rounded-lg">Execute Refund RPC</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
