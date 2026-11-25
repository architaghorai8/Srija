import { ArrowRight, Leaf, Microscope, ShieldCheck } from 'lucide-react';
import { motion } from 'motion/react';
import { AnimatedDnaHelix, DnaLogo } from './DnaLogo';

interface SplashScreenProps {
  onGetStarted: () => void;
  onExploreLearning: () => void;
}

export function SplashScreen({ onGetStarted, onExploreLearning }: SplashScreenProps) {
  return (
    <div className="min-h-screen bg-[#06291F] text-white flex flex-col justify-between overflow-hidden relative">
      {/* Background photographic canvas with calibrated dark forest scrim */}
      <div className="absolute inset-0 pointer-events-none">
        <img
          src="/src/assets/images/splash_hero_edna_1795608907656.jpg"
          alt="Environmental DNA double helix intertwined with botanical leaves"
          referrerPolicy="no-referrer"
          className="w-full h-full object-cover opacity-35"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-[#041E16]/95 via-[#06291F]/80 to-[#064E3B]/70" />
      </div>

      {/* Top Bar Contract: 3 zones */}
      <header className="relative z-10 w-full max-w-7xl mx-auto px-6 lg:px-10 py-6 flex items-center justify-between gap-8">
        <div className="flex items-center gap-3 whitespace-nowrap shrink-0">
          <DnaLogo size={36} inverted />
          <span className="text-lg font-semibold tracking-tight text-white">eDNA BioScope</span>
        </div>

        <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-emerald-100/85">
          <a href="#overview" className="hover:text-white transition-colors whitespace-nowrap shrink-0">
            Platform
          </a>
          <a href="#workflow" className="hover:text-white transition-colors whitespace-nowrap shrink-0">
            Methodology
          </a>
          <button
            type="button"
            onClick={onExploreLearning}
            className="hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Learning Hub
          </button>
        </nav>

        <div className="shrink-0">
          <button
            type="button"
            onClick={onGetStarted}
            className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-[#04241A] text-sm font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Sign In
          </button>
        </div>
      </header>

      {/* Main Split Hero */}
      <main id="overview" className="relative z-10 w-full max-w-7xl mx-auto px-6 lg:px-10 py-10 lg:py-16 grid lg:grid-cols-12 gap-10 items-center">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
          className="lg:col-span-7 space-y-6"
        >
          <p className="text-sm font-medium text-emerald-300 tracking-wide">
            Discover · Identify · Conserve
          </p>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-semibold tracking-tight leading-[1.08] text-white [text-wrap:balance]">
            Identifying Taxonomy and Assessing Biodiversity from eDNA Datasets
          </h1>

          <p className="text-base sm:text-lg text-emerald-100/85 max-w-2xl leading-relaxed">
            Analyze environmental DNA sequences from water, soil, sediment, and air samples. Classify
            organisms from Kingdom to Species and quantify ecosystem health with calibrated Shannon and
            Simpson biodiversity analytics.
          </p>

          <div className="flex flex-wrap items-center gap-4 pt-2">
            <button
              type="button"
              onClick={onGetStarted}
              className="inline-flex items-center gap-2.5 px-6 py-3.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-[#04241A] font-semibold text-base transition-colors cursor-pointer whitespace-nowrap"
            >
              Get Started
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={onExploreLearning}
              className="inline-flex items-center gap-2 px-5 py-3.5 rounded-lg border border-emerald-400/35 hover:border-emerald-300 text-emerald-50 font-medium text-base transition-colors cursor-pointer whitespace-nowrap"
            >
              Read eDNA Methodology
            </button>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          className="lg:col-span-5 flex items-center justify-center"
        >
          <div className="w-full max-w-md rounded-2xl border border-emerald-400/20 bg-[#052219]/85 p-8 flex items-center justify-between gap-6">
            <div className="space-y-5">
              <div>
                <p className="text-xs font-mono text-emerald-300/90">METABARCODING LOCI</p>
                <p className="text-lg font-semibold text-white mt-1">COI · 12S · 16S · 18S · ITS</p>
              </div>
              <div className="h-px bg-emerald-400/15" />
              <div className="space-y-3 text-sm text-emerald-100/85">
                <div className="flex items-start gap-2.5">
                  <Microscope className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>FASTA, FASTQ, CSV &amp; TXT sequence QC and taxonomy matching</span>
                </div>
                <div className="flex items-start gap-2.5">
                  <Leaf className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>Shannon (H&apos;), Simpson (D &amp; 1-D), and species richness indices</span>
                </div>
                <div className="flex items-start gap-2.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>Conservative uncertainty flagging for low-similarity reads</span>
                </div>
              </div>
            </div>
            <div className="shrink-0">
              <AnimatedDnaHelix />
            </div>
          </div>
        </motion.div>
      </main>

      {/* Bottom Workflow Strip */}
      <section id="workflow" className="relative z-10 border-t border-emerald-400/15 bg-[#041D15]/80">
        <div className="max-w-7xl mx-auto px-6 lg:px-10 py-6 grid sm:grid-cols-3 gap-6 text-sm">
          <div>
            <p className="font-semibold text-emerald-300">01. Sequence Ingestion</p>
            <p className="text-emerald-100/75 mt-1">
              Validate nucleotide bases, GC content, and FASTQ Phred scores with strict file checks.
            </p>
          </div>
          <div>
            <p className="font-semibold text-emerald-300">02. Taxonomic Resolution</p>
            <p className="text-emerald-100/75 mt-1">
              Inspect 7-rank hierarchies alongside confidence thresholds and ambiguous match candidates.
            </p>
          </div>
          <div>
            <p className="font-semibold text-emerald-300">03. Conservation Reporting</p>
            <p className="text-emerald-100/75 mt-1">
              Compare habitats across dates and coordinates, then export peer-ready PDF and CSV reports.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
