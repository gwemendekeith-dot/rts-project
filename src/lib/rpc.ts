import { supabase } from './supabase';
import type { PaymentMethodEnum, UserRoleEnum, Json } from '../types/database';

export interface RecordPaymentArgs {
  sale_id: string;
  amount_usd: number;
  payment_method: PaymentMethodEnum;
  reference_code?: string;
  recorded_by: string;
}

export interface ScheduleInstallationArgs {
  installation_id: string;
  installer_id: string;
  scheduled_date: string;
  scheduled_time_slot?: string;
  notes?: string;
}

export interface CompleteInstallationArgs {
  installation_id: string;
  gas_test: boolean;
  water_test: boolean;
  unit_test: boolean;
  customer_handover: boolean;
  signature_ref: string;
  photo_refs?: string[];
  installer_notes?: string;
}

export interface IssueRefundArgs {
  payment_id: string;
  amount: number;
  reason: string;
}

export interface ReceiveStockArgs {
  product_id: string;
  serial_numbers: string[];
  received_date?: string;
}

export interface SettleObligationArgs {
  obligation_id: string;
  amount: number;
  note?: string;
}

export interface VoidDocumentArgs {
  document_id: string;
  reason: string;
}

export interface SwitchRoleArgs {
  new_role: UserRoleEnum;
}

export interface CancelSaleArgs {
  sale_id: string;
  reason: string;
}

// 1. Record Payment
export async function recordPayment(args: RecordPaymentArgs): Promise<Json> {
  const { data, error } = await supabase.rpc('fn_record_payment', {
    p_sale_id: args.sale_id,
    p_amount: args.amount_usd,
    p_method: args.payment_method,
    p_reference: args.reference_code,
  });

  if (error) throw error;
  return data;
}

// 2. Schedule Installation
export async function scheduleInstallation(args: ScheduleInstallationArgs): Promise<Json> {
  const { data, error } = await supabase.rpc('fn_schedule_installation', {
    p_job_id: args.installation_id,
    p_installer_id: args.installer_id,
    p_date: args.scheduled_date,
  });

  if (error) throw error;
  return data;
}

// 3. Complete Installation
export async function completeInstallation(args: CompleteInstallationArgs): Promise<Json> {
  const { data, error } = await supabase.rpc('fn_complete_installation', {
    p_job_id: args.installation_id,
    p_gas_test: args.gas_test,
    p_water_test: args.water_test,
    p_unit_test: args.unit_test,
    p_customer_handover: args.customer_handover,
    p_signature_ref: args.signature_ref,
    p_photo_refs: args.photo_refs,
    p_installer_notes: args.installer_notes,
  });

  if (error) throw error;
  return data;
}

// 4. Issue Refund (Gates Clause 3: COMPLETED installation refund error)
export async function issueRefund(args: IssueRefundArgs): Promise<Json> {
  const { data, error } = await supabase.rpc('fn_issue_refund', {
    p_payment_id: args.payment_id,
    p_amount: args.amount,
    p_reason: args.reason,
  });

  if (error) throw error;
  return data;
}

// 5. Receive Stock
export async function receiveStock(args: ReceiveStockArgs): Promise<Json> {
  const { data, error } = await supabase.rpc('fn_receive_stock', {
    p_product_id: args.product_id,
    p_serials: args.serial_numbers,
    p_received_date: args.received_date,
  });

  if (error) throw error;
  return data;
}

// 6. Settle Obligation
export async function settleObligation(args: SettleObligationArgs): Promise<Json> {
  const { data, error } = await supabase.rpc('fn_settle_obligation', {
    p_obligation_id: args.obligation_id,
    p_amount: args.amount,
    p_note: args.note,
  });

  if (error) throw error;
  return data;
}

// 7. Void Document
export async function voidDocument(args: VoidDocumentArgs): Promise<Json> {
  const { data, error } = await supabase.rpc('fn_void_document', {
    p_document_id: args.document_id,
    p_reason: args.reason,
  });

  if (error) throw error;
  return data;
}

// 8. Switch Role
export async function switchRole(args: SwitchRoleArgs): Promise<Json> {
  const { data, error } = await supabase.rpc('fn_switch_role', {
    p_role: args.new_role,
  });

  if (error) throw error;
  return data;
}

export async function cancelSale(args: CancelSaleArgs): Promise<Json> {
  const { data, error } = await supabase.rpc('fn_cancel_sale', {
    p_sale_id: args.sale_id,
    p_reason: args.reason,
  });
  if (error) throw error;
  return data;
}

export async function setSerialQc(serialId: string, status: string, photoRef?: string): Promise<Json> {
  const { data, error } = await supabase.rpc('fn_set_serial_qc', {
    p_serial_id: serialId,
    p_qc_status: status,
    p_photo_ref: photoRef,
  });
  if (error) throw error;
  return data;
}

export async function adjustSerialStatus(serialId: string, status: string, reason: string): Promise<Json> {
  const { data, error } = await supabase.rpc('fn_adjust_serial_status', {
    p_serial_id: serialId,
    p_status: status,
    p_reason: reason,
  });
  if (error) throw error;
  return data;
}

export async function createCustomer(args: {
  first_name: string;
  phone: string;
  last_name?: string;
  email?: string;
  address?: string;
  city?: string;
  referral_source?: string;
}): Promise<Json> {
  const { data, error } = await supabase.rpc('fn_create_customer', {
    p_first_name: args.first_name,
    p_phone: args.phone,
    p_last_name: args.last_name,
    p_email: args.email,
    p_address: args.address,
    p_city: args.city,
    p_referral_source: args.referral_source,
  });
  if (error) throw error;
  return data;
}
