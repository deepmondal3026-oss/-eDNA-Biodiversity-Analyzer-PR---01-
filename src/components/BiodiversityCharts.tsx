import React, { useMemo, useState } from 'react';
import type { AnalysisJob, TaxonomicResult } from '../types/edna.ts';

const PALETTE = ['#16834A', '#16A6A0', '#123D2B', '#75C943', '#2E7D6B', '#4B9B76', '#84A98C'];

export function TaxonomicDistributionChart({ taxa }: { taxa: TaxonomicResult[] }) {
  const [groupBy, setGroupBy] = useState<'phylum' | 'class' | 'family'>('phylum');
  const [hovered, setHovered] = useState<string | null>(null);

  const grouped = useMemo(() => {
    const map = new Map<string, { reads: number; speciesSet: Set<string> }>();
    let total = 0;
    for (const t of taxa) {
      const key = t[groupBy] || 'Unassigned';
      const entry = map.get(key) ?? { reads: 0, speciesSet: new Set() };
      entry.reads += t.read_count;
      entry.speciesSet.add(t.species);
      map.set(key, entry);
      total += t.read_count;
    }
    return {
      total,
      rows: Array.from(map.entries())
        .map(([name, info]) => ({
          name,
          reads: info.reads,
          speciesCount: info.speciesSet.size,
          pct: total > 0 ? (info.reads / total) * 100 : 0,
        }))
        .sort((a, b) => b.reads - a.reads)
        .slice(0, 8),
    };
  }, [taxa, groupBy]);

  if (taxa.length === 0) {
    return (
      <div className="p-6 text-sm text-slate-500 text-center">
        No taxonomic distribution records available for this selection.
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h4 className="text-sm font-semibold text-[#172B22]">Taxonomic Read Share</h4>
          <p className="text-xs text-slate-500">Relative read proportions grouped by taxonomic rank</p>
        </div>
        <div className="flex items-center gap-1 p-1 bg-[#F5F8F5] border border-slate-200 rounded-lg">
          {(['phylum', 'class', 'family'] as const).map((rank) => (
            <button
              key={rank}
              type="button"
              onClick={() => setGroupBy(rank)}
              className={`px-2.5 py-1 text-xs font-medium rounded-md capitalize transition-colors whitespace-nowrap shrink-0 ${
                groupBy === rank
                  ? 'bg-white text-[#123D2B] shadow-xs border border-slate-200'
                  : 'text-slate-600 hover:text-[#172B22]'
              }`}
            >
              {rank}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        {grouped.rows.map((row, idx) => {
          const color = PALETTE[idx % PALETTE.length];
          const isActive = hovered === row.name;
          return (
            <div
              key={row.name}
              onMouseEnter={() => setHovered(row.name)}
              onMouseLeave={() => setHovered(null)}
              className="group"
            >
              <div className="flex items-baseline justify-between text-xs mb-1">
                <span className="font-medium text-[#172B22] truncate pr-3">{row.name}</span>
                <span className="font-mono tabular-nums text-slate-600 shrink-0">
                  {row.reads.toLocaleString()} reads · {row.speciesCount} taxa · {row.pct.toFixed(1)}%
                </span>
              </div>
              <div className="h-2.5 w-full bg-[#F5F8F5] rounded-sm overflow-hidden border border-slate-200/70">
                <div
                  className="h-full transition-all duration-300"
                  style={{
                    width: `${Math.max(2, row.pct)}%`,
                    backgroundColor: color,
                    opacity: hovered && !isActive ? 0.55 : 1,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function SpeciesRichnessBarChart({ taxa }: { taxa: TaxonomicResult[] }) {
  const sorted = useMemo(
    () => [...taxa].sort((a, b) => b.read_count - a.read_count).slice(0, 10),
    [taxa]
  );
  const maxReads = Math.max(1, ...sorted.map((t) => t.read_count));

  if (sorted.length === 0) return null;

  return (
    <div>
      <div className="mb-4">
        <h4 className="text-sm font-semibold text-[#172B22]">Top Detected Taxa by Read Count</h4>
        <p className="text-xs text-slate-500">
          Relative sequence abundance (note: subject to PCR &amp; primer efficiency bias)
        </p>
      </div>
      <div className="w-full overflow-x-auto">
        <svg viewBox="0 0 560 220" className="w-full h-56" role="img" aria-label="Species read count distribution chart">
          {[0, 0.25, 0.5, 0.75, 1].map((tick) => {
            const y = 175 - tick * 145;
            return (
              <g key={tick}>
                <line x1="48" y1={y} x2="545" y2={y} stroke="#E2E8F0" strokeDasharray="3 3" />
                <text x="42" y={y + 3} textAnchor="end" className="fill-slate-400 text-[9px] font-mono">
                  {Math.round(maxReads * tick)}
                </text>
              </g>
            );
          })}
          {sorted.map((item, idx) => {
            const barWidth = 34;
            const gap = 14;
            const x = 62 + idx * (barWidth + gap);
            const h = (item.read_count / maxReads) * 145;
            const y = 175 - h;
            const shortName = item.species.split(' ').slice(0, 2).map((w, wi) => (wi === 0 ? `${w[0]}.` : w)).join(' ');
            return (
              <g key={item.id}>
                <rect
                  x={x}
                  y={y}
                  width={barWidth}
                  height={Math.max(2, h)}
                  rx="3"
                  fill={PALETTE[idx % PALETTE.length]}
                />
                <text
                  x={x + barWidth / 2}
                  y={y - 5}
                  textAnchor="middle"
                  className="fill-[#172B22] text-[9px] font-mono"
                >
                  {item.read_count}
                </text>
                <text
                  x={x + barWidth / 2}
                  y={192}
                  textAnchor="middle"
                  className="fill-slate-600 text-[8.5px]"
                >
                  {shortName.slice(0, 10)}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

export function DiversityIndexComparisonChart({ analyses }: { analyses: AnalysisJob[] }) {
  const valid = analyses.filter((a) => a.biodiversity);
  if (valid.length === 0) return null;

  return (
    <div>
      <div className="mb-4">
        <h4 className="text-sm font-semibold text-[#172B22]">Alpha Diversity Index Comparison</h4>
        <p className="text-xs text-slate-500">
          Comparing Shannon (H&apos;), Gini-Simpson (1 - D), and Pielou&apos;s Evenness (J&apos;) across analyses
        </p>
      </div>
      <div className="space-y-4">
        {valid.slice(0, 6).map((job) => {
          const bio = job.biodiversity!;
          return (
            <div key={job.id} className="pb-3 border-b border-slate-100 last:border-b-0">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <span className="text-xs font-semibold text-[#172B22] truncate">
                  {job.dataset_name || job.sample_id || job.id.slice(0, 8)}
                </span>
                <span className="text-xs font-mono tabular-nums text-slate-500">
                  S = {bio.species_richness} · N = {bio.total_reads.toLocaleString()}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-3 text-xs">
                <div>
                  <div className="flex justify-between text-slate-600 mb-1">
                    <span>Shannon H&apos;</span>
                    <span className="font-mono tabular-nums font-semibold text-[#123D2B]">
                      {bio.shannon_index.toFixed(3)}
                    </span>
                  </div>
                  <div className="h-1.5 bg-slate-100 rounded-sm overflow-hidden">
                    <div
                      className="h-full bg-[#16834A]"
                      style={{ width: `${Math.min(100, (bio.shannon_index / 4.5) * 100)}%` }}
                    />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-slate-600 mb-1">
                    <span>Simpson 1-D</span>
                    <span className="font-mono tabular-nums font-semibold text-[#123D2B]">
                      {bio.simpson_index.toFixed(3)}
                    </span>
                  </div>
                  <div className="h-1.5 bg-slate-100 rounded-sm overflow-hidden">
                    <div
                      className="h-full bg-[#16A6A0]"
                      style={{ width: `${Math.min(100, bio.simpson_index * 100)}%` }}
                    />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-slate-600 mb-1">
                    <span>Pielou J&apos;</span>
                    <span className="font-mono tabular-nums font-semibold text-[#123D2B]">
                      {bio.pielou_evenness.toFixed(3)}
                    </span>
                  </div>
                  <div className="h-1.5 bg-slate-100 rounded-sm overflow-hidden">
                    <div
                      className="h-full bg-[#75C943]"
                      style={{ width: `${Math.min(100, bio.pielou_evenness * 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function TaxonomicHierarchyTree({ taxa }: { taxa: TaxonomicResult[] }) {
  const tree = useMemo(() => {
    const kingdoms = new Map<string, Map<string, TaxonomicResult[]>>();
    for (const t of taxa) {
      const kMap = kingdoms.get(t.kingdom) ?? new Map<string, TaxonomicResult[]>();
      const list = kMap.get(t.phylum) ?? [];
      list.push(t);
      kMap.set(t.phylum, list);
      kingdoms.set(t.kingdom, kMap);
    }
    return Array.from(kingdoms.entries());
  }, [taxa]);

  if (tree.length === 0) return null;

  return (
    <div>
      <div className="mb-4">
        <h4 className="text-sm font-semibold text-[#172B22]">Taxonomic Lineage Hierarchy</h4>
        <p className="text-xs text-slate-500">Kingdom → Phylum → Family → Species classification tree</p>
      </div>
      <div className="space-y-4">
        {tree.map(([kingdom, phyla]) => (
          <div key={kingdom} className="border border-slate-200 rounded-lg p-4 bg-[#F5F8F5]/60">
            <div className="text-xs font-semibold text-[#123D2B] uppercase tracking-wider mb-3">
              Kingdom: {kingdom}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {Array.from(phyla.entries()).map(([phylum, items]) => (
                <div key={phylum} className="bg-white border border-slate-200 rounded-lg p-3">
                  <div className="flex items-center justify-between text-xs font-semibold text-[#16834A] mb-2">
                    <span>Phylum: {phylum}</span>
                    <span className="font-mono tabular-nums text-slate-500">{items.length} taxa</span>
                  </div>
                  <ul className="space-y-1.5">
                    {items.map((t) => (
                      <li key={t.id} className="flex items-center justify-between text-xs text-slate-700 gap-2">
                        <span className="truncate">
                          <span className="text-slate-400">{t.family} /</span>{' '}
                          <em className="font-medium text-[#172B22]">{t.species}</em>
                        </span>
                        <span className="font-mono tabular-nums text-slate-500 shrink-0">
                          {(t.confidence_score * 100).toFixed(0)}%
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
