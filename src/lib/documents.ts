import { supabase } from './supabase';
import { hydrateTemplate, renderPdf, uploadPdfToStorage, lineItemRow } from './pdf';
import receiptTpl from '../../supabase/functions/generate-pdf/templates/receipt-v1.0.html?raw';
import invoiceTpl from '../../supabase/functions/generate-pdf/templates/invoice-v1.0.html?raw';
import warrantyTpl from '../../supabase/functions/generate-pdf/templates/warranty-v1.0.html?raw';

const fmtDate = (date: string | Date) =>
  new Date(date).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

type SaleItemRecord = {
  quantity: number;
  unit_price: number;
  products?: { name: string } | null;
  serial_numbers?: { serial_number: string } | null;
};

type SaleRecord = {
  customer_id: string;
  sale_date?: string;
  created_at: string;
  payment_status: string;
  total_amount: number;
  amount_paid: number;
  balance_due: number;
  customers: { first_name: string; last_name: string | null; phone: string; address: string | null };
  sale_items: SaleItemRecord[];
};

type PaymentRecord = {
  payment_date: string;
  amount: number;
  payment_method: string;
  payment_reference: string | null;
};

type WarrantyRecord = {
  id: string;
  warranty_number: string;
  sale_id: string;
  installation_id: string;
  customer_id: string;
  serial_numbers: {
    serial_number: string;
    products: { name: string } | null;
  };
  customers: { first_name: string; last_name: string | null };
  start_date: string;
  expiry_date: string;
};

type IssuedDocument = { id: string; document_number: string };
export type GeneratedDocument = { url: string; documentNumber: string };

async function baseSettings(): Promise<Record<string, string>> {
  const { data, error } = await supabase
    .from('system_settings')
    .select('key, value')
    .in('key', ['whatsapp_number', 'location']);
  if (error) throw error;
  const values = Object.fromEntries((data ?? []).map(row => [row.key, row.value]));
  return {
    WHATSAPP: values.whatsapp_number ?? '',
    LOCATION: values.location ?? '',
  };
}

async function getSale(saleId: string): Promise<SaleRecord> {
  const { data, error } = await supabase
    .from('sales')
    .select('*, customers(*), sale_items(*, products(*), serial_numbers(*))')
    .eq('id', saleId)
    .single();
  if (error) throw error;
  if (!data) throw new Error('Sale not found');
  return data as unknown as SaleRecord;
}

async function issueDocument(args: {
  type: 'RECEIPT' | 'INVOICE' | 'WARRANTY_CERTIFICATE';
  customerId: string;
  saleId?: string;
  paymentId?: string;
  installationId?: string;
  warrantyId?: string;
}): Promise<IssuedDocument> {
  const { data, error } = await supabase.rpc('fn_issue_document', {
    p_type: args.type,
    p_customer_id: args.customerId,
    p_sale_id: args.saleId,
    p_payment_id: args.paymentId,
    p_installation_id: args.installationId,
    p_warranty_id: args.warrantyId,
    p_template_version: 'v1.0',
  });
  if (error) throw error;
  if (!data) throw new Error('Document issuance returned no document');
  return data as unknown as IssuedDocument;
}

async function linkDocument(documentId: string, path: string): Promise<void> {
  const { error } = await supabase.rpc('fn_link_document_file', {
    p_document_id: documentId,
    p_file_reference: path,
  });
  if (error) throw error;
}

function saleRows(items: SaleItemRecord[]): string {
  return items.map((item) => {
    const unitPrice = Number(item.unit_price);
    const quantity = Number(item.quantity);
    return lineItemRow({
      description: item.products?.name ?? 'Sale item',
      serial: item.serial_numbers?.serial_number ?? null,
      qty: quantity,
      unitPrice,
      lineTotal: quantity * unitPrice,
    });
  }).join('');
}

export async function issueReceipt(saleId: string, paymentId: string): Promise<GeneratedDocument> {
  const [settings, sale] = await Promise.all([baseSettings(), getSale(saleId)]);
  const { data: payment, error: paymentError } = await supabase
    .from('payments')
    .select('*')
    .eq('id', paymentId)
    .single();
  if (paymentError) throw paymentError;
  if (!payment) throw new Error('Payment not found');
  const paymentRecord = payment as unknown as PaymentRecord;
  const document = await issueDocument({
    type: 'RECEIPT', customerId: sale.customer_id, saleId, paymentId,
  });

  const html = hydrateTemplate(receiptTpl, {
    ...settings,
    DOCUMENT_NUMBER: document.document_number,
    ISSUE_DATE: fmtDate(paymentRecord.payment_date),
    PAYMENT_METHOD: paymentRecord.payment_method.replace(/_/g, ' '),
    PAYMENT_REFERENCE: paymentRecord.payment_reference ?? '-',
    PAYMENT_STATUS: sale.payment_status.replace(/_/g, ' '),
    CUSTOMER_NAME: `${sale.customers.first_name} ${sale.customers.last_name || ''}`.trim(),
    LINE_ITEMS_ROWS: saleRows(sale.sale_items),
    SUBTOTAL: Number(sale.total_amount).toFixed(2),
    TOTAL_PAID: Number(paymentRecord.amount).toFixed(2),
  });
  const path = `receipts/${document.document_number}.pdf`;
  const url = await uploadPdfToStorage(path, await renderPdf(html));
  await linkDocument(document.id, path);
  return { url, documentNumber: document.document_number };
}

export async function issueInvoice(saleId: string): Promise<GeneratedDocument> {
  const [settings, sale] = await Promise.all([baseSettings(), getSale(saleId)]);
  const document = await issueDocument({
    type: 'INVOICE', customerId: sale.customer_id, saleId,
  });
  const html = hydrateTemplate(invoiceTpl, {
    ...settings,
    DOCUMENT_NUMBER: document.document_number,
    ISSUE_DATE: fmtDate(sale.sale_date ?? sale.created_at),
    CUSTOMER_NAME: `${sale.customers.first_name} ${sale.customers.last_name || ''}`.trim(),
    CUSTOMER_PHONE: sale.customers.phone,
    CUSTOMER_ADDRESS: sale.customers.address ?? '',
    LINE_ITEMS_ROWS: saleRows(sale.sale_items),
    SUBTOTAL: Number(sale.total_amount).toFixed(2),
    AMOUNT_PAID: Number(sale.amount_paid).toFixed(2),
    BALANCE_DUE: Number(sale.balance_due).toFixed(2),
  });
  const path = `invoices/${document.document_number}.pdf`;
  const url = await uploadPdfToStorage(path, await renderPdf(html));
  await linkDocument(document.id, path);
  return { url, documentNumber: document.document_number };
}

export async function issueWarrantyCertificate(installationId: string): Promise<string> {
  const [settings, warrantyResult] = await Promise.all([
    baseSettings(),
    supabase.from('warranties')
      .select('*, customers(*), serial_numbers(*, products(*))')
      .eq('installation_id', installationId)
      .single(),
  ]);
  if (warrantyResult.error) throw warrantyResult.error;
  if (!warrantyResult.data) throw new Error('Warranty not found');
  const warranty = warrantyResult.data as unknown as WarrantyRecord;
  const document = await issueDocument({
    type: 'WARRANTY_CERTIFICATE',
    customerId: warranty.customer_id,
    saleId: warranty.sale_id,
    installationId,
    warrantyId: warranty.id,
  });
  const html = hydrateTemplate(warrantyTpl, {
    ...settings,
    WARRANTY_NUMBER: document.document_number,
    SERIAL_NUMBER: warranty.serial_numbers.serial_number,
    PRODUCT_MODEL: warranty.serial_numbers.products?.name ?? '',
    CUSTOMER_NAME: `${warranty.customers.first_name} ${warranty.customers.last_name || ''}`.trim(),
    START_DATE: fmtDate(warranty.start_date),
    EXPIRY_DATE: fmtDate(warranty.expiry_date),
  });
  const path = `warranties/${document.document_number}.pdf`;
  const url = await uploadPdfToStorage(path, await renderPdf(html));
  await linkDocument(document.id, path);
  return url;
}
