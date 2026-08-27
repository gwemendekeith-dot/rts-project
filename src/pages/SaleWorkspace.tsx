import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { issueRefund, recordPayment, voidDocument } from '../lib/rpc';
import { issueReceipt } from '../lib/documents';
import { openWhatsApp } from '../lib/whatsapp';
import { useRole } from '../hooks/useRole';
import type { PaymentMethodEnum } from '../types/database';

const usd = (value: number | string | null) => `$${Number(value ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
type Tab = 'overview' | 'items' | 'payments' | 'installation' | 'documents' | 'audit';
type Sale = {
  id: string; sale_number: string; customer_id: string; total_amount: number; amount_paid: number;
  balance_due: number; payment_status: string; fulfilment_status: string; is_preorder: boolean;
  referral_source: string | null; customers: { first_name: string; last_name: string | null; phone: string; address: string | null } | null;
  sale_items: Array<{ id: string; description: string; quantity: number; unit_price: number; line_total: number; serial_numbers: { serial_number: string } | null; products: { description: string | null } | null }>;
};
type Payment = { id: string; payment_number: string; payment_date: string; payment_method: string; payment_reference: string | null; amount: number };
type Job = { id: string; job_number: string; status: string; scheduled_date: string | null };
type Document = { id: string; document_number: string; document_type: string; status: string; file_reference: string | null };
type Audit = { id: string; action: string; timestamp: string; reason: string | null };

export function SaleWorkspace() {
  const { saleId } = useParams<{ saleId: string }>();
  const queryClient = useQueryClient();
  const { isOwner } = useRole();
  const [tab, setTab] = useState<Tab>('overview');
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [amount, setAmount] = useState(0);
  const [method, setMethod] = useState<PaymentMethodEnum>('CASH');
  const [reference, setReference] = useState('');
  const [busy, setBusy] = useState(false);
  const [refundPayment, setRefundPayment] = useState('');
  const [refundAmount, setRefundAmount] = useState(0);
  const [refundReason, setRefundReason] = useState('');

  const saleQuery = useQuery({ queryKey: ['sale', saleId], enabled: Boolean(saleId), queryFn: async () => {
    const { data, error } = await supabase.from('sales').select('*, customers(*), sale_items(*, products(*), serial_numbers(*))').eq('id', saleId!).single();
    if (error) throw error;
    return data as unknown as Sale;
  }});
  const paymentsQuery = useQuery({ queryKey: ['payments', saleId], enabled: Boolean(saleId), queryFn: async () => {
    const { data, error } = await supabase.from('payments').select('*').eq('sale_id', saleId!).order('payment_date', { ascending: false });
    if (error) throw error;
    return (data ?? []) as unknown as Payment[];
  }});
  const jobQuery = useQuery({ queryKey: ['install_by_sale', saleId], enabled: Boolean(saleId), queryFn: async () => {
    const { data, error } = await supabase.from('installations').select('*').eq('sale_id', saleId!).maybeSingle();
    if (error) throw error;
    return data as unknown as Job | null;
  }});
  const docsQuery = useQuery({ queryKey: ['docs', saleId], enabled: Boolean(saleId), queryFn: async () => {
    const { data, error } = await supabase.from('documents').select('*').eq('sale_id', saleId!).order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []) as unknown as Document[];
  }});
  const auditQuery = useQuery({ queryKey: ['audit', saleId], enabled: tab === 'audit' && Boolean(saleId), queryFn: async () => {
    const { data, error } = await supabase.from('audit_logs').select('*').eq('entity_id', saleId!).order('timestamp', { ascending: false }).limit(100);
    if (error) throw error;
    return (data ?? []) as unknown as Audit[];
  }});

  if (saleQuery.isLoading) return <div className="p-10 text-center text-slate-400">Loading sale...</div>;
  if (saleQuery.error || !saleQuery.data) return <div className="p-10 text-center text-red-400">Sale not found.</div>;
  const sale = saleQuery.data;
  const customer = sale.customers;
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['sale', saleId] });

  async function submitPayment() {
    setBusy(true);
    try {
      await recordPayment({ sale_id: sale.id, amount_usd: amount, payment_method: method, reference_code: reference || undefined, recorded_by: sale.id });
      const latest = paymentsQuery.data?.[0];
      if (latest) await issueReceipt(sale.id, latest.id);
      setPaymentOpen(false); setAmount(0); setReference(''); await queryClient.invalidateQueries();
    } catch (error: unknown) { alert(error instanceof Error ? error.message : String(error)); }
    finally { setBusy(false); }
  }

  async function submitRefund() {
    if (!refundPayment || !refundReason || refundAmount <= 0) return;
    setBusy(true);
    try { await issueRefund({ payment_id: refundPayment, amount: refundAmount, reason: refundReason }); setRefundPayment(''); setRefundReason(''); await queryClient.invalidateQueries(); }
    catch (error: unknown) { alert(error instanceof Error ? error.message : String(error)); }
    finally { setBusy(false); }
  }

  const tabs: Tab[] = ['overview', 'items', 'payments', 'installation', 'documents', 'audit'];
  return <div className="mx-auto max-w-5xl space-y-5">
    <header className="flex flex-wrap items-center justify-between gap-3">
      <div><h1 className="text-2xl font-bold text-white">Sale {sale.sale_number}</h1><p className="text-sm text-slate-400">{customer?.first_name} {customer?.last_name ?? ''} · {customer?.phone}</p></div>
      <div className="flex gap-2"><Status text={sale.payment_status} /><Status text={sale.fulfilment_status} /></div>
    </header>
    <nav className="flex gap-1 overflow-x-auto border-b border-slate-800">{tabs.map(item => <button key={item} onClick={() => setTab(item)} className={`px-4 py-2 text-xs font-semibold capitalize ${tab === item ? 'border-b-2 border-amber-400 text-white' : 'text-slate-400'}`}>{item}</button>)}</nav>
    {tab === 'overview' && <section className="grid gap-4 md:grid-cols-2"><Panel title="Financial"><Row label="Total" value={usd(sale.total_amount)} /><Row label="Paid" value={usd(sale.amount_paid)} /><Row label="Balance due" value={usd(sale.balance_due)} /><Row label="Payment status" value={sale.payment_status} /></Panel><Panel title="Customer"><Row label="Name" value={`${customer?.first_name ?? ''} ${customer?.last_name ?? ''}`} /><Row label="Phone" value={customer?.phone ?? '-'} /><Row label="Address" value={customer?.address ?? '-'} /><Row label="Referral" value={sale.referral_source ?? '-'} /></Panel></section>}
    {tab === 'items' && <Panel title="Purchased Items"><Table headers={['Item', 'Serial', 'Qty', 'Unit', 'Total']} rows={sale.sale_items.map(item => [item.products?.description ?? item.description, item.serial_numbers?.serial_number ?? '-', String(item.quantity), usd(item.unit_price), usd(item.line_total)])} /></Panel>}
    {tab === 'payments' && <Panel title="Payment Ledger"><div className="mb-4 flex justify-end"><button onClick={() => { setAmount(Math.max(Number(sale.balance_due), 0)); setPaymentOpen(true); }} className="rounded bg-amber-500 px-3 py-2 text-xs font-semibold text-slate-900">Record Payment</button></div><Table headers={['Receipt', 'Date', 'Method', 'Reference', 'Amount']} rows={(paymentsQuery.data ?? []).map(payment => [payment.payment_number, new Date(payment.payment_date).toLocaleString(), payment.payment_method, payment.payment_reference ?? '-', usd(payment.amount)])} /></Panel>}
    {tab === 'installation' && <Panel title="Installation"><Row label="Job" value={jobQuery.data?.job_number ?? 'Not created'} /><Row label="Status" value={jobQuery.data?.status ?? 'Not created'} /><Row label="Scheduled" value={jobQuery.data?.scheduled_date ?? 'Not scheduled'} /></Panel>}
    {tab === 'documents' && <Panel title="Documents"><div className="space-y-2">{(docsQuery.data ?? []).map(doc => <div key={doc.id} className="flex items-center justify-between border-b border-slate-800 py-3 text-sm"><span>{doc.document_type} · {doc.document_number}</span><div className="flex gap-3">{doc.file_reference && <button onClick={() => openWhatsApp(customer?.phone ?? '', `Your ${doc.document_type} ${doc.document_number} is ready.`)} className="text-emerald-400">WhatsApp</button>}{isOwner && doc.status !== 'VOID' && <button onClick={async () => { await voidDocument({ document_id: doc.id, reason: 'Operator void request' }); await refresh(); }} className="text-red-400">Void</button>}</div></div>)}</div></Panel>}
    {tab === 'audit' && <Panel title="Audit Log"><div className="space-y-2">{(auditQuery.data ?? []).map(row => <div key={row.id} className="border-b border-slate-800 py-2 text-sm"><strong>{row.action}</strong><span className="ml-3 text-slate-500">{new Date(row.timestamp).toLocaleString()}</span>{row.reason && <p className="text-xs text-slate-500">{row.reason}</p>}</div>)}</div></Panel>}
    {paymentOpen && <Modal title="Record Payment"><input type="number" min={0.01} value={amount} onChange={event => setAmount(Number(event.target.value))} className="w-full rounded border p-2 text-slate-900" /><select value={method} onChange={event => setMethod(event.target.value as PaymentMethodEnum)} className="w-full rounded border p-2 text-slate-900"><option value="CASH">Cash</option><option value="BANK_TRANSFER">Bank Transfer</option><option value="CARD">Card</option></select><input value={reference} onChange={event => setReference(event.target.value)} placeholder="Reference" className="w-full rounded border p-2 text-slate-900" /><Actions busy={busy} onCancel={() => setPaymentOpen(false)} onConfirm={submitPayment} /> </Modal>}
    {isOwner && sale.fulfilment_status !== 'INSTALLED' && sale.fulfilment_status !== 'COMPLETED' && (paymentsQuery.data?.length ?? 0) > 0 && <Panel title="Owner Refund Control"><select value={refundPayment} onChange={event => setRefundPayment(event.target.value)} className="mr-2 rounded border p-2 text-slate-900"><option value="">Select payment</option>{paymentsQuery.data?.map(payment => <option key={payment.id} value={payment.id}>{payment.payment_number} - {usd(payment.amount)}</option>)}</select><input type="number" min={0.01} value={refundAmount} onChange={event => setRefundAmount(Number(event.target.value))} className="mr-2 rounded border p-2 text-slate-900" /><input value={refundReason} onChange={event => setRefundReason(event.target.value)} placeholder="Reason" className="mr-2 rounded border p-2 text-slate-900" /><button disabled={busy} onClick={submitRefund} className="rounded bg-red-600 px-3 py-2 text-xs font-semibold text-white">Issue Refund</button></Panel>}
  </div>;
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) { return <section className="rounded-xl border border-slate-800 bg-slate-900 p-5"><h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-400">{title}</h2>{children}</section>; }
function Row({ label, value }: { label: string; value: string }) { return <div className="flex justify-between border-b border-slate-800 py-2 text-sm last:border-0"><span className="text-slate-500">{label}</span><span className="text-slate-200">{value}</span></div>; }
function Status({ text }: { text: string }) { return <span className="rounded-full bg-slate-800 px-3 py-1 text-xs font-semibold text-amber-300">{text.replace(/_/g, ' ')}</span>; }
function Table({ headers, rows }: { headers: string[]; rows: string[][] }) { return <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="text-xs uppercase text-slate-500">{headers.map(header => <th key={header} className="py-2 pr-4">{header}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={index} className="border-t border-slate-800">{row.map((cell, cellIndex) => <td key={cellIndex} className="py-2 pr-4 text-slate-300">{cell}</td>)}</tr>)}</tbody></table></div>; }
function Modal({ title, children }: { title: string; children: React.ReactNode }) { return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"><div className="w-full max-w-sm space-y-3 rounded-xl bg-white p-5"><h2 className="font-semibold text-slate-900">{title}</h2>{children}</div></div>; }
function Actions({ busy, onCancel, onConfirm }: { busy: boolean; onCancel: () => void; onConfirm: () => void }) { return <div className="flex gap-2"><button onClick={onCancel} className="flex-1 rounded border px-3 py-2 text-sm text-slate-700">Cancel</button><button onClick={onConfirm} disabled={busy} className="flex-1 rounded bg-slate-900 px-3 py-2 text-sm text-white disabled:opacity-50">{busy ? 'Saving...' : 'Confirm'}</button></div>; }
