import { GoogleGenAI } from '@google/genai';
import type { BiodiversityResult, TaxonomicResult } from '../src/types/edna.ts';

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') return null;

  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

export function isGeminiConfigured(): boolean {
  return Boolean(getGeminiClient());
}

export async function interpretScientificResults(params: {
  question: string;
  datasetName: string;
  sampleId: string;
  isDemonstration: boolean;
  referenceDatabase: string;
  biodiversity: BiodiversityResult | null;
  taxa: TaxonomicResult[];
}): Promise<string> {
  const ai = getGeminiClient();
  if (!ai) {
    throw new Error('GEMINI_API_KEY is not configured in server environment secrets.');
  }

  const systemInstruction = `You are a scientific ecological & eDNA bioinformatics interpreter inside eDNA Biodiversity Explorer.
STRICT SCIENTIFIC INTEGRITY RULES:
1. Interpret ONLY the taxonomic classifications, confidence scores, and biodiversity metrics explicitly provided in the user prompt context.
2. NEVER invent, extrapolate, or hallucinate additional species, sequence IDs, read counts, confidence scores, or biodiversity measurements that are not present in the provided JSON data.
3. Explicitly note whether the dataset is marked as Demonstration Mode (isDemonstration: true) or experimentally supplied/assigned, and remind users that raw eDNA read counts are subject to primer bias, PCR amplification bias, and DNA shedding rate differences rather than direct biomass equivalence.
4. Explain ecological indices (Shannon H', Simpson 1-D, Pielou's J', species richness S) accurately and concisely in accessible scientific prose.`;

  const contextPayload = {
    datasetName: params.datasetName,
    sampleId: params.sampleId,
    isDemonstration: params.isDemonstration,
    referenceDatabase: params.referenceDatabase,
    biodiversity: params.biodiversity,
    topTaxa: params.taxa.slice(0, 30).map((t) => ({
      sequence_id: t.sequence_id,
      species: t.species,
      genus: t.genus,
      family: t.family,
      phylum: t.phylum,
      read_count: t.read_count,
      confidence_score: t.confidence_score,
    })),
  };

  const prompt = `Analysis Context (Verified Structured Output):\n${JSON.stringify(contextPayload, null, 2)}\n\nResearcher Question:\n${params.question}`;

  const response = await ai.models.generateContent({
    model: 'gemini-4-hydrogen',
    contents: prompt,
    config: {
      systemInstruction,
    },
  });

  return response.text ?? 'No interpretation returned by Gemini.';
}
