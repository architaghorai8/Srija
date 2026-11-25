import { type DragEvent, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowUpDown,
  CheckCircle2,
  Download,
  FileCode2,
  FlaskConical,
  Info,
  Search,
  Upload,
  X,
} from 'lucide-react';
import { apiRequest } from '../lib/api';
import type { BiodiversityMetrics, DatasetRecord, SampleDatasetTemplate, TaxonomicResult } from '../types';

interface AnalyzeEdnaViewProps {
  onAnalysisComplete: (datasetId: string) => void;
}

export function AnalyzeEdnaView({ onAnalysisComplete }: AnalyzeEdnaViewProps) {
  const [samples, setSamples] = useState<SampleDatasetTemplate[]>([]);
  const [datasetName, setDatasetName] = useState('');
  const [sampleId, setSampleId] = useState('');
  const [sampleType, setSampleType] = useState<DatasetRecord['sample_type']>('water');
  const [location, setLocation] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [collectionDate, setCollectionDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');

  const [fileName, setFileName] = useState('');
  const [fileSize, setFileSize] = useState(0);
  const [fileFormat, setFileFormat] = useState<'fasta' | 'fastq' | 'csv' | 'txt'>('fasta');
  const [fileContent, setFileContent] = useState('');
  const [validationStatus, setValidationStatus] = useState<'idle' | 'valid' | 'invalid'>('idle');
  const [validationMessage, setValidationMessage] = useState('');
  const [dragActive, setDragActive] = useState(false);

  const [uploadProgress, setUploadProgress] = useState(0);
  const [analysisStatus, setAnalysisStatus] = useState<'idle' | 'running' | 'completed' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [analyzedDataset, setAnalyzedDataset] = useState<DatasetRecord | null>(null);
  const [results, setResults] = useState<TaxonomicResult[]>([]);
  const [metrics, setMetrics] = useState<BiodiversityMetrics | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);

  // Filtering and sorting of identification results
  const [searchQuery, setSearchQuery] = useState('');
  const [kingdomFilter, setKingdomFilter] = useState('All');
  const [phylumFilter, setPhylumFilter] = useState('All');
  const [sortDir, setSortDir] = useState<'desc' | 'asc'>('desc');
  const [selectedTaxon, setSelectedTaxon] = useState<TaxonomicResult | null>(null);

  useEffect(() => {
    apiRequest<{ samples: SampleDatasetTemplate[] }>('/api/datasets/samples')
      .then((res) => setSamples(res.samples))
      .catch(() => {});
  }, []);

  function inferFormat(name: string): 'fasta' | 'fastq' | 'csv' | 'txt' | null {
    const ext = name.split('.').pop()?.toLowerCase() || '';
    if (['fasta', 'fa', 'fna'].includes(ext)) return 'fasta';
    if (['fastq', 'fq'].includes(ext)) return 'fastq';
    if (ext === 'csv') return 'csv';
    if (ext === 'txt') return 'txt';
    return null;
  }

  function validateClientFile(name: string, text: string, fmt: 'fasta' | 'fastq' | 'csv' | 'txt') {
    const bytes = new Blob([text]).size;
    setFileName(name);
    setFileSize(bytes);
    setFileFormat(fmt);
    setFileContent(text);

    if (bytes > 10 * 1024 * 1024) {
      setValidationStatus('invalid');
      setValidationMessage('File exceeds 10 MB maximum upload threshold.');
      return;
    }
    if (!text.trim()) {
      setValidationStatus('invalid');
      setValidationMessage('File appears to be empty.');
      return;
    }
    if (fmt === 'fasta' && !text.includes('>')) {
      setValidationStatus('invalid');
      setValidationMessage('FASTA file must include sequence header lines starting with ">".');
      return;
    }
    if (fmt === 'fastq' && !text.trim().startsWith('@')) {
      setValidationStatus('invalid');
      setValidationMessage('FASTQ file must start with "@" read headers.');
      return;
    }
    setValidationStatus('valid');
    setValidationMessage(`Validated ${fmt.toUpperCase()} payload (${(bytes / 1024).toFixed(2)} KB). Ready for analysis.`);
  }

  async function handleFileSelect(file: File | undefined) {
    if (!file) return;
    setErrorMsg(null);
    const fmt = inferFormat(file.name);
    if (!fmt) {
      setValidationStatus('invalid');
      setValidationMessage('Unsupported file extension. Please upload FASTA (.fasta/.fa), FASTQ (.fastq/.fq), CSV, or TXT.');
      return;
    }
    const text = await file.text();
    validateClientFile(file.name, text, fmt);
    if (!datasetName) {
      setDatasetName(file.name.replace(/\.[^.]+$/, ''));
    }
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragActive(false);
    handleFileSelect(e.dataTransfer.files?.[0]);
  }

  function loadSampleTemplate(tpl: SampleDatasetTemplate) {
    setErrorMsg(null);
    setDatasetName(tpl.datasetName);
    setSampleId(tpl.sampleId);
    setSampleType(tpl.sampleType);
    setLocation(tpl.location);
    setLatitude(String(tpl.latitude));
    setLongitude(String(tpl.longitude));
    setCollectionDate(tpl.collectionDate);
    setNotes(tpl.notes);
    validateClientFile(`${tpl.key}.${tpl.format}`, tpl.content, tpl.format);
  }

  async function handleAnalyze() {
    setErrorMsg(null);
    if (validationStatus !== 'valid' || !fileContent) {
      setErrorMsg('Please upload or load a valid FASTA, FASTQ, CSV, or TXT dataset before running analysis.');
      return;
    }
    setAnalysisStatus('running');
    setUploadProgress(25);

    const timer = window.setInterval(() => {
      setUploadProgress((prev) => (prev < 85 ? prev + 15 : prev));
    }, 180);

    try {
      const res = await apiRequest<{
        dataset: DatasetRecord;
        results: TaxonomicResult[];
        metrics: BiodiversityMetrics;
        warnings: string[];
      }>('/api/datasets/analyze', {
        method: 'POST',
        body: JSON.stringify({
          datasetName,
          sampleId,
          sampleType,
          location,
          latitude,
          longitude,
          collectionDate,
          notes,
          fileName,
          fileContent,
          fileFormat,
        }),
      });
      window.clearInterval(timer);
      setUploadProgress(100);
      setAnalysisStatus('completed');
      setAnalyzedDataset(res.dataset);
      setResults(res.results);
      setMetrics(res.metrics);
      setWarnings(res.warnings || []);
      onAnalysisComplete(res.dataset.id);
    } catch (err) {
      window.clearInterval(timer);
      setUploadProgress(0);
      setAnalysisStatus('error');
      setErrorMsg(err instanceof Error ? err.message : 'Analysis failed.');
    }
  }

  const kingdoms = useMemo(() => ['All', ...Array.from(new Set(results.map((r) => r.kingdom)))], [results]);
  const phyla = useMemo(() => ['All', ...Array.from(new Set(results.map((r) => r.phylum)))], [results]);

  const filteredResults = useMemo(() => {
    return results
      .filter((r) => {
        if (kingdomFilter !== 'All' && r.kingdom !== kingdomFilter) return false;
        if (phylumFilter !== 'All' && r.phylum !== phylumFilter) return false;
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const match = `${r.scientific_name} ${r.common_name} ${r.family} ${r.genus} ${r.accession_id}`.toLowerCase();
          if (!match.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => (sortDir === 'desc' ? b.confidence - a.confidence : a.confidence - b.confidence));
  }, [results, kingdomFilter, phylumFilter, searchQuery, sortDir]);

  function exportTaxaCsv() {
    if (filteredResults.length === 0) return;
    const headers = [
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
    ];
    const rows = filteredResults.map((r) => [
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
    ]);
    const csv = [headers, ...rows]
      .map((line) => line.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${analyzedDataset?.sample_id || 'edna-taxa'}-taxonomy.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold text-[#141E1A]">Analyze eDNA Dataset</h1>
          <p className="text-sm text-slate-600 mt-1">
            Upload FASTA, FASTQ, CSV, or TXT nucleotide sequence datasets for quality inspection and taxonomic alignment.
          </p>
        </div>

        {samples.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            {samples.map((tpl) => (
              <button
                key={tpl.key}
                type="button"
                onClick={() => loadSampleTemplate(tpl)}
                className="px-3 py-1.5 rounded-lg border border-emerald-300 bg-[#ECFDF5] hover:bg-emerald-100 text-[#064E3B] text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap"
              >
                Load Sample: {tpl.sampleId}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Scientific Transparency Notice */}
      <div className="p-4 rounded-xl bg-[#F0F7F4] border border-[#C6DFD3] flex items-start gap-3 text-xs text-[#141E1A]">
        <Info className="w-4 h-4 text-[#064E3B] shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-semibold">Bioinformatics Alignment Mode &amp; Scientific Transparency</p>
          <p className="text-slate-700 leading-relaxed">
            Sequences are parsed and validated directly on the server (IUPAC base check, GC%, read length, and FASTQ Phred Q-scores).
            When external NCBI BLAST / BOLD endpoints are not configured in server environment variables, taxonomic matches use local
            k-mer reference alignment across curated barcode markers and are explicitly labeled as{' '}
            <span className="font-semibold">Local Reference Demo</span> results. Reads below 88% similarity list alternative candidate taxa rather than claiming definitive species assignment.
          </p>
        </div>
      </div>

      {/* Upload & Metadata Form Grid */}
      <div className="grid lg:grid-cols-12 gap-6">
        <div className="lg:col-span-5 bg-white border border-[#D8E6DF] rounded-2xl p-6 space-y-4">
          <h2 className="text-lg font-semibold text-[#141E1A]">01. Sequence File Upload</h2>

          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragActive(true);
            }}
            onDragLeave={() => setDragActive(false)}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors ${
              dragActive ? 'border-emerald-600 bg-emerald-50/70' : 'border-[#BFD6CA] bg-[#F6FAF8]'
            }`}
          >
            <Upload className="w-8 h-8 text-[#064E3B] mx-auto mb-2" />
            <p className="text-sm font-semibold text-[#141E1A]">Drag &amp; drop eDNA sequence file</p>
            <p className="text-xs text-slate-500 mt-1">Accepted formats: FASTA (.fasta, .fa), FASTQ (.fastq, .fq), CSV, TXT (max 10 MB)</p>

            <label className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#064E3B] hover:bg-[#053F30] text-white text-xs font-semibold cursor-pointer">
              <FileCode2 className="w-4 h-4" />
              Browse Sequence File
              <input
                type="file"
                accept=".fasta,.fa,.fna,.fastq,.fq,.csv,.txt"
                className="hidden"
                onChange={(e) => handleFileSelect(e.target.files?.[0])}
              />
            </label>
          </div>

          {fileName && (
            <div className="p-3.5 rounded-xl border border-[#D8E6DF] bg-white space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-900 truncate">{fileName}</span>
                <span className="font-mono tabular-nums text-slate-600 shrink-0 ml-2">
                  {(fileSize / 1024).toFixed(2)} KB · {fileFormat.toUpperCase()}
                </span>
              </div>

              <div className="flex items-center gap-2">
                {validationStatus === 'valid' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                )}
                <span className={validationStatus === 'valid' ? 'text-emerald-800' : 'text-rose-700'}>
                  {validationMessage}
                </span>
              </div>

              {uploadProgress > 0 && (
                <div className="space-y-1 pt-1">
                  <div className="flex justify-between text-[11px] font-mono text-slate-500">
                    <span>Status: {analysisStatus}</span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-600 transition-all duration-200"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="lg:col-span-7 bg-white border border-[#D8E6DF] rounded-2xl p-6 space-y-4">
          <h2 className="text-lg font-semibold text-[#141E1A]">02. Sample &amp; Field Metadata</h2>

          <div className="grid sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Dataset Name *</label>
              <input
                type="text"
                value={datasetName}
                onChange={(e) => setDatasetName(e.target.value)}
                placeholder="e.g. Upper Rhine Spring Survey"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Sample ID *</label>
              <input
                type="text"
                value={sampleId}
                onChange={(e) => setSampleId(e.target.value)}
                placeholder="e.g. RHN-WTR-014"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>
          </div>

          <div className="grid sm:grid-cols-3 gap-3.5">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Sample Type *</label>
              <select
                value={sampleType}
                onChange={(e) => setSampleType(e.target.value as DatasetRecord['sample_type'])}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
              >
                <option value="water">Water</option>
                <option value="soil">Soil</option>
                <option value="sediment">Sediment</option>
                <option value="air">Air</option>
                <option value="biofilm">Biofilm</option>
                <option value="tissue">Tissue</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Sample Location *</label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. Lake Geneva Basin"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Collection Date *</label>
              <input
                type="date"
                value={collectionDate}
                onChange={(e) => setCollectionDate(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Latitude (optional)</label>
              <input
                type="number"
                step="any"
                value={latitude}
                onChange={(e) => setLatitude(e.target.value)}
                placeholder="e.g. 46.5197"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Longitude (optional)</label>
              <input
                type="number"
                step="any"
                value={longitude}
                onChange={(e) => setLongitude(e.target.value)}
                placeholder="e.g. 6.6323"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Additional Field Notes</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Filtration volume, pore size, extraction kit, negative controls..."
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
            />
          </div>

          {errorMsg && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="flex items-center justify-end pt-1">
            <button
              type="button"
              disabled={analysisStatus === 'running'}
              onClick={handleAnalyze}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#064E3B] hover:bg-[#053F30] disabled:opacity-60 text-white text-sm font-semibold transition-colors cursor-pointer"
            >
              <FlaskConical className="w-4 h-4" />
              {analysisStatus === 'running' ? 'Analyzing Sequences...' : 'Analyze Dataset'}
            </button>
          </div>
        </div>
      </div>

      {/* Analysis Results Section */}
      {analyzedDataset && metrics && (
        <section className="bg-white border border-[#D8E6DF] rounded-2xl p-6 space-y-5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-4">
            <div>
              <p className="text-xs font-mono text-emerald-700">
                {analyzedDataset.analysis_mode === 'local_reference_demo'
                  ? 'SIMULATED LOCAL REFERENCE ALIGNMENT'
                  : 'EXTERNAL REFERENCE ALIGNMENT'}
                {' · '}
                {analyzedDataset.sample_id}
              </p>
              <h2 className="text-xl font-semibold text-[#141E1A] mt-0.5">{analyzedDataset.dataset_name}</h2>
              <p className="text-xs text-slate-500 mt-1">
                {analyzedDataset.sequence_count} sequences · GC {analyzedDataset.gc_content}% · Mean length{' '}
                {analyzedDataset.mean_read_length} bp
                {analyzedDataset.mean_quality_score !== null ? ` · Mean Phred Q${analyzedDataset.mean_quality_score}` : ''}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-4 text-right">
              <div>
                <p className="text-[11px] text-slate-500">Species Richness</p>
                <p className="text-lg font-mono font-bold text-[#064E3B] tabular-nums">{metrics.species_richness}</p>
              </div>
              <div>
                <p className="text-[11px] text-slate-500">Shannon H&apos;</p>
                <p className="text-lg font-mono font-bold text-[#064E3B] tabular-nums">{metrics.shannon_index.toFixed(3)}</p>
              </div>
              <div>
                <p className="text-[11px] text-slate-500">Simpson (1 - D)</p>
                <p className="text-lg font-mono font-bold text-[#064E3B] tabular-nums">{metrics.simpson_diversity.toFixed(3)}</p>
              </div>
              <button
                type="button"
                onClick={exportTaxaCsv}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-300 hover:bg-slate-50 text-xs font-semibold text-slate-800 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                Export CSV
              </button>
            </div>
          </div>

          {warnings.length > 0 && (
            <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900">
              {warnings.join(' ')}
            </div>
          )}

          {/* Filter & Search Toolbar */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search scientific name, family, accession..."
                className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>

            <select
              value={kingdomFilter}
              onChange={(e) => setKingdomFilter(e.target.value)}
              className="px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white"
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
              className="px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white"
            >
              {phyla.map((p) => (
                <option key={p} value={p}>
                  Phylum: {p}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={() => setSortDir(sortDir === 'desc' ? 'asc' : 'desc')}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 hover:bg-slate-50 text-xs font-medium text-slate-700 cursor-pointer"
            >
              <ArrowUpDown className="w-3.5 h-3.5" />
              Confidence: {sortDir === 'desc' ? 'High to Low' : 'Low to High'}
            </button>
          </div>

          {/* Taxonomic Results Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs text-slate-500">
                  <th className="py-2.5 pr-4 font-semibold">Organism</th>
                  <th className="py-2.5 pr-4 font-semibold">Kingdom / Phylum</th>
                  <th className="py-2.5 pr-4 font-semibold">Family / Genus</th>
                  <th className="py-2.5 pr-4 font-semibold text-right">Reads</th>
                  <th className="py-2.5 pr-4 font-semibold text-right">Similarity</th>
                  <th className="py-2.5 pr-4 font-semibold text-right">Confidence</th>
                  <th className="py-2.5 pr-4 font-semibold">Reference</th>
                  <th className="py-2.5 font-semibold text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredResults.map((r) => (
                  <tr key={r.id} className="hover:bg-[#F6FAF8] transition-colors">
                    <td className="py-3 pr-4">
                      <p className="font-semibold italic text-[#141E1A]">{r.scientific_name}</p>
                      <p className="text-xs text-slate-500">{r.common_name || 'No common name recorded'}</p>
                    </td>
                    <td className="py-3 pr-4 text-xs text-slate-700">
                      {r.kingdom} · {r.phylum}
                    </td>
                    <td className="py-3 pr-4 text-xs text-slate-700">
                      {r.family} · <span className="italic">{r.genus}</span>
                    </td>
                    <td className="py-3 pr-4 text-right font-mono tabular-nums text-xs">
                      {r.read_count} ({r.relative_abundance}%)
                    </td>
                    <td className="py-3 pr-4 text-right font-mono tabular-nums text-xs">{r.similarity}%</td>
                    <td className="py-3 pr-4 text-right font-mono tabular-nums text-xs">
                      <span
                        className={`font-semibold ${
                          r.confidence >= 85
                            ? 'text-emerald-700'
                            : r.confidence >= 72
                              ? 'text-amber-700'
                              : 'text-rose-700'
                        }`}
                      >
                        {r.confidence}% · {r.confidence >= 85 ? 'High' : r.confidence >= 72 ? 'Moderate' : 'Uncertain'}
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-xs font-mono text-slate-600">
                      {r.accession_id}
                    </td>
                    <td className="py-3 text-right">
                      <button
                        type="button"
                        onClick={() => setSelectedTaxon(r)}
                        className="text-xs font-semibold text-[#064E3B] hover:underline cursor-pointer"
                      >
                        Inspect
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Organism Detail Modal */}
      {selectedTaxon && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white border border-[#D8E6DF] rounded-2xl max-w-xl w-full p-6 space-y-4 shadow-lg">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-mono text-emerald-700">
                  {selectedTaxon.marker_gene} · {selectedTaxon.accession_id}
                </p>
                <h3 className="text-2xl font-semibold italic text-[#141E1A] mt-0.5">
                  {selectedTaxon.scientific_name}
                </h3>
                <p className="text-sm text-slate-600">{selectedTaxon.common_name}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedTaxon(null)}
                aria-label="Close organism details"
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2.5 text-xs bg-[#F6FAF8] border border-[#D8E6DF] rounded-xl p-4">
              <div><span className="text-slate-500">Kingdom:</span> <strong className="text-slate-900">{selectedTaxon.kingdom}</strong></div>
              <div><span className="text-slate-500">Phylum:</span> <strong className="text-slate-900">{selectedTaxon.phylum}</strong></div>
              <div><span className="text-slate-500">Class:</span> <strong className="text-slate-900">{selectedTaxon.class_name}</strong></div>
              <div><span className="text-slate-500">Order:</span> <strong className="text-slate-900">{selectedTaxon.order_name}</strong></div>
              <div><span className="text-slate-500">Family:</span> <strong className="text-slate-900">{selectedTaxon.family}</strong></div>
              <div><span className="text-slate-500">Genus:</span> <strong className="text-slate-900 italic">{selectedTaxon.genus}</strong></div>
              <div><span className="text-slate-500">Species:</span> <strong className="text-slate-900 italic">{selectedTaxon.species}</strong></div>
              <div><span className="text-slate-500">Similarity / Confidence:</span> <strong className="font-mono text-emerald-800">{selectedTaxon.similarity}% / {selectedTaxon.confidence}%</strong></div>
            </div>

            <p className="text-xs text-slate-600">
              Reference source: <span className="font-medium text-slate-900">{selectedTaxon.reference_database}</span>
            </p>

            {selectedTaxon.uncertain_matches && selectedTaxon.uncertain_matches.length > 0 && (
              <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 space-y-2 text-xs">
                <p className="font-semibold text-amber-900">
                  Possible Alternative Taxonomic Matches (Ambiguity Advisory)
                </p>
                {selectedTaxon.uncertain_matches.map((m, idx) => (
                  <div key={idx} className="flex items-center justify-between text-amber-800">
                    <span className="italic">{m.scientific_name} ({m.family})</span>
                    <span className="font-mono tabular-nums">{m.similarity}%</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
