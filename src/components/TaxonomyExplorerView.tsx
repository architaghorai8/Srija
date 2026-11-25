import { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, GitBranch, Search } from 'lucide-react';
import type { TaxonomicResult } from '../types';

interface TaxonomyExplorerViewProps {
  taxa: TaxonomicResult[];
}

interface TreeNode {
  rank: string;
  name: string;
  count: number;
  children: Map<string, TreeNode>;
  records: TaxonomicResult[];
}

export function TaxonomyExplorerView({ taxa }: TaxonomyExplorerViewProps) {
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [selectedSpecies, setSelectedSpecies] = useState<string | null>(null);

  const filteredTaxa = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return taxa;
    return taxa.filter((t) =>
      `${t.kingdom} ${t.phylum} ${t.class_name} ${t.order_name} ${t.family} ${t.genus} ${t.scientific_name} ${t.common_name}`
        .toLowerCase()
        .includes(q)
    );
  }, [taxa, search]);

  const tree = useMemo(() => {
    const root = new Map<string, TreeNode>();
    for (const item of filteredTaxa) {
      const ranks: Array<[string, string]> = [
        ['Kingdom', item.kingdom],
        ['Phylum', item.phylum],
        ['Class', item.class_name],
        ['Order', item.order_name],
        ['Family', item.family],
        ['Genus', item.genus],
        ['Species', item.scientific_name],
      ];
      let currentMap = root;
      for (const [rank, name] of ranks) {
        let node = currentMap.get(name);
        if (!node) {
          node = { rank, name, count: 0, children: new Map(), records: [] };
          currentMap.set(name, node);
        }
        node.count += 1;
        node.records.push(item);
        currentMap = node.children;
      }
    }
    return root;
  }, [filteredTaxa]);

  function toggleNode(pathKey: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(pathKey)) next.delete(pathKey);
      else next.add(pathKey);
      return next;
    });
  }

  function expandAll() {
    const keys = new Set<string>();
    function walk(map: Map<string, TreeNode>, prefix: string) {
      for (const [name, node] of map.entries()) {
        const key = `${prefix}>${name}`;
        if (node.children.size > 0) {
          keys.add(key);
          walk(node.children, key);
        }
      }
    }
    walk(tree, 'root');
    setExpanded(keys);
  }

  const selectedRecords = useMemo(() => {
    if (!selectedSpecies) return [];
    return taxa.filter((t) => t.scientific_name === selectedSpecies);
  }, [taxa, selectedSpecies]);

  const primaryRecord = selectedRecords[0] || null;
  const relatedOrganisms = useMemo(() => {
    if (!primaryRecord) return [];
    const seen = new Set<string>();
    return taxa.filter((t) => {
      if (t.scientific_name === primaryRecord.scientific_name) return false;
      if (t.family !== primaryRecord.family && t.order_name !== primaryRecord.order_name) return false;
      if (seen.has(t.scientific_name)) return false;
      seen.add(t.scientific_name);
      return true;
    });
  }, [taxa, primaryRecord]);

  function renderLevel(map: Map<string, TreeNode>, prefix: string, depth: number) {
    return Array.from(map.values())
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((node) => {
        const key = `${prefix}>${node.name}`;
        const hasChildren = node.children.size > 0;
        const isOpen = expanded.has(key) || search.trim().length > 0;
        const isSpecies = node.rank === 'Species';

        return (
          <div key={key} style={{ marginLeft: depth > 0 ? 16 : 0 }} className="border-l border-[#D8E6DF] pl-3 my-1">
            <div className="flex items-center justify-between py-1 px-2 rounded-lg hover:bg-[#F6FAF8] transition-colors">
              <button
                type="button"
                onClick={() => {
                  if (isSpecies) {
                    setSelectedSpecies(node.name);
                  } else if (hasChildren) {
                    toggleNode(key);
                  }
                }}
                className="flex items-center gap-2 text-left text-sm cursor-pointer min-w-0"
              >
                {hasChildren ? (
                  isOpen ? (
                    <ChevronDown className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                  ) : (
                    <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  )
                ) : (
                  <span className="w-3.5 h-3.5 inline-block shrink-0" />
                )}
                <span className="text-[11px] font-mono text-slate-400 w-16 shrink-0">{node.rank}</span>
                <span
                  className={`truncate ${
                    isSpecies || node.rank === 'Genus' ? 'italic font-semibold text-[#064E3B]' : 'font-medium text-slate-800'
                  }`}
                >
                  {node.name}
                </span>
              </button>
              <span className="text-xs font-mono tabular-nums text-slate-500 ml-2 shrink-0">{node.count}</span>
            </div>
            {hasChildren && isOpen && <div>{renderLevel(node.children, key, depth + 1)}</div>}
          </div>
        );
      });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold text-[#141E1A]">Taxonomy Explorer</h1>
          <p className="text-sm text-slate-600 mt-1">
            Interactive 7-rank hierarchy browser across your identified environmental DNA datasets.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={expandAll}
            className="px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-white text-xs font-medium text-slate-700 cursor-pointer"
          >
            Expand All
          </button>
          <button
            type="button"
            onClick={() => setExpanded(new Set())}
            className="px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-white text-xs font-medium text-slate-700 cursor-pointer"
          >
            Collapse All
          </button>
        </div>
      </div>

      <div className="grid lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 bg-white border border-[#D8E6DF] rounded-2xl p-5 space-y-4">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search Kingdom, Phylum, Family, or Scientific Name..."
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
            />
          </div>

          {taxa.length === 0 ? (
            <div className="py-12 text-center text-sm text-slate-500">
              Analyze an eDNA dataset first to populate your interactive taxonomic tree.
            </div>
          ) : (
            <div className="max-h-[540px] overflow-y-auto pr-2">{renderLevel(tree, 'root', 0)}</div>
          )}
        </div>

        <div className="lg:col-span-5 bg-white border border-[#D8E6DF] rounded-2xl p-6 space-y-5">
          {primaryRecord ? (
            <>
              <div>
                <p className="text-xs font-mono text-emerald-700">
                  {primaryRecord.marker_gene} · {primaryRecord.accession_id}
                </p>
                <h2 className="text-2xl font-semibold italic text-[#141E1A] mt-0.5">
                  {primaryRecord.scientific_name}
                </h2>
                <p className="text-sm text-slate-600">{primaryRecord.common_name}</p>
              </div>

              <div className="space-y-1.5 text-xs bg-[#F6FAF8] border border-[#D8E6DF] rounded-xl p-4">
                <p><span className="text-slate-500 inline-block w-20">Kingdom</span> {primaryRecord.kingdom}</p>
                <p><span className="text-slate-500 inline-block w-20">Phylum</span> {primaryRecord.phylum}</p>
                <p><span className="text-slate-500 inline-block w-20">Class</span> {primaryRecord.class_name}</p>
                <p><span className="text-slate-500 inline-block w-20">Order</span> {primaryRecord.order_name}</p>
                <p><span className="text-slate-500 inline-block w-20">Family</span> {primaryRecord.family}</p>
                <p><span className="text-slate-500 inline-block w-20">Genus</span> <span className="italic">{primaryRecord.genus}</span></p>
                <p><span className="text-slate-500 inline-block w-20">Species</span> <span className="italic">{primaryRecord.species}</span></p>
              </div>

              <div>
                <h3 className="text-xs font-semibold text-slate-700 mb-2">Dataset Occurrence History</h3>
                <div className="space-y-2">
                  {selectedRecords.map((rec) => (
                    <div
                      key={rec.id}
                      className="p-2.5 rounded-lg border border-slate-200 text-xs flex items-center justify-between"
                    >
                      <div>
                        <p className="font-semibold text-slate-800">{rec.dataset_name || 'Dataset'}</p>
                        <p className="text-slate-500">{rec.location} · {rec.collection_date}</p>
                      </div>
                      <span className="font-mono tabular-nums text-emerald-700 font-semibold">
                        {rec.read_count} reads · {rec.confidence}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {relatedOrganisms.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-slate-700 mb-2">Related Organisms in Same Order/Family</h3>
                  <div className="space-y-1.5">
                    {relatedOrganisms.map((rel) => (
                      <button
                        key={rel.id}
                        type="button"
                        onClick={() => setSelectedSpecies(rel.scientific_name)}
                        className="w-full text-left px-3 py-2 rounded-lg bg-[#F6FAF8] hover:bg-emerald-50 text-xs flex items-center justify-between cursor-pointer"
                      >
                        <span className="italic font-medium text-[#064E3B]">{rel.scientific_name}</span>
                        <span className="text-slate-500">{rel.family}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="py-16 text-center space-y-2 text-slate-500">
              <GitBranch className="w-8 h-8 mx-auto text-emerald-700/60" />
              <p className="text-sm font-medium text-slate-700">Select any species node</p>
              <p className="text-xs">
                Expand the taxonomic lineage on the left and click a species to inspect its full hierarchy, related taxa, and dataset occurrence history.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
