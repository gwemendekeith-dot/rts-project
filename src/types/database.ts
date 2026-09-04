export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type UserRoleEnum = 'OWNER' | 'SALES' | 'OPERATIONS';
export type EnquiryStatusEnum = 'NEW' | 'CONTACTED' | 'QUALIFIED' | 'QUOTE_REQUESTED' | 'CONVERTED' | 'LOST' | 'CLOSED';
export type QuoteStatusEnum = 'DRAFT' | 'SENT' | 'VIEWED' | 'ACCEPTED' | 'DECLINED' | 'EXPIRED' | 'CANCELLED' | 'CONVERTED';
export type SaleStatusEnum = 'PENDING' | 'CONFIRMED' | 'SCHEDULED' | 'INSTALLED' | 'COMPLETED' | 'CANCELLED' | 'REFUNDED';
export type PaymentStatusEnum = 'UNPAID' | 'PARTIAL' | 'PAID' | 'OVERPAID' | 'REFUND_DUE' | 'REFUNDED' | 'PARTIALLY_REFUNDED';
export type PaymentMethodEnum = 'CASH' | 'BANK_TRANSFER' | 'CARD' | 'ECOCASH' | 'OTHER';
export type SerialStatusEnum = 'AVAILABLE' | 'RESERVED' | 'ALLOCATED' | 'INSTALLED' | 'RETURNED' | 'DAMAGED' | 'SCRAPPED';
export type InstallStatusEnum = 'PENDING' | 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
export type WarrantyStatusEnum = 'ACTIVE' | 'EXPIRED' | 'CLAIMED' | 'VOID';
export type DocTypeEnum = 'QUOTE' | 'INVOICE' | 'RECEIPT' | 'WARRANTY_CERTIFICATE' | 'INSTALLATION_REPORT';
export type CashTypeEnum = 'SALE_PAYMENT' | 'INSTALLER_PAYOUT' | 'REFERRAL_PAYOUT' | 'REFUND' | 'EXPENSE' | 'DEPOSIT';

export interface Database {
  public: {
    Tables: {
      system_settings: {
        Row: {
          key: string;
          value: string;
          value_type: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['system_settings']['Row'], 'updated_at'>;
        Update: Partial<Database['public']['Tables']['system_settings']['Insert']>;
      };
      warranty_terms: {
        Row: {
          version: string;
          clause_warranty: string;
          clause_liability: string;
          clause_returns: string;
          clause_handover: string;
          effective_date: string;
          is_active: boolean;
        };
        Insert: Omit<Database['public']['Tables']['warranty_terms']['Row'], 'version'>;
        Update: Partial<Database['public']['Tables']['warranty_terms']['Insert']>;
      };
      profiles: {
        Row: {
          id: string;
          active_role: UserRoleEnum;
          full_name: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['profiles']['Row'], 'id' | 'created_at' | 'updated_at'>;
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
          customer_number: string;
          customer_type: string;
          first_name: string;
          last_name: string | null;
          phone: string;
          email: string | null;
          address: string | null;
          city: string | null;
          referral_source: string | null;
          notes: string | null;
          status: string;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['customers']['Row'], 'id' | 'customer_number' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['customers']['Insert']>;
      };
      installers: {
        Row: {
          id: string;
          installer_number: string;
          name: string;
          phone: string;
          rate_per_install: number;
          status: string;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['installers']['Row'], 'id' | 'installer_number' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['installers']['Insert']>;
      };
      referral_partners: {
        Row: {
          id: string;
          name: string;
          phone: string;
          commission_rate: number | null;
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
          category: string;
          description: string | null;
          cost_price: number | null;
          selling_price: number;
          warranty_months: number;
          requires_serial: boolean;
          requires_installation: boolean;
          active: boolean;
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
          received_date: string | null;
          receiving_photo_ref: string | null;
          qc_status: string | null;
          qc_notes: string | null;
          sale_id: string | null;
          customer_id: string | null;
          installation_id: string | null;
          sold_date: string | null;
          installed_date: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['serial_numbers']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['serial_numbers']['Insert']>;
      };
      enquiries: {
        Row: {
          id: string;
          enquiry_number: string;
          customer_id: string;
          source: string;
          product_interest: string | null;
          status: EnquiryStatusEnum;
          message: string | null;
          assigned_to: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['enquiries']['Row'], 'id' | 'enquiry_number' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['enquiries']['Insert']>;
      };
      quotes: {
        Row: {
          id: string;
          quote_number: string;
          customer_id: string;
          enquiry_id: string | null;
          quote_date: string;
          status: QuoteStatusEnum;
          subtotal: number;
          discount: number;
          total: number;
          valid_until: string | null;
          notes: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['quotes']['Row'], 'id' | 'quote_number' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['quotes']['Insert']>;
      };
      quote_items: {
        Row: {
          id: string;
          quote_id: string;
          product_id: string;
          description: string;
          quantity: number;
          unit_price: number;
          discount: number;
          line_total: number;
        };
        Insert: Omit<Database['public']['Tables']['quote_items']['Row'], 'id'>;
        Update: Partial<Database['public']['Tables']['quote_items']['Insert']>;
      };
      sales: {
        Row: {
          id: string;
          sale_number: string;
          customer_id: string;
          quote_id: string | null;
          referral_partner_id: string | null;
          referral_source: string | null;
          sale_date: string;
          subtotal: number;
          discount: number;
          total_amount: number;
          amount_paid: number;
          balance_due: number;
          payment_status: PaymentStatusEnum;
          fulfilment_status: string;
          is_preorder: boolean;
          notes: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['sales']['Row'], 'id' | 'sale_number' | 'sale_date' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['sales']['Insert']>;
      };
      sale_items: {
        Row: {
          id: string;
          sale_id: string;
          product_id: string;
          description: string;
          quantity: number;
          unit_price: number;
          discount: number;
          line_total: number;
          serial_number_id: string | null;
        };
        Insert: Omit<Database['public']['Tables']['sale_items']['Row'], 'id'>;
        Update: Partial<Database['public']['Tables']['sale_items']['Insert']>;
      };
      payments: {
        Row: {
          id: string;
          payment_number: string;
          sale_id: string;
          customer_id: string;
          payment_date: string;
          amount: number;
          currency: string;
          payment_method: PaymentMethodEnum;
          payment_reference: string | null;
          status: string;
          received_by: string | null;
          notes: string | null;
        };
        Insert: Omit<Database['public']['Tables']['payments']['Row'], 'id' | 'payment_number' | 'payment_date'>;
        Update: Partial<Database['public']['Tables']['payments']['Insert']>;
      };
      refunds: {
        Row: {
          id: string;
          refund_number: string;
          payment_id: string;
          sale_id: string;
          amount: number;
          method: string;
          reason: string;
          status: string;
          processed_by: string | null;
          processed_at: string | null;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['refunds']['Row'], 'id' | 'refund_number' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['refunds']['Insert']>;
      };
      installations: {
        Row: {
          id: string;
          job_number: string;
          sale_id: string;
          installer_id: string | null;
          address: string;
          scheduled_date: string | null;
          status: InstallStatusEnum;
          gas_test: boolean | null;
          water_test: boolean | null;
          unit_test: boolean | null;
          customer_handover: boolean | null;
          signature_ref: string | null;
          photo_refs: string[] | null;
          installer_notes: string | null;
          completed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['installations']['Row'], 'id' | 'job_number' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['installations']['Insert']>;
      };
      installation_parts: {
        Row: {
          id: string;
          installation_id: string;
          product_id: string | null;
          description: string;
          quantity: number;
          unit_cost: number;
          total_cost: number;
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
          terms_version: string;
          duration_months: number;
          start_date: string;
          expiry_date: string;
          service_notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['warranties']['Row'], 'id' | 'warranty_number' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['warranties']['Insert']>;
      };
      inventory: {
        Row: {
          product_id: string;
          quantity_on_hand: number;
          quantity_reserved: number;
          quantity_available: number;
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
          reference_type: string | null;
          reference_id: string | null;
          movement_date: string;
          created_by: string | null;
          notes: string | null;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['inventory_movements']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['inventory_movements']['Insert']>;
      };
      obligations: {
        Row: {
          id: string;
          obligation_number: string;
          description: string;
          total_amount: number;
          amount_paid: number;
          due_date: string;
          status: string;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['obligations']['Row'], 'id' | 'obligation_number' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['obligations']['Insert']>;
      };
      cash_movements: {
        Row: {
          id: string;
          movement_date: string;
          description: string;
          category: string;
          type: string;
          amount: number;
          source_type: string | null;
          source_id: string | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['cash_movements']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['cash_movements']['Insert']>;
      };
      documents: {
        Row: {
          id: string;
          document_number: string;
          document_type: DocTypeEnum;
          customer_id: string;
          sale_id: string | null;
          payment_id: string | null;
          quote_id: string | null;
          installation_id: string | null;
          warranty_id: string | null;
          template_version: string;
          status: string;
          file_reference: string | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['documents']['Row'], 'id' | 'document_number' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['documents']['Insert']>;
      };
      audit_logs: {
        Row: {
          id: string;
          user_id: string | null;
          actor_role: string | null;
          action: string;
          entity_type: string;
          entity_id: string | null;
          old_values: Json | null;
          new_values: Json | null;
          reason: string | null;
          timestamp: string;
        };
        Insert: Omit<Database['public']['Tables']['audit_logs']['Row'], 'id' | 'timestamp'>;
        Update: Partial<Database['public']['Tables']['audit_logs']['Insert']>;
      };
    };
    Views: {
      v_cash_position: {
        Row: {
          id: string;
          movement_date: string;
          description: string;
          category: string;
          type: string;
          amount: number;
          source_type: string | null;
          source_id: string | null;
          created_by: string | null;
          created_at: string;
          running_balance: number;
        };
      };
      v_stock_dashboard: {
        Row: {
          sku: string;
          name: string;
          quantity_on_hand: number;
          quantity_reserved: number;
          quantity_available: number;
          days_of_stock_remaining: number | null;
          restock_status: string;
        };
      };
      v_pipeline_summary: {
        Row: {
          stage: string;
          count: number;
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
