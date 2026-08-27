import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

const statusTone: Record<string, string> = {
  PENDING: 'bg-slate-800 text-slate-300',
  UNSCHEDULED: 'bg-slate-800 text-slate-300',
  SCHEDULED: 'bg-blue-500/10 text-blue-300',
  IN_PROGRESS: 'bg-amber-500/10 text-amber-300',
  COMPLETED: 'bg-emerald-500/10 text-emerald-300',
  CANCELLED: 'bg-red-500/10 text-red-300',
};

type Installation = {
  id: string;
  job_number: string;
  status: string;
  scheduled_date: string | null;
  customers: { first_name: string; last_name: string | null } | null;
  serial_numbers: { serial_number: string } | null;
  installers: { name: string } | null;
};

export function Installations() {
  const query = useQuery({
    queryKey: ['installations'],
    queryFn: async () => {
      const { data, error } = await supabase.from('installations')
        .select('*, customers(*), serial_numbers(*, products(*)), installers(*)')
        .order('scheduled_date', { ascending: true, nullsFirst: false });
      if (error) throw error;
      return (data ?? []) as unknown as Installation[];
    },
  });

  if (query.isLoading) return <div className="p-10 text-center text-slate-400">Loading installations...</div>;
  if (query.error) return <div className="p-10 text-center text-red-400">Could not load installations.</div>;

  return <div className="mx-auto max-w-4xl"><h1 className="mb-4 text-2xl font-bold text-white">Installations</h1><div className="rounded-xl border border-slate-800 bg-slate-900">{query.data?.length === 0 && <p className="p-5 text-sm text-slate-400">No jobs yet.</p>}{query.data?.map(job => <Link key={job.id} to={`/installations/${job.id}`} className="flex items-center justify-between border-b border-slate-800 px-5 py-3 text-sm last:border-0 hover:bg-slate-800"><div><div className="font-medium text-slate-200">{job.job_number} · {job.customers?.first_name} {job.customers?.last_name ?? ''}</div><div className="text-xs text-slate-500">{job.serial_numbers?.serial_number ?? 'Serial pending'} · {job.scheduled_date ?? 'Unscheduled'} · {job.installers?.name ?? 'Unassigned'}</div></div><span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusTone[job.status] ?? statusTone.PENDING}`}>{job.status.replace(/_/g, ' ')}</span></Link>)}</div></div>;
}
