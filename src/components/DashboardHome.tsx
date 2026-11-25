import { useMemo } from 'react';
import { ArrowRight, FlaskConical } from 'lucide-react';
import type { AppPage, DatasetRecord, TaxonomicResult, UserActivityItem, UserProfile } from '../types';
import { BiodiversityTrendLineChart, SpeciesAbundanceBarChart, TaxonomicPieChart } from './Charts';

interface DashboardHomeProps {
  user: UserProfile;
  summary: {
    totalDatasets: number;
    totalSpeciesIdentified: number;
    totalTaxonomicGroups: number;
    averageBiodiversityIndex: number;
  };
  datasets: DatasetRecord[];
  taxa: TaxonomicResult[];
  activities: UserActivityItem[];
  onNavigate: (page: AppPage) => void;
}

export function DashboardHome({
  user,
  summary,
  datasets,
  taxa,
  activities,
  onNavigate,
}: DashboardHomeProps) {
  const recentDataset = datasets[datasets.length - 1] || null;

  const kingdomDist = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of taxa) {
      map.set(t.kingdom, (map.get(t.kingdom) || 0) + t.read_count);
    }
    return Array.from(map.entries()).map(([label, value]) => ({ label, value }));
  }, [taxa]);

  const topSpecies = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of taxa) {
      map.set(t.scientific_name, (map.get(t.scientific_name) || 0) + t.read_count);
    }
    return Array.from(map.entries())
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value);
  }, [taxa]);

  const trendPoints = useMemo(() => {
    return datasets.map((d) => ({
      date: d.collection_date,
      label: d.dataset_name,
      shannon: Number(d.shannon_index || 0),
      richness: Number(d.species_richness || 0),
    }));
  }, [datasets]);

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="bg-[#06291F] text-white rounded-2xl p-6 sm:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2">
          <p className="text-xs font-mono text-emerald-300">
            {user.userCategory} · {user.institution || user.country}
          </p>
          <h1 className="text-2xl sm:text-3xl font-semibold text-white">
            Welcome back, {user.fullName}
          </h1>
          <p className="text-sm text-emerald-100/80 max-w-2xl">
            Monitor environmental DNA sequence analyses, explore taxonomic lineages, and assess biodiversity trends across your sampling sites.
          </p>
        </div>

        <button
          type="button"
          onClick={() => onNavigate('analyze')}
          className="inline-flex items-center gap-2 px-5 py-3 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-[#04241A] text-sm font-semibold shrink-0 cursor-pointer whitespace-nowrap"
        >
          <FlaskConical className="w-4 h-4" />
          Analyze eDNA Dataset
        </button>
      </div>

      {/* 6 Dashboard Summary Cards */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-[#D8E6DF] rounded-2xl p-5">
          <p className="text-xs text-slate-500">Total Datasets Uploaded</p>
          <p className="text-3xl font-mono font-bold text-[#064E3B] tabular-nums mt-1.5">
            {summary.totalDatasets}
          </p>
          <p className="text-xs text-emerald-700 mt-1">FASTA, FASTQ, CSV &amp; TXT</p>
        </div>

        <div className="bg-white border border-[#D8E6DF] rounded-2xl p-5">
          <p className="text-xs text-slate-500">Total Species Identified</p>
          <p className="text-3xl font-mono font-bold text-[#064E3B] tabular-nums mt-1.5">
            {summary.totalSpeciesIdentified}
          </p>
          <p className="text-xs text-emerald-700 mt-1">Distinct taxonomic species</p>
        </div>

        <div className="bg-white border border-[#D8E6DF] rounded-2xl p-5">
          <p className="text-xs text-slate-500">Total Taxonomic Groups</p>
          <p className="text-3xl font-mono font-bold text-[#064E3B] tabular-nums mt-1.5">
            {summary.totalTaxonomicGroups}
          </p>
          <p className="text-xs text-emerald-700 mt-1">Distinct phyla represented</p>
        </div>

        <div className="bg-white border border-[#D8E6DF] rounded-2xl p-5">
          <p className="text-xs text-slate-500">Mean Biodiversity Index (H&apos;)</p>
          <p className="text-3xl font-mono font-bold text-[#064E3B] tabular-nums mt-1.5">
            {summary.averageBiodiversityIndex.toFixed(3)}
          </p>
          <p className="text-xs text-emerald-700 mt-1">Shannon diversity average</p>
        </div>
      </div>

      {/* Cards 5 & 6: Recent Analysis & Recent Activities */}
      <div className="grid lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 bg-white border border-[#D8E6DF] rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-[#141E1A]">Recent Analysis</h2>
            <button
              type="button"
              onClick={() => onNavigate('datasets')}
              className="inline-flex items-center gap-1 text-xs font-semibold text-[#064E3B] hover:underline cursor-pointer"
            >
              View All Datasets
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {recentDataset ? (
            <div className="p-4 rounded-xl bg-[#F6FAF8] border border-[#D8E6DF] space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-semibold text-[#141E1A]">{recentDataset.dataset_name}</p>
                  <p className="text-xs text-slate-500">
                    {recentDataset.sample_id} · {recentDataset.location} · {recentDataset.collection_date}
                  </p>
                </div>
                <span className="text-xs font-mono font-semibold text-emerald-800">
                  {recentDataset.sequence_count} reads · GC {recentDataset.gc_content}%
                </span>
              </div>
              <div className="grid grid-cols-3 gap-3 pt-2 border-t border-[#D8E6DF] text-xs">
                <div>
                  <p className="text-slate-500">Richness (S)</p>
                  <p className="font-mono font-bold text-[#064E3B] tabular-nums">{recentDataset.species_richness ?? 0}</p>
                </div>
                <div>
                  <p className="text-slate-500">Shannon (H&apos;)</p>
                  <p className="font-mono font-bold text-[#064E3B] tabular-nums">
                    {Number(recentDataset.shannon_index || 0).toFixed(3)}
                  </p>
                </div>
                <div>
                  <p className="text-slate-500">Simpson (1-D)</p>
                  <p className="font-mono font-bold text-[#064E3B] tabular-nums">
                    {Number(recentDataset.simpson_diversity || 0).toFixed(3)}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="py-8 text-center space-y-3">
              <p className="text-sm text-slate-500">No eDNA datasets analyzed yet.</p>
              <button
                type="button"
                onClick={() => onNavigate('analyze')}
                className="px-4 py-2 rounded-lg bg-[#064E3B] text-white text-xs font-semibold cursor-pointer"
              >
                Upload First Dataset
              </button>
            </div>
          )}

          <div className="pt-2">
            <BiodiversityTrendLineChart points={trendPoints} />
          </div>
        </div>

        <div className="lg:col-span-5 bg-white border border-[#D8E6DF] rounded-2xl p-6 space-y-4">
          <h2 className="text-base font-semibold text-[#141E1A]">Recent Activities</h2>
          {activities.length === 0 ? (
            <p className="text-xs text-slate-500 py-6">No account activity recorded yet.</p>
          ) : (
            <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto pr-1">
              {activities.map((a) => (
                <div key={a.activity_id} className="py-2.5 text-xs">
                  <p className="font-medium text-slate-900">{a.description}</p>
                  <p className="text-[11px] font-mono text-slate-400 mt-0.5">
                    {a.activity_type} · {new Date(a.timestamp).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Interactive Overview Charts */}
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="bg-white border border-[#D8E6DF] rounded-2xl p-6 space-y-4">
          <h2 className="text-base font-semibold text-[#141E1A]">Kingdom Composition Overview</h2>
          <TaxonomicPieChart
            data={kingdomDist}
            donut
            emptyText="Upload and analyze an eDNA dataset to view kingdom distribution."
          />
        </div>
        <div className="bg-white border border-[#D8E6DF] rounded-2xl p-6 space-y-4">
          <h2 className="text-base font-semibold text-[#141E1A]">Top Identified Species by Read Count</h2>
          <SpeciesAbundanceBarChart data={topSpecies} />
        </div>
      </div>
    </div>
  );
}
