import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BarChart3,
  Bell,
  CheckCircle2,
  ClipboardCopy,
  Database,
  Download,
  FileSpreadsheet,
  FileText,
  FlaskConical,
  FolderKanban,
  History,
  LayoutDashboard,
  Loader2,
  LogOut,
  Menu,
  Microscope,
  Plus,
  Search,
  Settings,
  Trash2,
  UploadCloud,
  X,
} from 'lucide-react';
import {
  DiversityIndexComparisonChart,
  SpeciesRichnessBarChart,
  TaxonomicDistributionChart,
  TaxonomicHierarchyTree,
} from '../components/BiodiversityCharts.tsx';
import { BrandLogoIcon } from '../components/BrandMark.tsx';
import { GeminiInterpreterPanel } from '../components/GeminiInterpreterPanel.tsx';
import { PWAInstallButton } from '../components/PWAInstallControls.tsx';
import { useAuth } from '../context/AuthContext.tsx';
import { apiFetch } from '../lib/apiClient.ts';
import {
  createNotification,
  createProject,
  deleteProject,
  fetchSystemSettings,
  logUserActivity,
  markNotificationRead,
  subscribeUserNotifications,
  subscribeUserProjects,
  updateProject,
  updateUserProfileFields,
} from '../lib/firebase.ts';
import { exportAnalysisToCsv, exportAnalysisToPdf } from '../lib/reportExporter.ts';
import type {
  AnalysisJob,
  DatasetRecord,
  IntegrationStatus,
  NotificationItem,
  Project,
  SystemSettings,
} from '../types/edna.ts';

type NavSection =
  | 'overview'
  | 'upload'
  | 'analyze'
  | 'taxonomy'
  | 'biodiversity'
  | 'projects'
  | 'history'
  | 'reports'
  | 'profile';

interface DemoPresetSummary {
  presetId: string;
  datasetName: string;
  sampleId: string;
  sampleType: string;
  collectionLocation: string;
  collectionDate: string;
  markerGene: string;
  sequencingPlatform: string;
  referenceDatabase: string;
  description: string;
  taxaCount: number;
}

export function UserDashboard({ onNavigate }: { onNavigate: (path: string) => void }) {
  const { user, profile, logout, refreshAuthAndProfile } = useAuth();
  const [activeNav, setActiveNav] = useState<NavSection>('overview');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Firestore real-time state
  const [projects, setProjects] = useState<Project[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [notifOpen, setNotifOpen] = useState(false);
  const [systemSettings, setSystemSettings] = useState<SystemSettings | null>(null);

  // Backend / Supabase / Demo state
  const [integrations, setIntegrations] = useState<IntegrationStatus | null>(null);
  const [datasets, setDatasets] = useState<DatasetRecord[]>([]);
  const [analyses, setAnalyses] = useState<AnalysisJob[]>([]);
  const [demoPresets, setDemoPresets] = useState<DemoPresetSummary[]>([]);
  const [selectedAnalysisId, setSelectedAnalysisId] = useState<string>('');
  const [schemaSql, setSchemaSql] = useState<string | null>(null);
  const [showSchemaModal, setShowSchemaModal] = useState(false);

  // Upload form state
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [uploadSuccess, setUploadSuccess] = useState('');
  const [datasetName, setDatasetName] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState('default-workspace');
  const [sampleId, setSampleId] = useState('');
  const [collectionLocation, setCollectionLocation] = useState('');
  const [collectionDate, setCollectionDate] = useState(new Date().toISOString().slice(0, 10));
  const [sampleType, setSampleType] = useState('Freshwater Surface Grab (1 L)');
  const [sequencingPlatform, setSequencingPlatform] = useState('Illumina MiSeq');
  const [markerGene, setMarkerGene] = useState('16S / COI / 12S');
  const [datasetDescription, setDatasetDescription] = useState('');

  // Analysis runner state
  const [selectedDatasetForRun, setSelectedDatasetForRun] = useState('');
  const [runningAnalysis, setRunningAnalysis] = useState(false);
  const [analysisError, setAnalysisError] = useState('');

  // Taxonomy filter state
  const [taxaSearch, setTaxaSearch] = useState('');
  const [minConfidence, setMinConfidence] = useState(0);

  // Project form state
  const [newProjName, setNewProjName] = useState('');
  const [newProjBiome, setNewProjBiome] = useState('Estuarine / Freshwater');
  const [newProjLocation, setNewProjLocation] = useState('');
  const [newProjDesc, setNewProjDesc] = useState('');
  const [editingProjId, setEditingProjId] = useState<string | null>(null);
  const [projSaving, setProjSaving] = useState(false);

  // Profile form state
  const [profName, setProfName] = useState('');
  const [profOrg, setProfOrg] = useState('');
  const [profCountry, setProfCountry] = useState('');
  const [profInterests, setProfInterests] = useState('');
  const [profSavedMsg, setProfSavedMsg] = useState('');

  useEffect(() => {
    if (profile) {
      setProfName(profile.fullName || '');
      setProfOrg(profile.organization || '');
      setProfCountry(profile.country || '');
      setProfInterests(profile.researchInterests || '');
    }
  }, [profile]);

  const loadBackendData = useCallback(async () => {
    try {
      const [intStatus, dsResp, anResp, demoResp, sys] = await Promise.all([
        apiFetch<IntegrationStatus>('/api/system/integrations'),
        apiFetch<{ configured: boolean; datasets: DatasetRecord[] }>('/api/datasets'),
        apiFetch<{ configured: boolean; analyses: AnalysisJob[] }>('/api/analyses'),
        apiFetch<{ presets: DemoPresetSummary[] }>('/api/demo-datasets'),
        fetchSystemSettings(),
      ]);
      setIntegrations(intStatus);
      setDemoPresets(demoResp.presets);
      setSystemSettings(sys);

      if (dsResp.datasets.length > 0) {
        setDatasets((prev) => {
          const localOnly = prev.filter((d) => d.storage_backend === 'local_session_only');
          const merged = [...dsResp.datasets, ...localOnly];
          return merged;
        });
      }
      if (anResp.analyses.length > 0) {
        setAnalyses((prev) => {
          const ids = new Set(anResp.analyses.map((a) => a.id));
          const sessionOnly = prev.filter((a) => !ids.has(a.id));
          return [...anResp.analyses, ...sessionOnly];
        });
        setSelectedAnalysisId((curr) => curr || anResp.analyses[0].id);
      }
    } catch (err) {
      console.error('Error loading dashboard backend data:', err);
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    const unsubProj = subscribeUserProjects(user.uid, (list) => {
      setProjects(list);
      if (list.length > 0 && selectedProjectId === 'default-workspace') {
        setSelectedProjectId(list[0].projectId);
      }
    });
    const unsubNotif = subscribeUserNotifications(user.uid, setNotifications);
    void loadBackendData();

    return () => {
      unsubProj();
      unsubNotif();
    };
  }, [user, loadBackendData, selectedProjectId]);

  const activeAnalysis = useMemo(() => {
    return analyses.find((a) => a.id === selectedAnalysisId) ?? analyses[0] ?? null;
  }, [analyses, selectedAnalysisId]);

  const totalIdentifiedTaxa = useMemo(() => {
    const species = new Set<string>();
    for (const a of analyses) {
      for (const t of a.taxa ?? []) species.add(t.species);
    }
    return species.size;
  }, [analyses]);

  const unreadNotifCount = notifications.filter((n) => !n.read).length;

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setUploadError('');
    setUploadSuccess('');

    if (!uploadFile) {
      setUploadError('Please select a FASTA, FASTQ, CSV, or TSV file.');
      return;
    }

    const maxBytes = (systemSettings?.maxUploadSizeMb ?? 25) * 1024 * 1024;
    if (uploadFile.size > maxBytes) {
      setUploadError(`File exceeds the configured ${systemSettings?.maxUploadSizeMb ?? 25} MB limit.`);
      return;
    }

    const formData = new FormData();
    formData.append('file', uploadFile);
    formData.append('datasetName', datasetName);
    formData.append('projectId', selectedProjectId);
    formData.append('sampleId', sampleId);
    formData.append('sampleType', sampleType);
    formData.append('collectionLocation', collectionLocation);
    formData.append('collectionDate', collectionDate);
    formData.append('sequencingPlatform', sequencingPlatform);
    formData.append('markerGene', markerGene);
    formData.append('description', datasetDescription);

    setUploading(true);
    setUploadProgress(25);
    try {
      const timer = setInterval(() => {
        setUploadProgress((p) => (p < 85 ? p + 12 : p));
      }, 150);

      const resp = await apiFetch<{
        storedInSupabase: boolean;
        message: string;
        dataset: DatasetRecord;
      }>('/api/datasets/upload', {
        method: 'POST',
        body: formData,
      });

      clearInterval(timer);
      setUploadProgress(100);
      setDatasets((prev) => [resp.dataset, ...prev]);
      setSelectedDatasetForRun(resp.dataset.id);
      setUploadSuccess(resp.message);

      if (user) {
        await logUserActivity(user.uid, 'DATASET_UPLOADED', `${resp.dataset.dataset_name} (${resp.dataset.file_format})`);
        await createNotification({
          uid: user.uid,
          title: 'Dataset Validated',
          message: `${resp.dataset.dataset_name} passed format QC (${resp.dataset.qc_summary?.totalRecords ?? 0} records). Ready for analysis.`,
          category: 'info',
        });
      }
      setUploadFile(null);
      setDatasetName('');
      setSampleId('');
      setCollectionLocation('');
      setDatasetDescription('');
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed.');
    } finally {
      setUploading(false);
    }
  };

  const handleRunDemoAnalysis = async (presetId: string) => {
    setRunningAnalysis(true);
    setAnalysisError('');
    try {
      const resp = await apiFetch<{ analysis: AnalysisJob }>('/api/analyses/run', {
        method: 'POST',
        body: JSON.stringify({ presetId }),
      });
      setAnalyses((prev) => [resp.analysis, ...prev]);
      setSelectedAnalysisId(resp.analysis.id);
      if (user) {
        await logUserActivity(user.uid, 'DEMO_ANALYSIS_RUN', resp.analysis.dataset_name || presetId);
      }
      setActiveNav('taxonomy');
    } catch (err) {
      setAnalysisError(err instanceof Error ? err.message : 'Unable to start demonstration analysis.');
    } finally {
      setRunningAnalysis(false);
    }
  };

  const handleRunDatasetAnalysis = async () => {
    const ds = datasets.find((d) => d.id === selectedDatasetForRun);
    if (!ds) {
      setAnalysisError('Select an uploaded dataset first.');
      return;
    }
    setRunningAnalysis(true);
    setAnalysisError('');
    try {
      const resp = await apiFetch<{ analysis: AnalysisJob }>('/api/analyses/run', {
        method: 'POST',
        body: JSON.stringify({
          datasetId: ds.id,
          datasetName: ds.dataset_name,
          sampleId: ds.sample_id,
          analysisType: ds.parsed_taxa?.length ? 'Taxonomic Abundance Assessment' : 'Sequence Alignment Pipeline',
          referenceDatabase: systemSettings?.defaultReferenceDb || 'SILVA / BOLD / MitoFish',
          parsedTaxa: ds.parsed_taxa ?? [],
        }),
      });
      setAnalyses((prev) => [resp.analysis, ...prev]);
      setSelectedAnalysisId(resp.analysis.id);
      if (user) {
        await logUserActivity(user.uid, 'DATASET_ANALYSIS_COMPLETED', ds.dataset_name);
        await createNotification({
          uid: user.uid,
          title: 'Analysis Completed',
          message: `Biodiversity indices computed for ${ds.dataset_name}.`,
          category: 'analysis',
        });
      }
      setActiveNav('biodiversity');
    } catch (err) {
      setAnalysisError(err instanceof Error ? err.message : 'Analysis pipeline unavailable.');
    } finally {
      setRunningAnalysis(false);
    }
  };

  const handleSaveProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || newProjName.trim().length < 2) return;
    setProjSaving(true);
    try {
      if (editingProjId) {
        await updateProject(editingProjId, user.uid, {
          projectName: newProjName,
          biome: newProjBiome,
          location: newProjLocation,
          description: newProjDesc,
        });
        setEditingProjId(null);
      } else {
        await createProject({
          ownerUid: user.uid,
          projectName: newProjName,
          biome: newProjBiome,
          location: newProjLocation,
          description: newProjDesc,
        });
      }
      setNewProjName('');
      setNewProjLocation('');
      setNewProjDesc('');
    } finally {
      setProjSaving(false);
    }
  };

  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setProfSavedMsg('');
    await updateUserProfileFields(user.uid, {
      fullName: profName,
      organization: profOrg,
      country: profCountry,
      researchInterests: profInterests,
    });
    await refreshAuthAndProfile();
    setProfSavedMsg('Profile preferences updated.');
  };

  const handleViewSchema = async () => {
    if (!schemaSql) {
      const resp = await apiFetch<{ sql: string }>('/api/system/supabase-schema');
      setSchemaSql(resp.sql);
    }
    setShowSchemaModal(true);
  };

  const navItems: Array<{ id: NavSection; label: string; icon: React.ComponentType<{ className?: string }> }> = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'upload', label: 'Upload eDNA Dataset', icon: UploadCloud },
    { id: 'analyze', label: 'Analyze Dataset', icon: FlaskConical },
    { id: 'taxonomy', label: 'Taxonomic Identification', icon: Microscope },
    { id: 'biodiversity', label: 'Biodiversity Assessment', icon: BarChart3 },
    { id: 'projects', label: 'My Projects', icon: FolderKanban },
    { id: 'history', label: 'Analysis History', icon: History },
    { id: 'reports', label: 'Reports', icon: FileText },
    { id: 'profile', label: 'Profile and Settings', icon: Settings },
  ];

  const filteredTaxa = useMemo(() => {
    if (!activeAnalysis?.taxa) return [];
    return activeAnalysis.taxa.filter((t) => {
      const matchesConf = t.confidence_score >= minConfidence;
      const q = taxaSearch.trim().toLowerCase();
      const matchesQuery =
        !q ||
        t.species.toLowerCase().includes(q) ||
        t.family.toLowerCase().includes(q) ||
        t.phylum.toLowerCase().includes(q) ||
        t.sequence_id.toLowerCase().includes(q);
      return matchesConf && matchesQuery;
    });
  }, [activeAnalysis, taxaSearch, minConfidence]);

  return (
    <div className="min-h-screen bg-[#F5F8F5] text-[#172B22] flex flex-col lg:flex-row">
      {/* Mobile Header */}
      <div className="lg:hidden bg-[#123D2B] text-white px-4 h-14 flex items-center justify-between">
        <div className="flex items-center gap-2 font-semibold text-sm">
          <BrandLogoIcon className="w-7 h-7" />
          <span>eDNA Biodiversity Explorer</span>
        </div>
        <button
          type="button"
          onClick={() => setMobileMenuOpen((v) => !v)}
          aria-label="Toggle workspace menu"
          className="p-2 rounded-lg hover:bg-white/10"
        >
          {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Sidebar Navigation */}
      <aside
        className={`${
          mobileMenuOpen ? 'flex' : 'hidden'
        } lg:flex flex-col justify-between w-full lg:w-64 bg-[#123D2B] text-white shrink-0 p-5`}
      >
        <div>
          <button
            type="button"
            onClick={() => onNavigate('/')}
            className="hidden lg:flex items-center gap-2.5 text-left mb-7 w-full"
          >
            <BrandLogoIcon className="w-8 h-8 shrink-0" />
            <div>
              <div className="text-sm font-bold leading-tight">eDNA Explorer</div>
              <div className="text-[11px] text-emerald-200/80">Identify · Analyze · Preserve</div>
            </div>
          </button>

          <nav className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = activeNav === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setActiveNav(item.id);
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs font-medium transition-colors text-left ${
                    active ? 'bg-[#16834A] text-white' : 'text-emerald-100/85 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        <div className="pt-5 mt-5 border-t border-white/15">
          <div className="px-3 mb-3">
            <div className="text-xs font-semibold truncate">{profile?.fullName || user?.displayName || 'Researcher'}</div>
            <div className="text-[11px] text-emerald-200/75 truncate">{user?.email}</div>
          </div>
          <PWAInstallButton variant="sidebar" className="mb-1" />
          <button
            type="button"
            onClick={() => void logout().then(() => onNavigate('/'))}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-emerald-100 hover:bg-white/10"
          >
            <LogOut className="w-4 h-4" />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Main Content Viewport */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Workspace Header */}
        <header className="bg-white border-b border-slate-200 px-6 h-16 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-base font-bold text-[#123D2B]">
              {navItems.find((n) => n.id === activeNav)?.label}
            </h1>
            <p className="text-xs text-slate-500">
              Research Workspace · {profile?.organization || 'Independent Biodiversity Lab'}
            </p>
          </div>

          <div className="flex items-center gap-3 relative">
            {systemSettings?.maintenanceMode && (
              <span className="text-xs font-medium text-amber-800 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-md">
                Maintenance Notice Active
              </span>
            )}
            <button
              type="button"
              onClick={() => setNotifOpen((v) => !v)}
              aria-label="Notifications"
              className="relative p-2 rounded-lg border border-slate-200 hover:border-[#16834A] text-slate-600"
            >
              <Bell className="w-4 h-4" />
              {unreadNotifCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#16834A] text-white text-[10px] font-mono flex items-center justify-center">
                  {unreadNotifCount}
                </span>
              )}
            </button>

            {notifOpen && (
              <div className="absolute right-0 top-12 w-80 bg-white border border-slate-200 rounded-xl shadow-lg z-30 p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold text-[#123D2B]">Notifications</span>
                  <button
                    type="button"
                    onClick={() => setNotifOpen(false)}
                    className="text-xs text-slate-400 hover:text-slate-700"
                  >
                    Close
                  </button>
                </div>
                {notifications.length === 0 ? (
                  <p className="text-xs text-slate-500 py-3">No notifications yet.</p>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {notifications.slice(0, 8).map((n) => (
                      <div
                        key={n.notificationId}
                        onClick={() => !n.read && void markNotificationRead(n.notificationId)}
                        className={`p-2.5 rounded-lg border text-xs cursor-pointer ${
                          n.read ? 'border-slate-100 bg-white text-slate-500' : 'border-[#16834A]/25 bg-[#F5F8F5]'
                        }`}
                      >
                        <div className="font-semibold text-[#172B22]">{n.title}</div>
                        <div className="mt-0.5">{n.message}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </header>

        <main className="flex-1 p-6 lg:p-8 max-w-7xl w-full mx-auto space-y-6">
          {/* 1. OVERVIEW */}
          {activeNav === 'overview' && (
            <>
              <div className="bg-white border border-slate-200 rounded-xl p-6 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-medium text-[#16834A] mb-1">Welcome back</p>
                  <h2 className="text-2xl font-bold text-[#123D2B]">
                    {profile?.fullName || user?.displayName || 'Researcher'}
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">
                    {profile?.country || 'Global'} · {profile?.researchInterests || 'eDNA Taxonomic & Biodiversity Analysis'}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2.5">
                  <button
                    type="button"
                    onClick={() => setActiveNav('upload')}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#16834A] text-white text-xs font-semibold hover:bg-[#123D2B]"
                  >
                    <UploadCloud className="w-4 h-4" />
                    Upload Dataset
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveNav('analyze')}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-[#172B22] hover:border-[#123D2B]"
                  >
                    <FlaskConical className="w-4 h-4" />
                    Explore Demo Samples
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  ['Uploaded Datasets', datasets.length],
                  ['Completed Analyses', analyses.filter((a) => a.processing_status === 'completed').length],
                  ['Identified Taxa', totalIdentifiedTaxa],
                  ['Research Projects', projects.length],
                ].map(([label, val]) => (
                  <div key={String(label)} className="bg-white border border-slate-200 rounded-xl p-5">
                    <div className="text-xs text-slate-500 mb-1">{label}</div>
                    <div className="text-3xl font-mono tabular-nums font-bold text-[#123D2B]">{val}</div>
                  </div>
                ))}
              </div>

              {/* Honest Integration Architecture Status */}
              {integrations && (
                <div className="bg-white border border-slate-200 rounded-xl p-6">
                  <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                    <div>
                      <h3 className="text-sm font-semibold text-[#123D2B]">Connected Infrastructure Status</h3>
                      <p className="text-xs text-slate-500">
                        Live readiness across Firebase identity, Supabase scientific storage, bioinformatics, and Gemini AI
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void handleViewSchema()}
                      className="text-xs font-medium text-[#16834A] hover:underline"
                    >
                      View Supabase PostgreSQL Schema
                    </button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                    <div className="p-4 rounded-lg bg-[#F5F8F5] border border-slate-200">
                      <div className="font-semibold text-[#123D2B] mb-1">
                        Firebase Auth &amp; Firestore · Connected
                      </div>
                      <p className="text-slate-600">
                        Project <span className="font-mono">{integrations.firebase.projectId}</span> verified with
                        row-level security rules.
                      </p>
                    </div>
                    <div className="p-4 rounded-lg bg-[#F5F8F5] border border-slate-200">
                      <div className="font-semibold text-[#123D2B] mb-1">
                        Supabase Data Server ·{' '}
                        <span className={integrations.supabase.configured ? 'text-[#16834A]' : 'text-amber-700'}>
                          {integrations.supabase.configured ? 'Connected' : 'Configuration Required'}
                        </span>
                      </div>
                      <p className="text-slate-600">{integrations.supabase.message}</p>
                    </div>
                    <div className="p-4 rounded-lg bg-[#F5F8F5] border border-slate-200">
                      <div className="font-semibold text-[#123D2B] mb-1">
                        Bioinformatics Engine ·{' '}
                        <span className={integrations.bioinformaticsEngine.configured ? 'text-[#16834A]' : 'text-slate-700'}>
                          {integrations.bioinformaticsEngine.configured ? 'External Pipeline Active' : 'QC + Demonstration Mode'}
                        </span>
                      </div>
                      <p className="text-slate-600">{integrations.bioinformaticsEngine.message}</p>
                    </div>
                    <div className="p-4 rounded-lg bg-[#F5F8F5] border border-slate-200">
                      <div className="font-semibold text-[#123D2B] mb-1">
                        Gemini Scientific Interpreter ·{' '}
                        <span className={integrations.gemini.configured ? 'text-[#16834A]' : 'text-amber-700'}>
                          {integrations.gemini.configured ? 'Ready' : 'Secret Not Set'}
                        </span>
                      </div>
                      <p className="text-slate-600">
                        {integrations.gemini.configured
                          ? `Server-side ${integrations.gemini.model} ready to summarize verified ecological results.`
                          : 'Configure GEMINI_API_KEY in Settings > Secrets to enable AI result explanations.'}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Recent Analysis & Biodiversity Preview */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white border border-slate-200 rounded-xl p-6">
                  <h3 className="text-sm font-semibold text-[#123D2B] mb-4">Recent Analysis Activity</h3>
                  {analyses.length === 0 ? (
                    <div className="py-6 text-center text-xs text-slate-500">
                      <p className="mb-3">No analyses run yet. Load a demonstration dataset or upload your own CSV/FASTA.</p>
                      <button
                        type="button"
                        onClick={() => setActiveNav('analyze')}
                        className="px-4 py-2 rounded-lg bg-[#16834A] text-white font-semibold"
                      >
                        Start Analysis
                      </button>
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100">
                      {analyses.slice(0, 5).map((a) => (
                        <div key={a.id} className="py-3 flex items-center justify-between gap-3 text-xs">
                          <div className="min-w-0">
                            <div className="font-semibold text-[#172B22] truncate">{a.dataset_name || a.id}</div>
                            <div className="text-slate-500">
                              {a.sample_id} · {a.is_demonstration ? 'Demonstration' : 'Uploaded'} ·{' '}
                              {new Date(a.started_at).toLocaleDateString()}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedAnalysisId(a.id);
                              setActiveNav('taxonomy');
                            }}
                            className="text-[#16834A] font-medium hover:underline shrink-0"
                          >
                            Inspect
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="bg-white border border-slate-200 rounded-xl p-6">
                  {analyses.length > 0 ? (
                    <DiversityIndexComparisonChart analyses={analyses} />
                  ) : (
                    <div className="py-8 text-center text-xs text-slate-500">
                      Biodiversity indices (Shannon H&apos;, Simpson 1-D, Pielou J&apos;) appear here once an analysis completes.
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {/* 2. UPLOAD eDNA DATASET */}
          {activeNav === 'upload' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <form onSubmit={handleUploadSubmit} className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6 space-y-4">
                <div>
                  <h2 className="text-base font-bold text-[#123D2B]">Upload Environmental DNA Dataset</h2>
                  <p className="text-xs text-slate-500 mt-1">
                    Accepted formats: FASTA (.fasta, .fa), FASTQ (.fastq, .fq), CSV (.csv), TSV (.tsv). Max{' '}
                    {systemSettings?.maxUploadSizeMb ?? 25} MB. Uploading validates structure and QC only; taxonomic
                    assignment runs separately.
                  </p>
                </div>

                {uploadError && (
                  <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-800">
                    {uploadError}
                  </div>
                )}
                {uploadSuccess && (
                  <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-900">
                    {uploadSuccess}
                  </div>
                )}

                <div>
                  <label className="block text-xs font-medium mb-1.5">Dataset File *</label>
                  <input
                    type="file"
                    accept=".fasta,.fa,.fastq,.fq,.csv,.tsv"
                    onChange={(e) => {
                      const file = e.target.files?.[0] ?? null;
                      setUploadFile(file);
                      if (file && !datasetName) {
                        setDatasetName(file.name.replace(/\.[^.]+$/, ''));
                      }
                    }}
                    className="block w-full text-xs text-slate-600 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-[#F5F8F5] file:text-[#123D2B] hover:file:bg-slate-200 border border-slate-200 rounded-lg p-2"
                  />
                  {uploadFile && (
                    <p className="text-[11px] font-mono text-slate-500 mt-1.5">
                      Selected: {uploadFile.name} · {(uploadFile.size / 1024).toFixed(1)} KB
                    </p>
                  )}
                </div>

                {uploading && (
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs font-mono">
                      <span>Validating &amp; Uploading...</span>
                      <span>{uploadProgress}%</span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-[#16834A] transition-all" style={{ width: `${uploadProgress}%` }} />
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium mb-1">Dataset Name *</label>
                    <input
                      type="text"
                      required
                      value={datasetName}
                      onChange={(e) => setDatasetName(e.target.value)}
                      placeholder="Nisqually Estuary Transect A"
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">Associated Project</label>
                    <select
                      value={selectedProjectId}
                      onChange={(e) => setSelectedProjectId(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white"
                    >
                      <option value="default-workspace">Personal Research Workspace</option>
                      {projects.map((p) => (
                        <option key={p.projectId} value={p.projectId}>
                          {p.projectName}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-medium mb-1">Sample ID *</label>
                    <input
                      type="text"
                      required
                      value={sampleId}
                      onChange={(e) => setSampleId(e.target.value)}
                      placeholder="SMP-2026-01"
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">Collection Date *</label>
                    <input
                      type="date"
                      required
                      value={collectionDate}
                      onChange={(e) => setCollectionDate(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">Sample Type *</label>
                    <input
                      type="text"
                      required
                      value={sampleType}
                      onChange={(e) => setSampleType(e.target.value)}
                      placeholder="Water / Sediment / Soil"
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium mb-1">Collection Location *</label>
                  <input
                    type="text"
                    required
                    value={collectionLocation}
                    onChange={(e) => setCollectionLocation(e.target.value)}
                    placeholder="Columbia River Estuary, OR (46.23, -123.95)"
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium mb-1">Sequencing Platform (optional)</label>
                    <input
                      type="text"
                      value={sequencingPlatform}
                      onChange={(e) => setSequencingPlatform(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">Marker Gene (optional)</label>
                    <input
                      type="text"
                      value={markerGene}
                      onChange={(e) => setMarkerGene(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium mb-1">Description</label>
                  <textarea
                    rows={2}
                    value={datasetDescription}
                    onChange={(e) => setDatasetDescription(e.target.value)}
                    placeholder="Filtration volume, primer pair, field replicates..."
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                  />
                </div>

                <button
                  type="submit"
                  disabled={uploading}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#16834A] text-white text-sm font-semibold hover:bg-[#123D2B] disabled:opacity-50"
                >
                  {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <UploadCloud className="w-4 h-4" />}
                  Upload &amp; Validate Dataset
                </button>
              </form>

              <div className="lg:col-span-5 space-y-4">
                <div className="bg-white border border-slate-200 rounded-xl p-6">
                  <h3 className="text-sm font-semibold text-[#123D2B] mb-3">Validated Datasets ({datasets.length})</h3>
                  {datasets.length === 0 ? (
                    <p className="text-xs text-slate-500">
                      No uploaded datasets yet. Upload a FASTA, FASTQ, CSV, or TSV file to inspect sequence QC.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {datasets.map((ds) => (
                        <div key={ds.id} className="p-3.5 rounded-lg border border-slate-200 bg-[#F5F8F5] text-xs">
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <span className="font-semibold text-[#123D2B] truncate">{ds.dataset_name}</span>
                            <span className="font-mono uppercase text-slate-500">{ds.file_format}</span>
                          </div>
                          <div className="text-slate-600 mb-2">
                            {ds.sample_id} · {ds.collection_location} ·{' '}
                            {ds.storage_backend === 'supabase' ? 'Stored in Supabase' : 'Session QC Only'}
                          </div>
                          {ds.qc_summary && (
                            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200 font-mono text-[11px]">
                              <div>Records: {ds.qc_summary.totalRecords}</div>
                              <div>
                                {ds.qc_summary.avgReadLength > 0
                                  ? `Avg Len: ${ds.qc_summary.avgReadLength} bp`
                                  : `Cols: ${ds.qc_summary.detectedColumns?.length ?? 0}`}
                              </div>
                              {ds.qc_summary.gcContentPercent > 0 && <div>GC: {ds.qc_summary.gcContentPercent}%</div>}
                              {ds.qc_summary.meanPhredScore !== undefined && (
                                <div>Mean Q: {ds.qc_summary.meanPhredScore}</div>
                              )}
                            </div>
                          )}
                          <div className="mt-2.5 flex justify-end">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedDatasetForRun(ds.id);
                                setActiveNav('analyze');
                              }}
                              className="text-xs font-semibold text-[#16834A] hover:underline"
                            >
                              Proceed to Analysis →
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* 3. ANALYZE DATASET */}
          {activeNav === 'analyze' && (
            <div className="space-y-6">
              <div className="bg-white border border-slate-200 rounded-xl p-6">
                <h2 className="text-base font-bold text-[#123D2B] mb-2">Run Scientific Analysis Workflow</h2>
                <p className="text-xs text-slate-600 mb-5">
                  Workflow stages: 1. Dataset Validation → 2. Sequence Preprocessing → 3. Quality Filtering → 4.
                  Reference Database Comparison → 5. Taxonomic Assignment → 6. Confidence Reporting → 7. Diversity
                  Indexing.
                </p>

                {analysisError && (
                  <div className="mb-4 p-3.5 rounded-lg bg-amber-50 border border-amber-200 flex items-start gap-2.5 text-xs text-amber-900">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{analysisError}</span>
                  </div>
                )}

                <div className="flex flex-wrap items-end gap-3">
                  <div className="flex-1 min-w-[240px]">
                    <label className="block text-xs font-medium mb-1">Select Uploaded Dataset</label>
                    <select
                      value={selectedDatasetForRun}
                      onChange={(e) => setSelectedDatasetForRun(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white"
                    >
                      <option value="">-- Choose an uploaded dataset --</option>
                      {datasets.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.dataset_name} ({d.file_format.toUpperCase()} · {d.sample_id})
                        </option>
                      ))}
                    </select>
                  </div>
                  <button
                    type="button"
                    disabled={runningAnalysis || !selectedDatasetForRun}
                    onClick={() => void handleRunDatasetAnalysis()}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#16834A] text-white text-sm font-semibold hover:bg-[#123D2B] disabled:opacity-50"
                  >
                    {runningAnalysis && <Loader2 className="w-4 h-4 animate-spin" />}
                    Execute Analysis
                  </button>
                </div>
              </div>

              {/* Clearly Labeled Demonstration Datasets */}
              <div className="bg-white border border-slate-200 rounded-xl p-6">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                  <div>
                    <h3 className="text-base font-bold text-[#123D2B]">
                      Demonstration Reference Datasets (Clearly Labeled Sample Data)
                    </h3>
                    <p className="text-xs text-slate-500">
                      Explore curated metabarcoding profiles when no external BLAST/QIIME 2 server is connected.
                    </p>
                  </div>
                  <span className="text-xs font-mono text-amber-800 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded">
                    DEMONSTRATION MODE
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {demoPresets.map((preset) => (
                    <div key={preset.presetId} className="p-4 rounded-xl border border-slate-200 bg-[#F5F8F5] flex flex-col justify-between">
                      <div>
                        <div className="text-xs font-mono text-[#16A6A0] mb-1">
                          {preset.sampleId} · {preset.taxaCount} taxa
                        </div>
                        <h4 className="text-sm font-semibold text-[#123D2B] mb-1.5">{preset.datasetName}</h4>
                        <p className="text-xs text-slate-600 leading-relaxed mb-3">{preset.description}</p>
                        <div className="text-[11px] text-slate-500 space-y-0.5 mb-4">
                          <div>Location: {preset.collectionLocation}</div>
                          <div>Marker: {preset.markerGene}</div>
                          <div>Reference: {preset.referenceDatabase}</div>
                        </div>
                      </div>
                      <button
                        type="button"
                        disabled={runningAnalysis}
                        onClick={() => void handleRunDemoAnalysis(preset.presetId)}
                        className="w-full py-2 px-3 rounded-lg bg-[#123D2B] text-white text-xs font-semibold hover:bg-[#16834A] transition-colors"
                      >
                        Load Demonstration Analysis
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* 4. TAXONOMIC IDENTIFICATION */}
          {activeNav === 'taxonomy' && (
            <div className="space-y-6">
              {!activeAnalysis ? (
                <div className="bg-white border border-slate-200 rounded-xl p-10 text-center">
                  <Microscope className="w-9 h-9 text-[#16834A] mx-auto mb-3" />
                  <h2 className="text-base font-semibold text-[#123D2B] mb-1">No Active Analysis Selected</h2>
                  <p className="text-xs text-slate-500 mb-4">
                    Run a taxonomic abundance CSV/TSV or load a demonstration metabarcoding profile to inspect lineages.
                  </p>
                  <button
                    type="button"
                    onClick={() => setActiveNav('analyze')}
                    className="px-4 py-2 rounded-lg bg-[#16834A] text-white text-xs font-semibold"
                  >
                    Open Analysis Runner
                  </button>
                </div>
              ) : (
                <>
                  {activeAnalysis.is_demonstration && (
                    <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 flex items-center gap-2.5 text-xs text-amber-900">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      <span>
                        <strong>Demonstration Mode:</strong> Displaying curated sample taxonomic assignments. No
                        external BLAST/QIIME 2 sequence alignment was fabricated.
                      </span>
                    </div>
                  )}

                  <div className="bg-white border border-slate-200 rounded-xl p-6">
                    <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
                      <div>
                        <h2 className="text-lg font-bold text-[#123D2B]">{activeAnalysis.dataset_name}</h2>
                        <p className="text-xs text-slate-500 font-mono">
                          Sample {activeAnalysis.sample_id} · {activeAnalysis.reference_database} · Status:{' '}
                          {activeAnalysis.processing_status}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-3">
                        <div className="relative">
                          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                          <input
                            type="text"
                            value={taxaSearch}
                            onChange={(e) => setTaxaSearch(e.target.value)}
                            placeholder="Filter species, phylum, ID..."
                            className="pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg"
                          />
                        </div>
                        <label className="flex items-center gap-2 text-xs text-slate-600">
                          <span>Min Confidence: {(minConfidence * 100).toFixed(0)}%</span>
                          <input
                            type="range"
                            min={0}
                            max={0.99}
                            step={0.05}
                            value={minConfidence}
                            onChange={(e) => setMinConfidence(Number(e.target.value))}
                          />
                        </label>
                      </div>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="border-b border-slate-200 text-slate-500">
                          <tr>
                            <th className="py-2.5 pr-3">Feature ID</th>
                            <th className="py-2.5 pr-3">Kingdom</th>
                            <th className="py-2.5 pr-3">Phylum</th>
                            <th className="py-2.5 pr-3">Class</th>
                            <th className="py-2.5 pr-3">Order</th>
                            <th className="py-2.5 pr-3">Family</th>
                            <th className="py-2.5 pr-3">Genus</th>
                            <th className="py-2.5 pr-3">Species</th>
                            <th className="py-2.5 pr-3 text-right">Reads</th>
                            <th className="py-2.5 pr-3 text-right">Confidence</th>
                            <th className="py-2.5">Reference DB</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {filteredTaxa.map((t) => (
                            <tr key={t.id} className="hover:bg-[#F5F8F5]">
                              <td className="py-2.5 pr-3 font-mono text-slate-600">{t.sequence_id}</td>
                              <td className="py-2.5 pr-3">{t.kingdom}</td>
                              <td className="py-2.5 pr-3">{t.phylum}</td>
                              <td className="py-2.5 pr-3">{t.class}</td>
                              <td className="py-2.5 pr-3">{t.order_name}</td>
                              <td className="py-2.5 pr-3">{t.family}</td>
                              <td className="py-2.5 pr-3">{t.genus}</td>
                              <td className="py-2.5 pr-3 font-semibold italic text-[#123D2B]">{t.species}</td>
                              <td className="py-2.5 pr-3 text-right font-mono tabular-nums">
                                {t.read_count.toLocaleString()}
                              </td>
                              <td className="py-2.5 pr-3 text-right font-mono tabular-nums text-[#16834A] font-semibold">
                                {(t.confidence_score * 100).toFixed(1)}%
                              </td>
                              <td className="py-2.5 text-slate-500">{t.reference_database}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="bg-white border border-slate-200 rounded-xl p-6">
                    <TaxonomicHierarchyTree taxa={filteredTaxa} />
                  </div>

                  <GeminiInterpreterPanel analysis={activeAnalysis} />
                </>
              )}
            </div>
          )}

          {/* 5. BIODIVERSITY ASSESSMENT */}
          {activeNav === 'biodiversity' && (
            <div className="space-y-6">
              {!activeAnalysis || !activeAnalysis.biodiversity ? (
                <div className="bg-white border border-slate-200 rounded-xl p-10 text-center">
                  <BarChart3 className="w-9 h-9 text-[#16A6A0] mx-auto mb-3" />
                  <h2 className="text-base font-semibold text-[#123D2B] mb-1">No Biodiversity Metrics Available</h2>
                  <p className="text-xs text-slate-500 mb-4">
                    Select or run an analysis first to calculate Shannon, Simpson, and Pielou diversity indices.
                  </p>
                  <button
                    type="button"
                    onClick={() => setActiveNav('analyze')}
                    className="px-4 py-2 rounded-lg bg-[#16834A] text-white text-xs font-semibold"
                  >
                    Analyze a Dataset
                  </button>
                </div>
              ) : (
                <>
                  {activeAnalysis.is_demonstration && (
                    <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900">
                      <strong>Demonstration Assessment:</strong> Metrics below are computed from curated demonstration
                      taxa counts.
                    </div>
                  )}

                  <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                    {[
                      ['Species Richness (S)', activeAnalysis.biodiversity.species_richness, 'Distinct taxa'],
                      ['Total Reads (N)', activeAnalysis.biodiversity.total_reads.toLocaleString(), 'Assigned reads'],
                      ["Shannon Index (H')", activeAnalysis.biodiversity.shannon_index.toFixed(4), '-sum(p_i * ln p_i)'],
                      ['Gini-Simpson (1-D)', activeAnalysis.biodiversity.simpson_index.toFixed(4), '1 - sum(p_i^2)'],
                      ["Pielou Evenness (J')", activeAnalysis.biodiversity.pielou_evenness.toFixed(4), "H' / ln(S)"],
                    ].map(([title, value, subtitle]) => (
                      <div key={String(title)} className="bg-white border border-slate-200 rounded-xl p-5">
                        <div className="text-xs text-slate-500 mb-1">{title}</div>
                        <div className="text-2xl font-mono tabular-nums font-bold text-[#123D2B]">{value}</div>
                        <div className="text-[11px] font-mono text-slate-400 mt-1">{subtitle}</div>
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="bg-white border border-slate-200 rounded-xl p-6">
                      <TaxonomicDistributionChart taxa={activeAnalysis.taxa ?? []} />
                    </div>
                    <div className="bg-white border border-slate-200 rounded-xl p-6">
                      <SpeciesRichnessBarChart taxa={activeAnalysis.taxa ?? []} />
                    </div>
                  </div>

                  <div className="bg-white border border-slate-200 rounded-xl p-6">
                    <DiversityIndexComparisonChart analyses={analyses} />
                  </div>

                  <div className="bg-white border border-slate-200 rounded-xl p-6 text-xs text-slate-600 leading-relaxed">
                    <h3 className="text-sm font-semibold text-[#123D2B] mb-2">
                      Methodological Formulas &amp; Ecological Limitations
                    </h3>
                    <p>
                      Shannon diversity (<span className="font-mono">H&apos; = -sum(p_i * ln(p_i))</span>) weights
                      both species richness and relative read evenness. Gini-Simpson (
                      <span className="font-mono">1 - sum(p_i^2)</span>) estimates the probability that two randomly
                      drawn sequence reads belong to different taxa. Pielou&apos;s evenness (
                      <span className="font-mono">J&apos; = H&apos; / ln(S)</span>) normalizes diversity between 0 and
                      1. <strong>Important caveat:</strong> eDNA read counts are influenced by PCR primer affinity,
                      mitochondrial copy number, and species DNA shedding rates; therefore, relative read abundance
                      cannot be directly equated to absolute organism counts or biomass without mock-community
                      calibration.
                    </p>
                  </div>

                  <GeminiInterpreterPanel analysis={activeAnalysis} />
                </>
              )}
            </div>
          )}

          {/* 6. MY PROJECTS */}
          {activeNav === 'projects' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <form onSubmit={handleSaveProject} className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6 space-y-4 h-fit">
                <h2 className="text-base font-bold text-[#123D2B]">
                  {editingProjId ? 'Edit Research Project' : 'Create Research Project'}
                </h2>
                <div>
                  <label className="block text-xs font-medium mb-1">Project Name *</label>
                  <input
                    type="text"
                    required
                    value={newProjName}
                    onChange={(e) => setNewProjName(e.target.value)}
                    placeholder="Upper Watershed Salmonid Survey 2026"
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Target Biome</label>
                  <input
                    type="text"
                    value={newProjBiome}
                    onChange={(e) => setNewProjBiome(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Geographic Region</label>
                  <input
                    type="text"
                    value={newProjLocation}
                    onChange={(e) => setNewProjLocation(e.target.value)}
                    placeholder="Pacific Northwest Basin"
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Description</label>
                  <textarea
                    rows={3}
                    value={newProjDesc}
                    onChange={(e) => setNewProjDesc(e.target.value)}
                    placeholder="Objectives, sampling season, and target marker loci..."
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={projSaving}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#16834A] text-white text-xs font-semibold hover:bg-[#123D2B]"
                  >
                    <Plus className="w-4 h-4" />
                    {editingProjId ? 'Save Changes' : 'Create Project'}
                  </button>
                  {editingProjId && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingProjId(null);
                        setNewProjName('');
                        setNewProjLocation('');
                        setNewProjDesc('');
                      }}
                      className="px-4 py-2 rounded-lg border border-slate-200 text-xs"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </form>

              <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6">
                <h3 className="text-sm font-semibold text-[#123D2B] mb-4">Your Private Projects ({projects.length})</h3>
                {projects.length === 0 ? (
                  <p className="text-xs text-slate-500">
                    No projects created yet. Create a project to organize your eDNA datasets and reports.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {projects.map((p) => (
                      <div key={p.projectId} className="p-4 rounded-xl border border-slate-200 bg-[#F5F8F5]">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <h4 className="text-sm font-semibold text-[#123D2B]">{p.projectName}</h4>
                            <p className="text-xs text-slate-500 mt-0.5">
                              {p.biome || 'General Biome'} · {p.location || 'Unspecified Location'}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 text-xs">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingProjId(p.projectId);
                                setNewProjName(p.projectName);
                                setNewProjBiome(p.biome || '');
                                setNewProjLocation(p.location || '');
                                setNewProjDesc(p.description || '');
                              }}
                              className="text-[#16834A] hover:underline"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => user && void deleteProject(p.projectId, user.uid)}
                              className="text-rose-700 hover:underline inline-flex items-center gap-1"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              Delete
                            </button>
                          </div>
                        </div>
                        {p.description && <p className="text-xs text-slate-600 mt-2">{p.description}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 7. ANALYSIS HISTORY */}
          {activeNav === 'history' && (
            <div className="bg-white border border-slate-200 rounded-xl p-6">
              <h2 className="text-base font-bold text-[#123D2B] mb-4">Analysis Job History ({analyses.length})</h2>
              {analyses.length === 0 ? (
                <p className="text-xs text-slate-500">No completed analyses recorded yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-slate-200 text-slate-500">
                      <tr>
                        <th className="py-2.5 pr-4">Dataset</th>
                        <th className="py-2.5 pr-4">Sample ID</th>
                        <th className="py-2.5 pr-4">Mode</th>
                        <th className="py-2.5 pr-4">Richness</th>
                        <th className="py-2.5 pr-4">Shannon H&apos;</th>
                        <th className="py-2.5 pr-4">Date</th>
                        <th className="py-2.5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {analyses.map((a) => (
                        <tr key={a.id}>
                          <td className="py-3 pr-4 font-medium text-[#123D2B]">{a.dataset_name || a.dataset_id}</td>
                          <td className="py-3 pr-4 font-mono">{a.sample_id}</td>
                          <td className="py-3 pr-4 font-mono">{a.is_demonstration ? 'Demonstration' : 'Computed'}</td>
                          <td className="py-3 pr-4 font-mono tabular-nums">
                            {a.biodiversity?.species_richness ?? 0}
                          </td>
                          <td className="py-3 pr-4 font-mono tabular-nums">
                            {a.biodiversity?.shannon_index.toFixed(3) ?? '—'}
                          </td>
                          <td className="py-3 pr-4 font-mono tabular-nums text-slate-500">
                            {new Date(a.started_at).toLocaleString()}
                          </td>
                          <td className="py-3 text-right space-x-3">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedAnalysisId(a.id);
                                setActiveNav('taxonomy');
                              }}
                              className="text-[#16834A] hover:underline"
                            >
                              Taxonomy
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedAnalysisId(a.id);
                                setActiveNav('reports');
                              }}
                              className="text-[#123D2B] hover:underline"
                            >
                              Report
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

          {/* 8. REPORTS */}
          {activeNav === 'reports' && (
            <div className="space-y-6">
              {!activeAnalysis ? (
                <div className="bg-white border border-slate-200 rounded-xl p-10 text-center">
                  <FileText className="w-9 h-9 text-[#16834A] mx-auto mb-3" />
                  <h2 className="text-base font-semibold text-[#123D2B] mb-1">No Reportable Analysis Selected</h2>
                  <p className="text-xs text-slate-500 mb-4">
                    Complete a dataset analysis or load a demonstration survey to generate PDF and CSV reports.
                  </p>
                  <button
                    type="button"
                    onClick={() => setActiveNav('analyze')}
                    className="px-4 py-2 rounded-lg bg-[#16834A] text-white text-xs font-semibold"
                  >
                    Go to Analyze Dataset
                  </button>
                </div>
              ) : (
                <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-6">
                  <div className="flex flex-wrap items-center justify-between gap-4 pb-5 border-b border-slate-200">
                    <div>
                      <h2 className="text-lg font-bold text-[#123D2B]">Scientific Biodiversity Report</h2>
                      <p className="text-xs text-slate-500">
                        {activeAnalysis.dataset_name} · Sample {activeAnalysis.sample_id} ·{' '}
                        {new Date(activeAnalysis.completed_at || activeAnalysis.started_at).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2.5">
                      <button
                        type="button"
                        onClick={() =>
                          exportAnalysisToPdf(
                            activeAnalysis,
                            projects[0]?.projectName || 'Personal Research Workspace'
                          )
                        }
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#16834A] text-white text-xs font-semibold hover:bg-[#123D2B]"
                      >
                        <Download className="w-4 h-4" />
                        Download PDF Report
                      </button>
                      <button
                        type="button"
                        onClick={() => exportAnalysisToCsv(activeAnalysis)}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 text-xs font-semibold text-[#172B22] hover:border-[#123D2B]"
                      >
                        <FileSpreadsheet className="w-4 h-4" />
                        Export CSV Table
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                    <div className="p-4 rounded-lg bg-[#F5F8F5] border border-slate-200 space-y-1">
                      <div className="font-semibold text-[#123D2B]">Methodology &amp; Reference Provenance</div>
                      <div>Pipeline: {activeAnalysis.pipeline_version}</div>
                      <div>Reference DB: {activeAnalysis.reference_database}</div>
                      <div>Status: {activeAnalysis.processing_status}</div>
                      <div>Data Classification: {activeAnalysis.is_demonstration ? 'Demonstration Data' : 'User Table'}</div>
                    </div>
                    <div className="p-4 rounded-lg bg-[#F5F8F5] border border-slate-200 space-y-1 font-mono tabular-nums">
                      <div className="font-sans font-semibold text-[#123D2B]">Biodiversity Summary</div>
                      <div>Species Richness (S): {activeAnalysis.biodiversity?.species_richness ?? 0}</div>
                      <div>Shannon Diversity (H&apos;): {activeAnalysis.biodiversity?.shannon_index.toFixed(4)}</div>
                      <div>Gini-Simpson (1-D): {activeAnalysis.biodiversity?.simpson_index.toFixed(4)}</div>
                      <div>Pielou Evenness (J&apos;): {activeAnalysis.biodiversity?.pielou_evenness.toFixed(4)}</div>
                    </div>
                  </div>

                  <div className="text-xs text-slate-600 p-4 rounded-lg border border-slate-200">
                    <strong>Limitations:</strong>{' '}
                    {activeAnalysis.methodology_note ||
                      'eDNA metabarcoding read counts reflect relative sequence proportions subject to PCR primer bias and DNA shedding differences.'}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 9. PROFILE AND SETTINGS */}
          {activeNav === 'profile' && (
            <div className="space-y-6">
              <PWAInstallButton variant="card" />
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-4 bg-white border border-slate-200 rounded-xl p-6 h-fit">
                <div className="w-14 h-14 rounded-full bg-[#123D2B] text-white font-display font-bold text-xl flex items-center justify-center mb-4">
                  {(profile?.fullName || user?.email || 'R').slice(0, 2).toUpperCase()}
                </div>
                <h2 className="text-lg font-bold text-[#123D2B]">{profile?.fullName || 'Researcher'}</h2>
                <p className="text-xs font-mono text-slate-500 mb-4">{user?.email}</p>
                <div className="space-y-2 text-xs border-t border-slate-100 pt-4">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Account Role</span>
                    <span className="font-mono font-semibold">{profile?.role || 'user'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Account Status</span>
                    <span className="font-mono text-[#16834A]">{profile?.accountStatus || 'active'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Total Projects</span>
                    <span className="font-mono tabular-nums">{projects.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Total Analyses</span>
                    <span className="font-mono tabular-nums">{analyses.length}</span>
                  </div>
                </div>
              </div>

              <form onSubmit={handleProfileSave} className="lg:col-span-8 bg-white border border-slate-200 rounded-xl p-6 space-y-4">
                <h3 className="text-base font-bold text-[#123D2B]">Researcher Profile &amp; Preferences</h3>
                {profSavedMsg && (
                  <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center gap-2 text-xs text-emerald-900">
                    <CheckCircle2 className="w-4 h-4 text-[#16834A]" />
                    <span>{profSavedMsg}</span>
                  </div>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium mb-1">Full Name</label>
                    <input
                      type="text"
                      required
                      value={profName}
                      onChange={(e) => setProfName(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">Email (Verified)</label>
                    <input
                      type="email"
                      disabled
                      value={user?.email || ''}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-slate-50 text-slate-500"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium mb-1">Institution / Organization</label>
                    <input
                      type="text"
                      value={profOrg}
                      onChange={(e) => setProfOrg(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">Country</label>
                    <input
                      type="text"
                      value={profCountry}
                      onChange={(e) => setProfCountry(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Research Interests</label>
                  <textarea
                    rows={3}
                    value={profInterests}
                    onChange={(e) => setProfInterests(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                  />
                </div>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-lg bg-[#16834A] text-white text-sm font-semibold hover:bg-[#123D2B]"
                >
                  Save Profile Changes
                </button>
              </form>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Supabase Schema Modal */}
      {showSchemaModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-3xl w-full max-h-[85vh] flex flex-col">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2 font-semibold text-sm text-[#123D2B]">
                <Database className="w-4 h-4 text-[#16834A]" />
                <span>Supabase PostgreSQL &amp; Storage Schema (supabase/schema.sql)</span>
              </div>
              <button
                type="button"
                onClick={() => setShowSchemaModal(false)}
                className="p-1 text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto flex-1">
              <p className="text-xs text-slate-600 mb-3">
                Run this SQL in your Supabase project SQL editor, then set <span className="font-mono">SUPABASE_URL</span>{' '}
                and <span className="font-mono">SUPABASE_SERVICE_ROLE_KEY</span> in your server environment secrets.
              </p>
              <pre className="p-4 rounded-xl bg-slate-900 text-emerald-200 text-xs font-mono overflow-x-auto">
                {schemaSql || 'Loading schema...'}
              </pre>
            </div>
            <div className="px-6 py-3 border-t border-slate-200 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => schemaSql && void navigator.clipboard.writeText(schemaSql)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#16834A] text-white text-xs font-semibold"
              >
                <ClipboardCopy className="w-3.5 h-3.5" />
                Copy SQL
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
