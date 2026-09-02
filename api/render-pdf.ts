import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';
import { verifyAuth } from '@supabase/server/core';

type VercelRequest = { method?: string; url?: string; headers: Record<string, string | string[] | undefined>; body?: unknown };
type VercelResponse = { status: (code: number) => VercelResponse; json: (body: unknown) => void; send: (body: Buffer) => void; setHeader: (name: string, value: string) => void };

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  const authorization = typeof req.headers.authorization === 'string' ? req.headers.authorization : '';
  const request = new Request(`https://${req.headers.host ?? 'localhost'}${req.url ?? '/api/render-pdf'}`, { headers: { authorization } });
  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.VITE_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !publishableKey) return res.status(500).json({ error: 'PDF_AUTH_CONFIG_MISSING' });
  const { error } = await verifyAuth(request, {
    auth: 'user',
    env: { url: supabaseUrl, publishableKeys: { default: publishableKey }, jwks: new URL(`${supabaseUrl}/auth/v1/.well-known/jwks.json`) },
  });
  if (error) return res.status(error.status).json({ error: 'AUTHENTICATION_REQUIRED' });

  const html = typeof req.body === 'object' && req.body !== null && 'html' in req.body
    ? String((req.body as { html: unknown }).html)
    : '';
  if (!html.trim()) return res.status(400).json({ error: 'HTML_REQUIRED' });

  let browser: Awaited<ReturnType<typeof puppeteer.launch>> | undefined;
  try {
    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: { width: 1024, height: 768 },
      executablePath: await chromium.executablePath(),
      headless: true,
    });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdf = await page.pdf({ format: 'A4', printBackground: true, margin: { top: '12mm', right: '12mm', bottom: '12mm', left: '12mm' } });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename="rafiki-document.pdf"');
    return res.status(200).send(Buffer.from(pdf));
  } catch (error: unknown) {
    return res.status(500).json({ error: error instanceof Error ? error.message : 'PDF_RENDER_FAILED' });
  } finally {
    await browser?.close();
  }
}
