import * as XLSX from 'xlsx';
import { supabase } from './supabase';

type Customer = {
  full_name: string;
  phone: string;
  address: string | null;
};

type StockRow = {
  sku: string;
  quantity_available: number;
  days_of_stock_remaining: number | null;
  restock_status: string;
};

type SaleItem = {
  products: { sku: string } | null;
};

type SaleRow = {
  sale_date: string;
  total_amount: number;
  fulfilment_status: string;
  referral_source: string | null;
  notes: string | null;
  customers: Customer | null;
  sale_items: SaleItem[];
};

type PaymentRow = {
  sale_id: string;
  amount: number;
  payment_date: string;
};

type CashRow = {
  movement_date: string;
  description: string;
  category: string;
  type: string;
  amount: number;
  running_balance: number;
};

type InstallationRow = {
  sale_id: string;
  scheduled_date: string | null;
  address: string;
  parts_needed: string | null;
  status: string;
  installer_notes: string | null;
  customers: Customer | null;
  serial_numbers: { products: { sku: string } | null } | null;
  installers: { name: string } | null;
};

type WarrantyRow = {
  start_date: string;
  expiry_date: string;
  status: string;
  customers: Customer | null;
  serial_numbers: {
    serial_number: string;
    products: { sku: string } | null;
  } | null;
};

const dateOnly = (value: string | null | undefined) =>
  value ? new Date(value).toISOString().slice(0, 10) : '';

const customerName = (customer: Customer | null) => customer?.full_name ?? '';

export async function exportOperationsTracker(): Promise<void> {
  const results = await Promise.all([
    supabase.from('v_stock_dashboard').select('*'),
    supabase.from('sales').select('*, customers(*), sale_items(*, products(*))').order('sale_date', { ascending: true }),
    supabase.from('payments').select('*').order('payment_date', { ascending: true }),
    supabase.from('v_cash_position').select('*').order('movement_date', { ascending: true }),
    supabase.from('installations').select('*, customers(*), serial_numbers(*, products(*)), installers(*)').order('scheduled_date', { ascending: true }),
    supabase.from('warranties').select('*, customers(*), serial_numbers(*, products(*))').order('start_date', { ascending: true }),
  ]);

  const failed = results.find(result => result.error);
  if (failed?.error) throw failed.error;

  const [stockResult, salesResult, paymentsResult, cashResult, installsResult, warrantiesResult] = results;
  const stock = (stockResult.data ?? []) as unknown as StockRow[];
  const sales = (salesResult.data ?? []) as unknown as SaleRow[];
  const payments = (paymentsResult.data ?? []) as unknown as PaymentRow[];
  const cash = (cashResult.data ?? []) as unknown as CashRow[];
  const installs = (installsResult.data ?? []) as unknown as InstallationRow[];
  const warranties = (warrantiesResult.data ?? []) as unknown as WarrantyRow[];

  const workbook = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(stock.map(row => ({
    SKU: row.sku,
    'Current Stock': row.quantity_available,
    'Days of Stock Left': row.days_of_stock_remaining ?? 'No sales yet',
    Status: row.restock_status,
  }))), 'Stock Tracker');

  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(sales.map(sale => {
    const firstPayment = payments.find(payment => payment.sale_id === (sale as SaleRow & { id: string }).id);
    const installation = installs.find(job => job.sale_id === (sale as SaleRow & { id: string }).id);
    return {
      'Enquiry Date': dateOnly(sale.sale_date),
      'Customer Name': customerName(sale.customers),
      Phone: sale.customers?.phone ?? '',
      SKU: sale.sale_items[0]?.products?.sku ?? '',
      Stage: sale.fulfilment_status,
      'Quote ($)': sale.total_amount,
      'Deposit ($)': firstPayment?.amount ?? 0,
      'Deposit Date': dateOnly(firstPayment?.payment_date),
      'Install Date': installation?.scheduled_date ?? '',
      'Referral Source': sale.referral_source ?? '',
      Notes: sale.notes ?? '',
    };
  })), 'Sales Pipeline');

  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(cash.map(row => ({
    Date: row.movement_date,
    Description: row.description,
    Category: row.category,
    'Type (In/Out)': row.type,
    'Amount ($)': row.amount,
    'Running Balance ($)': row.running_balance,
  }))), 'Cash & Capital');

  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(installs.map(job => ({
    'Job Date': job.scheduled_date ?? '',
    'Customer Name': customerName(job.customers),
    Phone: job.customers?.phone ?? '',
    Address: job.address,
    SKU: job.serial_numbers?.products?.sku ?? '',
    'Plumber Assigned': job.installers?.name ?? '',
    'Parts Needed': job.parts_needed ?? '',
    Status: job.status,
    Notes: job.installer_notes ?? '',
  }))), 'Install Scheduler');

  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(warranties.map(warranty => ({
    'Customer Name': customerName(warranty.customers),
    Phone: warranty.customers?.phone ?? '',
    Address: warranty.customers?.address ?? '',
    SKU: warranty.serial_numbers?.products?.sku ?? '',
    'Serial Number': warranty.serial_numbers?.serial_number ?? '',
    'Install Date': warranty.start_date,
    'Warranty Expiry': warranty.expiry_date,
    'Warranty Status': warranty.status,
  }))), 'Customer & Warranty');

  XLSX.writeFile(workbook, `Rafiki_Operations_Tracker_${dateOnly(new Date().toISOString())}.xlsx`);
}