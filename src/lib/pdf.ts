import { supabase } from './supabase';

// Replace {{ KEY }} placeholders. LINE_ITEMS_ROWS is pre-built HTML.
export function hydrateTemplate(template: string, data: Record<string, string>): string {
  return template.replace(/\{\{\s*([A-Z0-9_]+)\s*\}\}/gi, (_, key) =>
    data[key.toUpperCase()] ?? '');
}

// Send hydrated HTML to the Vercel render function; get PDF bytes back.
export async function renderPdf(html: string): Promise<Blob> {
  const res = await fetch('/api/render-pdf', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ html }),
  });
  if (!res.ok) throw new Error(`PDF render failed (${res.status})`);
  return res.blob();
}

// Upload PDF to the 'documents' storage bucket and return its public URL.
export async function uploadPdfToStorage(path: string, blob: Blob): Promise<string> {
  const { error } = await supabase.storage
    .from('documents')
    .upload(path, blob, { contentType: 'application/pdf', upsert: true });
  if (error) throw error;
  const { data } = supabase.storage.from('documents').getPublicUrl(path);
  return data.publicUrl;
}

// Build a table row for a sale item (serial shown only for serialised units).
export function lineItemRow(i: { description: string; serial: string | null;
                                 qty: number; unitPrice: number; lineTotal: number }): string {
  const serial = i.serial ? `<span class="serial">${i.serial}</span>` : '-';
  return `<tr>
    <td>${i.description}</td><td>${serial}</td>
    <td class="r">${i.qty}</td>
    <td class="r">$${i.unitPrice.toFixed(2)}</td>
    <td class="r">$${i.lineTotal.toFixed(2)}</td>
  </tr>`;
}