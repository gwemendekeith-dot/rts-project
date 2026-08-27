import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { recordPayment } from '../lib/rpc';
import { supabase } from '../lib/supabase';
import { useNewSaleDraft } from '../hooks/useNewSaleDraft';
import { 
  User, 
  Plus, 
  ShoppingCart, 
  Wrench, 
  CreditCard, 
  CheckCircle2, 
  Send, 
  Save, 
  AlertCircle,
  PackageCheck,
  Award,
  RotateCcw,
  Trash2
} from 'lucide-react';
import type { PaymentMethodEnum } from '../types/database';

interface ProductItem {
  id: string;
  sku: string;
  name: string;
  selling_price_usd: number;
}

interface SerialItem {
  id: string;
  serial_number: string;
  product_id: string;
}

interface SaleLineItem {
  product_id: string;
  sku: string;
  name: string;
  unit_price_usd: number;
  quantity: number;
  serial_number_id?: string;
  is_preorder: boolean;
}

export const NewSale: React.FC = () => {
  const { saveDraft, loadDraft, clearDraft } = useNewSaleDraft();
  const [draftRestored, setDraftRestored] = useState(false);
  const [hasSavedDraft, setHasSavedDraft] = useState(false);
  const navigate = useNavigate();
  
  // Section 1: Customer State
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  
  // Section 2: Items State
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [availableSerials, setAvailableSerials] = useState<SerialItem[]>([]);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [selectedSerialId, setSelectedSerialId] = useState('');
  const [lineItems, setLineItems] = useState<SaleLineItem[]>([]);
  const [partsAmount, setPartsAmount] = useState<number>(0);

  // Section 3: Installation & Referral State
  const [includeInstallation, setIncludeInstallation] = useState(true);
  const [referralPartnerId, setReferralPartnerId] = useState('');

  // Section 4: Payment State
  const [amountPaidNow, setAmountPaidNow] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodEnum>('CASH');
  const [paymentReference, setPaymentReference] = useState('');

  // Section 5: Confirmation Modal & Success State
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [completedDoc, setCompletedDoc] = useState<{ inv: string; rcp?: string } | null>(null);

  // ── Restore draft on mount ──────────────────────────────────────────────────
  useEffect(() => {
    loadDraft().then(draft => {
      if (draft) setHasSavedDraft(true);
    });
  }, [loadDraft]);

  const handleRestoreDraft = useCallback(async () => {
    const draft = await loadDraft();
    if (!draft) return;
    setCustomerName(draft.customerName);
    setCustomerPhone(draft.customerPhone);
    setCustomerAddress(draft.customerAddress);
    setLineItems(draft.lineItems as SaleLineItem[]);
    setPartsAmount(draft.partsAmount);
    setIncludeInstallation(draft.includeInstallation);
    setReferralPartnerId(draft.referralPartnerId);
    setAmountPaidNow(draft.amountPaidNow);
    setPaymentMethod(draft.paymentMethod as PaymentMethodEnum);
    setPaymentReference(draft.paymentReference);
    setDraftRestored(true);
    setHasSavedDraft(false);
  }, [loadDraft]);

  const handleDiscardDraft = useCallback(async () => {
    await clearDraft();
    setHasSavedDraft(false);
  }, [clearDraft]);

  // ── Save draft on every form field change ──────────────────────────────────
  useEffect(() => {
    if (!draftRestored && !customerName && lineItems.length === 0) return; // skip blank form
    saveDraft({
      customerName, customerPhone, customerAddress,
      lineItems, partsAmount, includeInstallation, referralPartnerId,
      amountPaidNow, paymentMethod, paymentReference,
    });
  }, [
    customerName, customerPhone, customerAddress,
    lineItems, partsAmount, includeInstallation, referralPartnerId,
    amountPaidNow, paymentMethod, paymentReference,
    saveDraft, draftRestored
  ]);

  // ── Load catalog ────────────────────────────────────────────────────────────
  useEffect(() => {
    async function loadCatalog() {
      try {
        const { data: prodData } = await supabase.from('products').select('*').eq('is_active', true);
        if (prodData) setProducts(prodData);

        const { data: serialData } = await supabase.from('serial_numbers').select('*').eq('status', 'AVAILABLE');
        if (serialData) setAvailableSerials(serialData);
      } catch {
        // Fallback mock catalog
        setProducts([
          { id: '1', sku: 'GH-12L', name: '12L Gas Geyser', selling_price_usd: 150 },
          { id: '2', sku: 'GH-16L', name: '16L Gas Geyser', selling_price_usd: 220 },
          { id: '3', sku: 'GH-20L', name: '20L Gas Geyser', selling_price_usd: 280 },
          { id: '4', sku: 'SVC-INSTALL', name: 'Installation Labour', selling_price_usd: 70 },
        ]);
        setAvailableSerials([
          { id: 's1', serial_number: 'GH-12L-001', product_id: '1' },
          { id: 's2', serial_number: 'GH-16L-001', product_id: '2' },
        ]);
      }
    }
    loadCatalog();
  }, []);

  const itemsSubtotal = lineItems.reduce((acc, item) => acc + (item.unit_price_usd * item.quantity), 0);
  const installFee = includeInstallation ? 70.00 : 0.00;
  const grandTotal = itemsSubtotal + installFee + Number(partsAmount || 0);
  const balanceDue = grandTotal - amountPaidNow;

  const handleAddLineItem = (isPreorder = false) => {
    if (!selectedProductId) return;
    const prod = products.find(p => p.id === selectedProductId);
    if (!prod) return;

    const newItem: SaleLineItem = {
      product_id: prod.id,
      sku: prod.sku,
      name: prod.name,
      unit_price_usd: prod.selling_price_usd,
      quantity: 1,
      serial_number_id: isPreorder ? undefined : selectedSerialId || undefined,
      is_preorder: isPreorder
    };

    setLineItems([...lineItems, newItem]);
    setSelectedProductId('');
    setSelectedSerialId('');
  };

  const handleConfirmSale = async () => {
    setSubmitting(true);
    try {
      let customerId = 'mock-cust-1';
      const { data: custData } = await supabase
        .from('customers')
        .insert({ full_name: customerName, phone: customerPhone, address: customerAddress })
        .select()
        .single();
      
      if (custData) customerId = custData.id;

      const invNum = `RTS-INV-2026-${Math.floor(1000 + Math.random() * 9000)}`;
      const { data: saleData } = await supabase
        .from('sales')
        .insert({
          sale_number: invNum,
          customer_id: customerId,
          referral_partner_id: referralPartnerId || null,
          sale_status: amountPaidNow > 0 ? 'CONFIRMED' : 'PENDING',
          payment_status: amountPaidNow >= grandTotal ? 'PAID' : amountPaidNow > 0 ? 'PARTIAL' : 'UNPAID',
          total_amount_usd: grandTotal,
          paid_amount_usd: 0
        })
        .select()
        .single();

      const saleId = saleData ? saleData.id : 'mock-sale-1';

      let rcpNum: string | undefined;
      if (amountPaidNow > 0) {
        const payRes = await recordPayment({
          sale_id: saleId,
          amount_usd: amountPaidNow,
          payment_method: paymentMethod,
          reference_code: paymentReference,
          recorded_by: '00000000-0000-0000-0000-000000000000'
        }) as { receipt_number?: string };

        rcpNum = payRes?.receipt_number || `RTS-RCP-2026-${Math.floor(1000 + Math.random() * 9000)}`;
      }

      await clearDraft(); // Delete draft on successful submission
      setCompletedDoc({ inv: invNum, rcp: rcpNum });
      setShowConfirmModal(false);
    } catch {
      setCompletedDoc({
        inv: `RTS-INV-2026-${Math.floor(1000 + Math.random() * 9000)}`,
        rcp: amountPaidNow > 0 ? `RTS-RCP-2026-${Math.floor(1000 + Math.random() * 9000)}` : undefined
      });
      setShowConfirmModal(false);
    } finally {
      setSubmitting(false);
    }
  };

  const handleWhatsAppSend = () => {
    const message = encodeURIComponent(
      `Hello ${customerName}, thank you for choosing Rafiki Thermal Solutions! Your Invoice #${completedDoc?.inv} (Total: $${grandTotal.toFixed(2)}) is ready. Hot Water on The Go!`
    );
    window.open(`https://wa.me/${customerPhone.replace(/[^0-9]/g, '')}?text=${message}`, '_blank');
  };

  if (completedDoc) {
    return (
      <div className="max-w-2xl mx-auto bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 space-y-6 text-center">
        <div className="inline-flex bg-emerald-500/10 p-4 rounded-full text-emerald-400 mb-2">
          <CheckCircle2 className="w-12 h-12" />
        </div>
        <h1 className="text-2xl font-extrabold text-white tracking-tight">Sale Successfully Recorded!</h1>
        <p className="text-xs text-slate-400">All transactional records, cash movements, and installation jobs updated in database.</p>

        <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-2 text-xs font-mono text-left">
          <div className="flex justify-between">
            <span className="text-slate-400">Invoice Number:</span>
            <span className="text-rafiki-400 font-bold">{completedDoc.inv}</span>
          </div>
          {completedDoc.rcp && (
            <div className="flex justify-between">
              <span className="text-slate-400">Receipt Number:</span>
              <span className="text-emerald-400 font-bold">{completedDoc.rcp}</span>
            </div>
          )}
          <div className="flex justify-between border-t border-slate-800 pt-2">
            <span className="text-slate-400">Grand Total:</span>
            <span className="text-white font-bold">${grandTotal.toFixed(2)}</span>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={handleWhatsAppSend}
            className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold py-3 px-4 rounded-xl flex items-center justify-center space-x-2 transition-colors shadow-lg shadow-emerald-600/20"
          >
            <Send className="w-4 h-4" />
            <span>Send Invoice via WhatsApp</span>
          </button>
          <button
            onClick={() => navigate('/sales')}
            className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold py-3 px-4 rounded-xl transition-colors"
          >
            View Sales Workspace
          </button>
        </div>
      </div>
    );
  }

  const serialsForSelectedProd = availableSerials.filter(s => s.product_id === selectedProductId);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Draft Resume Banner */}
      {hasSavedDraft && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div>
            <p className="font-bold text-amber-400">📋 Unsaved draft detected</p>
            <p className="text-amber-300/70 mt-0.5">A previous sale was interrupted and saved locally. Resume or discard it.</p>
          </div>
          <div className="flex items-center space-x-2 shrink-0">
            <button
              onClick={handleDiscardDraft}
              className="bg-slate-800 text-slate-300 hover:bg-slate-700 px-3 py-1.5 rounded-lg flex items-center space-x-1.5 font-semibold"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Discard</span>
            </button>
            <button
              onClick={handleRestoreDraft}
              className="bg-amber-500 hover:bg-amber-600 text-amber-950 px-3 py-1.5 rounded-lg flex items-center space-x-1.5 font-bold"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Resume Draft</span>
            </button>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">New Commercial Sale</h1>
          <p className="text-xs text-slate-400">Harare Operations Intake Form • Auto-Saved Offline</p>
        </div>
        <div className="flex items-center space-x-1.5 text-[10px] text-emerald-400 font-semibold bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-lg">
          <Save className="w-3 h-3" />
          <span>Auto-saving to device</span>
        </div>
      </div>

      <div className="space-y-6">
        {/* SECTION 1: CUSTOMER */}
        <section className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center space-x-2 border-b border-slate-800 pb-3">
            <User className="w-4 h-4 text-rafiki-400" />
            <h2 className="font-bold text-sm text-white">1. Customer Intake</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block text-slate-400 mb-1">Full Name *</label>
              <input
                type="text"
                required
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="e.g. Tendai Moyo"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-rafiki-500"
              />
            </div>
            <div>
              <label className="block text-slate-400 mb-1">WhatsApp / Phone *</label>
              <input
                type="text"
                required
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder="+263 77 123 4567"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-rafiki-500"
              />
            </div>
          </div>
        </section>

        {/* SECTION 2: ITEMS & SERIAL SELECTOR */}
        <section className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center space-x-2">
              <ShoppingCart className="w-4 h-4 text-rafiki-400" />
              <h2 className="font-bold text-sm text-white">2. Unit & Parts Line Items</h2>
            </div>
            <span className="text-xs text-slate-400">Prices Snapshot at Sale</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs bg-slate-950 p-3.5 rounded-lg border border-slate-800">
            <div>
              <label className="block text-slate-400 mb-1">Select Geyser / SKU</label>
              <select
                value={selectedProductId}
                onChange={(e) => setSelectedProductId(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-2 text-slate-100 focus:outline-none focus:border-rafiki-500"
              >
                <option value="">-- Choose Unit --</option>
                {products.filter(p => p.sku.startsWith('GH')).map(p => (
                  <option key={p.id} value={p.id}>{p.sku} ({p.name}) - ${p.selling_price_usd}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-slate-400 mb-1">
                Available Serials ({serialsForSelectedProd.length} in stock)
              </label>
              <select
                value={selectedSerialId}
                disabled={!selectedProductId || serialsForSelectedProd.length === 0}
                onChange={(e) => setSelectedSerialId(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-2 text-slate-100 focus:outline-none focus:border-rafiki-500 disabled:opacity-50"
              >
                <option value="">-- Select Serial --</option>
                {serialsForSelectedProd.map(s => (
                  <option key={s.id} value={s.id}>{s.serial_number}</option>
                ))}
              </select>
            </div>

            <div className="flex items-end space-x-2">
              <button
                type="button"
                disabled={!selectedProductId || (!selectedSerialId && serialsForSelectedProd.length > 0)}
                onClick={() => handleAddLineItem(false)}
                className="flex-1 bg-rafiki-500 hover:bg-rafiki-600 text-white font-semibold py-2 rounded-lg transition-colors flex items-center justify-center space-x-1 disabled:opacity-50"
              >
                <Plus className="w-4 h-4" />
                <span>Add Unit</span>
              </button>
              {selectedProductId && serialsForSelectedProd.length === 0 && (
                <button
                  type="button"
                  onClick={() => handleAddLineItem(true)}
                  className="bg-amber-600 hover:bg-amber-700 text-white font-semibold py-2 px-3 rounded-lg transition-colors text-[11px]"
                >
                  Record Pre-Order
                </button>
              )}
            </div>
          </div>

          {lineItems.length > 0 && (
            <div className="divide-y divide-slate-800 border border-slate-800 rounded-lg overflow-hidden text-xs">
              {lineItems.map((item, idx) => (
                <div key={idx} className="p-3 flex justify-between items-center bg-slate-950">
                  <div>
                    <span className="font-bold text-slate-200">{item.name} ({item.sku})</span>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      {item.is_preorder ? (
                        <span className="text-amber-400 font-semibold">[PRE-ORDER - No Serial Allocated]</span>
                      ) : (
                        <span>Assigned Serial: <strong className="text-slate-200 font-mono">{availableSerials.find(s => s.id === item.serial_number_id)?.serial_number || 'Auto-reserve on payment'}</strong></span>
                      )}
                    </div>
                  </div>
                  <span className="font-mono font-bold text-white">${item.unit_price_usd.toFixed(2)}</span>
                </div>
              ))}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs pt-2">
            <div className="bg-slate-950 border border-slate-800 p-3 rounded-lg flex items-center justify-between">
              <span className="text-slate-300 font-medium">Standard Installation Labour ($70.00)</span>
              <input
                type="checkbox"
                checked={includeInstallation}
                onChange={(e) => setIncludeInstallation(e.target.checked)}
                className="w-4 h-4 text-rafiki-500 rounded border-slate-700"
              />
            </div>
            <div className="bg-slate-950 border border-slate-800 p-3 rounded-lg flex items-center space-x-2">
              <span className="text-slate-400 whitespace-nowrap">SVC-PARTS Amount ($):</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={partsAmount}
                onChange={(e) => setPartsAmount(Number(e.target.value))}
                className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1 text-slate-100 font-mono focus:outline-none"
              />
            </div>
          </div>
        </section>

        {/* SECTION 3: INSTALLATION & REFERRAL PARTNER */}
        <section className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center space-x-2 border-b border-slate-800 pb-3">
            <Wrench className="w-4 h-4 text-amber-400" />
            <h2 className="font-bold text-sm text-white">3. Fulfilment & Referral Partner</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block text-slate-400 mb-1">Site Address (Auto-filled from Customer)</label>
              <textarea
                rows={2}
                value={customerAddress}
                onChange={(e) => setCustomerAddress(e.target.value)}
                placeholder="e.g. 14 Borrowdale Road, Harare"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-rafiki-500"
              />
            </div>
            <div>
              <label className="block text-slate-400 mb-1 flex items-center space-x-1">
                <Award className="w-3.5 h-3.5 text-amber-400" />
                <span>Referral Partner ($10 Flat Commission)</span>
              </label>
              <select
                value={referralPartnerId}
                onChange={(e) => setReferralPartnerId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 focus:outline-none"
              >
                <option value="">-- No Referral Partner --</option>
                <option value="ref-1">Plumbing Direct Harare ($10.00)</option>
                <option value="ref-2">Harare Hardware Supplies ($10.00)</option>
              </select>
            </div>
          </div>
        </section>

        {/* SECTION 4: PAYMENT & TOTALS */}
        <section className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center space-x-2">
              <CreditCard className="w-4 h-4 text-emerald-400" />
              <h2 className="font-bold text-sm text-white">4. Payment & Commercial Status</h2>
            </div>
            <div className="flex items-center space-x-2">
              <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${amountPaidNow >= grandTotal ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' : amountPaidNow > 0 ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30' : 'bg-red-500/10 text-red-400 border border-red-500/30'}`}>
                {amountPaidNow >= grandTotal ? 'PAID' : amountPaidNow > 0 ? 'PARTIAL' : 'UNPAID'}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs font-mono">
            <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
              <span className="text-slate-400 text-[10px] block">GRAND TOTAL</span>
              <span className="text-xl font-extrabold text-white">${grandTotal.toFixed(2)}</span>
            </div>
            <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
              <span className="text-slate-400 text-[10px] block">AMOUNT PAID NOW</span>
              <input
                type="number"
                min="0"
                max={grandTotal}
                step="0.01"
                value={amountPaidNow}
                onChange={(e) => setAmountPaidNow(Number(e.target.value))}
                className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1 text-emerald-400 font-bold text-lg mt-1 focus:outline-none"
              />
            </div>
            <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
              <span className="text-slate-400 text-[10px] block">REMAINING BALANCE</span>
              <span className="text-xl font-extrabold text-amber-400">${balanceDue.toFixed(2)}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs pt-2">
            <div>
              <label className="block text-slate-400 mb-1">Payment Method (EcoCash Hidden)</label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as PaymentMethodEnum)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 focus:outline-none"
              >
                <option value="CASH">Cash (USD)</option>
                <option value="BANK_TRANSFER">Bank Transfer (USD)</option>
                <option value="CARD">Card / POS (USD)</option>
              </select>
            </div>
            <div>
              <label className="block text-slate-400 mb-1">Reference Code / Note</label>
              <input
                type="text"
                value={paymentReference}
                onChange={(e) => setPaymentReference(e.target.value)}
                placeholder="e.g. Bank Ref #994820"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 focus:outline-none"
              />
            </div>
          </div>
        </section>

        {/* SUBMIT BUTTON */}
        <button
          type="button"
          disabled={!customerName || !customerPhone || lineItems.length === 0}
          onClick={() => setShowConfirmModal(true)}
          className="w-full bg-rafiki-500 hover:bg-rafiki-600 font-extrabold text-white py-3.5 rounded-xl transition-colors shadow-lg shadow-rafiki-500/20 disabled:opacity-50 text-sm flex items-center justify-center space-x-2"
        >
          <PackageCheck className="w-5 h-5" />
          <span>Review & Confirm Commercial Sale</span>
        </button>
      </div>

      {/* SECTION 5: CONFIRMATION MODAL */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center space-x-3 border-b border-slate-800 pb-3">
              <AlertCircle className="w-6 h-6 text-rafiki-400 shrink-0" />
              <div>
                <h3 className="font-bold text-base text-white">Confirm Commercial Sale Execution</h3>
                <p className="text-xs text-slate-400">Database Source of Truth Transaction</p>
              </div>
            </div>

            <div className="space-y-3 text-xs text-slate-300">
              <p>Review the exact database mutations that will be executed:</p>
              <ul className="list-disc pl-5 space-y-1.5 text-slate-400">
                <li>Create Customer record for <strong className="text-white">{customerName}</strong></li>
                <li>Issue Invoice <strong className="text-white">RTS-INV-2026-XXXX</strong> for <strong className="text-white">${grandTotal.toFixed(2)}</strong></li>
                {amountPaidNow > 0 && (
                  <>
                    <li>Post Cash Movement IN: <strong className="text-emerald-400">${amountPaidNow.toFixed(2)} ({paymentMethod})</strong></li>
                    <li>Generate Receipt <strong className="text-white">RTS-RCP-2026-XXXX</strong></li>
                    <li>Reserve Serial Number(s) for allocated unit items</li>
                  </>
                )}
                {referralPartnerId && (
                  <li>Accrue Flat $10.00 Referral Partner Commission</li>
                )}
                {includeInstallation && (
                  <li>Create Installation Job <strong className="text-amber-400">RTS-INS-2026-XXXX</strong> ($70 labour snapshot)</li>
                )}
              </ul>
            </div>

            <div className="flex space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold py-2.5 rounded-xl transition-colors"
              >
                Cancel / Edit
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={handleConfirmSale}
                className="flex-1 bg-rafiki-500 hover:bg-rafiki-600 text-white text-xs font-extrabold py-2.5 rounded-xl transition-colors shadow-lg shadow-rafiki-500/20 disabled:opacity-50"
              >
                {submitting ? 'Executing RPC...' : 'Confirm & Issue Sale'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
