import React, { useState } from 'react';
import { BookOpen, Loader2, Send } from 'lucide-react';
import { apiFetch } from '../lib/apiClient.ts';
import type { AnalysisJob } from '../types/edna.ts';

const QUICK_PROMPTS = [
  'Summarize the ecological biodiversity and dominant taxonomic groups in this sample.',
  'Explain what the Shannon, Simpson, and Pielou values indicate about community evenness.',
  'Describe the methodological limitations of interpreting raw eDNA read counts here.',
];

export function GeminiInterpreterPanel({ analysis }: { analysis: AnalysisJob }) {
  const [question, setQuestion] = useState(QUICK_PROMPTS[0]);
  const [answer, setAnswer] = useState<string | null>(null);
  const [disclaimer, setDisclaimer] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleInterpret = async (promptText?: string) => {
    const q = (promptText ?? question).trim();
    if (!q) return;
    setLoading(true);
    setError(null);
    try {
      const resp = await apiFetch<{
        interpretation: string;
        model: string;
        disclaimer: string;
      }>('/api/ai/interpret', {
        method: 'POST',
        body: JSON.stringify({
          question: q,
          datasetName: analysis.dataset_name || analysis.dataset_id,
          sampleId: analysis.sample_id || analysis.biodiversity?.sample_id || 'Sample',
          isDemonstration: analysis.is_demonstration,
          referenceDatabase: analysis.reference_database,
          biodiversity: analysis.biodiversity ?? null,
          taxa: analysis.taxa ?? [],
        }),
      });
      setAnswer(resp.interpretation);
      setDisclaimer(resp.disclaimer);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to generate explanation.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <div className="flex items-center gap-2 text-[#123D2B]">
            <BookOpen className="w-4 h-4 text-[#16A6A0]" />
            <h3 className="text-base font-semibold">Scientific Results Interpreter</h3>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            AI-assisted ecological explanation grounded strictly on your displayed taxonomic and diversity outputs.
          </p>
        </div>
        <span className="text-xs font-mono text-[#16A6A0]">Gemini Interpretation Layer</span>
      </div>

      <div className="flex flex-wrap gap-2 mb-3">
        {QUICK_PROMPTS.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => {
              setQuestion(p);
              void handleInterpret(p);
            }}
            className="text-left text-xs px-3 py-1.5 rounded-lg border border-slate-200 bg-[#F5F8F5] text-[#172B22] hover:border-[#16834A] transition-colors"
          >
            {p}
          </button>
        ))}
      </div>

      <div className="flex gap-2">
        <input
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ask about taxa, Shannon H', Simpson 1-D, or ecological significance..."
          className="flex-1 px-3.5 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:border-[#16834A]"
        />
        <button
          type="button"
          disabled={loading}
          onClick={() => void handleInterpret()}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#16834A] text-white text-sm font-medium hover:bg-[#123D2B] disabled:opacity-50 transition-colors whitespace-nowrap shrink-0"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          Explain Results
        </button>
      </div>

      {error && (
        <div className="mt-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-800">
          {error}
        </div>
      )}

      {answer && (
        <div className="mt-4 p-4 rounded-lg bg-[#F5F8F5] border border-slate-200">
          <div className="text-xs font-semibold text-[#123D2B] mb-2">
            AI-Generated Interpretation {analysis.is_demonstration ? '(Based on Demonstration Data)' : ''}
          </div>
          <div className="text-sm text-[#172B22] whitespace-pre-wrap leading-relaxed">{answer}</div>
          {disclaimer && <p className="text-[11px] text-slate-500 mt-3 pt-2 border-t border-slate-200">{disclaimer}</p>}
        </div>
      )}
    </div>
  );
}
