-- ============================================================
-- RAFIKI OPERATIONS DESK — 0005_documents.sql
-- Atomic document issuance with type-prefixed numbering.
-- ============================================================
CREATE OR REPLACE FUNCTION fn_issue_document(
  p_type             TEXT,
  p_customer_id      UUID,
  p_sale_id          UUID DEFAULT NULL,
  p_payment_id       UUID DEFAULT NULL,
  p_quote_id         UUID DEFAULT NULL,
  p_installation_id  UUID DEFAULT NULL,
  p_warranty_id      UUID DEFAULT NULL,
  p_template_version TEXT DEFAULT 'v1.0'
)
RETURNS documents LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_prefix TEXT; v_seq TEXT; v_number TEXT; v_doc documents;
BEGIN
  CASE p_type
    WHEN 'QUOTE'                 THEN v_prefix := 'RTS-QTE-'; v_seq := 'seq_quote';
    WHEN 'INVOICE'               THEN v_prefix := 'RTS-INV-'; v_seq := 'seq_invoice';
    WHEN 'RECEIPT'               THEN v_prefix := 'RTS-RCP-'; v_seq := 'seq_receipt';
    WHEN 'WARRANTY_CERTIFICATE'  THEN v_prefix := 'RTS-WTY-'; v_seq := 'seq_warranty_certificate';
    WHEN 'INSTALLATION_REPORT'   THEN v_prefix := 'RTS-INS-'; v_seq := 'seq_installation_report';
    ELSE RAISE EXCEPTION 'INVALID_DOCUMENT_TYPE';
  END CASE;

  v_number := fn_next_number(v_prefix, v_seq);

  INSERT INTO documents (document_number, document_type, customer_id, sale_id,
    payment_id, quote_id, installation_id, warranty_id, template_version,
    status, created_by)
  VALUES (v_number, p_type, p_customer_id, p_sale_id, p_payment_id, p_quote_id,
    p_installation_id, p_warranty_id, p_template_version, 'ISSUED', auth.uid())
  RETURNING * INTO v_doc;

  RETURN v_doc;
END; $$;
