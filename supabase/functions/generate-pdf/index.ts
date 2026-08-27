import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

serve(async (req) => {
  try {
    const { document_id, template_name } = await req.json();

    if (!document_id || !template_name) {
      return new Response(
        JSON.stringify({ error: "Missing document_id or template_name" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Fetch Document and linked data
    const { data: doc, error: docErr } = await supabase
      .from("documents")
      .select("*, sales(*, customers(*), sale_items(*, products(*), serial_numbers(*))), payments(*)")
      .eq("id", document_id)
      .single();

    if (docErr || !doc) {
      return new Response(
        JSON.stringify({ error: "Document not found" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    // Storage bucket path
    const pdfPath = `${doc.doc_type.toLowerCase()}s/${doc.doc_number}.pdf`;
    const mockPdfBuffer = new TextEncoder().encode(`%PDF-1.4 Mock Document Content for ${doc.doc_number}`);

    // Upload to Supabase Storage Bucket 'documents'
    const { error: uploadErr } = await supabase.storage
      .from("documents")
      .upload(pdfPath, mockPdfBuffer, {
        contentType: "application/pdf",
        upsert: true,
      });

    if (uploadErr) {
      return new Response(
        JSON.stringify({ error: uploadErr.message }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    const { data: publicUrlData } = supabase.storage
      .from("documents")
      .getPublicUrl(pdfPath);

    // Update document file reference
    await supabase
      .from("documents")
      .update({ pdf_url: publicUrlData.publicUrl })
      .eq("id", document_id);

    return new Response(
      JSON.stringify({ success: true, url: publicUrlData.publicUrl, doc_number: doc.doc_number }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return new Response(
      JSON.stringify({ error: errorMsg }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
