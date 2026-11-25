import { type FormEvent, useEffect, useState } from 'react';
import {
  Activity,
  Database,
  Lock,
  LogOut,
  Plus,
  RefreshCw,
  ShieldAlert,
  Trash2,
  Users,
} from 'lucide-react';
import { apiRequest, setAuthToken } from '../lib/api';
import type { LearningModuleItem, SpeciesReferenceItem, UserProfile } from '../types';
import { DnaLogo } from './DnaLogo';

interface AdminOverviewData {
  stats: {
    totalUsers: number;
    activeUsers: number;
    totalDatasets: number;
    completedJobs: number;
    failedJobs: number;
    totalSpeciesRef: number;
    totalTaxaIdentified: number;
  };
  integrations: {
    localSqlite: { status: string; engine: string };
    supabase: { configured: boolean; urlSet: boolean; serviceKeySet: boolean; bucket: string };
    firebase: { configured: boolean };
    ncbiExternalBlast: { configured: boolean };
    smtpEmail: { configured: boolean };
  };
  users: Array<{
    uid: string;
    full_name: string;
    email: string;
    institution: string;
    country: string;
    user_category: string;
    role: string;
    status: string;
    email_verified: number;
    last_login_at: string | null;
    created_at: string;
  }>;
  datasets: Array<{
    id: string;
    dataset_name: string;
    sample_id: string;
    sample_type: string;
    location: string;
    owner_name: string;
    owner_email: string;
    sequence_count: number;
    species_richness: number | null;
    shannon_index: number | null;
    created_at: string;
  }>;
  jobs: Array<{
    id: string;
    dataset_name: string;
    owner_email: string;
    status: string;
    progress: number;
    analysis_mode: string;
    started_at: string;
    error_message: string | null;
  }>;
  activities: Array<{
    activity_id: string;
    user_email: string | null;
    user_name: string | null;
    activity_type: string;
    description: string;
    timestamp: string;
  }>;
  auditLogs: Array<{
    id: string;
    actor_email: string | null;
    action: string;
    target_type: string;
    details: string;
    created_at: string;
  }>;
  speciesReference: SpeciesReferenceItem[];
  learningModules: LearningModuleItem[];
}

export function AdminControlCenter({ onExitToApp }: { onExitToApp: () => void }) {
  const [adminUser, setAdminUser] = useState<UserProfile | null>(null);
  const [needsBootstrap, setNeedsBootstrap] = useState(false);
  const [bootstrapChecked, setBootstrapChecked] = useState(false);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [tab, setTab] = useState<'overview' | 'users' | 'datasets' | 'species' | 'learning' | 'logs' | 'integrations'>(
    'overview'
  );
  const [data, setData] = useState<AdminOverviewData | null>(null);

  // New species form state
  const [newSpecies, setNewSpecies] = useState({
    scientific_name: '',
    common_name: '',
    kingdom: 'Animalia',
    phylum: 'Chordata',
    class_name: '',
    order_name: '',
    family: '',
    genus: '',
    species: '',
    organism_category: 'Freshwater Fish',
    marker_gene: 'COI',
    reference_database: 'NCBI GenBank',
    accession_id: '',
    habitat: '',
    conservation_status: 'Least Concern (IUCN)',
    reference_motif: '',
    description: '',
  });

  useEffect(() => {
    apiRequest<{ needsBootstrap: boolean }>('/api/admin/bootstrap-status')
      .then((res) => setNeedsBootstrap(res.needsBootstrap))
      .catch(() => {})
      .finally(() => setBootstrapChecked(true));
  }, []);

  async function loadOverview() {
    setLoading(true);
    try {
      const overview = await apiRequest<AdminOverviewData>('/api/admin/overview');
      setData(overview);
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Unable to load control center data.');
    } finally {
      setLoading(false);
    }
  }

  async function handleAdminLogin(e: FormEvent) {
    e.preventDefault();
    setAuthError(null);
    setLoading(true);
    try {
      const res = await apiRequest<{ token: string; user: UserProfile }>('/api/admin/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      setAuthToken(res.token);
      setAdminUser(res.user);
      await loadOverview();
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Access denied.');
    } finally {
      setLoading(false);
    }
  }

  async function handleBootstrap(e: FormEvent) {
    e.preventDefault();
    setAuthError(null);
    setLoading(true);
    try {
      const res = await apiRequest<{ token: string; user: UserProfile }>('/api/admin/bootstrap', {
        method: 'POST',
        body: JSON.stringify({ fullName, email, password, confirmPassword }),
      });
      setAuthToken(res.token);
      setAdminUser(res.user);
      setNeedsBootstrap(false);
      await loadOverview();
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Bootstrap setup failed.');
    } finally {
      setLoading(false);
    }
  }

  async function toggleUserStatus(uid: string, currentStatus: string) {
    const nextStatus = currentStatus === 'active' ? 'suspended' : 'active';
    await apiRequest(`/api/admin/users/${uid}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status: nextStatus }),
    });
    await loadOverview();
  }

  async function handleCreateSpecies(e: FormEvent) {
    e.preventDefault();
    await apiRequest('/api/admin/species', {
      method: 'POST',
      body: JSON.stringify(newSpecies),
    });
    setNewSpecies({
      ...newSpecies,
      scientific_name: '',
      common_name: '',
      class_name: '',
      order_name: '',
      family: '',
      genus: '',
      species: '',
      accession_id: '',
      habitat: '',
      reference_motif: '',
      description: '',
    });
    await loadOverview();
  }

  async function handleDeleteSpecies(id: string) {
    await apiRequest(`/api/admin/species/${id}`, { method: 'DELETE' });
    await loadOverview();
  }

  async function toggleModulePublish(mod: LearningModuleItem) {
    await apiRequest(`/api/admin/learning/${mod.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ published: !mod.published }),
    });
    await loadOverview();
  }

  if (!adminUser) {
    return (
      <div className="min-h-screen bg-[#111815] text-white flex items-center justify-center p-6">
        <div className="w-full max-w-md bg-[#18231E] border border-emerald-900/60 rounded-2xl p-8 space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <DnaLogo size={32} inverted />
              <div>
                <h1 className="text-lg font-semibold">Secure Control Center</h1>
                <p className="text-xs text-emerald-300/80">Restricted Administrator Portal</p>
              </div>
            </div>
            <Lock className="w-5 h-5 text-emerald-400" />
          </div>

          {authError && (
            <div className="p-3 rounded-lg bg-rose-950/60 border border-rose-700 text-rose-200 text-xs flex items-start gap-2">
              <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{authError}</span>
            </div>
          )}

          {!bootstrapChecked ? (
            <p className="text-xs text-emerald-200/70">Verifying control center initialization...</p>
          ) : needsBootstrap ? (
            <form onSubmit={handleBootstrap} className="space-y-3.5">
              <div className="p-3 rounded-lg bg-emerald-950/60 border border-emerald-800 text-xs text-emerald-200">
                First-run setup: Claim the initial administrator account. This form locks permanently once claimed.
              </div>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Administrator Full Name"
                className="w-full px-3.5 py-2.5 rounded-lg bg-[#111815] border border-emerald-900 text-sm text-white"
              />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Administrator Email"
                className="w-full px-3.5 py-2.5 rounded-lg bg-[#111815] border border-emerald-900 text-sm text-white"
              />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Strong Password (8+ chars, symbol, number)"
                className="w-full px-3.5 py-2.5 rounded-lg bg-[#111815] border border-emerald-900 text-sm text-white"
              />
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm Password"
                className="w-full px-3.5 py-2.5 rounded-lg bg-[#111815] border border-emerald-900 text-sm text-white"
              />
              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-[#05241B] font-semibold text-sm cursor-pointer"
              >
                {loading ? 'Claiming...' : 'Claim Administrator Access'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleAdminLogin} className="space-y-4">
              <div>
                <label className="block text-xs text-emerald-200/80 mb-1">Administrator Email</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@ednabioscope.org"
                  className="w-full px-3.5 py-2.5 rounded-lg bg-[#111815] border border-emerald-900 text-sm text-white"
                />
              </div>
              <div>
                <label className="block text-xs text-emerald-200/80 mb-1">Password / Passcode</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter administrator credentials"
                  className="w-full px-3.5 py-2.5 rounded-lg bg-[#111815] border border-emerald-900 text-sm text-white"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-[#05241B] font-semibold text-sm cursor-pointer"
              >
                {loading ? 'Verifying...' : 'Verify & Enter Control Center'}
              </button>
            </form>
          )}

          <button
            type="button"
            onClick={onExitToApp}
            className="text-xs text-emerald-300/70 hover:text-white cursor-pointer"
          >
            Return to Public Application
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F6FAF8] text-[#141E1A]">
      <header className="bg-[#06291F] text-white px-6 py-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <DnaLogo size={30} inverted />
          <div>
            <p className="text-sm font-semibold">eDNA BioScope — Secure Control Center</p>
            <p className="text-[11px] text-emerald-300">{adminUser.email} · Server-Verified Admin</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={loadOverview}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-800/70 hover:bg-emerald-700 text-xs font-medium cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </button>
          <button
            type="button"
            onClick={() => {
              setAuthToken(null);
              setAdminUser(null);
              onExitToApp();
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-emerald-500/40 hover:bg-emerald-900 text-xs font-medium cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign Out
          </button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Segmented Admin Tabs */}
        <div className="flex flex-wrap gap-1.5 p-1 bg-white border border-[#D8E6DF] rounded-xl">
          {(
            [
              ['overview', 'Overview'],
              ['users', 'Users & Accounts'],
              ['datasets', 'Datasets & Jobs'],
              ['species', 'Species Reference'],
              ['learning', 'Learning Content'],
              ['logs', 'Activity & Audit Logs'],
              ['integrations', 'Integration Monitor'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                tab === id ? 'bg-[#064E3B] text-white' : 'text-slate-600 hover:bg-[#F6FAF8]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {data && tab === 'overview' && (
          <div className="space-y-6">
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white border border-[#D8E6DF] rounded-2xl p-5">
                <p className="text-xs text-slate-500">Total Registered Users</p>
                <p className="text-3xl font-mono font-bold text-[#064E3B] tabular-nums mt-1">{data.stats.totalUsers}</p>
                <p className="text-xs text-emerald-700 mt-1">{data.stats.activeUsers} active accounts</p>
              </div>
              <div className="bg-white border border-[#D8E6DF] rounded-2xl p-5">
                <p className="text-xs text-slate-500">Uploaded Datasets</p>
                <p className="text-3xl font-mono font-bold text-[#064E3B] tabular-nums mt-1">{data.stats.totalDatasets}</p>
                <p className="text-xs text-slate-500 mt-1">{data.stats.totalTaxaIdentified} taxonomic records</p>
              </div>
              <div className="bg-white border border-[#D8E6DF] rounded-2xl p-5">
                <p className="text-xs text-slate-500">Analysis Jobs</p>
                <p className="text-3xl font-mono font-bold text-[#064E3B] tabular-nums mt-1">{data.stats.completedJobs}</p>
                <p className="text-xs text-slate-500 mt-1">{data.stats.failedJobs} failed jobs</p>
              </div>
              <div className="bg-white border border-[#D8E6DF] rounded-2xl p-5">
                <p className="text-xs text-slate-500">Reference Species</p>
                <p className="text-3xl font-mono font-bold text-[#064E3B] tabular-nums mt-1">{data.stats.totalSpeciesRef}</p>
                <p className="text-xs text-slate-500 mt-1">Curated barcode vouchers</p>
              </div>
            </div>

            <div className="grid lg:grid-cols-2 gap-6">
              <div className="bg-white border border-[#D8E6DF] rounded-2xl p-6 space-y-3">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-[#064E3B]" />
                  <h2 className="text-base font-semibold">Recent Registered Users</h2>
                </div>
                <div className="divide-y divide-slate-100 text-xs">
                  {data.users.slice(0, 6).map((u) => (
                    <div key={u.uid} className="py-2 flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-slate-900">{u.full_name}</p>
                        <p className="text-slate-500">{u.email} · {u.user_category}</p>
                      </div>
                      <span className="font-mono text-emerald-700">{u.status}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white border border-[#D8E6DF] rounded-2xl p-6 space-y-3">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-[#064E3B]" />
                  <h2 className="text-base font-semibold">Recent Security Audit Trail</h2>
                </div>
                <div className="divide-y divide-slate-100 text-xs">
                  {data.auditLogs.slice(0, 6).map((log) => (
                    <div key={log.id} className="py-2">
                      <p className="font-semibold text-slate-900">{log.action}</p>
                      <p className="text-slate-500">{log.details} · {log.actor_email || 'system'}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {data && tab === 'users' && (
          <div className="bg-white border border-[#D8E6DF] rounded-2xl p-6 overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="py-2.5 pr-4 font-semibold">Name / Email</th>
                  <th className="py-2.5 pr-4 font-semibold">Category / Institution</th>
                  <th className="py-2.5 pr-4 font-semibold">Role</th>
                  <th className="py-2.5 pr-4 font-semibold">Status</th>
                  <th className="py-2.5 text-right font-semibold">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.users.map((u) => (
                  <tr key={u.uid}>
                    <td className="py-3 pr-4">
                      <p className="font-semibold text-slate-900">{u.full_name}</p>
                      <p className="text-slate-500">{u.email}</p>
                    </td>
                    <td className="py-3 pr-4">
                      {u.user_category} · {u.institution || u.country}
                    </td>
                    <td className="py-3 pr-4 font-mono">{u.role}</td>
                    <td className="py-3 pr-4 font-mono">
                      <span className={u.status === 'active' ? 'text-emerald-700' : 'text-rose-700'}>
                        {u.status}
                      </span>
                    </td>
                    <td className="py-3 text-right">
                      {u.uid !== adminUser.uid && (
                        <button
                          type="button"
                          onClick={() => toggleUserStatus(u.uid, u.status)}
                          className="px-3 py-1 rounded border border-slate-300 hover:bg-slate-50 font-medium cursor-pointer"
                        >
                          {u.status === 'active' ? 'Suspend' : 'Reactivate'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {data && tab === 'datasets' && (
          <div className="space-y-6">
            <div className="bg-white border border-[#D8E6DF] rounded-2xl p-6 overflow-x-auto space-y-3">
              <h2 className="text-base font-semibold">Dataset Records</h2>
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500">
                    <th className="py-2 pr-4 font-semibold">Dataset</th>
                    <th className="py-2 pr-4 font-semibold">Owner</th>
                    <th className="py-2 pr-4 font-semibold">Sample</th>
                    <th className="py-2 pr-4 font-semibold text-right">Sequences</th>
                    <th className="py-2 font-semibold text-right">H&apos;</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.datasets.map((d) => (
                    <tr key={d.id}>
                      <td className="py-2.5 pr-4 font-semibold">{d.dataset_name}</td>
                      <td className="py-2.5 pr-4 text-slate-600">{d.owner_email}</td>
                      <td className="py-2.5 pr-4">{d.sample_id} · {d.sample_type}</td>
                      <td className="py-2.5 pr-4 text-right font-mono">{d.sequence_count}</td>
                      <td className="py-2.5 text-right font-mono text-emerald-700">
                        {d.shannon_index !== null ? Number(d.shannon_index).toFixed(3) : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="bg-white border border-[#D8E6DF] rounded-2xl p-6 overflow-x-auto space-y-3">
              <h2 className="text-base font-semibold">Analysis Jobs Monitor</h2>
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500">
                    <th className="py-2 pr-4 font-semibold">Dataset</th>
                    <th className="py-2 pr-4 font-semibold">Owner</th>
                    <th className="py-2 pr-4 font-semibold">Status</th>
                    <th className="py-2 pr-4 font-semibold">Engine</th>
                    <th className="py-2 font-semibold">Started</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.jobs.map((j) => (
                    <tr key={j.id}>
                      <td className="py-2.5 pr-4 font-semibold">{j.dataset_name}</td>
                      <td className="py-2.5 pr-4">{j.owner_email}</td>
                      <td className="py-2.5 pr-4 font-mono text-emerald-700">{j.status} ({j.progress}%)</td>
                      <td className="py-2.5 pr-4 font-mono">{j.analysis_mode}</td>
                      <td className="py-2.5 font-mono text-slate-500">{new Date(j.started_at).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {data && tab === 'species' && (
          <div className="grid lg:grid-cols-12 gap-6">
            <form onSubmit={handleCreateSpecies} className="lg:col-span-5 bg-white border border-[#D8E6DF] rounded-2xl p-6 space-y-3 text-xs">
              <div className="flex items-center gap-2">
                <Plus className="w-4 h-4 text-[#064E3B]" />
                <h2 className="text-base font-semibold">Add Reference Species</h2>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <input required placeholder="Scientific name" value={newSpecies.scientific_name} onChange={(e) => setNewSpecies({ ...newSpecies, scientific_name: e.target.value, species: e.target.value })} className="px-2.5 py-2 border border-slate-300 rounded-lg" />
                <input required placeholder="Common name" value={newSpecies.common_name} onChange={(e) => setNewSpecies({ ...newSpecies, common_name: e.target.value })} className="px-2.5 py-2 border border-slate-300 rounded-lg" />
                <input required placeholder="Kingdom" value={newSpecies.kingdom} onChange={(e) => setNewSpecies({ ...newSpecies, kingdom: e.target.value })} className="px-2.5 py-2 border border-slate-300 rounded-lg" />
                <input required placeholder="Phylum" value={newSpecies.phylum} onChange={(e) => setNewSpecies({ ...newSpecies, phylum: e.target.value })} className="px-2.5 py-2 border border-slate-300 rounded-lg" />
                <input required placeholder="Class" value={newSpecies.class_name} onChange={(e) => setNewSpecies({ ...newSpecies, class_name: e.target.value })} className="px-2.5 py-2 border border-slate-300 rounded-lg" />
                <input required placeholder="Order" value={newSpecies.order_name} onChange={(e) => setNewSpecies({ ...newSpecies, order_name: e.target.value })} className="px-2.5 py-2 border border-slate-300 rounded-lg" />
                <input required placeholder="Family" value={newSpecies.family} onChange={(e) => setNewSpecies({ ...newSpecies, family: e.target.value })} className="px-2.5 py-2 border border-slate-300 rounded-lg" />
                <input required placeholder="Genus" value={newSpecies.genus} onChange={(e) => setNewSpecies({ ...newSpecies, genus: e.target.value })} className="px-2.5 py-2 border border-slate-300 rounded-lg" />
                <input required placeholder="Accession ID" value={newSpecies.accession_id} onChange={(e) => setNewSpecies({ ...newSpecies, accession_id: e.target.value })} className="px-2.5 py-2 border border-slate-300 rounded-lg font-mono" />
                <input required placeholder="Marker Gene (COI/12S)" value={newSpecies.marker_gene} onChange={(e) => setNewSpecies({ ...newSpecies, marker_gene: e.target.value })} className="px-2.5 py-2 border border-slate-300 rounded-lg" />
              </div>
              <input required placeholder="Habitat" value={newSpecies.habitat} onChange={(e) => setNewSpecies({ ...newSpecies, habitat: e.target.value })} className="w-full px-2.5 py-2 border border-slate-300 rounded-lg" />
              <input required placeholder="Reference DNA Motif (ACGT...)" value={newSpecies.reference_motif} onChange={(e) => setNewSpecies({ ...newSpecies, reference_motif: e.target.value })} className="w-full px-2.5 py-2 border border-slate-300 rounded-lg font-mono" />
              <textarea required rows={2} placeholder="Ecological description" value={newSpecies.description} onChange={(e) => setNewSpecies({ ...newSpecies, description: e.target.value })} className="w-full px-2.5 py-2 border border-slate-300 rounded-lg" />
              <button type="submit" className="w-full py-2.5 rounded-lg bg-[#064E3B] text-white font-semibold cursor-pointer">
                Add to Reference Catalog
              </button>
            </form>

            <div className="lg:col-span-7 bg-white border border-[#D8E6DF] rounded-2xl p-6 space-y-3 max-h-[600px] overflow-y-auto">
              <h2 className="text-base font-semibold">Reference Species Catalog ({data.speciesReference.length})</h2>
              <div className="divide-y divide-slate-100 text-xs">
                {data.speciesReference.map((sp) => (
                  <div key={sp.id} className="py-2.5 flex items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold italic">{sp.scientific_name} <span className="not-italic font-normal text-slate-500">({sp.common_name})</span></p>
                      <p className="text-slate-500 font-mono">{sp.marker_gene} · {sp.accession_id}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteSpecies(sp.id)}
                      className="p-1.5 text-rose-600 hover:bg-rose-50 rounded cursor-pointer"
                      aria-label={`Delete ${sp.scientific_name}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {data && tab === 'learning' && (
          <div className="bg-white border border-[#D8E6DF] rounded-2xl p-6 space-y-4">
            <h2 className="text-base font-semibold">Manage Educational Modules</h2>
            <div className="divide-y divide-slate-100 text-xs">
              {data.learningModules.map((mod) => (
                <div key={mod.id} className="py-3 flex items-center justify-between gap-4">
                  <div>
                    <p className="font-semibold text-sm text-slate-900">{mod.title}</p>
                    <p className="text-slate-500">{mod.category} · {mod.summary}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleModulePublish(mod)}
                    className={`px-3 py-1.5 rounded-lg font-semibold cursor-pointer ${
                      mod.published ? 'bg-emerald-100 text-emerald-900' : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {mod.published ? 'Published' : 'Hidden'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {data && tab === 'logs' && (
          <div className="grid lg:grid-cols-2 gap-6">
            <div className="bg-white border border-[#D8E6DF] rounded-2xl p-6 space-y-3 max-h-[540px] overflow-y-auto">
              <h2 className="text-base font-semibold">Application User Activity</h2>
              <div className="divide-y divide-slate-100 text-xs">
                {data.activities.map((a) => (
                  <div key={a.activity_id} className="py-2">
                    <p className="font-semibold">{a.activity_type}</p>
                    <p className="text-slate-600">{a.description}</p>
                    <p className="text-slate-400 font-mono">{a.user_email || 'system'} · {new Date(a.timestamp).toLocaleString()}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white border border-[#D8E6DF] rounded-2xl p-6 space-y-3 max-h-[540px] overflow-y-auto">
              <h2 className="text-base font-semibold">Security &amp; Error Audit Logs</h2>
              <div className="divide-y divide-slate-100 text-xs">
                {data.auditLogs.map((l) => (
                  <div key={l.id} className="py-2">
                    <p className="font-semibold text-[#064E3B]">{l.action}</p>
                    <p className="text-slate-700">{l.details}</p>
                    <p className="text-slate-400 font-mono">{l.actor_email || 'anonymous'} · {new Date(l.created_at).toLocaleString()}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {data && tab === 'integrations' && (
          <div className="bg-white border border-[#D8E6DF] rounded-2xl p-6 space-y-4">
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-[#064E3B]" />
              <h2 className="text-base font-semibold">Backend Database &amp; External Service Integration Monitor</h2>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
              <div className="p-4 rounded-xl border border-[#D8E6DF] bg-[#F6FAF8] space-y-1">
                <p className="font-semibold text-sm">Primary Server Database</p>
                <p className="text-emerald-700 font-mono">Connected · {data.integrations.localSqlite.engine}</p>
              </div>
              <div className="p-4 rounded-xl border border-[#D8E6DF] bg-[#F6FAF8] space-y-1">
                <p className="font-semibold text-sm">Supabase PostgreSQL &amp; Storage</p>
                <p className={`font-mono ${data.integrations.supabase.configured ? 'text-emerald-700' : 'text-amber-700'}`}>
                  {data.integrations.supabase.configured
                    ? `Configured (Bucket: ${data.integrations.supabase.bucket})`
                    : 'Placeholder Mode — Set SUPABASE_URL & SUPABASE_SERVICE_ROLE_KEY'}
                </p>
              </div>
              <div className="p-4 rounded-xl border border-[#D8E6DF] bg-[#F6FAF8] space-y-1">
                <p className="font-semibold text-sm">Firebase Auth / External Config</p>
                <p className={`font-mono ${data.integrations.firebase.configured ? 'text-emerald-700' : 'text-amber-700'}`}>
                  {data.integrations.firebase.configured
                    ? 'Configured via environment variables'
                    : 'Local Server Auth Active — Set VITE_FIREBASE_* if desired'}
                </p>
              </div>
              <div className="p-4 rounded-xl border border-[#D8E6DF] bg-[#F6FAF8] space-y-1">
                <p className="font-semibold text-sm">External BLAST / NCBI Service</p>
                <p className={`font-mono ${data.integrations.ncbiExternalBlast.configured ? 'text-emerald-700' : 'text-amber-700'}`}>
                  {data.integrations.ncbiExternalBlast.configured
                    ? 'External API key configured'
                    : 'Local Reference Demo Mode — Set NCBI_API_KEY / EXTERNAL_BLAST_ENDPOINT'}
                </p>
              </div>
              <div className="p-4 rounded-xl border border-[#D8E6DF] bg-[#F6FAF8] space-y-1">
                <p className="font-semibold text-sm">Transactional SMTP Email</p>
                <p className={`font-mono ${data.integrations.smtpEmail.configured ? 'text-emerald-700' : 'text-amber-700'}`}>
                  {data.integrations.smtpEmail.configured
                    ? 'Configured'
                    : 'Preview Token Dispatch Mode — Set SMTP_HOST'}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
