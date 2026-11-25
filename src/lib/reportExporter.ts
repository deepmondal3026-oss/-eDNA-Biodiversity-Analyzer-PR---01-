import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { AnalysisJob } from '../types/edna.ts';

export function exportAnalysisToCsv(analysis: AnalysisJob): void {
  const taxa = analysis.taxa ?? [];
  const headers = [
    'sequence_id',
    'kingdom',
    'phylum',
    'class',
    'order_name',
    'family',
    'genus',
    'species',
    'read_count',
    'confidence_score',
    'reference_database',
    'is_demonstration',
  ];

  const rows = taxa.map((t) =>
    [
      t.sequence_id,
      t.kingdom,
      t.phylum,
      t.class,
      t.order_name,
      t.family,
      t.genus,
      t.species,
      String(t.read_count),
      String(t.confidence_score),
      t.reference_database,
      String(analysis.is_demonstration),
    ]
      .map((val) => `"${String(val).replace(/"/g, '""')}"`)
      .join(',')
  );

  const csvContent = [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `edna-report-${analysis.sample_id || analysis.id.slice(0, 8)}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function exportAnalysisToPdf(analysis: AnalysisJob, projectName = 'Personal Research Workspace'): void {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();

  // Header band
  doc.setFillColor(18, 61, 43); // #123D2B
  doc.rect(0, 0, pageWidth, 84, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text('eDNA Biodiversity Explorer', 40, 36);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text('Identify. Analyze. Preserve. — Scientific Biodiversity & Taxonomic Report', 40, 56);

  let y = 108;
  doc.setTextColor(23, 43, 34);

  if (analysis.is_demonstration) {
    doc.setFillColor(254, 243, 199);
    doc.rect(40, y, pageWidth - 80, 34, 'F');
    doc.setTextColor(146, 64, 14);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text(
      'DEMONSTRATION DATA NOTICE: Generated from curated reference profiles (no external BLAST/QIIME 2 server connected).',
      50,
      y + 21
    );
    y += 48;
  }

  // Metadata summary
  doc.setTextColor(23, 43, 34);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('1. Dataset & Analysis Metadata', 40, y);
  y += 16;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  const metaLines = [
    `Project: ${projectName}`,
    `Dataset: ${analysis.dataset_name || analysis.dataset_id}`,
    `Sample ID: ${analysis.sample_id || 'N/A'}`,
    `Analysis ID: ${analysis.id}`,
    `Pipeline: ${analysis.pipeline_version} (${analysis.processing_status})`,
    `Reference Database: ${analysis.reference_database}`,
    `Analysis Date: ${new Date(analysis.completed_at || analysis.started_at).toLocaleString()}`,
  ];
  metaLines.forEach((line) => {
    doc.text(line, 40, y);
    y += 14;
  });

  y += 10;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('2. Biodiversity Assessment Summary', 40, y);
  y += 8;

  const bio = analysis.biodiversity;
  autoTable(doc, {
    startY: y,
    head: [['Metric', 'Value', 'Scientific Formula / Interpretation']],
    body: [
      ['Species Richness (S)', String(bio?.species_richness ?? 0), 'Count of distinct assigned taxa in sample'],
      ['Total Sequence Reads (N)', String(bio?.total_reads ?? 0), 'Sum of assigned read counts across taxa'],
      ["Shannon Diversity Index (H')", String(bio?.shannon_index ?? 0), "-sum(p_i * ln(p_i)); reflects richness & evenness"],
      ['Gini-Simpson Index (1 - D)', String(bio?.simpson_index ?? 0), '1 - sum(p_i^2); probability two reads differ in species'],
      ["Pielou's Evenness (J')", String(bio?.pielou_evenness ?? 0), "H' / ln(S); 0 = complete dominance, 1 = equal abundance"],
    ],
    theme: 'grid',
    headStyles: { fillColor: [22, 131, 74], textColor: 255, fontSize: 9 },
    bodyStyles: { fontSize: 8.5, textColor: [23, 43, 34] },
    margin: { left: 40, right: 40 },
  });

  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 22;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('3. Taxonomic Identification Results', 40, y);
  y += 8;

  const taxaRows = (analysis.taxa ?? []).map((t) => [
    t.sequence_id,
    t.phylum,
    t.family,
    t.species,
    String(t.read_count),
    `${(t.confidence_score * 100).toFixed(1)}%`,
    t.reference_database,
  ]);

  autoTable(doc, {
    startY: y,
    head: [['Feature ID', 'Phylum', 'Family', 'Species', 'Reads', 'Confidence', 'Reference DB']],
    body: taxaRows,
    theme: 'striped',
    headStyles: { fillColor: [18, 61, 43], textColor: 255, fontSize: 8.5 },
    bodyStyles: { fontSize: 8, textColor: [23, 43, 34] },
    margin: { left: 40, right: 40 },
  });

  const finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 20;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('4. Methodological Limitations & Scientific Disclaimer', 40, Math.min(finalY, 740));
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  const note =
    analysis.methodology_note ||
    'eDNA metabarcoding read counts reflect relative DNA template proportions after extraction and PCR amplification. Primer bias, differential DNA shedding rates, and reference database completeness prevent equating raw read counts directly to absolute organism abundance or biomass.';
  const wrapped = doc.splitTextToSize(note, pageWidth - 80);
  doc.text(wrapped, 40, Math.min(finalY + 14, 756));

  doc.save(`edna-biodiversity-report-${analysis.sample_id || analysis.id.slice(0, 8)}.pdf`);
}
