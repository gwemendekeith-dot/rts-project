import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { completeInstallation } from '../lib/rpc';
import { issueWarrantyCertificate } from '../lib/documents';
import { SignaturePad } from '../components/install/SignaturePad';

const CHECKS = [
  { key: 'gasTest', label: 'Gas connection and leak/safety test passed' },
  { key: 'waterTest', label: 'Water connection and pressure test passed' },
  { key: 'unitTest', label: 'Unit operational test passed' },
  { key: 'customerHandover', label: 'Customer handover complete' },
] as const;

type Job = {
  id: string; job_number: string; status: string; address: string; completed_at: string | null;
  customers: { first_name: string; last_name: string | null; phone: string } | null;
  serial_numbers: { serial_number: string; products: { description: string | null } | null } | null;
  installers: { name: string } | null;
};
type CompletionResult = { warranty_expiry?: string; warranty_number?: string };

export function InstallationDetail() {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();
  const [checks, setChecks] = useState<Record<string, boolean>>({});
  const [photoRefs, setPhotoRefs] = useState<string[]>([]);
  const [signature, setSignature] = useState<Blob | null>(null);
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<CompletionResult | null>(null);

  const jobQuery = useQuery({
    queryKey: ['installation', jobId],
    enabled: Boolean(jobId),
    queryFn: async () => {
      const { data, error } = await supabase.from('installations')
        .select('*, customers(*), serial_numbers(*, products(*)), installers(*)')
        .eq('id', jobId!).single();
      if (error) throw error;
      return data as unknown as Job;
    },
  });

  if (jobQuery.isLoading) return <div className="p-10 text-center text-slate-400">Loading installation...</div>;
  if (jobQuery.error || !jobQuery.data) return <div className="p-10 text-center text-red-400">Job not found.</div>;

  const job = jobQuery.data;
  const allChecked = CHECKS.every(check => checks[check.key]);

  async function addPhotos(files: FileList | null) {
    if (!files) return;
    for (const file of Array.from(files)) {
      const path = `installations/${job.job_number}/${Date.now()}-${file.name}`;
      const { error } = await supabase.storage.from('documents').upload(path, file);
      if (error) { alert(error.message); continue; }
      setPhotoRefs(previous => [...previous, path]);
    }
  }

  async function handleComplete() {
    if (!allChecked || !signature) return;
    setBusy(true);
    try {
      const signaturePath = `installations/${job.job_number}/signature-${Date.now()}.png`;
      const { error } = await supabase.storage.from('documents').upload(signaturePath, signature, { contentType: 'image/png' });
      if (error) throw error;
      const result = await completeInstallation({
        installation_id: job.id,
        gas_test: Boolean(checks.gasTest),
        water_test: Boolean(checks.waterTest),
        unit_test: Boolean(checks.unitTest),
        customer_handover: Boolean(checks.customerHandover),
        signature_ref: signaturePath,
        photo_refs: photoRefs,
        installer_notes: notes || undefined,
      }) as CompletionResult;
      const certificateUrl = await issueWarrantyCertificate(job.id);
      setDone({ ...result, warranty_expiry: result.warranty_expiry ?? certificateUrl });
    } catch (error: unknown) {
      alert(error instanceof Error ? error.message : String(error));
    } finally { setBusy(false); }
  }

  if (job.status === 'COMPLETED' || done) {
    return <div className="mx-auto max-w-lg rounded-xl border border-emerald-200 bg-emerald-50 p-8 text-center"><div className="text-4xl">✓</div><h2 className="mt-2 text-xl font-bold text-emerald-800">Installation Completed</h2><p className="mt-1 text-sm text-emerald-700">Job {job.job_number}</p>{done?.warranty_expiry && <p className="mt-2 text-sm text-emerald-700">Warranty active until <strong>{done.warranty_expiry}</strong></p>}<button onClick={() => navigate('/installations')} className="mt-6 text-sm text-slate-500 underline">Back to Installations</button></div>;
  }

  return <div className="mx-auto max-w-xl space-y-5"><div><h1 className="text-2xl font-bold text-white">Install {job.job_number}</h1><p className="text-sm text-slate-400">{job.status.replace(/_/g, ' ')}</p></div><section className="rounded-xl border border-slate-800 bg-slate-900 p-5 text-sm"><Fact label="Customer" value={`${job.customers?.first_name ?? ''} ${job.customers?.last_name ?? ''}`} /><Fact label="Phone" value={job.customers?.phone} /><Fact label="Address" value={job.address} /><Fact label="Unit" value={job.serial_numbers?.products?.description} /><Fact label="Serial" value={job.serial_numbers?.serial_number} highlight /><Fact label="Installer" value={job.installers?.name ?? 'Unassigned'} /></section><section className="rounded-xl border border-slate-800 bg-slate-900 p-5"><h2 className="mb-3 text-sm font-semibold uppercase text-slate-400">Handover Checklist</h2>{CHECKS.map(check => <label key={check.key} className="mb-2 flex items-center gap-3 text-sm text-slate-300"><input type="checkbox" checked={Boolean(checks[check.key])} onChange={event => setChecks(previous => ({ ...previous, [check.key]: event.target.checked }))} className="h-4 w-4 accent-amber-500" />{check.label}</label>)}</section><section className="rounded-xl border border-slate-800 bg-slate-900 p-5"><h2 className="mb-3 text-sm font-semibold uppercase text-slate-400">Photos</h2><input type="file" accept="image/*" capture="environment" multiple onChange={event => addPhotos(event.target.files)} className="text-sm text-slate-300" />{photoRefs.length > 0 && <p className="mt-2 text-xs text-slate-500">{photoRefs.length} photo(s) attached.</p>}</section><section className="rounded-xl border border-slate-800 bg-slate-900 p-5"><h2 className="mb-3 text-sm font-semibold uppercase text-slate-400">Customer Signature</h2><SignaturePad onReady={setSignature} /></section><section className="rounded-xl border border-slate-800 bg-slate-900 p-5"><h2 className="mb-3 text-sm font-semibold uppercase text-slate-400">Installer Notes</h2><textarea value={notes} onChange={event => setNotes(event.target.value)} rows={3} className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" /></section><button onClick={handleComplete} disabled={busy || !allChecked || !signature} className="w-full rounded-md bg-amber-500 px-4 py-3 text-sm font-bold text-slate-900 disabled:opacity-40">{busy ? 'Completing...' : 'Complete Installation'}</button></div>;
}

function Fact({ label, value, highlight = false }: { label: string; value: string | null | undefined; highlight?: boolean }) { return <div className="flex justify-between border-b border-slate-800 py-2 last:border-0"><span className="text-slate-500">{label}</span><span className={highlight ? 'font-bold text-amber-400' : 'text-slate-200'}>{value || '-'}</span></div>; }
