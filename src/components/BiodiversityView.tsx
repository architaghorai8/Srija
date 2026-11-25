import { useMemo, useState } from 'react';
import { Info } from 'lucide-react';
import type { DatasetRecord, TaxonomicResult } from '../types';
import {
  BiodiversityTrendLineChart,
  SamplingGeoMap,
  SpeciesAbundanceBarChart,
  TaxonomicPieChart,
} from './Charts';

interface BiodiversityViewProps {
  datasets: DatasetRecord[];
  taxa: TaxonomicResult[];
}

export function BiodiversityView({ datasets, taxa }: BiodiversityViewProps) {
  const [datasetFilter, setDatasetFilter] = useState('All');
  const [locationFilter, setLocationFilter] = useState('All');
  const [dateFilter, setDateFilter] = useState('All');
  const [kingdomFilter, setKingdomFilter] = useState('All');
  const [phylumFilter, setPhylumFilter] = useState('All');

  const locations = useMemo(() => ['All', ...Array.from(new Set(datasets.map((d) => d.location)))], [datasets]);
  const dates = useMemo(() => ['All', ...Array.from(new Set(datasets.map((d) => d.collection_date)))], [datasets]);
  const kingdoms = useMemo(() => ['All', ...Array.from(new Set(taxa.map((t) => t.kingdom)))], [taxa]);
  const phyla = useMemo(() => ['All', ...Array.from(new Set(taxa.map((t) => t.phylum)))], [taxa]);

  const filteredDatasets = useMemo(() => {
    return datasets.filter((d) => {
      if (datasetFilter !== 'All' && d.id !== datasetFilter) return false;
      if (locationFilter !== 'All' && d.location !== locationFilter) return false;
      if (dateFilter !== 'All' && d.collection_date !== dateFilter) return false;
      return true;
    });
  }, [datasets, datasetFilter, locationFilter, dateFilter]);

  const filteredDatasetIds = useMemo(() => new Set(filteredDatasets.map((d) => d.id)), [filteredDatasets]);

  const filteredTaxa = useMemo(() => {
    return taxa.filter((t) => {
      if (!filteredDatasetIds.has(t.dataset_id)) return false;
      if (kingdomFilter !== 'All' && t.kingdom !== kingdomFilter) return false;
      if (phylumFilter !== 'All' && t.phylum !== phylumFilter) return false;
      return true;
    });
  }, [taxa, filteredDatasetIds, kingdomFilter, phylumFilter]);

  // Compute live biodiversity metrics across the filtered taxonomic subset
  const metrics = useMemo(() => {
    const speciesMap = new Map<string, number>();
    for (const t of filteredTaxa) {
      speciesMap.set(t.species, (speciesMap.get(t.species) || 0) + t.read_count);
    }
    const richness = speciesMap.size;
    const totalReads = Array.from(speciesMap.values()).reduce((s, v) => s + v, 0);

    let shannon = 0;
    let simpsonD = 0;
    if (totalReads > 0 && richness > 0) {
      for (const count of speciesMap.values()) {
        const pi = count / totalReads;
        if (pi > 0) {
          shannon += -pi * Math.log(pi);
          simpsonD += pi * pi;
        }
      }
    }
    const simpsonDiversity = richness > 0 ? 1 - simpsonD : 0;
    const evenness = richness > 1 ? shannon / Math.log(richness) : richness === 1 ? 1 : 0;
    const abundanceSupported = totalReads > richness && richness > 1;

    return {
      richness,
      shannon,
      simpsonD,
      simpsonDiversity,
      evenness,
      totalReads,
      abundanceSupported,
    };
  }, [filteredTaxa]);

  const classDistribution = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of filteredTaxa) {
      map.set(t.class_name, (map.get(t.class_name) || 0) + t.read_count);
    }
    return Array.from(map.entries())
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value);
  }, [filteredTaxa]);

  const kingdomDistribution = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of filteredTaxa) {
      map.set(t.kingdom, (map.get(t.kingdom) || 0) + t.read_count);
    }
    return Array.from(map.entries())
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value);
  }, [filteredTaxa]);

  const speciesAbundance = useMemo(() => {
    const map = new Map<string, { reads: number; pctSum: number }>();
    for (const t of filteredTaxa) {
      const prev = map.get(t.scientific_name) || { reads: 0, pctSum: 0 };
      map.set(t.scientific_name, {
        reads: prev.reads + t.read_count,
        pctSum: prev.pctSum + t.relative_abundance,
      });
    }
    const total = Array.from(map.values()).reduce((s, v) => s + v.reads, 0) || 1;
    return Array.from(map.entries())
      .map(([label, v]) => ({
        label,
        value: v.reads,
        sublabel: `${((v.reads / total) * 100).toFixed(1)}%`,
      }))
      .sort((a, b) => b.value - a.value);
  }, [filteredTaxa]);

  const trendPoints = useMemo(() => {
    return filteredDatasets
      .slice()
      .sort((a, b) => a.collection_date.localeCompare(b.collection_date))
      .map((d) => ({
        date: d.collection_date,
        label: d.dataset_name,
        shannon: Number(d.shannon_index || 0),
        richness: Number(d.species_richness || 0),
      }));
  }, [filteredDatasets]);

  const geoPoints = useMemo(() => {
    return filteredDatasets.map((d) => ({
      id: d.id,
      name: d.dataset_name,
      location: d.location,
      latitude: d.latitude,
      longitude: d.longitude,
      richness: Number(d.species_richness || 0),
      shannon: Number(d.shannon_index || 0),
    }));
  }, [filteredDatasets]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-semibold text-[#141E1A]">Biodiversity Assessment &amp; Visual Analytics</h1>
        <p className="text-sm text-slate-600 mt-1">
          Evaluate species richness, Shannon (H&apos;), Simpson (D &amp; 1-D), and spatial-temporal community structure.
        </p>
      </div>

      {/* Dynamic Multi-Facet Filter Bar */}
      <div className="bg-white border border-[#D8E6DF] rounded-2xl p-4 grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <select
          value={datasetFilter}
          onChange={(e) => setDatasetFilter(e.target.value)}
          className="px-3 py-2 rounded-lg border border-slate-300 text-xs bg-white"
        >
          <option value="All">All Datasets ({datasets.length})</option>
          {datasets.map((d) => (
            <option key={d.id} value={d.id}>
              {d.dataset_name}
            </option>
          ))}
        </select>

        <select
          value={locationFilter}
          onChange={(e) => setLocationFilter(e.target.value)}
          className="px-3 py-2 rounded-lg border border-slate-300 text-xs bg-white"
        >
          {locations.map((loc) => (
            <option key={loc} value={loc}>
              Location: {loc}
            </option>
          ))}
        </select>

        <select
          value={dateFilter}
          onChange={(e) => setDateFilter(e.target.value)}
          className="px-3 py-2 rounded-lg border border-slate-300 text-xs bg-white"
        >
          {dates.map((dt) => (
            <option key={dt} value={dt}>
              Date: {dt}
            </option>
          ))}
        </select>

        <select
          value={kingdomFilter}
          onChange={(e) => setKingdomFilter(e.target.value)}
          className="px-3 py-2 rounded-lg border border-slate-300 text-xs bg-white"
        >
          {kingdoms.map((k) => (
            <option key={k} value={k}>
              Kingdom: {k}
            </option>
          ))}
        </select>

        <select
          value={phylumFilter}
          onChange={(e) => setPhylumFilter(e.target.value)}
          className="px-3 py-2 rounded-lg border border-slate-300 text-xs bg-white"
        >
          {phyla.map((p) => (
            <option key={p} value={p}>
              Phylum: {p}
            </option>
          ))}
        </select>
      </div>

      {/* Diversity Metric Cards */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white border border-[#D8E6DF] rounded-2xl p-5">
          <p className="text-xs text-slate-500">Species Richness (S)</p>
          <p className="text-3xl font-mono font-bold text-[#064E3B] tabular-nums mt-1">{metrics.richness}</p>
          <p className="text-[11px] text-slate-500 mt-1">Distinct identified taxa</p>
        </div>

        <div className="bg-white border border-[#D8E6DF] rounded-2xl p-5">
          <p className="text-xs text-slate-500">Shannon Diversity (H&apos;)</p>
          <p className="text-3xl font-mono font-bold text-[#064E3B] tabular-nums mt-1">
            {metrics.abundanceSupported ? metrics.shannon.toFixed(3) : 'N/A'}
          </p>
          <p className="text-[11px] text-slate-500 mt-1">H&apos; = -Σ(pi × ln(pi))</p>
        </div>

        <div className="bg-white border border-[#D8E6DF] rounded-2xl p-5">
          <p className="text-xs text-slate-500">Simpson Dominance (D)</p>
          <p className="text-3xl font-mono font-bold text-[#141E1A] tabular-nums mt-1">
            {metrics.abundanceSupported ? metrics.simpsonD.toFixed(3) : 'N/A'}
          </p>
          <p className="text-[11px] text-slate-500 mt-1">D = Σ(pi²) · Lower = more diverse</p>
        </div>

        <div className="bg-white border border-[#D8E6DF] rounded-2xl p-5">
          <p className="text-xs text-slate-500">Simpson Diversity (1 - D)</p>
          <p className="text-3xl font-mono font-bold text-emerald-700 tabular-nums mt-1">
            {metrics.abundanceSupported ? metrics.simpsonDiversity.toFixed(3) : 'N/A'}
          </p>
          <p className="text-[11px] text-slate-500 mt-1">Probability two reads differ</p>
        </div>

        <div className="bg-white border border-[#D8E6DF] rounded-2xl p-5">
          <p className="text-xs text-slate-500">Pielou Evenness (J&apos;)</p>
          <p className="text-3xl font-mono font-bold text-[#141E1A] tabular-nums mt-1">
            {metrics.abundanceSupported ? metrics.evenness.toFixed(3) : 'N/A'}
          </p>
          <p className="text-[11px] text-slate-500 mt-1">Equitability (0.0 to 1.0)</p>
        </div>
      </div>

      {/* Scientific Read-Count & Sequencing Bias Disclaimer */}
      <div className="p-4 rounded-xl bg-[#F0F7F4] border border-[#C6DFD3] flex items-start gap-3 text-xs text-slate-700">
        <Info className="w-4 h-4 text-[#064E3B] shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold text-[#141E1A]">Methodological Note on Read Counts &amp; Abundance Metrics: </span>
          {metrics.abundanceSupported
            ? 'Abundance-weighted indices (H\', D, 1-D) are computed from sequence read proportions (pi = reads_i / total_reads). In eDNA metabarcoding, read counts reflect amplicon proportions influenced by PCR primer affinity, mitochondrial copy number, and shedding rates—not exact organism biomass.'
            : 'Current selection lacks multi-read abundance variance (e.g., single-read presence-only records). Abundance-based indices (H\', D, 1-D) are withheld to prevent misleading ecological inference.'}
        </div>
      </div>

      {/* Interactive Charts Grid */}
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="bg-white border border-[#D8E6DF] rounded-2xl p-6 space-y-4">
          <h2 className="text-base font-semibold text-[#141E1A]">Taxonomic Class Distribution (Pie)</h2>
          <TaxonomicPieChart data={classDistribution} />
        </div>

        <div className="bg-white border border-[#D8E6DF] rounded-2xl p-6 space-y-4">
          <h2 className="text-base font-semibold text-[#141E1A]">Kingdom Composition (Donut)</h2>
          <TaxonomicPieChart data={kingdomDistribution} donut />
        </div>

        <div className="bg-white border border-[#D8E6DF] rounded-2xl p-6 space-y-4">
          <h2 className="text-base font-semibold text-[#141E1A]">Species Read Abundance</h2>
          <SpeciesAbundanceBarChart data={speciesAbundance} />
        </div>

        <div className="bg-white border border-[#D8E6DF] rounded-2xl p-6 space-y-4">
          <h2 className="text-base font-semibold text-[#141E1A]">Biodiversity Across Sampling Dates</h2>
          <BiodiversityTrendLineChart points={trendPoints} />
        </div>
      </div>

      {/* Geographic Map & Site Comparison Table */}
      <div className="grid lg:grid-cols-12 gap-6">
        <div className="lg:col-span-6 bg-white border border-[#D8E6DF] rounded-2xl p-6 space-y-4">
          <h2 className="text-base font-semibold text-[#141E1A]">Sampling Location Geographic Distribution</h2>
          <SamplingGeoMap samples={geoPoints} />
        </div>

        <div className="lg:col-span-6 bg-white border border-[#D8E6DF] rounded-2xl p-6 space-y-4">
          <h2 className="text-base font-semibold text-[#141E1A]">Dataset &amp; Location Comparison</h2>
          {filteredDatasets.length === 0 ? (
            <p className="text-sm text-slate-500 py-8 text-center">No datasets match the active filters.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500">
                    <th className="py-2 pr-3 font-semibold">Dataset / Location</th>
                    <th className="py-2 pr-3 font-semibold">Date</th>
                    <th className="py-2 pr-3 font-semibold text-right">Richness</th>
                    <th className="py-2 pr-3 font-semibold text-right">H&apos;</th>
                    <th className="py-2 font-semibold text-right">1 - D</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredDatasets.map((d) => (
                    <tr key={d.id}>
                      <td className="py-2.5 pr-3">
                        <p className="font-semibold text-[#141E1A]">{d.dataset_name}</p>
                        <p className="text-slate-500">{d.location} · {d.sample_type}</p>
                      </td>
                      <td className="py-2.5 pr-3 font-mono tabular-nums text-slate-600">{d.collection_date}</td>
                      <td className="py-2.5 pr-3 text-right font-mono tabular-nums">{d.species_richness ?? 0}</td>
                      <td className="py-2.5 pr-3 text-right font-mono tabular-nums text-[#064E3B] font-semibold">
                        {Number(d.shannon_index || 0).toFixed(3)}
                      </td>
                      <td className="py-2.5 text-right font-mono tabular-nums">
                        {Number(d.simpson_diversity || 0).toFixed(3)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
