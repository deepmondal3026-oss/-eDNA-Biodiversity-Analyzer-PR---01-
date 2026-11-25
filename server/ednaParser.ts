import crypto from 'node:crypto';
import type { AnalysisJob, BiodiversityResult, SequenceQCSummary, TaxonomicResult } from '../src/types/edna.ts';

export function calculateBiodiversityIndices(
  taxa: Array<{ species: string; read_count: number }>,
  analysisId: string,
  sampleId: string
): BiodiversityResult {
  const validTaxa = taxa.filter((t) => t.read_count > 0 && t.species.trim().length > 0);
  const aggregated = new Map<string, number>();
  for (const t of validTaxa) {
    const key = t.species.trim();
    aggregated.set(key, (aggregated.get(key) ?? 0) + t.read_count);
  }

  const counts = Array.from(aggregated.values());
  const speciesRichness = counts.length;
  const totalReads = counts.reduce((acc, c) => acc + c, 0);

  if (speciesRichness === 0 || totalReads === 0) {
    return {
      id: crypto.randomUUID(),
      analysis_id: analysisId,
      sample_id: sampleId,
      species_richness: 0,
      shannon_index: 0,
      simpson_index: 0,
      pielou_evenness: 0,
      total_reads: 0,
      created_at: new Date().toISOString(),
    };
  }

  // Shannon Diversity Index: H' = -sum(p_i * ln(p_i))
  let shannon = 0;
  // Gini-Simpson Index: 1 - sum(p_i^2)
  let sumPSquared = 0;

  for (const count of counts) {
    const p = count / totalReads;
    if (p > 0) {
      shannon -= p * Math.log(p);
      sumPSquared += p * p;
    }
  }

  const simpson = 1 - sumPSquared;
  const pielou = speciesRichness > 1 ? shannon / Math.log(speciesRichness) : 0;

  return {
    id: crypto.randomUUID(),
    analysis_id: analysisId,
    sample_id: sampleId,
    species_richness: speciesRichness,
    shannon_index: Number(shannon.toFixed(4)),
    simpson_index: Number(simpson.toFixed(4)),
    pielou_evenness: Number(pielou.toFixed(4)),
    total_reads: totalReads,
    created_at: new Date().toISOString(),
  };
}

export function parseEdnaFile(
  filename: string,
  buffer: Buffer
): { qc: SequenceQCSummary; parsedTaxa: TaxonomicResult[] } {
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  const text = buffer.toString('utf8');
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);

  if (ext === 'fasta' || ext === 'fa') {
    const lengths: number[] = [];
    const headers: string[] = [];
    let currentLen = 0;
    let gcCount = 0;
    let nCount = 0;
    let totalBases = 0;

    for (const line of lines) {
      if (line.startsWith('>')) {
        if (currentLen > 0) lengths.push(currentLen);
        currentLen = 0;
        if (headers.length < 5) headers.push(line.slice(1).trim().slice(0, 120));
      } else {
        const seq = line.trim().toUpperCase();
        currentLen += seq.length;
        totalBases += seq.length;
        for (let i = 0; i < seq.length; i++) {
          const ch = seq[i];
          if (ch === 'G' || ch === 'C') gcCount++;
          else if (ch === 'N') nCount++;
        }
      }
    }
    if (currentLen > 0) lengths.push(currentLen);

    const valid = lengths.length > 0 && totalBases > 0;
    return {
      qc: {
        format: ext as 'fasta' | 'fa',
        totalRecords: lengths.length,
        totalBases,
        avgReadLength: lengths.length ? Math.round(totalBases / lengths.length) : 0,
        minReadLength: lengths.length ? Math.min(...lengths) : 0,
        maxReadLength: lengths.length ? Math.max(...lengths) : 0,
        gcContentPercent: totalBases ? Number(((gcCount / totalBases) * 100).toFixed(2)) : 0,
        ambiguousBasePercent: totalBases ? Number(((nCount / totalBases) * 100).toFixed(2)) : 0,
        previewHeaders: headers,
        validationPassed: valid,
        validationNotes: valid
          ? [`Validated ${lengths.length} FASTA sequence records (${totalBases.toLocaleString()} bp).`]
          : ['No valid FASTA sequences (>header + nucleotide lines) detected.'],
      },
      parsedTaxa: [],
    };
  }

  if (ext === 'fastq' || ext === 'fq') {
    const lengths: number[] = [];
    const headers: string[] = [];
    let gcCount = 0;
    let nCount = 0;
    let totalBases = 0;
    let totalQ = 0;
    let q20Count = 0;
    let q30Count = 0;

    for (let i = 0; i + 3 < lines.length; i += 4) {
      const headerLine = lines[i];
      const seqLine = lines[i + 1].trim().toUpperCase();
      const plusLine = lines[i + 2];
      const qualLine = lines[i + 3].trim();
      if (!headerLine.startsWith('@') || !plusLine.startsWith('+')) continue;

      if (headers.length < 5) headers.push(headerLine.slice(1).trim().slice(0, 120));
      lengths.push(seqLine.length);
      totalBases += seqLine.length;

      for (let j = 0; j < seqLine.length; j++) {
        const ch = seqLine[j];
        if (ch === 'G' || ch === 'C') gcCount++;
        else if (ch === 'N') nCount++;
      }

      let readQSum = 0;
      const qLen = Math.min(seqLine.length, qualLine.length);
      for (let j = 0; j < qLen; j++) {
        const q = qualLine.charCodeAt(j) - 33;
        readQSum += q;
        totalQ += q;
      }
      const meanReadQ = qLen > 0 ? readQSum / qLen : 0;
      if (meanReadQ >= 20) q20Count++;
      if (meanReadQ >= 30) q30Count++;
    }

    const valid = lengths.length > 0 && totalBases > 0;
    return {
      qc: {
        format: ext as 'fastq' | 'fq',
        totalRecords: lengths.length,
        totalBases,
        avgReadLength: lengths.length ? Math.round(totalBases / lengths.length) : 0,
        minReadLength: lengths.length ? Math.min(...lengths) : 0,
        maxReadLength: lengths.length ? Math.max(...lengths) : 0,
        gcContentPercent: totalBases ? Number(((gcCount / totalBases) * 100).toFixed(2)) : 0,
        ambiguousBasePercent: totalBases ? Number(((nCount / totalBases) * 100).toFixed(2)) : 0,
        meanPhredScore: totalBases ? Number((totalQ / totalBases).toFixed(2)) : 0,
        q20Percent: lengths.length ? Number(((q20Count / lengths.length) * 100).toFixed(1)) : 0,
        q30Percent: lengths.length ? Number(((q30Count / lengths.length) * 100).toFixed(1)) : 0,
        previewHeaders: headers,
        validationPassed: valid,
        validationNotes: valid
          ? [`Validated ${lengths.length} FASTQ reads with Phred+33 quality scoring.`]
          : ['No valid 4-line FASTQ records detected.'],
      },
      parsedTaxa: [],
    };
  }

  if (ext === 'csv' || ext === 'tsv') {
    const delimiter = ext === 'tsv' ? '\t' : ',';
    const rawHeaders = lines[0]?.split(delimiter).map((h) => h.trim().replace(/^"|"$/g, '')) ?? [];
    const lowerHeaders = rawHeaders.map((h) => h.toLowerCase());
    const dataRows = lines.slice(1);

    const speciesIdx = lowerHeaders.findIndex((h) => ['species', 'taxon', 'organism', 'scientific_name'].includes(h));
    const readsIdx = lowerHeaders.findIndex((h) => ['read_count', 'reads', 'count', 'abundance'].includes(h));
    const seqIdx = lowerHeaders.findIndex((h) => ['sequence_id', 'asv_id', 'otu_id', 'feature_id'].includes(h));
    const kingdomIdx = lowerHeaders.indexOf('kingdom');
    const phylumIdx = lowerHeaders.indexOf('phylum');
    const classIdx = lowerHeaders.indexOf('class');
    const orderIdx = lowerHeaders.findIndex((h) => h === 'order' || h === 'order_name');
    const familyIdx = lowerHeaders.indexOf('family');
    const genusIdx = lowerHeaders.indexOf('genus');
    const confIdx = lowerHeaders.findIndex((h) => ['confidence', 'confidence_score', 'identity'].includes(h));
    const dbIdx = lowerHeaders.indexOf('reference_database');

    const parsedTaxa: TaxonomicResult[] = [];
    if (speciesIdx !== -1) {
      dataRows.slice(0, 500).forEach((row, idx) => {
        const cols = row.split(delimiter).map((c) => c.trim().replace(/^"|"$/g, ''));
        const speciesVal = cols[speciesIdx];
        if (!speciesVal) return;
        const readsRaw = readsIdx !== -1 ? Number(cols[readsIdx]) : 1;
        const confRaw = confIdx !== -1 ? Number(cols[confIdx]) : 0.9;
        parsedTaxa.push({
          id: crypto.randomUUID(),
          analysis_id: 'pending',
          sequence_id: seqIdx !== -1 && cols[seqIdx] ? cols[seqIdx] : `FEAT_${String(idx + 1).padStart(4, '0')}`,
          kingdom: kingdomIdx !== -1 && cols[kingdomIdx] ? cols[kingdomIdx] : 'Eukaryota',
          phylum: phylumIdx !== -1 && cols[phylumIdx] ? cols[phylumIdx] : 'Unassigned',
          class: classIdx !== -1 && cols[classIdx] ? cols[classIdx] : 'Unassigned',
          order_name: orderIdx !== -1 && cols[orderIdx] ? cols[orderIdx] : 'Unassigned',
          family: familyIdx !== -1 && cols[familyIdx] ? cols[familyIdx] : 'Unassigned',
          genus: genusIdx !== -1 && cols[genusIdx] ? cols[genusIdx] : speciesVal.split(' ')[0] || 'Unassigned',
          species: speciesVal,
          read_count: Number.isFinite(readsRaw) && readsRaw > 0 ? Math.round(readsRaw) : 1,
          confidence_score: Number.isFinite(confRaw) ? Math.min(1, Math.max(0, confRaw > 1 ? confRaw / 100 : confRaw)) : 0.9,
          reference_database: dbIdx !== -1 && cols[dbIdx] ? cols[dbIdx] : 'User-Supplied ASV/Taxon Table',
        });
      });
    }

    const valid = rawHeaders.length > 0 && dataRows.length > 0;
    return {
      qc: {
        format: ext as 'csv' | 'tsv',
        totalRecords: dataRows.length,
        totalBases: buffer.length,
        avgReadLength: 0,
        minReadLength: 0,
        maxReadLength: 0,
        gcContentPercent: 0,
        ambiguousBasePercent: 0,
        detectedColumns: rawHeaders,
        hasTaxonTable: parsedTaxa.length > 0,
        previewHeaders: dataRows.slice(0, 5).map((r) => r.slice(0, 120)),
        validationPassed: valid,
        validationNotes: [
          `Parsed ${dataRows.length} tabular records across ${rawHeaders.length} columns.`,
          parsedTaxa.length > 0
            ? `Detected pre-classified taxonomic abundance table (${parsedTaxa.length} taxa rows).`
            : 'No pre-classified species/read_count columns detected; requires bioinformatics assignment.',
        ],
      },
      parsedTaxa,
    };
  }

  return {
    qc: {
      format: 'fasta',
      totalRecords: 0,
      totalBases: 0,
      avgReadLength: 0,
      minReadLength: 0,
      maxReadLength: 0,
      gcContentPercent: 0,
      ambiguousBasePercent: 0,
      previewHeaders: [],
      validationPassed: false,
      validationNotes: ['Unsupported file extension.'],
    },
    parsedTaxa: [],
  };
}

export interface DemonstrationDatasetPreset {
  presetId: string;
  datasetName: string;
  sampleId: string;
  sampleType: string;
  collectionLocation: string;
  collectionDate: string;
  latitude: number;
  longitude: number;
  markerGene: string;
  sequencingPlatform: string;
  referenceDatabase: string;
  description: string;
  taxa: Array<Omit<TaxonomicResult, 'id' | 'analysis_id'>>;
}

export const DEMONSTRATION_PRESETS: DemonstrationDatasetPreset[] = [
  {
    presetId: 'demo-pacific-estuary',
    datasetName: 'Pacific Temperate Estuary eDNA Survey (Demo)',
    sampleId: 'EST-2026-04A',
    sampleType: 'Estuarine Surface Water (1.0 L, 0.45 µm filter)',
    collectionLocation: 'Puget Sound Nisqually Reach, WA',
    collectionDate: '2026-06-14',
    latitude: 47.1056,
    longitude: -122.7042,
    markerGene: '12S rRNA (MiFish-U) & COI',
    sequencingPlatform: 'Illumina MiSeq 2x250 bp',
    referenceDatabase: 'MitoFish v3.95 / BOLD v4 (Demonstration Reference)',
    description: 'Curated demonstration metabarcoding dataset representing temperate Pacific Northwest estuarine vertebrates and benthic invertebrates.',
    taxa: [
      { sequence_id: 'ASV_001', kingdom: 'Animalia', phylum: 'Chordata', class: 'Actinopteri', order_name: 'Salmoniformes', family: 'Salmonidae', genus: 'Oncorhynchus', species: 'Oncorhynchus tshawytscha', read_count: 1840, confidence_score: 0.99, reference_database: 'MitoFish v3.95 (Demo)' },
      { sequence_id: 'ASV_002', kingdom: 'Animalia', phylum: 'Chordata', class: 'Actinopteri', order_name: 'Clupeiformes', family: 'Clupeidae', genus: 'Clupea', species: 'Clupea pallasii', read_count: 2410, confidence_score: 0.98, reference_database: 'MitoFish v3.95 (Demo)' },
      { sequence_id: 'ASV_003', kingdom: 'Animalia', phylum: 'Chordata', class: 'Actinopteri', order_name: 'Gasterosteiformes', family: 'Gasterosteidae', genus: 'Gasterosteus', species: 'Gasterosteus aculeatus', read_count: 1120, confidence_score: 0.97, reference_database: 'MitoFish v3.95 (Demo)' },
      { sequence_id: 'ASV_004', kingdom: 'Animalia', phylum: 'Chordata', class: 'Mammalia', order_name: 'Carnivora', family: 'Phocidae', genus: 'Phoca', species: 'Phoca vitulina', read_count: 315, confidence_score: 0.96, reference_database: 'NCBI RefSeq (Demo)' },
      { sequence_id: 'ASV_005', kingdom: 'Animalia', phylum: 'Mollusca', class: 'Bivalvia', order_name: 'Ostreida', family: 'Ostreidae', genus: 'Ostrea', species: 'Ostrea lurida', read_count: 980, confidence_score: 0.95, reference_database: 'BOLD v4 (Demo)' },
      { sequence_id: 'ASV_006', kingdom: 'Animalia', phylum: 'Arthropoda', class: 'Malacostraca', order_name: 'Decapoda', family: 'Cancridae', genus: 'Metacarcinus', species: 'Metacarcinus magister', read_count: 760, confidence_score: 0.94, reference_database: 'BOLD v4 (Demo)' },
      { sequence_id: 'ASV_007', kingdom: 'Animalia', phylum: 'Chordata', class: 'Actinopteri', order_name: 'Pleuronectiformes', family: 'Pleuronectidae', genus: 'Platichthys', species: 'Platichthys stellatus', read_count: 640, confidence_score: 0.97, reference_database: 'MitoFish v3.95 (Demo)' },
      { sequence_id: 'ASV_008', kingdom: 'Plantae', phylum: 'Tracheophyta', class: 'Liliopsida', order_name: 'Alismatales', family: 'Zosteraceae', genus: 'Zostera', species: 'Zostera marina', read_count: 1450, confidence_score: 0.99, reference_database: 'SILVA 138.1 (Demo)' },
    ],
  },
  {
    presetId: 'demo-alpine-stream',
    datasetName: 'Alpine Headwater Macroinvertebrate Assay (Demo)',
    sampleId: 'ALP-2026-11B',
    sampleType: 'Freshwater Riffle Composite (2.0 L)',
    collectionLocation: 'Upper Rhone Alpine Basin, Valais',
    collectionDate: '2026-07-08',
    latitude: 46.3189,
    longitude: 7.9882,
    markerGene: 'COI (BF2/BR2)',
    sequencingPlatform: 'Oxford Nanopore MinION R10.4',
    referenceDatabase: 'BOLD v4 / Midori2 (Demonstration Reference)',
    description: 'Demonstration freshwater benthic macroinvertebrate and salmonid bioindicator dataset for ecological stream quality assessment.',
    taxa: [
      { sequence_id: 'ASV_101', kingdom: 'Animalia', phylum: 'Arthropoda', class: 'Insecta', order_name: 'Ephemeroptera', family: 'Baetidae', genus: 'Baetis', species: 'Baetis alpinus', read_count: 1620, confidence_score: 0.98, reference_database: 'BOLD v4 (Demo)' },
      { sequence_id: 'ASV_102', kingdom: 'Animalia', phylum: 'Arthropoda', class: 'Insecta', order_name: 'Plecoptera', family: 'Nemouridae', genus: 'Protonemura', species: 'Protonemura intricata', read_count: 910, confidence_score: 0.95, reference_database: 'BOLD v4 (Demo)' },
      { sequence_id: 'ASV_103', kingdom: 'Animalia', phylum: 'Arthropoda', class: 'Insecta', order_name: 'Trichoptera', family: 'Rhyacophilidae', genus: 'Rhyacophila', species: 'Rhyacophila dorsalis', read_count: 740, confidence_score: 0.94, reference_database: 'BOLD v4 (Demo)' },
      { sequence_id: 'ASV_104', kingdom: 'Animalia', phylum: 'Chordata', class: 'Actinopteri', order_name: 'Salmoniformes', family: 'Salmonidae', genus: 'Salmo', species: 'Salmo trutta', read_count: 1290, confidence_score: 0.99, reference_database: 'MitoFish v3.95 (Demo)' },
      { sequence_id: 'ASV_105', kingdom: 'Animalia', phylum: 'Arthropoda', class: 'Insecta', order_name: 'Diptera', family: 'Simuliidae', genus: 'Simulium', species: 'Simulium variegatum', read_count: 480, confidence_score: 0.91, reference_database: 'BOLD v4 (Demo)' },
      { sequence_id: 'ASV_106', kingdom: 'Animalia', phylum: 'Annelida', class: 'Clitellata', order_name: 'Haplotaxida', family: 'Naididae', genus: 'Tubifex', species: 'Tubifex tubifex', read_count: 210, confidence_score: 0.89, reference_database: 'Midori2 (Demo)' },
    ],
  },
  {
    presetId: 'demo-coral-reef',
    datasetName: 'Tropical Reef 18S Eukaryotic Community (Demo)',
    sampleId: 'CRF-2026-02C',
    sampleType: 'Subsurface Reef Crest Water (10 m depth)',
    collectionLocation: 'Moorea Outer Reef Slope, French Polynesia',
    collectionDate: '2026-08-22',
    latitude: -17.4792,
    longitude: -149.8264,
    markerGene: '18S rRNA V4 & 12S',
    sequencingPlatform: 'Illumina NovaSeq 6000',
    referenceDatabase: 'PR2 v5.0 / ReefGenomics (Demonstration Reference)',
    description: 'Demonstration marine coral-reef eukaryotic eDNA survey covering scleractinian corals, reef fishes, echinoderms, and dinoflagellate symbionts.',
    taxa: [
      { sequence_id: 'ASV_201', kingdom: 'Animalia', phylum: 'Cnidaria', class: 'Anthozoa', order_name: 'Scleractinia', family: 'Acroporidae', genus: 'Acropora', species: 'Acropora hyacinthus', read_count: 2150, confidence_score: 0.97, reference_database: 'PR2 v5.0 (Demo)' },
      { sequence_id: 'ASV_202', kingdom: 'Animalia', phylum: 'Cnidaria', class: 'Anthozoa', order_name: 'Scleractinia', family: 'Pocilloporidae', genus: 'Pocillopora', species: 'Pocillopora meandrina', read_count: 1730, confidence_score: 0.96, reference_database: 'PR2 v5.0 (Demo)' },
      { sequence_id: 'ASV_203', kingdom: 'Chromista', phylum: 'Miozoa', class: 'Dinophyceae', order_name: 'Suessiales', family: 'Symbiodiniaceae', genus: 'Cladocopium', species: 'Cladocopium goreaui', read_count: 2890, confidence_score: 0.98, reference_database: 'PR2 v5.0 (Demo)' },
      { sequence_id: 'ASV_204', kingdom: 'Animalia', phylum: 'Chordata', class: 'Actinopteri', order_name: 'Ovalentaria', family: 'Pomacentridae', genus: 'Chromis', species: 'Chromis viridis', read_count: 1340, confidence_score: 0.99, reference_database: 'MitoFish v3.95 (Demo)' },
      { sequence_id: 'ASV_205', kingdom: 'Animalia', phylum: 'Echinodermata', class: 'Echinoidea', order_name: 'Camarodonta', family: 'Echinometridae', genus: 'Echinometra', species: 'Echinometra mathaei', read_count: 680, confidence_score: 0.93, reference_database: 'BOLD v4 (Demo)' },
      { sequence_id: 'ASV_206', kingdom: 'Animalia', phylum: 'Chordata', class: 'Actinopteri', order_name: 'Acanthuriformes', family: 'Acanthuridae', genus: 'Zebrasoma', species: 'Zebrasoma scopas', read_count: 920, confidence_score: 0.97, reference_database: 'MitoFish v3.95 (Demo)' },
      { sequence_id: 'ASV_207', kingdom: 'Animalia', phylum: 'Porifera', class: 'Demospongiae', order_name: 'Haplosclerida', family: 'Chalinidae', genus: 'Haliclona', species: 'Haliclona caerulea', read_count: 410, confidence_score: 0.90, reference_database: 'PR2 v5.0 (Demo)' },
    ],
  },
];

export function buildDemonstrationAnalysis(presetId: string, firebaseUid: string): AnalysisJob {
  const preset = DEMONSTRATION_PRESETS.find((p) => p.presetId === presetId) ?? DEMONSTRATION_PRESETS[0];
  const analysisId = crypto.randomUUID();
  const taxa: TaxonomicResult[] = preset.taxa.map((t) => ({
    ...t,
    id: crypto.randomUUID(),
    analysis_id: analysisId,
  }));
  const biodiversity = calculateBiodiversityIndices(taxa, analysisId, preset.sampleId);
  const now = new Date().toISOString();

  return {
    id: analysisId,
    dataset_id: preset.presetId,
    dataset_name: preset.datasetName,
    sample_id: preset.sampleId,
    firebase_uid: firebaseUid,
    analysis_type: `Demonstration Metabarcoding (${preset.markerGene})`,
    processing_status: 'completed',
    pipeline_version: 'QIIME2/VSEARCH-Demo-Ref-v1',
    reference_database: preset.referenceDatabase,
    is_demonstration: true,
    started_at: now,
    completed_at: now,
    taxa,
    biodiversity,
    methodology_note:
      'DEMONSTRATION MODE: Generated from curated reference eDNA metabarcoding profiles because no external BLAST/QIIME 2 server is configured. Read counts reflect PCR/amplification-biased relative sequence abundance and do not directly equal absolute organism biomass.',
  };
}
