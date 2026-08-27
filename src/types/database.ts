export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type UserRoleEnum = 'OWNER' | 'SALES' | 'OPERATIONS';
export type EnquiryStatusEnum = 'NEW' | 'CONTACTED' | 'QUOTED' | 'WON' | 'LOST';
export type QuoteStatusEnum = 'DRAFT' | 'SENT' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED';
export type SaleStatusEnum = 'PENDING' | 'CONFIRMED' | 'SCHEDULED' | 'INSTALLED' | 'COMPLETED' | 'CANCELLED' | 'REFUNDED';
export type PaymentStatusEnum = 'UNPAID' | 'PARTIAL' | 'PAID' | 'REFUNDED';
export type PaymentMethodEnum = 'CASH' | 'BANK_TRANSFER' | 'CARD' | 'ECOCASH';
export type SerialStatusEnum = 'AVAILABLE' | 'RESERVED' | 'ALLOCATED' | 'INSTALLED' | 'DEFECTIVE' | 'WRITTEN_OFF';
export type InstallStatusEnum = 'UNSCHEDULED' | 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
export type WarrantyStatusEnum = 'ACTIVE' | 'EXPIRED' | 'CLAIMED' | 'VOID';
export type DocTypeEnum = 'QUOTE' | 'INVOICE' | 'RECEIPT' | 'WARRANTY' | 'INSTALLATION_CERT';
export type CashTypeEnum = 'SALE_PAYMENT' | 'INSTALLER_PAYOUT' | 'REFERRAL_PAYOUT' | 'REFUND' | 'EXPENSE' | 'DEPOSIT';

export interface Database {
  public: {
    Tables: {
      system_settings: {
        Row: {
          id: number;
          company_name: string;
          tagline: string;
          whatsapp_number: string;
          location: string;
          currency: string;
          timezone: string;
          ecocash_enabled: boolean;
          vat_registered: boolean;
          vat_disclaimer: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['system_settings']['Row'], 'id' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['system_settings']['Insert']>;
      };
      warranty_terms: {
        Row: {
          id: string;
          duration_months: number;
          terms_text: string;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['warranty_terms']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['warranty_terms']['Insert']>;
      };
      profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string;
          active_role: UserRoleEnum;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['profiles']['Row'], 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['profiles']['Insert']>;
      };
      user_roles: {
        Row: {
          id: string;
          user_id: string;
          role: UserRoleEnum;
          granted_at: string;
        };
        Insert: Omit<Database['public']['Tables']['user_roles']['Row'], 'id' | 'granted_at'>;
        Update: Partial<Database['public']['Tables']['user_roles']['Insert']>;
      };
      customers: {
        Row: {
          id: string;
          full_name: string;
          phone: string;
          email: string | null;
          address: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['customers']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['customers']['Insert']>;
      };
      installers: {
        Row: {
          id: string;
          full_name: string;
          phone: string;
          is_active: boolean;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['installers']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['installers']['Insert']>;
      };
      referral_partners: {
        Row: {
          id: string;
          full_name: string;
          phone: string;
          commission_rate_usd: number;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['referral_partners']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['referral_partners']['Insert']>;
      };
      products: {
        Row: {
          id: string;
          sku: string;
          name: string;
          capacity_litres: number | null;
          selling_price_usd: number;
          cost_price_usd: number;
          is_active: boolean;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['products']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['products']['Insert']>;
      };
      serial_numbers: {
        Row: {
          id: string;
          serial_number: string;
          product_id: string;
          status: SerialStatusEnum;
          received_at: string;
          notes: string | null;
        };
        Insert: Omit<Database['public']['Tables']['serial_numbers']['Row'], 'id' | 'received_at'>;
        Update: Partial<Database['public']['Tables']['serial_numbers']['Insert']>;
      };
      enquiries: {
        Row: {
          id: string;
          customer_id: string | null;
          channel: string;
          notes: string;
          status: EnquiryStatusEnum;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['enquiries']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['enquiries']['Insert']>;
      };
      quotes: {
        Row: {
          id: string;
          quote_number: string;
          customer_id: string;
          status: QuoteStatusEnum;
          subtotal_usd: number;
          install_labour_usd: number;
          total_usd: number;
          valid_until: string;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['quotes']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['quotes']['Insert']>;
      };
      quote_items: {
        Row: {
          id: string;
          quote_id: string;
          product_id: string;
          quantity: number;
          unit_price_usd: number;
        };
        Insert: Omit<Database['public']['Tables']['quote_items']['Row'], 'id'>;
        Update: Partial<Database['public']['Tables']['quote_items']['Insert']>;
      };
      sales: {
        Row: {
          id: string;
          sale_number: string;
          quote_id: string | null;
          customer_id: string;
          referral_partner_id: string | null;
          sale_status: SaleStatusEnum;
          payment_status: PaymentStatusEnum;
          total_amount_usd: number;
          paid_amount_usd: number;
          balance_due_usd: number;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['sales']['Row'], 'id' | 'balance_due_usd' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['sales']['Insert']>;
      };
      sale_items: {
        Row: {
          id: string;
          sale_id: string;
          product_id: string;
          serial_number_id: string | null;
          unit_price_usd: number;
          quantity: number;
        };
        Insert: Omit<Database['public']['Tables']['sale_items']['Row'], 'id'>;
        Update: Partial<Database['public']['Tables']['sale_items']['Insert']>;
      };
      payments: {
        Row: {
          id: string;
          receipt_number: string;
          sale_id: string;
          amount_usd: number;
          payment_method: PaymentMethodEnum;
          reference_code: string | null;
          recorded_by: string;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['payments']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['payments']['Insert']>;
      };
      refunds: {
        Row: {
          id: string;
          sale_id: string;
          amount_usd: number;
          reason: string;
          approved_by: string;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['refunds']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['refunds']['Insert']>;
      };
      installations: {
        Row: {
          id: string;
          job_number: string;
          sale_id: string;
          installer_id: string | null;
          status: InstallStatusEnum;
          scheduled_date: string | null;
          scheduled_time_slot: string | null;
          labour_fee_usd: number;
          installer_pay_usd: number;
          company_cut_usd: number;
          completed_at: string | null;
          notes: string | null;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['installations']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['installations']['Insert']>;
      };
      installation_parts: {
        Row: {
          id: string;
          installation_id: string;
          part_name: string;
          cost_usd: number;
          billed_usd: number;
        };
        Insert: Omit<Database['public']['Tables']['installation_parts']['Row'], 'id'>;
        Update: Partial<Database['public']['Tables']['installation_parts']['Insert']>;
      };
      warranties: {
        Row: {
          id: string;
          warranty_number: string;
          sale_id: string;
          installation_id: string;
          serial_number_id: string;
          customer_id: string;
          status: WarrantyStatusEnum;
          start_date: string;
          expiry_date: string;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['warranties']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['warranties']['Insert']>;
      };
      inventory: {
        Row: {
          product_id: string;
          available_qty: number;
          reserved_qty: number;
          installed_qty: number;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['inventory']['Row'], 'updated_at'>;
        Update: Partial<Database['public']['Tables']['inventory']['Insert']>;
      };
      inventory_movements: {
        Row: {
          id: string;
          product_id: string;
          serial_number_id: string | null;
          movement_type: string;
          quantity: number;
          reference: string | null;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['inventory_movements']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['inventory_movements']['Insert']>;
      };
      obligations: {
        Row: {
          id: string;
          payee_type: string;
          payee_id: string;
          sale_id: string | null;
          installation_id: string | null;
          amount_usd: number;
          is_settled: boolean;
          settled_at: string | null;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['obligations']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['obligations']['Insert']>;
      };
      cash_movements: {
        Row: {
          id: string;
          movement_type: CashTypeEnum;
          amount_usd: number;
          payment_method: PaymentMethodEnum;
          reference_id: string | null;
          notes: string | null;
          recorded_by: string;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['cash_movements']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['cash_movements']['Insert']>;
      };
      documents: {
        Row: {
          id: string;
          doc_number: string;
          doc_type: DocTypeEnum;
          reference_id: string;
          pdf_url: string | null;
          is_void: boolean;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['documents']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['documents']['Insert']>;
      };
      audit_logs: {
        Row: {
          id: string;
          actor_id: string | null;
          actor_role: UserRoleEnum;
          action: string;
          entity: string;
          entity_id: string | null;
          details: Json | null;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['audit_logs']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['audit_logs']['Insert']>;
      };
    };
    Views: {
      v_cash_position: {
        Row: {
          total_collected_usd: number;
          total_payouts_usd: number;
          net_cash_usd: number;
        };
      };
      v_stock_dashboard: {
        Row: {
          product_id: string;
          sku: string;
          name: string;
          selling_price_usd: number;
          available_units: number;
          reserved_units: number;
          installed_units: number;
        };
      };
      v_pipeline_summary: {
        Row: {
          total_enquiries: number;
          total_quotes: number;
          total_sales: number;
          pending_installations: number;
        };
      };
      v_dashboard: {
        Row: {
          sales_today: number;
          revenue_today: number;
          cash_collected_today: number;
          installations_today: number;
          current_cash_balance: number;
          obligations_due_soon: number;
          quotes_expiring_soon: number;
          low_stock_skus: number;
        };
      };
    };
    Functions: {
      fn_create_customer: {
        Args: {
          p_first_name: string;
          p_phone: string;
          p_last_name?: string;
          p_email?: string;
          p_address?: string;
          p_city?: string;
          p_customer_type?: string;
          p_referral_source?: string;
          p_notes?: string;
        };
        Returns: Json;
      };
      fn_set_serial_qc: {
        Args: {
          p_serial_id: string;
          p_qc_status: string;
          p_photo_ref?: string;
        };
        Returns: Json;
      };
      fn_adjust_serial_status: {
        Args: {
          p_serial_id: string;
          p_status: string;
          p_reason: string;
        };
        Returns: Json;
      };
      fn_create_sale: {
        Args: {
          p_customer_id: string;
          p_referral_partner_id?: string;
          p_referral_source?: string;
          p_is_preorder?: boolean;
          p_notes?: string;
          p_items?: Json;
        };
        Returns: Json;
      };
      fn_record_payment: {
        Args: {
          p_sale_id: string;
          p_amount: number;
          p_method: string;
          p_reference?: string;
        };
        Returns: Json;
      };
      fn_schedule_installation: {
        Args: {
          p_job_id: string;
          p_installer_id: string;
          p_date: string;
        };
        Returns: Json;
      };
      fn_complete_installation: {
        Args: {
          p_job_id: string;
          p_gas_test: boolean;
          p_water_test: boolean;
          p_unit_test: boolean;
          p_customer_handover: boolean;
          p_signature_ref: string;
          p_photo_refs?: string[];
          p_installer_notes?: string;
        };
        Returns: Json;
      };
      fn_issue_refund: {
        Args: {
          p_payment_id: string;
          p_amount: number;
          p_reason: string;
        };
        Returns: Json;
      };
      fn_receive_stock: {
        Args: {
          p_product_id: string;
          p_serials: string[];
          p_received_date?: string;
        };
        Returns: Json;
      };
      fn_settle_obligation: {
        Args: {
          p_obligation_id: string;
          p_amount: number;
          p_note?: string;
        };
        Returns: Json;
      };
      fn_void_document: {
        Args: {
          p_document_id: string;
          p_reason: string;
        };
        Returns: Json;
      };
      fn_switch_role: {
        Args: {
          p_role: UserRoleEnum;
        };
        Returns: Json;
      };
    };
  };
}

// Convenient type aliases
export type SystemSettings = Database['public']['Tables']['system_settings']['Row'];
export type Profile = Database['public']['Tables']['profiles']['Row'];
export type Customer = Database['public']['Tables']['customers']['Row'];
export type Installer = Database['public']['Tables']['installers']['Row'];
export type ReferralPartner = Database['public']['Tables']['referral_partners']['Row'];
export type Product = Database['public']['Tables']['products']['Row'];
export type SerialNumber = Database['public']['Tables']['serial_numbers']['Row'];
export type Quote = Database['public']['Tables']['quotes']['Row'];
export type Sale = Database['public']['Tables']['sales']['Row'];
export type SaleItem = Database['public']['Tables']['sale_items']['Row'];
export type Payment = Database['public']['Tables']['payments']['Row'];
export type Installation = Database['public']['Tables']['installations']['Row'];
export type Warranty = Database['public']['Tables']['warranties']['Row'];
export type Document = Database['public']['Tables']['documents']['Row'];
