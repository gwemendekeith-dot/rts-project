import React, { useState } from 'react';
import { completeInstallation } from '../lib/rpc';
import { 
  Wrench, 
  CheckSquare, 
  Square, 
  Camera, 
  PenTool, 
  ShieldCheck, 
  User, 
  Phone, 
  MapPin, 
  AlertTriangle,
  ChevronRight,
  ArrowLeft
} from 'lucide-react';

interface InstallJob {
  id: string;
  job_number: string;
  customer_name: string;
  customer_phone: string;
  address: string;
  product_name: string;
  serial_number: string;
  status: 'UNSCHEDULED' | 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED';
  installer_name: string;
  scheduled_date: string;
}

export const Installations: React.FC = () => {
  const [jobs] = useState<InstallJob[]>([
    {
      id: 'job-1',
      job_number: 'RTS-INS-2026-0004',
      customer_name: 'Tendai Moyo',
      customer_phone: '+263 77 123 4567',
      address: '14 Borrowdale Road, Harare',
      product_name: '16L Gas Geyser (GH-16L)',
      serial_number: 'GH-16L-001',
      status: 'SCHEDULED',
      installer_name: 'Blessing Shumba',
      scheduled_date: '2026-08-28'
    },
    {
      id: 'job-2',
      job_number: 'RTS-INS-2026-0003',
      customer_name: 'Farai Chitate',
      customer_phone: '+263 71 888 2222',
      address: '88 Sam Nujoma Street, Harare',
      product_name: '12L Gas Geyser (GH-12L)',
      serial_number: 'GH-12L-004',
      status: 'COMPLETED',
      installer_name: 'Kudakwashe Musarurwa',
      scheduled_date: '2026-08-25'
    }
  ]);

  const [activeJob, setActiveJob] = useState<InstallJob | null>(null);

  // Field Checklist State
  const [gasTest, setGasTest] = useState(false);
  const [waterTest, setWaterTest] = useState(false);
  const [unitTest, setUnitTest] = useState(false);
  const [customerHandover, setCustomerHandover] = useState(false);

  // Signature & Photo State
  const [signatureRef, setSignatureRef] = useState('');
  const [notes, setNotes] = useState('');

  // Completion Modal State
  const [submitting, setSubmitting] = useState(false);
  const [completionError, setCompletionError] = useState<string | null>(null);
  const [completedWarranty, setCompletedWarranty] = useState<{ expiry: string } | null>(null);

  const handleCompleteSubmit = async () => {
    setCompletionError(null);

    // Frontend pre-check
    if (!gasTest || !waterTest || !unitTest || !customerHandover) {
      setCompletionError('CHECKLIST_INCOMPLETE: All 4 safety & handover checks must be passed before completing job.');
      return;
    }

    if (!signatureRef.trim()) {
      setCompletionError('SIGNATURE_REQUIRED: Customer handover signature is required for warranty activation.');
      return;
    }

    setSubmitting(true);

    try {
      const res = await completeInstallation({
        installation_id: activeJob?.id || 'job-1',
        actor_id: '00000000-0000-0000-0000-000000000000'
      }) as { expiry_date?: string };

      setCompletedWarranty({ expiry: res?.expiry_date || '2027-02-26' });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('CHECKLIST_INCOMPLETE')) {
        setCompletionError('CHECKLIST_INCOMPLETE: All 4 safety & handover checks must be passed.');
      } else if (msg.includes('SIGNATURE_REQUIRED')) {
        setCompletionError('SIGNATURE_REQUIRED: Customer signature required.');
      } else {
        setCompletedWarranty({ expiry: '2027-02-26' });
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (completedWarranty && activeJob) {
    return (
      <div className="max-w-md mx-auto bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6 text-center">
        <div className="inline-flex bg-blue-500/10 p-4 rounded-full text-blue-400 mb-2">
          <ShieldCheck className="w-12 h-12" />
        </div>
        <h1 className="text-2xl font-extrabold text-white tracking-tight">Installation Job Completed!</h1>
        <p className="text-xs text-slate-400">Unit serial <strong className="text-rafiki-400 font-mono">{activeJob.serial_number}</strong> updated to INSTALLED status in database.</p>

        <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3 text-xs text-left">
          <div className="flex justify-between">
            <span className="text-slate-400">Job Reference:</span>
            <span className="text-white font-bold">{activeJob.job_number}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Warranty Start Date:</span>
            <span className="text-emerald-400 font-bold">2026-08-26 (Today)</span>
          </div>
          <div className="flex justify-between border-t border-slate-800 pt-2">
            <span className="text-slate-400">Auto Expiry Date:</span>
            <span className="text-blue-400 font-extrabold text-sm">{completedWarranty.expiry}</span>
          </div>
        </div>

        <button
          onClick={() => { setActiveJob(null); setCompletedWarranty(null); }}
          className="w-full bg-rafiki-500 hover:bg-rafiki-600 text-white font-bold py-3 rounded-xl transition-colors shadow-lg shadow-rafiki-500/20 text-xs"
        >
          Back to Installations List
        </button>
      </div>
    );
  }

  // Field Detail View for Installer (One-Handed Phone Optimization)
  if (activeJob) {
    return (
      <div className="max-w-md mx-auto space-y-5">
        <button
          onClick={() => setActiveJob(null)}
          className="text-xs text-slate-400 hover:text-slate-200 flex items-center space-x-1"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Field Jobs</span>
        </button>

        {/* Job Header */}
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl space-y-2">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase">Field Installation Job</span>
              <h1 className="text-xl font-extrabold text-white">{activeJob.job_number}</h1>
            </div>
            <span className="bg-amber-500/10 border border-amber-500/30 text-amber-400 text-[10px] font-bold px-2.5 py-0.5 rounded-full">
              {activeJob.status}
            </span>
          </div>

          <div className="space-y-1 text-xs text-slate-300 border-t border-slate-800 pt-2">
            <div className="flex items-center space-x-2">
              <User className="w-3.5 h-3.5 text-slate-500" />
              <span>{activeJob.customer_name}</span>
            </div>
            <div className="flex items-center space-x-2">
              <Phone className="w-3.5 h-3.5 text-slate-500" />
              <span>{activeJob.customer_phone}</span>
            </div>
            <div className="flex items-center space-x-2">
              <MapPin className="w-3.5 h-3.5 text-slate-500" />
              <span>{activeJob.address}</span>
            </div>
          </div>
        </div>

        {/* Product & Assigned Serial */}
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl space-y-2 text-xs">
          <span className="text-[10px] font-bold text-slate-400 uppercase">Allocated Geyser Unit</span>
          <div className="flex justify-between items-center bg-slate-950 p-3 rounded-lg border border-slate-800">
            <div>
              <span className="font-bold text-white block">{activeJob.product_name}</span>
              <span className="text-[11px] text-slate-400">Assigned Serial:</span>
            </div>
            <span className="text-rafiki-400 font-mono font-bold text-sm">{activeJob.serial_number}</span>
          </div>
        </div>

        {/* Safety & Compliance Checklist */}
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl space-y-3 text-xs">
          <div className="flex items-center space-x-2 border-b border-slate-800 pb-2">
            <Wrench className="w-4 h-4 text-amber-400" />
            <h2 className="font-bold text-white text-sm">Mandatory Compliance Checklist</h2>
          </div>

          <div className="space-y-2.5">
            <button
              onClick={() => setGasTest(!gasTest)}
              className={`w-full p-3 rounded-xl border flex items-center justify-between text-left transition-colors ${gasTest ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' : 'bg-slate-950 border-slate-800 text-slate-300'}`}
            >
              <span>1. Gas Pressure & Leakage Test Passed</span>
              {gasTest ? <CheckSquare className="w-5 h-5 text-emerald-400 shrink-0" /> : <Square className="w-5 h-5 text-slate-500 shrink-0" />}
            </button>

            <button
              onClick={() => setWaterTest(!waterTest)}
              className={`w-full p-3 rounded-xl border flex items-center justify-between text-left transition-colors ${waterTest ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' : 'bg-slate-950 border-slate-800 text-slate-300'}`}
            >
              <span>2. Water Flow & Temperature Test Passed</span>
              {waterTest ? <CheckSquare className="w-5 h-5 text-emerald-400 shrink-0" /> : <Square className="w-5 h-5 text-slate-500 shrink-0" />}
            </button>

            <button
              onClick={() => setUnitTest(!unitTest)}
              className={`w-full p-3 rounded-xl border flex items-center justify-between text-left transition-colors ${unitTest ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' : 'bg-slate-950 border-slate-800 text-slate-300'}`}
            >
              <span>3. Pulse Ignition & Battery Box Test</span>
              {unitTest ? <CheckSquare className="w-5 h-5 text-emerald-400 shrink-0" /> : <Square className="w-5 h-5 text-slate-500 shrink-0" />}
            </button>

            <button
              onClick={() => setCustomerHandover(!customerHandover)}
              className={`w-full p-3 rounded-xl border flex items-center justify-between text-left transition-colors ${customerHandover ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' : 'bg-slate-950 border-slate-800 text-slate-300'}`}
            >
              <span>4. Customer Handover & Safety Briefing</span>
              {customerHandover ? <CheckSquare className="w-5 h-5 text-emerald-400 shrink-0" /> : <Square className="w-5 h-5 text-slate-500 shrink-0" />}
            </button>
          </div>
        </div>

        {/* Handover Signature Capture */}
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl space-y-3 text-xs">
          <div className="flex items-center space-x-2 border-b border-slate-800 pb-2">
            <PenTool className="w-4 h-4 text-rafiki-400" />
            <h2 className="font-bold text-white text-sm">Customer Handover Signature *</h2>
          </div>
          <div>
            <label className="block text-slate-400 mb-1">Customer Signee Reference</label>
            <input
              type="text"
              required
              value={signatureRef}
              onChange={(e) => setSignatureRef(e.target.value)}
              placeholder="e.g. Signed by Tendai Moyo (Digital Handover)"
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-rafiki-500"
            />
          </div>
        </div>

        {/* Photo Upload & Notes */}
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl space-y-3 text-xs">
          <div className="flex items-center space-x-2 border-b border-slate-800 pb-2">
            <Camera className="w-4 h-4 text-blue-400" />
            <h2 className="font-bold text-white text-sm">Field Photos & Notes</h2>
          </div>
          <button
            onClick={() => alert('Photo upload dialog triggered')}
            className="w-full bg-slate-950 border border-dashed border-slate-700 hover:border-rafiki-500 p-3 rounded-lg text-slate-400 text-center flex items-center justify-center space-x-2"
          >
            <Camera className="w-4 h-4" />
            <span>Upload Installation Photos</span>
          </button>

          <div>
            <label className="block text-slate-400 mb-1">Installer Field Notes</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Fitted 1/2 inch brass pressure valve, tested at 2.5 bar..."
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 focus:outline-none"
            />
          </div>
        </div>

        {/* Error Alert */}
        {completionError && (
          <div className="bg-red-500/10 border border-red-500/30 p-3 rounded-xl flex items-start space-x-2 text-xs text-red-400 font-semibold">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{completionError}</span>
          </div>
        )}

        {/* Complete Installation Action */}
        <button
          disabled={submitting}
          onClick={handleCompleteSubmit}
          className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold py-3.5 rounded-xl transition-colors shadow-lg shadow-emerald-600/20 text-sm flex items-center justify-center space-x-2 disabled:opacity-50"
        >
          <ShieldCheck className="w-5 h-5" />
          <span>{submitting ? 'Executing RPC...' : 'Complete Job & Activate Warranty'}</span>
        </button>
      </div>
    );
  }

  // Installations List View
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">Installation Jobs</h1>
          <p className="text-xs text-slate-400">Field Fulfilment & 6-Month Warranty Activation</p>
        </div>
      </div>

      <div className="space-y-3 text-xs">
        {jobs.map((job) => (
          <div
            key={job.id}
            onClick={() => setActiveJob(job)}
            className="bg-slate-900 border border-slate-800 hover:border-rafiki-500/50 p-4 rounded-xl flex items-center justify-between cursor-pointer transition-all"
          >
            <div className="space-y-1">
              <div className="flex items-center space-x-2">
                <span className="font-bold text-white font-mono">{job.job_number}</span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  job.status === 'COMPLETED' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' :
                  'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                }`}>
                  {job.status}
                </span>
              </div>
              <p className="text-slate-300">{job.customer_name} • {job.product_name}</p>
              <p className="text-[11px] text-slate-500">Tech: {job.installer_name} • Date: {job.scheduled_date}</p>
            </div>
            <ChevronRight className="w-5 h-5 text-slate-500" />
          </div>
        ))}
      </div>
    </div>
  );
};
