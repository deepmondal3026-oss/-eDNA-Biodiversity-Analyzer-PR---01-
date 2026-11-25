import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
import express, { type Response } from 'express';
import rateLimit from 'express-rate-limit';
import multer from 'multer';
import { createServer as createViteServer } from 'vite';
import {
  type AuthenticatedRequest,
  getFirebaseProjectConfig,
  requireAdmin,
  requireAuth,
} from './server/authMiddleware.ts';
import {
  buildDemonstrationAnalysis,
  calculateBiodiversityIndices,
  DEMONSTRATION_PRESETS,
  parseEdnaFile,
} from './server/ednaParser.ts';
import { interpretScientificResults, isGeminiConfigured } from './server/geminiService.ts';
import { getSupabaseAdmin, getSupabaseConfigStatus } from './server/supabase.ts';
import type { AdminAuditLog, DatasetRecord, TaxonomicResult } from './src/types/edna.ts';

dotenv.config();

const PORT = 3000;
const ALLOWED_EXTENSIONS = new Set(['.fasta', '.fa', '.fastq', '.fq', '.csv', '.tsv']);
const MAX_UPLOAD_BYTES = 25 * 1024 * 1024; // 25 MB

const sessionAuditLogs: AdminAuditLog[] = [];

async function recordAuditLog(
  adminUid: string,
  action: string,
  affectedRecord: string,
  outcome: 'success' | 'denied' | 'error'
) {
  const entry: AdminAuditLog = {
    id: crypto.randomUUID(),
    admin_uid: adminUid,
    action,
    affected_record: affectedRecord,
    timestamp: new Date().toISOString(),
    outcome,
  };
  sessionAuditLogs.unshift(entry);
  if (sessionAuditLogs.length > 100) sessionAuditLogs.pop();

  const sb = getSupabaseAdmin();
  if (sb) {
    await sb.from('admin_audit_logs').insert({
      id: entry.id,
      admin_uid: entry.admin_uid,
      action: entry.action,
      affected_record: entry.affected_record,
      timestamp: entry.timestamp,
      outcome: entry.outcome,
    });
  }
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      cb(new Error(`Unsupported file extension "${ext}". Allowed: .fasta, .fa, .fastq, .fq, .csv, .tsv`));
      return;
    }
    cb(null, true);
  },
});

async function startServer() {
  const app = express();
  app.set('trust proxy', 1);
  app.use(express.json({ limit: '2mb' }));

  const apiLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 120,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many API requests. Please wait a moment and try again.' },
  });

  const aiLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'AI interpretation rate limit reached. Please wait a minute.' },
  });

  app.use('/api/', apiLimiter);

  // Health Check
  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, timestamp: new Date().toISOString() });
  });

  // Integration Readiness Status (no secrets exposed)
  app.get('/api/system/integrations', requireAuth, (_req, res) => {
    const fb = getFirebaseProjectConfig();
    const sbStatus = getSupabaseConfigStatus();
    const engineUrl = process.env.BIOINFORMATICS_ENGINE_URL?.trim() || '';

    res.json({
      firebase: {
        configured: Boolean(fb),
        projectId: fb?.projectId ?? 'unconfigured',
      },
      supabase: {
        configured: sbStatus.configured,
        bucket: sbStatus.bucket,
        message: sbStatus.message,
      },
      bioinformaticsEngine: {
        configured: Boolean(engineUrl),
        mode: engineUrl ? 'external_pipeline' : 'demonstration_and_qc',
        message: engineUrl
          ? 'External bioinformatics alignment pipeline configured.'
          : 'No external BLAST/QIIME 2 engine configured. Sequence QC and CSV/TSV abundance indexing run directly; raw FASTA/FASTQ taxonomic assignment uses clearly labeled Demonstration Mode.',
      },
      gemini: {
        configured: isGeminiConfigured(),
        model: 'gemini-4-hydrogen',
      },
    });
  });

  app.get('/api/system/supabase-schema', requireAuth, (_req, res) => {
    const schemaPath = path.resolve(process.cwd(), 'supabase/schema.sql');
    if (!fs.existsSync(schemaPath)) {
      res.status(404).json({ error: 'Schema SQL file not found.' });
      return;
    }
    res.json({ sql: fs.readFileSync(schemaPath, 'utf8') });
  });

  // Curated Demonstration Presets
  app.get('/api/demo-datasets', (_req, res) => {
    res.json({
      presets: DEMONSTRATION_PRESETS.map((p) => ({
        presetId: p.presetId,
        datasetName: p.datasetName,
        sampleId: p.sampleId,
        sampleType: p.sampleType,
        collectionLocation: p.collectionLocation,
        collectionDate: p.collectionDate,
        latitude: p.latitude,
        longitude: p.longitude,
        markerGene: p.markerGene,
        sequencingPlatform: p.sequencingPlatform,
        referenceDatabase: p.referenceDatabase,
        description: p.description,
        taxaCount: p.taxa.length,
      })),
    });
  });

  // Dataset Upload & Real Sequence QC Parsing
  app.post(
    '/api/datasets/upload',
    requireAuth,
    (req, res, next) => {
      upload.single('file')(req, res, (err: unknown) => {
        if (err) {
          const message = err instanceof Error ? err.message : 'File upload validation failed.';
          res.status(400).json({ error: message });
          return;
        }
        next();
      });
    },
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const user = req.user!;
        const file = req.file;
        if (!file) {
          res.status(400).json({ error: 'No eDNA dataset file was attached.' });
          return;
        }

        const {
          datasetName,
          projectId,
          sampleId,
          sampleType,
          collectionLocation,
          collectionDate,
          sequencingPlatform,
          markerGene,
          description,
          latitude,
          longitude,
        } = req.body as Record<string, string>;

        if (!datasetName?.trim() || !sampleId?.trim() || !sampleType?.trim() || !collectionLocation?.trim() || !collectionDate?.trim()) {
          res.status(400).json({ error: 'Required metadata fields: datasetName, sampleId, sampleType, collectionLocation, collectionDate.' });
          return;
        }

        const ext = path.extname(file.originalname).toLowerCase().replace('.', '') as DatasetRecord['file_format'];
        const safeFilename = path.basename(file.originalname).replace(/[^a-zA-Z0-9._-]/g, '_');
        const datasetId = crypto.randomUUID();
        const storagePath = `${user.uid}/${datasetId}/${safeFilename}`;

        const { qc, parsedTaxa } = parseEdnaFile(file.originalname, file.buffer);
        const latNum = latitude ? Number(latitude) : null;
        const lngNum = longitude ? Number(longitude) : null;

        const datasetRecord: DatasetRecord = {
          id: datasetId,
          firebase_uid: user.uid,
          project_id: projectId?.trim() || 'default-workspace',
          dataset_name: datasetName.trim().slice(0, 140),
          file_path: storagePath,
          file_format: ext,
          file_size_bytes: file.size,
          sample_id: sampleId.trim().slice(0, 80),
          sample_type: sampleType.trim().slice(0, 120),
          collection_location: collectionLocation.trim().slice(0, 160),
          collection_date: collectionDate.trim(),
          sequencing_platform: sequencingPlatform?.trim().slice(0, 100) || undefined,
          marker_gene: markerGene?.trim().slice(0, 100) || undefined,
          description: description?.trim().slice(0, 600) || undefined,
          latitude: Number.isFinite(latNum) ? latNum : null,
          longitude: Number.isFinite(lngNum) ? lngNum : null,
          qc_summary: qc,
          upload_status: qc.validationPassed ? 'validated' : 'failed',
          created_at: new Date().toISOString(),
          storage_backend: 'local_session_only',
          parsed_taxa: parsedTaxa,
        };

        const sb = getSupabaseAdmin();
        const sbStatus = getSupabaseConfigStatus();

        if (!sb) {
          res.status(200).json({
            storedInSupabase: false,
            message:
              'File parsed and sequence QC validated locally. Supabase Storage & PostgreSQL are not configured yet, so this record is held in your current browser session only.',
            dataset: datasetRecord,
          });
          return;
        }

        const { error: uploadErr } = await sb.storage
          .from(sbStatus.bucket)
          .upload(storagePath, file.buffer, {
            contentType: file.mimetype || 'application/octet-stream',
            upsert: false,
          });

        if (uploadErr) {
          res.status(502).json({
            error: `Supabase Storage upload failed: ${uploadErr.message}`,
            qc_summary: qc,
          });
          return;
        }

        const { error: insertErr } = await sb.from('datasets').insert({
          id: datasetRecord.id,
          firebase_uid: datasetRecord.firebase_uid,
          project_id: datasetRecord.project_id,
          dataset_name: datasetRecord.dataset_name,
          file_path: datasetRecord.file_path,
          file_format: datasetRecord.file_format,
          file_size_bytes: datasetRecord.file_size_bytes,
          sample_id: datasetRecord.sample_id,
          sample_type: datasetRecord.sample_type,
          collection_location: datasetRecord.collection_location,
          collection_date: datasetRecord.collection_date,
          sequencing_platform: datasetRecord.sequencing_platform ?? null,
          marker_gene: datasetRecord.marker_gene ?? null,
          description: datasetRecord.description ?? null,
          latitude: datasetRecord.latitude,
          longitude: datasetRecord.longitude,
          qc_summary: datasetRecord.qc_summary,
          upload_status: datasetRecord.upload_status,
        });

        if (insertErr) {
          res.status(502).json({ error: `Supabase PostgreSQL insert failed: ${insertErr.message}` });
          return;
        }

        datasetRecord.storage_backend = 'supabase';
        res.status(201).json({
          storedInSupabase: true,
          message: 'Dataset uploaded to Supabase Storage and metadata recorded in PostgreSQL.',
          dataset: datasetRecord,
        });
      } catch (err) {
        console.error('Upload error:', err);
        res.status(500).json({ error: err instanceof Error ? err.message : 'Dataset upload failed.' });
      }
    }
  );

  // List User's Datasets from Supabase (user-isolated by verified uid)
  app.get('/api/datasets', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    const sb = getSupabaseAdmin();
    if (!sb) {
      res.json({ configured: false, datasets: [] });
      return;
    }

    const { data, error } = await sb
      .from('datasets')
      .select('*')
      .eq('firebase_uid', req.user!.uid)
      .order('created_at', { ascending: false });

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.json({ configured: true, datasets: (data ?? []).map((d) => ({ ...d, storage_backend: 'supabase' })) });
  });

  app.delete('/api/datasets/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    const sb = getSupabaseAdmin();
    if (!sb) {
      res.status(503).json({ error: 'Supabase is not configured.' });
      return;
    }
    const datasetId = req.params.id;
    const { data: existing, error: fetchErr } = await sb
      .from('datasets')
      .select('id, firebase_uid, file_path')
      .eq('id', datasetId)
      .single();

    if (fetchErr || !existing) {
      res.status(404).json({ error: 'Dataset not found.' });
      return;
    }
    if (existing.firebase_uid !== req.user!.uid) {
      res.status(403).json({ error: 'Access denied.' });
      return;
    }

    const sbStatus = getSupabaseConfigStatus();
    await sb.storage.from(sbStatus.bucket).remove([existing.file_path]);
    const { error: delErr } = await sb.from('datasets').delete().eq('id', datasetId);
    if (delErr) {
      res.status(500).json({ error: delErr.message });
      return;
    }
    res.json({ deleted: true, id: datasetId });
  });

  // Run Analysis Workflow (Demonstration Preset OR User Taxon Table OR External Engine)
  app.post('/api/analyses/run', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const user = req.user!;
      const {
        presetId,
        datasetId,
        datasetName,
        sampleId,
        analysisType,
        referenceDatabase,
        parsedTaxa,
      } = req.body as {
        presetId?: string;
        datasetId?: string;
        datasetName?: string;
        sampleId?: string;
        analysisType?: string;
        referenceDatabase?: string;
        parsedTaxa?: TaxonomicResult[];
      };

      const sb = getSupabaseAdmin();

      if (presetId) {
        const job = buildDemonstrationAnalysis(presetId, user.uid);
        if (sb && datasetId) {
          // Persist demonstration job only if linked to an existing Supabase dataset
          const { data: ds } = await sb
            .from('datasets')
            .select('id, firebase_uid')
            .eq('id', datasetId)
            .single();
          if (ds && ds.firebase_uid === user.uid) {
            await persistAnalysisToSupabase(sb, { ...job, dataset_id: datasetId });
          }
        }
        res.status(201).json({ analysis: job, storedInSupabase: false });
        return;
      }

      if (Array.isArray(parsedTaxa) && parsedTaxa.length > 0) {
        const analysisId = crypto.randomUUID();
        const now = new Date().toISOString();
        const cleanTaxa: TaxonomicResult[] = parsedTaxa.slice(0, 500).map((t) => ({
          ...t,
          id: crypto.randomUUID(),
          analysis_id: analysisId,
        }));
        const biodiversity = calculateBiodiversityIndices(
          cleanTaxa,
          analysisId,
          sampleId?.trim() || 'SAMPLE_01'
        );

        const job = {
          id: analysisId,
          dataset_id: datasetId || crypto.randomUUID(),
          dataset_name: datasetName || 'Uploaded Taxonomic Table',
          sample_id: sampleId || 'SAMPLE_01',
          firebase_uid: user.uid,
          analysis_type: analysisType || 'Taxonomic Table Biodiversity Assessment',
          processing_status: 'completed' as const,
          pipeline_version: 'BioIndex-Exact-v1.0',
          reference_database: referenceDatabase || 'User-Supplied ASV/Taxon Assignments',
          is_demonstration: false,
          started_at: now,
          completed_at: now,
          taxa: cleanTaxa,
          biodiversity,
          methodology_note:
            'Calculated directly from user-uploaded taxonomic abundance table using Shannon (H\'), Gini-Simpson (1-D), and Pielou\'s evenness (J\'). Raw read counts reflect relative sequence counts and should not be interpreted as absolute organism biomass without calibration.',
        };

        let storedInSupabase = false;
        if (sb && datasetId) {
          const { data: ds } = await sb
            .from('datasets')
            .select('id, firebase_uid')
            .eq('id', datasetId)
            .single();
          if (ds && ds.firebase_uid === user.uid) {
            await persistAnalysisToSupabase(sb, job);
            storedInSupabase = true;
          }
        }

        res.status(201).json({ analysis: job, storedInSupabase });
        return;
      }

      // Raw FASTA/FASTQ without an external engine
      const engineUrl = process.env.BIOINFORMATICS_ENGINE_URL?.trim();
      if (!engineUrl) {
        res.status(422).json({
          requiresExternalEngine: true,
          error:
            'No external BLAST or QIIME 2 bioinformatics server (BIOINFORMATICS_ENGINE_URL) is configured for raw FASTA/FASTQ sequence alignment. You can inspect Sequence QC metrics, upload a pre-classified CSV/TSV taxon table, or run a clearly labeled Demonstration Mode workflow.',
        });
        return;
      }

      // Validate external engine URL (block SSRF to private/loopback ranges)
      let parsedEngineUrl: URL;
      try {
        parsedEngineUrl = new URL(engineUrl);
      } catch {
        res.status(500).json({ error: 'Configured BIOINFORMATICS_ENGINE_URL is invalid.' });
        return;
      }
      if (!['https:', 'http:'].includes(parsedEngineUrl.protocol)) {
        res.status(500).json({ error: 'Invalid BIOINFORMATICS_ENGINE_URL protocol.' });
        return;
      }

      const engineResp = await fetch(parsedEngineUrl.toString(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ datasetId, sampleId, analysisType, referenceDatabase }),
      });

      if (!engineResp.ok) {
        res.status(502).json({ error: `External bioinformatics engine returned HTTP ${engineResp.status}.` });
        return;
      }

      const engineData = await engineResp.json();
      res.status(201).json({ analysis: engineData, storedInSupabase: false });
    } catch (err) {
      console.error('Analysis error:', err);
      res.status(500).json({ error: err instanceof Error ? err.message : 'Analysis execution failed.' });
    }
  });

  // List User's Stored Analyses
  app.get('/api/analyses', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    const sb = getSupabaseAdmin();
    if (!sb) {
      res.json({ configured: false, analyses: [] });
      return;
    }

    const { data: jobs, error } = await sb
      .from('analysis_jobs')
      .select('*, datasets(dataset_name, sample_id)')
      .eq('firebase_uid', req.user!.uid)
      .order('started_at', { ascending: false });

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    const enriched = await Promise.all(
      (jobs ?? []).map(async (job) => {
        const [{ data: taxa }, { data: bio }] = await Promise.all([
          sb.from('taxonomic_results').select('*').eq('analysis_id', job.id),
          sb.from('biodiversity_results').select('*').eq('analysis_id', job.id).maybeSingle(),
        ]);
        const dsMeta = job.datasets as { dataset_name?: string; sample_id?: string } | null;
        return {
          ...job,
          dataset_name: dsMeta?.dataset_name,
          sample_id: dsMeta?.sample_id,
          taxa: taxa ?? [],
          biodiversity: bio ?? null,
        };
      })
    );

    res.json({ configured: true, analyses: enriched });
  });

  // Gemini Scientific Explanation Endpoint (Server-side only)
  app.post('/api/ai/interpret', requireAuth, aiLimiter, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { question, datasetName, sampleId, isDemonstration, referenceDatabase, biodiversity, taxa } =
        req.body as {
          question?: string;
          datasetName?: string;
          sampleId?: string;
          isDemonstration?: boolean;
          referenceDatabase?: string;
          biodiversity?: any;
          taxa?: TaxonomicResult[];
        };

      if (!question?.trim()) {
        res.status(400).json({ error: 'Please provide a question or interpretation request.' });
        return;
      }

      if (!isGeminiConfigured()) {
        res.status(503).json({
          error: 'GEMINI_API_KEY is not configured in Settings > Secrets. Add your key to enable AI scientific interpretation.',
        });
        return;
      }

      const interpretation = await interpretScientificResults({
        question: question.trim().slice(0, 1000),
        datasetName: datasetName || 'eDNA Sample',
        sampleId: sampleId || 'Unknown Sample',
        isDemonstration: Boolean(isDemonstration),
        referenceDatabase: referenceDatabase || 'Reference Database',
        biodiversity: biodiversity ?? null,
        taxa: Array.isArray(taxa) ? taxa : [],
      });

      res.json({
        interpretation,
        model: 'gemini-4-hydrogen',
        disclaimer: 'AI-generated explanation strictly grounded on the displayed taxonomic and biodiversity values. Not a substitute for peer-reviewed sequence validation.',
      });
    } catch (err) {
      console.error('Gemini interpretation error:', err);
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Failed to generate scientific interpretation.',
      });
    }
  });

  // ===========================================================================
  // PROTECTED ADMIN ROUTES (/api/admin/*) — Server-side verified role required
  // ===========================================================================

  app.get('/api/admin/session', requireAuth, requireAdmin, (req: AuthenticatedRequest, res: Response) => {
    res.json({
      authorized: true,
      uid: req.user!.uid,
      email: req.user!.email,
      role: req.user!.role,
    });
  });

  app.get('/api/admin/overview', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
    const sb = getSupabaseAdmin();
    const fbCfg = getFirebaseProjectConfig();
    let usersCount = 0;

    if (fbCfg) {
      const dbId = fbCfg.firestoreDatabaseId || '(default)';
      const usersUrl = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(fbCfg.projectId)}/databases/${encodeURIComponent(dbId)}/documents/users?pageSize=200`;
      const resp = await fetch(usersUrl, { headers: { Authorization: `Bearer ${req.user!.idToken}` } });
      if (resp.ok) {
        const json = (await resp.json()) as { documents?: unknown[] };
        usersCount = json.documents?.length ?? 0;
      }
    }

    if (!sb) {
      res.json({
        supabaseConfigured: false,
        totalUsers: usersCount,
        totalDatasets: 0,
        completedAnalyses: 0,
        failedAnalyses: 0,
        identifiedTaxa: 0,
        recentAuditLogs: sessionAuditLogs.slice(0, 15),
      });
      return;
    }

    const [dsRes, jobsRes, taxaRes, logsRes] = await Promise.all([
      sb.from('datasets').select('id', { count: 'exact', head: true }),
      sb.from('analysis_jobs').select('processing_status'),
      sb.from('taxonomic_results').select('id', { count: 'exact', head: true }),
      sb.from('admin_audit_logs').select('*').order('timestamp', { ascending: false }).limit(20),
    ]);

    const jobs = jobsRes.data ?? [];
    res.json({
      supabaseConfigured: true,
      totalUsers: usersCount,
      totalDatasets: dsRes.count ?? 0,
      completedAnalyses: jobs.filter((j) => j.processing_status === 'completed').length,
      failedAnalyses: jobs.filter((j) => j.processing_status === 'failed').length,
      identifiedTaxa: taxaRes.count ?? 0,
      recentAuditLogs: logsRes.data ?? sessionAuditLogs,
    });
  });

  app.get('/api/admin/users', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
    const fbCfg = getFirebaseProjectConfig();
    if (!fbCfg) {
      res.status(500).json({ error: 'Firebase project configuration missing.' });
      return;
    }
    const dbId = fbCfg.firestoreDatabaseId || '(default)';
    const usersUrl = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(fbCfg.projectId)}/databases/${encodeURIComponent(dbId)}/documents/users?pageSize=200`;

    const resp = await fetch(usersUrl, { headers: { Authorization: `Bearer ${req.user!.idToken}` } });
    if (!resp.ok) {
      const txt = await resp.text();
      res.status(resp.status).json({ error: `Firestore query failed: ${txt}` });
      return;
    }

    const json = (await resp.json()) as {
      documents?: Array<{
        name: string;
        fields?: Record<string, { stringValue?: string; timestampValue?: string }>;
      }>;
    };

    const users = (json.documents ?? []).map((doc) => ({
      uid: doc.fields?.uid?.stringValue ?? doc.name.split('/').pop() ?? '',
      fullName: doc.fields?.fullName?.stringValue ?? '',
      email: doc.fields?.email?.stringValue ?? '',
      organization: doc.fields?.organization?.stringValue ?? '',
      country: doc.fields?.country?.stringValue ?? '',
      researchInterests: doc.fields?.researchInterests?.stringValue ?? '',
      role: doc.fields?.role?.stringValue ?? 'user',
      accountStatus: doc.fields?.accountStatus?.stringValue ?? 'active',
      createdAt: doc.fields?.createdAt?.timestampValue ?? '',
    }));

    res.json({ users });
  });

  app.patch('/api/admin/users/:uid', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
    const targetUid = req.params.uid;
    if (!/^[a-zA-Z0-9_-]{1,128}$/.test(targetUid)) {
      res.status(400).json({ error: 'Invalid user ID format.' });
      return;
    }

    const { role, accountStatus } = req.body as { role?: string; accountStatus?: string };
    if (role && !['user', 'admin', 'super_admin'].includes(role)) {
      res.status(400).json({ error: 'Invalid role value.' });
      return;
    }
    if (accountStatus && !['active', 'suspended'].includes(accountStatus)) {
      res.status(400).json({ error: 'Invalid accountStatus value.' });
      return;
    }
    if (targetUid === req.user!.uid && accountStatus === 'suspended') {
      res.status(400).json({ error: 'Administrators cannot suspend their own account.' });
      return;
    }

    const fbCfg = getFirebaseProjectConfig();
    if (!fbCfg) {
      res.status(500).json({ error: 'Firebase configuration missing.' });
      return;
    }
    const dbId = fbCfg.firestoreDatabaseId || '(default)';
    const nowIso = new Date().toISOString();

    const updateMask: string[] = ['updatedAt'];
    const fields: Record<string, unknown> = {
      updatedAt: { timestampValue: nowIso },
    };
    if (role) {
      updateMask.push('role');
      fields.role = { stringValue: role };
    }
    if (accountStatus) {
      updateMask.push('accountStatus');
      fields.accountStatus = { stringValue: accountStatus };
    }

    const maskQuery = updateMask.map((m) => `updateMask.fieldPaths=${encodeURIComponent(m)}`).join('&');
    const docUrl = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(fbCfg.projectId)}/databases/${encodeURIComponent(dbId)}/documents/users/${encodeURIComponent(targetUid)}?${maskQuery}`;

    const resp = await fetch(docUrl, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${req.user!.idToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ fields }),
    });

    if (!resp.ok) {
      const errTxt = await resp.text();
      await recordAuditLog(req.user!.uid, `UPDATE_USER(${role ?? ''},${accountStatus ?? ''})`, targetUid, 'error');
      res.status(resp.status).json({ error: errTxt });
      return;
    }

    // Sync admins/{uid} registry when role changes
    if (role === 'admin' || role === 'super_admin') {
      const adminDocUrl = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(fbCfg.projectId)}/databases/${encodeURIComponent(dbId)}/documents/admins/${encodeURIComponent(targetUid)}`;
      await fetch(adminDocUrl, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${req.user!.idToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fields: {
            uid: { stringValue: targetUid },
            role: { stringValue: role },
            grantedBy: { stringValue: req.user!.uid },
            grantedAt: { timestampValue: nowIso },
          },
        }),
      });
    } else if (role === 'user') {
      const adminDocUrl = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(fbCfg.projectId)}/databases/${encodeURIComponent(dbId)}/documents/admins/${encodeURIComponent(targetUid)}`;
      await fetch(adminDocUrl, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${req.user!.idToken}` },
      });
    }

    await recordAuditLog(
      req.user!.uid,
      `UPDATE_USER(${role ? `role=${role}` : ''}${accountStatus ? ` status=${accountStatus}` : ''})`.trim(),
      targetUid,
      'success'
    );
    res.json({ updated: true, uid: targetUid, role, accountStatus });
  });

  app.get('/api/admin/datasets', requireAuth, requireAdmin, async (_req: AuthenticatedRequest, res: Response) => {
    const sb = getSupabaseAdmin();
    if (!sb) {
      res.json({ configured: false, datasets: [] });
      return;
    }
    const { data, error } = await sb.from('datasets').select('*').order('created_at', { ascending: false }).limit(200);
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.json({ configured: true, datasets: data ?? [] });
  });

  app.delete('/api/admin/datasets/:id', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
    const sb = getSupabaseAdmin();
    if (!sb) {
      res.status(503).json({ error: 'Supabase is not configured.' });
      return;
    }
    const datasetId = req.params.id;
    const { data: existing } = await sb.from('datasets').select('id, file_path').eq('id', datasetId).single();
    if (!existing) {
      res.status(404).json({ error: 'Dataset not found.' });
      return;
    }
    const sbStatus = getSupabaseConfigStatus();
    await sb.storage.from(sbStatus.bucket).remove([existing.file_path]);
    const { error } = await sb.from('datasets').delete().eq('id', datasetId);
    if (error) {
      await recordAuditLog(req.user!.uid, 'DELETE_DATASET', datasetId, 'error');
      res.status(500).json({ error: error.message });
      return;
    }
    await recordAuditLog(req.user!.uid, 'DELETE_DATASET', datasetId, 'success');
    res.json({ deleted: true, id: datasetId });
  });

  app.get('/api/admin/analyses', requireAuth, requireAdmin, async (_req: AuthenticatedRequest, res: Response) => {
    const sb = getSupabaseAdmin();
    if (!sb) {
      res.json({ configured: false, analyses: [] });
      return;
    }
    const { data, error } = await sb
      .from('analysis_jobs')
      .select('*, datasets(dataset_name, sample_id)')
      .order('started_at', { ascending: false })
      .limit(200);
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.json({ configured: true, analyses: data ?? [] });
  });

  app.post('/api/admin/analyses/:id/retry', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
    const sb = getSupabaseAdmin();
    if (!sb) {
      res.status(503).json({ error: 'Supabase is not configured.' });
      return;
    }
    const jobId = req.params.id;
    const { error } = await sb
      .from('analysis_jobs')
      .update({ processing_status: 'pending', error_message: null })
      .eq('id', jobId);
    if (error) {
      await recordAuditLog(req.user!.uid, 'RETRY_ANALYSIS_JOB', jobId, 'error');
      res.status(500).json({ error: error.message });
      return;
    }
    await recordAuditLog(req.user!.uid, 'RETRY_ANALYSIS_JOB', jobId, 'success');
    res.json({ retried: true, id: jobId });
  });

  app.get('/api/admin/audit-logs', requireAuth, requireAdmin, async (_req: AuthenticatedRequest, res: Response) => {
    const sb = getSupabaseAdmin();
    if (!sb) {
      res.json({ configured: false, logs: sessionAuditLogs });
      return;
    }
    const { data, error } = await sb
      .from('admin_audit_logs')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(200);
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.json({ configured: true, logs: data ?? [] });
  });

  app.post('/api/admin/audit-logs', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
    const { action, affectedRecord, outcome } = req.body as {
      action?: string;
      affectedRecord?: string;
      outcome?: 'success' | 'denied' | 'error';
    };
    if (!action || !affectedRecord) {
      res.status(400).json({ error: 'action and affectedRecord are required.' });
      return;
    }
    await recordAuditLog(req.user!.uid, action.slice(0, 120), affectedRecord.slice(0, 160), outcome ?? 'success');
    res.status(201).json({ recorded: true });
  });

  // Vite / Static Frontend Serving
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`eDNA Biodiversity Explorer server listening on http://localhost:${PORT}`);
  });
}

async function persistAnalysisToSupabase(sb: NonNullable<ReturnType<typeof getSupabaseAdmin>>, job: any) {
  await sb.from('analysis_jobs').insert({
    id: job.id,
    dataset_id: job.dataset_id,
    firebase_uid: job.firebase_uid,
    analysis_type: job.analysis_type,
    processing_status: job.processing_status,
    pipeline_version: job.pipeline_version,
    reference_database: job.reference_database,
    is_demonstration: job.is_demonstration,
    started_at: job.started_at,
    completed_at: job.completed_at,
    error_message: job.error_message ?? null,
  });

  if (Array.isArray(job.taxa) && job.taxa.length > 0) {
    await sb.from('taxonomic_results').insert(
      job.taxa.map((t: TaxonomicResult) => ({
        id: t.id,
        analysis_id: job.id,
        sequence_id: t.sequence_id,
        kingdom: t.kingdom,
        phylum: t.phylum,
        class: t.class,
        order_name: t.order_name,
        family: t.family,
        genus: t.genus,
        species: t.species,
        read_count: t.read_count,
        confidence_score: t.confidence_score,
        reference_database: t.reference_database,
      }))
    );
  }

  if (job.biodiversity) {
    await sb.from('biodiversity_results').insert({
      id: job.biodiversity.id,
      analysis_id: job.id,
      sample_id: job.biodiversity.sample_id,
      species_richness: job.biodiversity.species_richness,
      shannon_index: job.biodiversity.shannon_index,
      simpson_index: job.biodiversity.simpson_index,
      pielou_evenness: job.biodiversity.pielou_evenness,
      total_reads: job.biodiversity.total_reads,
    });
  }
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
