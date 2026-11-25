import { useEffect, useState } from 'react';
import { jsPDF } from 'jspdf';
import { Download, FileSpreadsheet, FileText } from 'lucide-react';
import { apiRequest } from '../lib/api';
import type { BiodiversityMetrics, DatasetRecord, ReportRecord, TaxonomicResult } from '../types';

interface ReportsViewProps {
  datasets: DatasetRecord[];
  reports: ReportRecord[];
  onReportCreated: () => void;
}

export function ReportsView({ datasets, reports, onReportCreated }: ReportsViewProps) {
  const [selectedId, setSelectedId] = useState<string>(datasets[0]?.id || '');
  const [detail, setDetail] = useState<{
    dataset: DatasetRecord;
    results: TaxonomicResult[];
    metrics: BiodiversityMetrics;
  } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!selectedId && datasets.length > 0) {
      setSelectedId(datasets[0].id);
    }
  }, [datasets, selectedId]);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    setLoading(true);
    apiRequest<{
      dataset: DatasetRecord;
      results: TaxonomicResult[];
      metrics: BiodiversityMetrics;
    }>(`/api/datasets/${selectedId}`)
      .then((res) => setDetail(res))
      .catch(() => setDetail(null))
      .finally(() => setLoading(false));
  }, [selectedId]);

  async function handleDownloadPdf() {
    if (!detail) return;
    const { dataset, results, metrics } = detail;
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });

    let y = 46;
    const line = (text: string, size = 10, bold = false, indent = 44) => {
      if (y > 760) {
        doc.addPage();
        y = 48;
      }
      doc.setFont('helvetica', bold ? 'bold' : 'normal');
      doc.setFontSize(size);
      const split = doc.splitTextToSize(text, 505 - (indent - 44));
      doc.text(split, indent, y);
      y += split.length * (size + 4) + 4;
    };

    line('eDNA BioScope — Scientific Biodiversity & Taxonomic Report', 15, true);
    line('Identifying Taxonomy and Assessing Biodiversity from eDNA Datasets', 10, false);
    y += 8;

    line('1. Project & Dataset Information', 12, true);
    line(`Dataset Name: ${dataset.dataset_name} | Format: ${dataset.file_format.toUpperCase()} | Sequences: ${dataset.sequence_count}`);
    line(`GC Content: ${dataset.gc_content}% | Mean Read Length: ${dataset.mean_read_length} bp`);
    y += 4;

    line('2. Sample Details', 12, true);
    line(`Sample ID: ${dataset.sample_id} | Type: ${dataset.sample_type} | Location: ${dataset.location}`);
    line(`Collection Date: ${dataset.collection_date} | Notes: ${dataset.notes || 'None'}`);
    y += 4;

    line('3. Analysis Methodology & Reference Database', 12, true);
    line(
      `Engine Mode: ${
        dataset.analysis_mode === 'local_reference_demo'
          ? 'Local Reference Alignment (Simulated Demo Mode — configure external NCBI/BOLD endpoints for live BLAST)'
          : 'External Reference Alignment'
      }`
    );
    line('Taxonomic alignment across curated COI, 12S, 16S, 18S, ITS, and rbcL barcode references.');
    y += 4;

    line('4. Biodiversity Indices', 12, true);
    line(
      `Species Richness (S): ${metrics.species_richness} | Shannon (H'): ${metrics.shannon_index.toFixed(4)} | Simpson Dominance (D): ${metrics.simpson_index.toFixed(4)} | Simpson Diversity (1-D): ${metrics.simpson_diversity.toFixed(4)} | Evenness (J'): ${metrics.evenness_index.toFixed(4)}`
    );
    y += 4;

    line('5. Identified Species & Taxonomic Classification', 12, true);
    for (const r of results) {
      line(
        `${r.scientific_name} (${r.common_name || 'N/A'}) — ${r.kingdom} > ${r.phylum} > ${r.class_name} > ${r.family} | Reads: ${r.read_count} (${r.relative_abundance}%) | Similarity: ${r.similarity}% | Confidence: ${r.confidence}% | ${r.accession_id}`,
        9
      );
    }
    y += 4;

    line('6. Scientific Limitations & Date of Analysis', 12, true);
    line(
      'Read counts reflect PCR amplicon proportions influenced by primer affinity, mitochondrial copy number, and eDNA decay rates rather than absolute organism biomass. Detections below 88% similarity represent tentative taxonomic assignments.'
    );
    line(`Date of Analysis: ${new Date(dataset.created_at).toUTCString()}`);

    const reportName = `${dataset.sample_id} Biodiversity Report`;
    doc.save(`${dataset.sample_id}-edna-report.pdf`);

    await apiRequest('/api/reports', {
      method: 'POST',
      body: JSON.stringify({ datasetId: dataset.id, reportName, format: 'pdf' }),
    }).catch(() => {});
    onReportCreated();
  }

  async function handleExportCsv() {
    if (!detail) return;
    const { dataset, results, metrics } = detail;
    const headerRows = [
      ['Project Title', 'eDNA BioScope — Identifying Taxonomy and Assessing Biodiversity from eDNA Datasets'],
      ['Dataset Name', dataset.dataset_name],
      ['Sample ID', dataset.sample_id],
      ['Sample Type', dataset.sample_type],
      ['Location', dataset.location],
      ['Collection Date', dataset.collection_date],
      ['Analysis Mode', dataset.analysis_mode],
      ['Species Richness', metrics.species_richness],
      ['Shannon Index (H)', metrics.shannon_index],
      ['Simpson Dominance (D)', metrics.simpson_index],
      ['Simpson Diversity (1-D)', metrics.simpson_diversity],
      ['Date of Analysis', dataset.created_at],
      [],
      [
        'Scientific Name',
        'Common Name',
        'Kingdom',
        'Phylum',
        'Class',
        'Order',
        'Family',
        'Genus',
        'Species',
        'Read Count',
        'Relative Abundance (%)',
        'Similarity (%)',
        'Confidence (%)',
        'Reference Database',
        'Accession ID',
      ],
      ...results.map((r) => [
        r.scientific_name,
        r.common_name,
        r.kingdom,
        r.phylum,
        r.class_name,
        r.order_name,
        r.family,
        r.genus,
        r.species,
        r.read_count,
        r.relative_abundance,
        r.similarity,
        r.confidence,
        r.reference_database,
        r.accession_id,
      ]),
    ];

    const csv = headerRows
      .map((row) => row.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${dataset.sample_id}-edna-report.csv`;
    a.click();
    URL.revokeObjectURL(url);

    await apiRequest('/api/reports', {
      method: 'POST',
      body: JSON.stringify({
        datasetId: dataset.id,
        reportName: `${dataset.sample_id} CSV Data Export`,
        format: 'csv',
      }),
    }).catch(() => {});
    onReportCreated();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold text-[#141E1A]">Scientific Reports &amp; Exports</h1>
          <p className="text-sm text-slate-600 mt-1">
            Generate structured PDF and CSV biodiversity reports scoped exclusively to your private datasets.
          </p>
        </div>

        {datasets.length > 0 && (
          <select
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            className="px-3.5 py-2 rounded-lg border border-slate-300 text-sm bg-white"
          >
            {datasets.map((d) => (
              <option key={d.id} value={d.id}>
                {d.dataset_name} ({d.sample_id})
              </option>
            ))}
          </select>
        )}
      </div>

      {datasets.length === 0 ? (
        <div className="bg-white border border-[#D8E6DF] rounded-2xl p-12 text-center text-sm text-slate-500">
          Analyze a dataset first to unlock structured PDF and CSV biodiversity reports.
        </div>
      ) : loading || !detail ? (
        <div className="bg-white border border-[#D8E6DF] rounded-2xl p-12 text-center text-sm text-slate-500">
          Preparing report preview...
        </div>
      ) : (
        <div className="bg-white border border-[#D8E6DF] rounded-2xl p-6 sm:p-8 space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-5">
            <div>
              <p className="text-xs font-mono text-emerald-700">12-SECTION SCIENTIFIC REPORT PREVIEW</p>
              <h2 className="text-2xl font-semibold text-[#141E1A] mt-0.5">
                {detail.dataset.dataset_name} — Biodiversity Assessment
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Date of analysis: {new Date(detail.dataset.created_at).toLocaleString()}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleDownloadPdf}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#064E3B] hover:bg-[#053F30] text-white text-xs font-semibold cursor-pointer"
              >
                <Download className="w-4 h-4" />
                Download PDF
              </button>
              <button
                type="button"
                onClick={handleExportCsv}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-800 text-xs font-semibold cursor-pointer"
              >
                <FileSpreadsheet className="w-4 h-4" />
                Export CSV
              </button>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-6 text-xs">
            <div className="p-4 rounded-xl bg-[#F6FAF8] border border-[#D8E6DF] space-y-1.5">
              <p className="font-semibold text-sm text-[#141E1A]">Dataset &amp; Sample Details</p>
              <p><span className="text-slate-500">Project Title:</span> Identifying Taxonomy and Assessing Biodiversity from eDNA Datasets</p>
              <p><span className="text-slate-500">Sample ID:</span> <span className="font-mono">{detail.dataset.sample_id}</span></p>
              <p><span className="text-slate-500">Sample Type:</span> {detail.dataset.sample_type}</p>
              <p><span className="text-slate-500">Location:</span> {detail.dataset.location}</p>
              <p><span className="text-slate-500">Collection Date:</span> {detail.dataset.collection_date}</p>
              <p><span className="text-slate-500">Sequences / GC%:</span> {detail.dataset.sequence_count} reads · {detail.dataset.gc_content}%</p>
            </div>

            <div className="p-4 rounded-xl bg-[#F6FAF8] border border-[#D8E6DF] space-y-1.5">
              <p className="font-semibold text-sm text-[#141E1A]">Biodiversity Indices &amp; Methodology</p>
              <p><span className="text-slate-500">Species Richness (S):</span> <strong className="font-mono">{detail.metrics.species_richness}</strong></p>
              <p><span className="text-slate-500">Shannon Index (H&apos;):</span> <strong className="font-mono">{detail.metrics.shannon_index.toFixed(4)}</strong></p>
              <p><span className="text-slate-500">Simpson Dominance (D):</span> <strong className="font-mono">{detail.metrics.simpson_index.toFixed(4)}</strong></p>
              <p><span className="text-slate-500">Simpson Diversity (1 - D):</span> <strong className="font-mono">{detail.metrics.simpson_diversity.toFixed(4)}</strong></p>
              <p><span className="text-slate-500">Methodology:</span> {detail.dataset.analysis_mode === 'local_reference_demo' ? 'Local k-mer reference alignment (Demo Mode)' : 'External reference alignment'}</p>
              <p><span className="text-slate-500">Limitations:</span> Read counts are sensitive to PCR bias, primer affinity, and environmental DNA degradation.</p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="py-2 pr-3 font-semibold">Species</th>
                  <th className="py-2 pr-3 font-semibold">Taxonomic Path</th>
                  <th className="py-2 pr-3 font-semibold text-right">Reads</th>
                  <th className="py-2 pr-3 font-semibold text-right">Confidence</th>
                  <th className="py-2 font-semibold">Reference DB / Accession</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {detail.results.map((r) => (
                  <tr key={r.id}>
                    <td className="py-2 pr-3 font-semibold italic text-[#141E1A]">{r.scientific_name}</td>
                    <td className="py-2 pr-3 text-slate-600">
                      {r.kingdom} &gt; {r.phylum} &gt; {r.class_name} &gt; {r.family}
                    </td>
                    <td className="py-2 pr-3 text-right font-mono tabular-nums">{r.read_count} ({r.relative_abundance}%)</td>
                    <td className="py-2 pr-3 text-right font-mono tabular-nums text-emerald-700">{r.confidence}%</td>
                    <td className="py-2 font-mono text-slate-600">{r.accession_id} · {r.reference_database}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Saved Reports History */}
      <div className="bg-white border border-[#D8E6DF] rounded-2xl p-6 space-y-4">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-[#064E3B]" />
          <h2 className="text-base font-semibold text-[#141E1A]">Exported Report History</h2>
        </div>

        {reports.length === 0 ? (
          <p className="text-xs text-slate-500">No reports exported yet.</p>
        ) : (
          <div className="divide-y divide-slate-100 text-xs">
            {reports.map((rep) => (
              <div key={rep.id} className="py-2.5 flex items-center justify-between gap-4">
                <div>
                  <p className="font-semibold text-slate-900">{rep.report_name}</p>
                  <p className="text-slate-500">{rep.dataset_name} · {rep.location}</p>
                </div>
                <div className="text-right font-mono text-slate-500">
                  <p className="uppercase text-[#064E3B] font-semibold">{rep.format}</p>
                  <p>{new Date(rep.created_at).toLocaleDateString()}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
