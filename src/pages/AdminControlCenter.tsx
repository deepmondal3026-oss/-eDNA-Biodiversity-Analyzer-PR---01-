import React, { useCallback, useEffect, useState } from 'react';
import {
  Activity,
  Database,
  FileWarning,
  Loader2,
  RefreshCw,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  Users,
} from 'lucide-react';
import { BrandLogoIcon } from '../components/BrandMark.tsx';
import { useAuth } from '../context/AuthContext.tsx';
import { apiFetch } from '../lib/apiClient.ts';
import { fetchSystemSettings, saveSystemSettings } from '../lib/firebase.ts';
import type { AdminAuditLog, SystemSettings, UserProfile } from '../types/edna.ts';

type AdminTab = 'overview' | 'users' | 'datasets' | 'analyses' | 'settings' | 'audit';

interface AdminOverview {
  supabaseConfigured: boolean;
  totalUsers: number;
  totalDatasets: number;
  completedAnalyses: number;
  failedAnalyses: number;
  identifiedTaxa: number;
  recentAuditLogs: AdminAuditLog[];
}

export function AdminControlCenter({ onNavigate }: { onNavigate: (path: string) => void }) {
  const { user, loading: authLoading, logout } = useAuth();
  const [verifying, setVerifying] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [tab, setTab] = useState<AdminTab>('overview');

  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [userSearch, setUserSearch] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState('all');
  const [datasets, setDatasets] = useState<any[]>([]);
  const [analyses, setAnalyses] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<AdminAuditLog[]>([]);
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [busyMsg, setBusyMsg] = useState('');

  const loadAdminData = useCallback(async () => {
    setVerifying(true);
    setAuthError(null);
    try {
      await apiFetch('/api/admin/session');
      setAuthorized(true);
      const [ov, usr, ds, an, logs, sys] = await Promise.all([
        apiFetch<AdminOverview>('/api/admin/overview'),
        apiFetch<{ users: UserProfile[] }>('/api/admin/users'),
        apiFetch<{ datasets: any[] }>('/api/admin/datasets'),
        apiFetch<{ analyses: any[] }>('/api/admin/analyses'),
        apiFetch<{ logs: AdminAuditLog[] }>('/api/admin/audit-logs'),
        fetchSystemSettings(),
      ]);
      setOverview(ov);
      setUsers(usr.users);
      setDatasets(ds.datasets);
      setAnalyses(an.analyses);
      setAuditLogs(logs.logs);
      setSettings(sys);
    } catch (err) {
      setAuthorized(false);
      setAuthError(err instanceof Error ? err.message : '403 Unauthorized');
    } finally {
      setVerifying(false);
    }
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setVerifying(false);
      setAuthorized(false);
      return;
    }
    void loadAdminData();
  }, [authLoading, user, loadAdminData]);

  if (authLoading || verifying) {
    return (
      <div className="min-h-screen bg-[#F5F8F5] flex items-center justify-center p-6">
        <div className="flex items-center gap-3 text-sm text-[#123D2B]">
          <Loader2 className="w-5 h-5 animate-spin text-[#16834A]" />
          <span>Verifying server-side administrator credentials...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#F5F8F5] flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white border border-slate-200 rounded-2xl p-8 text-center">
          <ShieldAlert className="w-10 h-10 text-[#123D2B] mx-auto mb-3" />
          <h1 className="text-xl font-bold text-[#123D2B] mb-2">Authentication Required</h1>
          <p className="text-sm text-slate-600 mb-6">
            Sign in with an authorized administrator account to verify backend access.
          </p>
          <button
            type="button"
            onClick={() => onNavigate('/login?next=/control-center')}
            className="w-full py-2.5 px-4 rounded-lg bg-[#16834A] text-white text-sm font-semibold hover:bg-[#123D2B]"
          >
            Sign In
          </button>
        </div>
      </div>
    );
  }

  if (!authorized) {
    return (
      <div className="min-h-screen bg-[#F5F8F5] flex items-center justify-center p-6">
        <div className="max-w-lg w-full bg-white border border-rose-200 rounded-2xl p-8 text-center">
          <ShieldAlert className="w-12 h-12 text-rose-600 mx-auto mb-4" />
          <div className="text-xs font-mono uppercase tracking-wider text-rose-700 mb-1">HTTP 403 Forbidden</div>
          <h1 className="text-2xl font-bold text-[#172B22] mb-2">403 Unauthorized</h1>
          <p className="text-sm text-slate-600 mb-6">
            {authError || 'Your account does not hold verified administrator privileges.'}
          </p>
          <div className="flex justify-center gap-3">
            <button
              type="button"
              onClick={() => onNavigate('/dashboard')}
              className="px-4 py-2 rounded-lg bg-[#123D2B] text-white text-sm font-medium hover:bg-[#16834A]"
            >
              Return to User Dashboard
            </button>
            <button
              type="button"
              onClick={() => onNavigate('/')}
              className="px-4 py-2 rounded-lg border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Homepage
            </button>
          </div>
        </div>
      </div>
    );
  }

  const handleUpdateUser = async (uid: string, patch: { role?: string; accountStatus?: string }) => {
    setBusyMsg('Updating user permissions...');
    try {
      await apiFetch(`/api/admin/users/${uid}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      });
      await loadAdminData();
    } catch (err) {
      setBusyMsg(err instanceof Error ? err.message : 'Update failed.');
    } finally {
      setTimeout(() => setBusyMsg(''), 2500);
    }
  };

  const handleDeleteDataset = async (id: string) => {
    setBusyMsg('Removing dataset...');
    try {
      await apiFetch(`/api/admin/datasets/${id}`, { method: 'DELETE' });
      await loadAdminData();
    } catch (err) {
      setBusyMsg(err instanceof Error ? err.message : 'Delete failed.');
    } finally {
      setTimeout(() => setBusyMsg(''), 2500);
    }
  };

  const handleRetryJob = async (id: string) => {
    setBusyMsg('Queueing retry...');
    try {
      await apiFetch(`/api/admin/analyses/${id}/retry`, { method: 'POST' });
      await loadAdminData();
    } catch (err) {
      setBusyMsg(err instanceof Error ? err.message : 'Retry failed.');
    } finally {
      setTimeout(() => setBusyMsg(''), 2500);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings || !user) return;
    setBusyMsg('Saving global system settings...');
    try {
      await saveSystemSettings(user.uid, {
        maxUploadSizeMb: settings.maxUploadSizeMb,
        allowedExtensions: settings.allowedExtensions,
        defaultReferenceDb: settings.defaultReferenceDb,
        maintenanceMode: settings.maintenanceMode,
      });
      await apiFetch('/api/admin/audit-logs', {
        method: 'POST',
        body: JSON.stringify({
          action: 'UPDATE_SYSTEM_SETTINGS',
          affectedRecord: 'system_settings/global',
          outcome: 'success',
        }),
      });
      await loadAdminData();
    } catch (err) {
      setBusyMsg(err instanceof Error ? err.message : 'Failed to save settings.');
    } finally {
      setTimeout(() => setBusyMsg(''), 2500);
    }
  };

  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      !userSearch ||
      u.fullName.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.email.toLowerCase().includes(userSearch.toLowerCase()) ||
      (u.organization ?? '').toLowerCase().includes(userSearch.toLowerCase());
    const matchesRole = userRoleFilter === 'all' || u.role === userRoleFilter;
    return matchesSearch && matchesRole;
  });

  return (
    <div className="min-h-screen bg-[#F5F8F5] text-[#172B22] flex flex-col lg:flex-row">
      {/* Sidebar */}
      <aside className="w-full lg:w-64 bg-[#123D2B] text-white shrink-0 flex flex-col justify-between p-5">
        <div>
          <div className="flex items-center gap-2.5 mb-8">
            <BrandLogoIcon className="w-8 h-8" />
            <div>
              <div className="text-sm font-bold leading-tight">Control Center</div>
              <div className="text-[11px] text-emerald-200/80">Server-Verified Admin</div>
            </div>
          </div>

          <nav className="space-y-1">
            {(
              [
                ['overview', 'System Overview', Activity],
                ['users', 'User Management', Users],
                ['datasets', 'Dataset Management', Database],
                ['analyses', 'Analysis Jobs', FileWarning],
                ['settings', 'System Settings', Settings],
                ['audit', 'Audit Logs', ShieldCheck],
              ] as const
            ).map(([id, label, Icon]) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                  tab === id ? 'bg-[#16834A] text-white' : 'text-emerald-100/80 hover:bg-white/10 hover:text-white'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{label}</span>
              </button>
            ))}
          </nav>
        </div>

        <div className="pt-6 border-t border-white/15 space-y-2 text-xs">
          <button
            type="button"
            onClick={() => onNavigate('/dashboard')}
            className="w-full text-left px-3 py-2 rounded-lg text-emerald-100 hover:bg-white/10"
          >
            Researcher Dashboard
          </button>
          <button
            type="button"
            onClick={() => void logout()}
            className="w-full text-left px-3 py-2 rounded-lg text-rose-200 hover:bg-rose-500/20"
          >
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-6 lg:p-8 overflow-x-hidden">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-[#123D2B]">Administration Console</h1>
            <p className="text-xs text-slate-500">
              Authenticated as {user.email} · Backend RBAC Active
            </p>
          </div>
          <div className="flex items-center gap-3">
            {busyMsg && <span className="text-xs font-medium text-[#16834A]">{busyMsg}</span>}
            <button
              type="button"
              onClick={() => void loadAdminData()}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white border border-slate-200 text-xs font-medium hover:border-[#16834A]"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Refresh
            </button>
          </div>
        </div>

        {tab === 'overview' && overview && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
              {[
                ['Registered Users', overview.totalUsers],
                ['Stored Datasets', overview.totalDatasets],
                ['Completed Analyses', overview.completedAnalyses],
                ['Failed Jobs', overview.failedAnalyses],
                ['Identified Taxa', overview.identifiedTaxa],
              ].map(([label, val]) => (
                <div key={String(label)} className="bg-white border border-slate-200 rounded-xl p-5">
                  <div className="text-xs text-slate-500 mb-1">{label}</div>
                  <div className="text-2xl font-mono tabular-nums font-bold text-[#123D2B]">{val}</div>
                </div>
              ))}
            </div>

            {!overview.supabaseConfigured && (
              <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900">
                Supabase PostgreSQL is not configured yet (`SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY`). User
                counts come live from Firestore; dataset and job counts reflect Supabase once connected.
              </div>
            )}

            <div className="bg-white border border-slate-200 rounded-xl p-6">
              <h2 className="text-sm font-semibold text-[#123D2B] mb-4">Recent Administrative Audit Activity</h2>
              {overview.recentAuditLogs.length === 0 ? (
                <p className="text-xs text-slate-500">No administrative mutations logged yet.</p>
              ) : (
                <div className="divide-y divide-slate-100">
                  {overview.recentAuditLogs.slice(0, 8).map((log) => (
                    <div key={log.id} className="py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
                      <div>
                        <span className="font-mono font-semibold text-[#123D2B]">{log.action}</span>
                        <span className="text-slate-400 mx-2">·</span>
                        <span className="text-slate-600">{log.affected_record}</span>
                      </div>
                      <span className="font-mono tabular-nums text-slate-500">
                        {new Date(log.timestamp).toLocaleString()} · {log.outcome}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {tab === 'users' && (
          <div className="bg-white border border-slate-200 rounded-xl p-6">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
              <h2 className="text-base font-semibold text-[#123D2B]">User Directory ({filteredUsers.length})</h2>
              <div className="flex flex-wrap gap-2">
                <input
                  type="text"
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  placeholder="Search name, email, institution..."
                  className="px-3 py-1.5 text-xs border border-slate-200 rounded-lg"
                />
                <select
                  value={userRoleFilter}
                  onChange={(e) => setUserRoleFilter(e.target.value)}
                  className="px-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-white"
                >
                  <option value="all">All Roles</option>
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                  <option value="super_admin">Super Admin</option>
                </select>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200 text-slate-500">
                  <tr>
                    <th className="py-2.5 pr-4">Researcher</th>
                    <th className="py-2.5 pr-4">Organization</th>
                    <th className="py-2.5 pr-4">Role</th>
                    <th className="py-2.5 pr-4">Status</th>
                    <th className="py-2.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredUsers.map((u) => (
                    <tr key={u.uid} className="hover:bg-slate-50">
                      <td className="py-3 pr-4">
                        <div className="font-semibold text-[#172B22]">{u.fullName || 'Unnamed'}</div>
                        <div className="text-slate-500 font-mono">{u.email}</div>
                      </td>
                      <td className="py-3 pr-4 text-slate-600">{u.organization || '—'}</td>
                      <td className="py-3 pr-4">
                        <select
                          value={u.role}
                          onChange={(e) => void handleUpdateUser(u.uid, { role: e.target.value })}
                          className="px-2 py-1 border border-slate-200 rounded bg-white font-mono"
                        >
                          <option value="user">user</option>
                          <option value="admin">admin</option>
                          <option value="super_admin">super_admin</option>
                        </select>
                      </td>
                      <td className="py-3 pr-4 font-mono">
                        <span className={u.accountStatus === 'suspended' ? 'text-rose-700' : 'text-[#16834A]'}>
                          {u.accountStatus}
                        </span>
                      </td>
                      <td className="py-3 text-right">
                        {u.uid !== user.uid && (
                          <button
                            type="button"
                            onClick={() =>
                              void handleUpdateUser(u.uid, {
                                accountStatus: u.accountStatus === 'active' ? 'suspended' : 'active',
                              })
                            }
                            className="px-2.5 py-1 rounded border border-slate-200 hover:border-rose-400 text-xs"
                          >
                            {u.accountStatus === 'active' ? 'Suspend' : 'Reactivate'}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === 'datasets' && (
          <div className="bg-white border border-slate-200 rounded-xl p-6">
            <h2 className="text-base font-semibold text-[#123D2B] mb-4">Uploaded Datasets ({datasets.length})</h2>
            {datasets.length === 0 ? (
              <p className="text-xs text-slate-500">
                No datasets found in Supabase PostgreSQL (or Supabase is not configured yet).
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-200 text-slate-500">
                    <tr>
                      <th className="py-2 pr-4">Dataset</th>
                      <th className="py-2 pr-4">Sample ID</th>
                      <th className="py-2 pr-4">Format</th>
                      <th className="py-2 pr-4">Status</th>
                      <th className="py-2 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {datasets.map((d) => (
                      <tr key={d.id}>
                        <td className="py-2.5 pr-4 font-medium">{d.dataset_name}</td>
                        <td className="py-2.5 pr-4 font-mono">{d.sample_id}</td>
                        <td className="py-2.5 pr-4 font-mono uppercase">{d.file_format}</td>
                        <td className="py-2.5 pr-4 font-mono">{d.upload_status}</td>
                        <td className="py-2.5 text-right">
                          <button
                            type="button"
                            onClick={() => void handleDeleteDataset(d.id)}
                            className="inline-flex items-center gap-1 text-rose-700 hover:underline"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {tab === 'analyses' && (
          <div className="bg-white border border-slate-200 rounded-xl p-6">
            <h2 className="text-base font-semibold text-[#123D2B] mb-4">Analysis Jobs ({analyses.length})</h2>
            {analyses.length === 0 ? (
              <p className="text-xs text-slate-500">No analysis jobs recorded in Supabase yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-200 text-slate-500">
                    <tr>
                      <th className="py-2 pr-4">Job ID</th>
                      <th className="py-2 pr-4">Type</th>
                      <th className="py-2 pr-4">Status</th>
                      <th className="py-2 pr-4">Error Log</th>
                      <th className="py-2 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {analyses.map((a) => (
                      <tr key={a.id}>
                        <td className="py-2.5 pr-4 font-mono">{a.id.slice(0, 8)}</td>
                        <td className="py-2.5 pr-4">{a.analysis_type}</td>
                        <td className="py-2.5 pr-4 font-mono">{a.processing_status}</td>
                        <td className="py-2.5 pr-4 text-rose-700">{a.error_message || '—'}</td>
                        <td className="py-2.5 text-right">
                          {a.processing_status === 'failed' && (
                            <button
                              type="button"
                              onClick={() => void handleRetryJob(a.id)}
                              className="text-[#16834A] font-medium hover:underline"
                            >
                              Retry Job
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {tab === 'settings' && settings && (
          <form onSubmit={handleSaveSettings} className="max-w-xl bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <h2 className="text-base font-semibold text-[#123D2B]">Application &amp; Pipeline Settings</h2>
            <div>
              <label className="block text-xs font-medium mb-1">Max Upload File Size (MB)</label>
              <input
                type="number"
                min={1}
                max={500}
                value={settings.maxUploadSizeMb}
                onChange={(e) => setSettings({ ...settings, maxUploadSizeMb: Number(e.target.value) })}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Default Reference Database</label>
              <input
                type="text"
                value={settings.defaultReferenceDb}
                onChange={(e) => setSettings({ ...settings, defaultReferenceDb: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
              />
            </div>
            <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.maintenanceMode}
                onChange={(e) => setSettings({ ...settings, maintenanceMode: e.target.checked })}
              />
              Enable Maintenance Mode Banner for Standard Users
            </label>
            <button
              type="submit"
              className="px-5 py-2 rounded-lg bg-[#16834A] text-white text-sm font-semibold hover:bg-[#123D2B]"
            >
              Save Settings
            </button>
          </form>
        )}

        {tab === 'audit' && (
          <div className="bg-white border border-slate-200 rounded-xl p-6">
            <h2 className="text-base font-semibold text-[#123D2B] mb-4">Administrator Audit Logs</h2>
            {auditLogs.length === 0 ? (
              <p className="text-xs text-slate-500">No audit logs recorded yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-200 text-slate-500">
                    <tr>
                      <th className="py-2 pr-4">Timestamp</th>
                      <th className="py-2 pr-4">Admin UID</th>
                      <th className="py-2 pr-4">Action</th>
                      <th className="py-2 pr-4">Affected Record</th>
                      <th className="py-2">Outcome</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {auditLogs.map((log) => (
                      <tr key={log.id}>
                        <td className="py-2.5 pr-4 font-mono tabular-nums text-slate-500">
                          {new Date(log.timestamp).toLocaleString()}
                        </td>
                        <td className="py-2.5 pr-4 font-mono">{log.admin_uid.slice(0, 12)}</td>
                        <td className="py-2.5 pr-4 font-mono font-semibold">{log.action}</td>
                        <td className="py-2.5 pr-4">{log.affected_record}</td>
                        <td className="py-2.5 font-mono">{log.outcome}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
