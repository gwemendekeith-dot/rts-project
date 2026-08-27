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
  actor_id: string;
}

export interface IssueRefundArgs {
  sale_id: string;
  amount_usd: number;
  reason: string;
  approved_by: string;
}

export interface ReceiveStockArgs {
  product_id: string;
  serial_numbers: string[];
  received_by: string;
}

export interface SettleObligationArgs {
  obligation_id: string;
  payment_method: PaymentMethodEnum;
  recorded_by: string;
}

export interface VoidDocumentArgs {
  document_id: string;
  reason: string;
  actor_id: string;
}

export interface SwitchRoleArgs {
  user_id: string;
  new_role: UserRoleEnum;
}

// 1. Record Payment
export async function recordPayment(args: RecordPaymentArgs): Promise<Json> {
  const { data, error } = await supabase.rpc('fn_record_payment', {
    p_sale_id: args.sale_id,
    p_amount_usd: args.amount_usd,
    p_payment_method: args.payment_method,
    p_reference_code: args.reference_code,
    p_recorded_by: args.recorded_by,
  });

  if (error) throw error;
  return data;
}

// 2. Schedule Installation
export async function scheduleInstallation(args: ScheduleInstallationArgs): Promise<Json> {
  const { data, error } = await supabase.rpc('fn_schedule_installation', {
    p_installation_id: args.installation_id,
    p_installer_id: args.installer_id,
    p_scheduled_date: args.scheduled_date,
    p_scheduled_time_slot: args.scheduled_time_slot,
    p_notes: args.notes,
  });

  if (error) throw error;
  return data;
}

// 3. Complete Installation
export async function completeInstallation(args: CompleteInstallationArgs): Promise<Json> {
  const { data, error } = await supabase.rpc('fn_complete_installation', {
    p_installation_id: args.installation_id,
    p_actor_id: args.actor_id,
  });

  if (error) throw error;
  return data;
}

// 4. Issue Refund (Gates Clause 3: COMPLETED installation refund error)
export async function issueRefund(args: IssueRefundArgs): Promise<Json> {
  const { data, error } = await supabase.rpc('fn_issue_refund', {
    p_sale_id: args.sale_id,
    p_amount_usd: args.amount_usd,
    p_reason: args.reason,
    p_approved_by: args.approved_by,
  });

  if (error) throw error;
  return data;
}

// 5. Receive Stock
export async function receiveStock(args: ReceiveStockArgs): Promise<Json> {
  const { data, error } = await supabase.rpc('fn_receive_stock', {
    p_product_id: args.product_id,
    p_serial_numbers: args.serial_numbers,
    p_received_by: args.received_by,
  });

  if (error) throw error;
  return data;
}

// 6. Settle Obligation
export async function settleObligation(args: SettleObligationArgs): Promise<Json> {
  const { data, error } = await supabase.rpc('fn_settle_obligation', {
    p_obligation_id: args.obligation_id,
    p_payment_method: args.payment_method,
    p_recorded_by: args.recorded_by,
  });

  if (error) throw error;
  return data;
}

// 7. Void Document
export async function voidDocument(args: VoidDocumentArgs): Promise<Json> {
  const { data, error } = await supabase.rpc('fn_void_document', {
    p_document_id: args.document_id,
    p_reason: args.reason,
    p_actor_id: args.actor_id,
  });

  if (error) throw error;
  return data;
}

// 8. Switch Role
export async function switchRole(args: SwitchRoleArgs): Promise<Json> {
  const { data, error } = await supabase.rpc('fn_switch_role', {
    p_user_id: args.user_id,
    p_new_role: args.new_role,
  });

  if (error) throw error;
  return data;
}
