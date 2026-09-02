-- RAFIKI OPERATIONS DESK — 0011_document_storage.sql
-- Storage and document-linking prerequisites for invoice, receipt, and warranty PDFs.

-- The application uses public URLs after authenticated uploads. The bucket is
-- public for reads, while writes remain authenticated-only.
INSERT INTO storage.buckets (id, name, public)
VALUES ('documents', 'documents', true)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;

DO $$
BEGIN
  CREATE POLICY rafiki_documents_read ON storage.objects
    FOR SELECT TO public USING (bucket_id = 'documents');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY rafiki_documents_insert ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'documents');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY rafiki_documents_update ON storage.objects
    FOR UPDATE TO authenticated
    USING (bucket_id = 'documents')
    WITH CHECK (bucket_id = 'documents');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE OR REPLACE FUNCTION fn_link_document_file(
  p_document_id UUID,
  p_file_reference TEXT
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM fn_require_authenticated();
  IF current_user_role() NOT IN ('OWNER', 'SALES', 'OPERATIONS') THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;
  IF p_file_reference IS NULL OR trim(p_file_reference) = '' THEN
    RAISE EXCEPTION 'FILE_REFERENCE_REQUIRED';
  END IF;
  UPDATE documents
     SET file_reference = trim(p_file_reference)
   WHERE id = p_document_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'DOCUMENT_NOT_FOUND'; END IF;
  RETURN jsonb_build_object('document_id', p_document_id, 'file_reference', trim(p_file_reference));
END; $$;

REVOKE EXECUTE ON FUNCTION fn_link_document_file(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION fn_link_document_file(UUID, TEXT) TO authenticated;
