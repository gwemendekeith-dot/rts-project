import { supabase } from './supabase';

// Replace {{ KEY }} placeholders. LINE_ITEMS_ROWS is pre-built HTML.
export function hydrateTemplate(template: string, data: Record<string, string>): string {
  return template.replace(/\{\{\s*([A-Z0-9_]+)\s*\}\}/gi, (_, key) =>
    data[key.toUpperCase()] ?? '');
}

// Send hydrated HTML to the Vercel render function; get PDF bytes back.
export async function renderPdf(html: string): Promise<Blob> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('You must be signed in to render a PDF');
  const res = await fetch('/api/render-pdf', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ html }),
  });
  if (!res.ok) {
    const detail = await res.text();
    let message = detail;
    try { message = (JSON.parse(detail) as { error?: string }).error ?? detail; } catch { /* keep raw response */ }
    throw new Error(`PDF render failed (${res.status}): ${message}`);
  }
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
  const escapeHtml = (value: string) => value.replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[character] ?? character));
  const serial = i.serial ? `<span class="serial">${escapeHtml(i.serial)}</span>` : '-';
  return `<tr>
    <td>${escapeHtml(i.description)}</td><td>${serial}</td>
    <td class="r">${i.qty}</td>
    <td class="r">$${i.unitPrice.toFixed(2)}</td>
    <td class="r">$${i.lineTotal.toFixed(2)}</td>
  </tr>`;
}
