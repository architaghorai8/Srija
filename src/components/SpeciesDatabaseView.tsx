import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Database, Search } from 'lucide-react';
import { apiRequest } from '../lib/api';
import type { SpeciesReferenceItem, TaxonomicResult } from '../types';

interface SpeciesDatabaseViewProps {
  userTaxa: TaxonomicResult[];
}

export function SpeciesDatabaseView({ userTaxa }: SpeciesDatabaseViewProps) {
  const [query, setQuery] = useState('');
  const [kingdom, setKingdom] = useState('All');
  const [category, setCategory] = useState('All');
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<SpeciesReferenceItem[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [kingdoms, setKingdoms] = useState<string[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<SpeciesReferenceItem | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    const params = new URLSearchParams({
      q: query,
      kingdom,
      category,
      page: String(page),
      pageSize: '8',
    });
    apiRequest<{
      items: SpeciesReferenceItem[];
      total: number;
      totalPages: number;
      facets: { kingdoms: string[]; categories: string[] };
    }>(`/api/species?${params.toString()}`)
      .then((res) => {
        if (!active) return;
        setItems(res.items);
        setTotal(res.total);
        setTotalPages(res.totalPages);
        setKingdoms(res.facets.kingdoms);
        setCategories(res.facets.categories);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [query, kingdom, category, page]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-semibold text-[#141E1A]">Species Reference Database</h1>
        <p className="text-sm text-slate-600 mt-1">
          Curated barcode voucher catalog across COI, 12S, 16S, 18S, ITS, and rbcL indicator taxa.
        </p>
      </div>

      {/* Filters */}
      <div className="bg-white border border-[#D8E6DF] rounded-2xl p-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
            }}
            placeholder="Search scientific name, common name, habitat, accession..."
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
          />
        </div>

        <select
          value={kingdom}
          onChange={(e) => {
            setKingdom(e.target.value);
            setPage(1);
          }}
          className="px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white"
        >
          <option value="All">All Kingdoms</option>
          {kingdoms.map((k) => (
            <option key={k} value={k}>
              {k}
            </option>
          ))}
        </select>

        <select
          value={category}
          onChange={(e) => {
            setCategory(e.target.value);
            setPage(1);
          }}
          className="px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white"
        >
          <option value="All">All Organism Categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      <div className="grid lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 bg-white border border-[#D8E6DF] rounded-2xl p-5 space-y-4">
          {loading ? (
            <div className="py-12 text-center text-sm text-slate-500">Loading species catalog...</div>
          ) : items.length === 0 ? (
            <div className="py-12 text-center text-sm text-slate-500">No species match your search criteria.</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {items.map((sp) => {
                const matchingRuns = userTaxa.filter((t) => t.species === sp.species);
                const isSelected = selected?.id === sp.id;
                return (
                  <button
                    key={sp.id}
                    type="button"
                    onClick={() => setSelected(sp)}
                    className={`w-full text-left py-3.5 px-3 rounded-xl transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-2 cursor-pointer ${
                      isSelected ? 'bg-[#ECFDF5]' : 'hover:bg-[#F6FAF8]'
                    }`}
                  >
                    <div>
                      <p className="font-semibold italic text-[#141E1A]">{sp.scientific_name}</p>
                      <p className="text-xs text-slate-600">
                        {sp.common_name} · {sp.organism_category} · {sp.kingdom} / {sp.phylum}
                      </p>
                    </div>
                    <div className="text-left sm:text-right text-xs font-mono text-slate-500 shrink-0">
                      <p>{sp.marker_gene} · {sp.accession_id}</p>
                      <p className="text-emerald-700 font-sans font-medium">
                        {matchingRuns.length > 0 ? `Detected in ${matchingRuns.length} dataset(s)` : sp.conservation_status}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* Pagination */}
          <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs text-slate-600">
            <span className="font-mono tabular-nums">
              Showing page {page} of {totalPages} ({total} species)
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="p-1.5 rounded-lg border border-slate-300 disabled:opacity-40 hover:bg-slate-50 cursor-pointer"
                aria-label="Previous page"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="p-1.5 rounded-lg border border-slate-300 disabled:opacity-40 hover:bg-slate-50 cursor-pointer"
                aria-label="Next page"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Species Detail Sidebar */}
        <div className="lg:col-span-4 bg-white border border-[#D8E6DF] rounded-2xl p-6">
          {selected ? (
            <div className="space-y-4">
              <div>
                <p className="text-xs font-mono text-emerald-700">
                  {selected.marker_gene} · {selected.accession_id}
                </p>
                <h2 className="text-xl font-semibold italic text-[#141E1A] mt-0.5">{selected.scientific_name}</h2>
                <p className="text-sm text-slate-600">{selected.common_name}</p>
              </div>

              <div className="p-3.5 rounded-xl bg-[#F6FAF8] border border-[#D8E6DF] text-xs space-y-1">
                <p><span className="text-slate-500">Kingdom:</span> {selected.kingdom}</p>
                <p><span className="text-slate-500">Phylum:</span> {selected.phylum}</p>
                <p><span className="text-slate-500">Class:</span> {selected.class_name}</p>
                <p><span className="text-slate-500">Order:</span> {selected.order_name}</p>
                <p><span className="text-slate-500">Family:</span> {selected.family}</p>
                <p><span className="text-slate-500">Genus:</span> <span className="italic">{selected.genus}</span></p>
              </div>

              <div className="space-y-2 text-xs text-slate-700">
                <p><strong className="text-slate-900">Habitat:</strong> {selected.habitat}</p>
                <p><strong className="text-slate-900">Conservation Status:</strong> {selected.conservation_status}</p>
                <p><strong className="text-slate-900">Reference DB:</strong> {selected.reference_database}</p>
                <p className="leading-relaxed">{selected.description}</p>
              </div>

              <div>
                <p className="text-xs font-semibold text-slate-800 mb-1.5">Your Dataset Detections</p>
                {userTaxa.filter((t) => t.species === selected.species).length === 0 ? (
                  <p className="text-xs text-slate-500">Not yet detected in your uploaded datasets.</p>
                ) : (
                  <div className="space-y-1.5">
                    {userTaxa
                      .filter((t) => t.species === selected.species)
                      .map((match) => (
                        <div key={match.id} className="p-2 rounded-lg border border-slate-200 text-xs flex justify-between">
                          <span className="truncate pr-2">{match.dataset_name}</span>
                          <span className="font-mono text-emerald-700 shrink-0">{match.confidence}%</span>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="py-16 text-center space-y-2 text-slate-500">
              <Database className="w-8 h-8 mx-auto text-emerald-700/60" />
              <p className="text-sm font-medium text-slate-700">Inspect Species Record</p>
              <p className="text-xs">Select any organism from the reference catalog to view taxonomic lineage, habitat notes, and dataset detections.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
