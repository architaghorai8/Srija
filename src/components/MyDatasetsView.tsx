import { useState } from 'react';
import { Eye, FolderOpen, Trash2, X } from 'lucide-react';
import { apiRequest } from '../lib/api';
import type { AppPage, BiodiversityMetrics, DatasetRecord, TaxonomicResult } from '../types';

interface MyDatasetsViewProps {
  datasets: DatasetRecord[];
  onRefresh: () => void;
  onNavigate: (page: AppPage) => void;
}

export function MyDatasetsView({ datasets, onRefresh, onNavigate }: MyDatasetsViewProps) {
  const [inspectData, setInspectData] = useState<{
    dataset: DatasetRecord;
    results: TaxonomicResult[];
    metrics: BiodiversityMetrics;
  } | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  async function handleInspect(id: string) {
    const res = await apiRequest<{
      dataset: DatasetRecord;
      results: TaxonomicResult[];
      metrics: BiodiversityMetrics;
    }>(`/api/datasets/${id}`);
    setInspectData(res);
  }

  async function handleDelete(id: string) {
    await apiRequest(`/api/datasets/${id}`, { method: 'DELETE' });
    setConfirmDeleteId(null);
    onRefresh();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold text-[#141E1A]">My eDNA Datasets</h1>
          <p className="text-sm text-slate-600 mt-1">
            Private sequence files, sample metadata, and taxonomic analysis records linked to your account.
          </p>
        </div>
        <button
          type="button"
          onClick={() => onNavigate('analyze')}
          className="px-4 py-2.5 rounded-lg bg-[#064E3B] hover:bg-[#053F30] text-white text-xs font-semibold cursor-pointer"
        >
          Analyze New Dataset
        </button>
      </div>

      {datasets.length === 0 ? (
        <div className="bg-white border border-[#D8E6DF] rounded-2xl p-12 text-center space-y-3">
          <FolderOpen className="w-10 h-10 text-emerald-700/60 mx-auto" />
          <h2 className="text-lg font-semibold text-[#141E1A]">No datasets uploaded yet</h2>
          <p className="text-sm text-slate-500 max-w-md mx-auto">
            Upload a FASTA, FASTQ, CSV, or TXT file—or load one of our field sample templates—to generate taxonomic identifications and biodiversity metrics.
          </p>
          <button
            type="button"
            onClick={() => onNavigate('analyze')}
            className="px-4 py-2 rounded-lg bg-[#064E3B] text-white text-xs font-semibold cursor-pointer"
          >
            Go to Analyze eDNA
          </button>
        </div>
      ) : (
        <div className="bg-white border border-[#D8E6DF] rounded-2xl p-6 overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs text-slate-500">
                <th className="py-2.5 pr-4 font-semibold">Dataset &amp; Sample ID</th>
                <th className="py-2.5 pr-4 font-semibold">Location &amp; Type</th>
                <th className="py-2.5 pr-4 font-semibold">Collection Date</th>
                <th className="py-2.5 pr-4 font-semibold text-right">Sequences</th>
                <th className="py-2.5 pr-4 font-semibold text-right">Richness</th>
                <th className="py-2.5 pr-4 font-semibold text-right">Shannon H&apos;</th>
                <th className="py-2.5 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {datasets.map((d) => (
                <tr key={d.id} className="hover:bg-[#F6FAF8]">
                  <td className="py-3 pr-4">
                    <p className="font-semibold text-[#141E1A]">{d.dataset_name}</p>
                    <p className="text-xs font-mono text-slate-500">
                      {d.sample_id} · {d.file_format.toUpperCase()}
                    </p>
                  </td>
                  <td className="py-3 pr-4 text-xs text-slate-700">
                    <p>{d.location}</p>
                    <p className="text-slate-500 capitalize">{d.sample_type}</p>
                  </td>
                  <td className="py-3 pr-4 font-mono text-xs text-slate-600 tabular-nums">{d.collection_date}</td>
                  <td className="py-3 pr-4 text-right font-mono text-xs tabular-nums">{d.sequence_count}</td>
                  <td className="py-3 pr-4 text-right font-mono text-xs tabular-nums">{d.species_richness ?? 0}</td>
                  <td className="py-3 pr-4 text-right font-mono text-xs font-semibold text-[#064E3B] tabular-nums">
                    {Number(d.shannon_index || 0).toFixed(3)}
                  </td>
                  <td className="py-3 text-right">
                    <div className="inline-flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleInspect(d.id)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-300 hover:bg-white text-xs font-medium cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        Inspect
                      </button>
                      {confirmDeleteId === d.id ? (
                        <button
                          type="button"
                          onClick={() => handleDelete(d.id)}
                          className="px-2.5 py-1.5 rounded-lg bg-rose-600 text-white text-xs font-semibold cursor-pointer"
                        >
                          Confirm
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(d.id)}
                          aria-label={`Delete ${d.dataset_name}`}
                          className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Inspect Dataset Modal */}
      {inspectData && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white border border-[#D8E6DF] rounded-2xl max-w-3xl w-full max-h-[85vh] overflow-y-auto p-6 space-y-4">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-3">
              <div>
                <p className="text-xs font-mono text-emerald-700">{inspectData.dataset.sample_id}</p>
                <h2 className="text-xl font-semibold text-[#141E1A]">{inspectData.dataset.dataset_name}</h2>
                <p className="text-xs text-slate-500">
                  {inspectData.dataset.location} · {inspectData.dataset.collection_date} · GC {inspectData.dataset.gc_content}%
                </p>
              </div>
              <button
                type="button"
                onClick={() => setInspectData(null)}
                aria-label="Close modal"
                className="p-1.5 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-[#F6FAF8] border border-[#D8E6DF]">
                <p className="text-slate-500">Richness</p>
                <p className="font-mono font-bold text-lg text-[#064E3B]">{inspectData.metrics.species_richness}</p>
              </div>
              <div className="p-3 rounded-xl bg-[#F6FAF8] border border-[#D8E6DF]">
                <p className="text-slate-500">Shannon H&apos;</p>
                <p className="font-mono font-bold text-lg text-[#064E3B]">{inspectData.metrics.shannon_index.toFixed(3)}</p>
              </div>
              <div className="p-3 rounded-xl bg-[#F6FAF8] border border-[#D8E6DF]">
                <p className="text-slate-500">Simpson D</p>
                <p className="font-mono font-bold text-lg">{inspectData.metrics.simpson_index.toFixed(3)}</p>
              </div>
              <div className="p-3 rounded-xl bg-[#F6FAF8] border border-[#D8E6DF]">
                <p className="text-slate-500">Simpson (1-D)</p>
                <p className="font-mono font-bold text-lg text-emerald-700">{inspectData.metrics.simpson_diversity.toFixed(3)}</p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500">
                    <th className="py-2 pr-3 font-semibold">Species</th>
                    <th className="py-2 pr-3 font-semibold">Phylum / Family</th>
                    <th className="py-2 pr-3 font-semibold text-right">Reads</th>
                    <th className="py-2 font-semibold text-right">Confidence</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {inspectData.results.map((r) => (
                    <tr key={r.id}>
                      <td className="py-2 pr-3 font-semibold italic">{r.scientific_name}</td>
                      <td className="py-2 pr-3 text-slate-600">{r.phylum} · {r.family}</td>
                      <td className="py-2 pr-3 text-right font-mono tabular-nums">{r.read_count} ({r.relative_abundance}%)</td>
                      <td className="py-2 text-right font-mono tabular-nums text-emerald-700">{r.confidence}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
