export type UserRole = 'user' | 'admin' | 'super_admin';
export type AccountStatus = 'active' | 'suspended';

export interface UserProfile {
  uid: string;
  fullName: string;
  email: string;
  organization?: string;
  country?: string;
  researchInterests?: string;
  role: UserRole;
  accountStatus: AccountStatus;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface Project {
  projectId: string;
  ownerUid: string;
  projectName: string;
  description?: string;
  biome?: string;
  location?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface NotificationItem {
  notificationId: string;
  uid: string;
  title: string;
  message: string;
  category: 'info' | 'analysis' | 'system' | 'security';
  read: boolean;
  createdAt?: unknown;
}

export interface ActivityLog {
  activityId: string;
  uid: string;
  action: string;
  details?: string;
  timestamp?: unknown;
}

export interface SystemSettings {
  settingId: string;
  maxUploadSizeMb: number;
  allowedExtensions: string[];
  defaultReferenceDb: string;
  maintenanceMode: boolean;
  updatedAt?: unknown;
  updatedBy?: string;
}

export interface SequenceQCSummary {
  format: 'fasta' | 'fa' | 'fastq' | 'fq' | 'csv' | 'tsv';
  totalRecords: number;
  totalBases: number;
  avgReadLength: number;
  minReadLength: number;
  maxReadLength: number;
  gcContentPercent: number;
  ambiguousBasePercent: number;
  meanPhredScore?: number;
  q20Percent?: number;
  q30Percent?: number;
  detectedColumns?: string[];
  hasTaxonTable?: boolean;
  previewHeaders: string[];
  validationPassed: boolean;
  validationNotes: string[];
}

export interface TaxonomicResult {
  id: string;
  analysis_id: string;
  sequence_id: string;
  kingdom: string;
  phylum: string;
  class: string;
  order_name: string;
  family: string;
  genus: string;
  species: string;
  read_count: number;
  confidence_score: number;
  reference_database: string;
}

export interface BiodiversityResult {
  id: string;
  analysis_id: string;
  sample_id: string;
  species_richness: number;
  shannon_index: number;
  simpson_index: number;
  pielou_evenness: number;
  total_reads: number;
  created_at: string;
}

export interface DatasetRecord {
  id: string;
  firebase_uid: string;
  project_id: string;
  dataset_name: string;
  file_path: string;
  file_format: 'fasta' | 'fa' | 'fastq' | 'fq' | 'csv' | 'tsv';
  file_size_bytes: number;
  sample_id: string;
  sample_type: string;
  collection_location: string;
  collection_date: string;
  sequencing_platform?: string;
  marker_gene?: string;
  description?: string;
  latitude?: number | null;
  longitude?: number | null;
  qc_summary?: SequenceQCSummary | null;
  upload_status: 'uploaded' | 'validated' | 'failed';
  created_at: string;
  storage_backend?: 'supabase' | 'local_session_only';
  parsed_taxa?: TaxonomicResult[];
}

export interface AnalysisJob {
  id: string;
  dataset_id: string;
  dataset_name?: string;
  sample_id?: string;
  firebase_uid: string;
  analysis_type: string;
  processing_status: 'pending' | 'running' | 'completed' | 'failed';
  pipeline_version: string;
  reference_database: string;
  is_demonstration: boolean;
  started_at: string;
  completed_at?: string | null;
  error_message?: string | null;
  taxa?: TaxonomicResult[];
  biodiversity?: BiodiversityResult | null;
  methodology_note?: string;
}

export interface AdminAuditLog {
  id: string;
  admin_uid: string;
  action: string;
  affected_record: string;
  timestamp: string;
  outcome: 'success' | 'denied' | 'error';
}

export interface IntegrationStatus {
  firebase: {
    configured: boolean;
    projectId: string;
  };
  supabase: {
    configured: boolean;
    bucket: string;
    message: string;
  };
  bioinformaticsEngine: {
    configured: boolean;
    mode: 'external_pipeline' | 'demonstration_and_qc';
    message: string;
  };
  gemini: {
    configured: boolean;
    model: string;
  };
}
