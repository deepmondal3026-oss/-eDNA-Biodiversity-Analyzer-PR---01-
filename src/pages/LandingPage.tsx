import React, { useState } from 'react';
import { ArrowRight, CheckCircle2, Database, FileSpreadsheet, FlaskConical, Globe2, Microscope, ShieldCheck } from 'lucide-react';
import { BrandLogoIcon, ResilientImage } from '../components/BrandMark.tsx';
import { PWAInstallButton } from '../components/PWAInstallControls.tsx';

interface LandingPageProps {
  onNavigate: (path: string) => void;
  isAuthenticated: boolean;
}

export function LandingPage({ onNavigate, isAuthenticated }: LandingPageProps) {
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactOrg, setContactOrg] = useState('');
  const [contactMsg, setContactMsg] = useState('');
  const [contactSubmitted, setContactSubmitted] = useState(false);
  const [contactError, setContactError] = useState('');

  const handleContactSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setContactError('');
    if (!contactName.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail) || contactMsg.trim().length < 10) {
      setContactError('Please enter your name, a valid email address, and a brief research inquiry.');
      return;
    }
    setContactSubmitted(true);
  };

  return (
    <div className="min-h-screen bg-[#F5F8F5] text-[#172B22]">
      {/* Strict 3-Zone Top Bar Contract */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-xs border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between gap-8">
          <a
            href="#top"
            onClick={(e) => {
              e.preventDefault();
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className="flex items-center gap-2.5 text-lg font-bold tracking-tight text-[#123D2B] whitespace-nowrap shrink-0"
          >
            <BrandLogoIcon className="w-8 h-8 shrink-0" />
            <span>eDNA Biodiversity Explorer</span>
          </a>

          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
            <a href="#capabilities" className="hover:text-[#123D2B] transition-colors whitespace-nowrap shrink-0">
              Capabilities
            </a>
            <a href="#workflow" className="hover:text-[#123D2B] transition-colors whitespace-nowrap shrink-0">
              How It Works
            </a>
            <a href="#applications" className="hover:text-[#123D2B] transition-colors whitespace-nowrap shrink-0">
              Applications
            </a>
            <a href="#about" className="hover:text-[#123D2B] transition-colors whitespace-nowrap shrink-0">
              About
            </a>
            <a href="#contact" className="hover:text-[#123D2B] transition-colors whitespace-nowrap shrink-0">
              Contact
            </a>
          </nav>

          <div className="shrink-0">
            <button
              type="button"
              onClick={() => onNavigate(isAuthenticated ? '/dashboard' : '/register')}
              className="px-4 py-2 text-sm font-medium text-white bg-[#16834A] rounded-lg hover:bg-[#123D2B] transition-colors whitespace-nowrap shrink-0"
            >
              {isAuthenticated ? 'Open Workspace' : 'Get Started'}
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section id="top" className="max-w-7xl mx-auto px-6 pt-12 pb-16 lg:pt-16 lg:pb-24">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-stretch">
          <div className="lg:col-span-6 flex flex-col justify-center">
            <p className="text-xs font-semibold tracking-wider uppercase text-[#16834A] mb-3">
              Identify · Analyze · Preserve
            </p>
            <h1
              className="font-bold tracking-tight text-[#123D2B] leading-[1.1] mb-5"
              style={{ fontSize: 'clamp(2.25rem, 3.8vw, 3.5rem)', textWrap: 'balance' }}
            >
              Identifying taxonomy and assessing biodiversity from eDNA datasets.
            </h1>
            <p className="text-base text-slate-600 leading-relaxed max-w-xl mb-8">
              An environmental genomics workspace built for researchers, ecologists, and conservationists to
              validate FASTA, FASTQ, and ASV tables, explore taxonomic lineages, compute alpha diversity
              indices, and produce transparent scientific reports.
            </p>
            <div className="flex flex-wrap items-center gap-4">
              <button
                type="button"
                onClick={() => onNavigate(isAuthenticated ? '/dashboard' : '/register')}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-[#16834A] text-white text-sm font-semibold hover:bg-[#123D2B] transition-colors whitespace-nowrap shrink-0"
              >
                {isAuthenticated ? 'Go to Dashboard' : 'Get Started'}
                <ArrowRight className="w-4 h-4" />
              </button>
              <a
                href="#workflow"
                className="inline-flex items-center gap-2 px-5 py-3 rounded-lg bg-white border border-slate-300 text-sm font-semibold text-[#172B22] hover:border-[#123D2B] transition-colors whitespace-nowrap shrink-0"
              >
                Learn More
              </a>
              <PWAInstallButton variant="hero" />
              {!isAuthenticated && (
                <button
                  type="button"
                  onClick={() => onNavigate('/login')}
                  className="text-sm font-medium text-[#123D2B] hover:underline px-2 py-2 whitespace-nowrap shrink-0"
                >
                  Sign In
                </button>
              )}
            </div>
          </div>

          <div className="lg:col-span-6">
            <div className="h-full min-h-[320px] rounded-2xl overflow-hidden border border-slate-200 bg-white">
              <ResilientImage
                src="/src/assets/images/hero_edna_ecosystem_1795608854095.jpg"
                alt="Temperate forest river estuary with environmental DNA data visualization"
                fallbackTitle="Environmental DNA River Estuary"
                className="w-full h-full object-cover"
              />
            </div>
          </div>
        </div>

        {/* Evidence Strip Below Hero Split */}
        <div className="mt-12 grid grid-cols-2 lg:grid-cols-4 gap-4 bg-white border border-slate-200 rounded-xl p-6">
          <div>
            <div className="text-xs text-slate-500 mb-1">Supported Sequence Formats</div>
            <div className="text-lg font-mono tabular-nums font-semibold text-[#123D2B]">
              FASTA · FASTQ · CSV · TSV
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-500 mb-1">Ecological Diversity Metrics</div>
            <div className="text-lg font-mono tabular-nums font-semibold text-[#123D2B]">
              Shannon H&apos; · Simpson · Pielou
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-500 mb-1">Taxonomic Resolution</div>
            <div className="text-lg font-mono tabular-nums font-semibold text-[#123D2B]">
              Kingdom → Species (7 Ranks)
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-500 mb-1">Exportable Deliverables</div>
            <div className="text-lg font-mono tabular-nums font-semibold text-[#123D2B]">
              Audit-Ready PDF &amp; CSV
            </div>
          </div>
        </div>
      </section>

      {/* Capabilities Asymmetric Grid */}
      <section id="capabilities" className="bg-white border-y border-slate-200 py-20">
        <div className="max-w-7xl mx-auto px-6">
          <div className="max-w-2xl mb-12">
            <p className="text-xs font-semibold uppercase tracking-wider text-[#16A6A0] mb-2">
              Platform Capabilities
            </p>
            <h2 className="text-3xl font-bold text-[#123D2B] tracking-tight" style={{ textWrap: 'balance' }}>
              Purpose-built tools from sequence ingestion to conservation reporting
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2 p-7 rounded-xl border border-slate-200 bg-[#F5F8F5]">
              <Microscope className="w-6 h-6 text-[#16834A] mb-4" />
              <h3 className="text-lg font-semibold text-[#123D2B] mb-2">
                01. Environmental DNA Data Exploration &amp; Sequence QC
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Upload raw FASTA/FASTQ reads or pre-classified ASV/OTU abundance tables. Inspect exact read
                counts, base composition (GC%), Phred+33 Q20/Q30 quality distributions, and sequence length
                profiles before running downstream classification.
              </p>
            </div>

            <div className="p-7 rounded-xl border border-slate-200 bg-white">
              <Database className="w-6 h-6 text-[#16A6A0] mb-4" />
              <h3 className="text-lg font-semibold text-[#123D2B] mb-2">02. Taxonomic Identification</h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Explore complete 7-rank lineages (Kingdom to Species), reference database provenance, and
                assignment confidence scores without fabricated matches.
              </p>
            </div>

            <div className="p-7 rounded-xl border border-slate-200 bg-white">
              <Globe2 className="w-6 h-6 text-[#16834A] mb-4" />
              <h3 className="text-lg font-semibold text-[#123D2B] mb-2">03. Biodiversity Assessment</h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Compare taxon distributions across phyla and families, visualize community dominance, and inspect
                site-level ecological profiles.
              </p>
            </div>

            <div className="p-7 rounded-xl border border-slate-200 bg-white">
              <FlaskConical className="w-6 h-6 text-[#16A6A0] mb-4" />
              <h3 className="text-lg font-semibold text-[#123D2B] mb-2">04. Species Richness &amp; Indices</h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Compute validated Shannon (H&apos;), Gini-Simpson (1 - D), and Pielou&apos;s evenness (J&apos;)
                with transparent formula definitions and PCR-bias caveats.
              </p>
            </div>

            <div className="p-7 rounded-xl border border-slate-200 bg-[#F5F8F5]">
              <FileSpreadsheet className="w-6 h-6 text-[#123D2B] mb-4" />
              <h3 className="text-lg font-semibold text-[#123D2B] mb-2">05. Scientific Reporting &amp; AI Summaries</h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Export structured PDF and CSV ecological reports and generate Gemini-assisted explanations
                strictly grounded on verified result tables.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="workflow" className="max-w-7xl mx-auto px-6 py-20">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          <div className="lg:col-span-5 space-y-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-[#16834A] mb-2">
                Scientific Workflow
              </p>
              <h2 className="text-3xl font-bold text-[#123D2B] tracking-tight" style={{ textWrap: 'balance' }}>
                Four structured steps from water sample to ecological insight
              </h2>
            </div>

            <div className="space-y-5">
              {[
                {
                  step: '01. Sample & Metadata Ingestion',
                  text: 'Attach FASTA, FASTQ, CSV, or TSV files alongside sample ID, habitat type, collection coordinates, and marker gene.',
                },
                {
                  step: '02. Validation & Quality Filtering',
                  text: 'Verify sequence formatting, nucleotide ratios, and Phred quality scores prior to taxonomic assignment.',
                },
                {
                  step: '03. Taxonomic & Diversity Computation',
                  text: 'Inspect 7-rank organism assignments from reference engines or demonstration profiles and compute alpha diversity.',
                },
                {
                  step: '04. Transparent Reporting',
                  text: 'Download PDF/CSV deliverables documenting pipeline versions, reference databases, and methodological limitations.',
                },
              ].map((item) => (
                <div key={item.step} className="pb-4 border-b border-slate-200 last:border-b-0">
                  <h3 className="text-sm font-semibold text-[#123D2B] mb-1">{item.step}</h3>
                  <p className="text-sm text-slate-600">{item.text}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="rounded-xl overflow-hidden border border-slate-200 bg-white">
              <ResilientImage
                src="/src/assets/images/lab_water_sampling_1795608859706.jpg"
                alt="Field biologist filtering forest stream water for environmental DNA sampling"
                className="w-full h-64 object-cover"
              />
              <div className="p-4">
                <div className="text-xs text-slate-500">Field Filtration · Freshwater eDNA</div>
                <div className="text-sm font-semibold text-[#123D2B] mt-1">
                  Trace DNA Capture from Aquatic Habitats
                </div>
              </div>
            </div>
            <div className="rounded-xl overflow-hidden border border-slate-200 bg-white">
              <ResilientImage
                src="/src/assets/images/sequencing_bioinformatics_lab_1795608859117.jpg"
                alt="Genomics sequencing and bioinformatics laboratory workstation"
                className="w-full h-64 object-cover"
              />
              <div className="p-4">
                <div className="text-xs text-slate-500">Amplicon Sequencing · QC &amp; Taxonomy</div>
                <div className="text-sm font-semibold text-[#123D2B] mt-1">
                  Reference Database Alignment &amp; Indexing
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Scientific Applications */}
      <section id="applications" className="bg-white border-y border-slate-200 py-20">
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
          <div className="lg:col-span-5">
            <div className="rounded-2xl overflow-hidden border border-slate-200 aspect-square">
              <ResilientImage
                src="/src/assets/images/biodiversity_coral_estuary_1795608859034.jpg"
                alt="Diverse coastal kelp and marine reef ecosystem"
                className="w-full h-full object-cover"
              />
            </div>
          </div>
          <div className="lg:col-span-7">
            <p className="text-xs font-semibold uppercase tracking-wider text-[#16A6A0] mb-2">
              Scientific Applications
            </p>
            <h2 className="text-3xl font-bold text-[#123D2B] tracking-tight mb-6" style={{ textWrap: 'balance' }}>
              Non-invasive biomonitoring across aquatic and terrestrial ecosystems
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {[
                {
                  title: 'Freshwater & Watershed Health',
                  desc: 'Track salmonids, amphibians, and EPT macroinvertebrate bioindicators without disturbing sensitive stream beds.',
                },
                {
                  title: 'Coastal & Reef Conservation',
                  desc: 'Monitor scleractinian corals, kelp communities, and reef fish richness across marine protected areas.',
                },
                {
                  title: 'Invasive Species Early Detection',
                  desc: 'Identify low-abundance DNA signatures of invasive bivalves or pathogens prior to ecological establishment.',
                },
                {
                  title: 'Academic Research & Teaching',
                  desc: 'Use clearly labeled demonstration metabarcoding datasets to teach alpha diversity formulas and taxonomic classification.',
                },
              ].map((app) => (
                <div key={app.title} className="p-5 rounded-xl bg-[#F5F8F5] border border-slate-200">
                  <h3 className="text-sm font-semibold text-[#123D2B] mb-1.5">{app.title}</h3>
                  <p className="text-xs text-slate-600 leading-relaxed">{app.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* About & Scientific Integrity */}
      <section id="about" className="max-w-7xl mx-auto px-6 py-20">
        <div className="bg-[#123D2B] text-white rounded-2xl p-8 lg:p-12 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          <div className="lg:col-span-8">
            <div className="flex items-center gap-2 text-[#75C943] text-xs font-semibold uppercase tracking-wider mb-3">
              <ShieldCheck className="w-4 h-4" />
              <span>Scientific Rigor &amp; Data Isolation</span>
            </div>
            <h2 className="text-2xl lg:text-3xl font-bold mb-4" style={{ textWrap: 'balance' }}>
              Designed for reproducible research without fabricated classifications
            </h2>
            <p className="text-sm text-emerald-100/90 leading-relaxed max-w-2xl">
              eDNA Biodiversity Explorer separates identity management (Firebase Authentication &amp; Firestore) from
              scientific dataset storage (Supabase PostgreSQL &amp; Storage) behind verified server-side tokens. When
              no external BLAST or QIIME 2 pipeline is connected, demonstration datasets are explicitly labeled so
              exploratory results are never confused with validated wet-lab alignments.
            </p>
          </div>
          <div className="lg:col-span-4 flex flex-col sm:flex-row lg:flex-col gap-3 lg:items-end">
            <button
              type="button"
              onClick={() => onNavigate(isAuthenticated ? '/dashboard' : '/register')}
              className="px-6 py-3 rounded-lg bg-[#75C943] text-[#123D2B] text-sm font-bold hover:bg-white transition-colors whitespace-nowrap shrink-0"
            >
              {isAuthenticated ? 'Enter Research Dashboard' : 'Create Researcher Account'}
            </button>
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section id="contact" className="bg-white border-t border-slate-200 py-20">
        <div className="max-w-3xl mx-auto px-6">
          <div className="text-center mb-10">
            <p className="text-xs font-semibold uppercase tracking-wider text-[#16834A] mb-2">Contact</p>
            <h2 className="text-3xl font-bold text-[#123D2B]">Collaborations &amp; Research Inquiries</h2>
            <p className="text-sm text-slate-600 mt-2">
              Questions about integrating institutional BLAST/QIIME 2 pipelines or academic access? Send us a note.
            </p>
          </div>

          {contactSubmitted ? (
            <div className="p-6 rounded-xl bg-[#F5F8F5] border border-[#16834A]/30 text-center">
              <CheckCircle2 className="w-8 h-8 text-[#16834A] mx-auto mb-2" />
              <h3 className="text-base font-semibold text-[#123D2B]">Inquiry Recorded</h3>
              <p className="text-sm text-slate-600 mt-1">
                Thank you, {contactName}. Our research support team will respond to {contactEmail}.
              </p>
            </div>
          ) : (
            <form onSubmit={handleContactSubmit} className="space-y-4 bg-[#F5F8F5] border border-slate-200 rounded-xl p-6">
              {contactError && (
                <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-800">
                  {contactError}
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-[#172B22] mb-1">Full Name</label>
                  <input
                    type="text"
                    required
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                    placeholder="Dr. Elena Vance"
                    className="w-full px-3.5 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-[#16834A]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#172B22] mb-1">Email Address</label>
                  <input
                    type="email"
                    required
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                    placeholder="elena.vance@university.edu"
                    className="w-full px-3.5 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-[#16834A]"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-[#172B22] mb-1">Institution / Laboratory</label>
                <input
                  type="text"
                  value={contactOrg}
                  onChange={(e) => setContactOrg(e.target.value)}
                  placeholder="Department of Marine Ecology"
                  className="w-full px-3.5 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-[#16834A]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#172B22] mb-1">Message</label>
                <textarea
                  rows={4}
                  required
                  value={contactMsg}
                  onChange={(e) => setContactMsg(e.target.value)}
                  placeholder="Tell us about your eDNA datasets, marker genes, or conservation project..."
                  className="w-full px-3.5 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-[#16834A]"
                />
              </div>
              <button
                type="submit"
                className="px-5 py-2.5 rounded-lg bg-[#16834A] text-white text-sm font-semibold hover:bg-[#123D2B] transition-colors"
              >
                Send Message
              </button>
            </form>
          )}
        </div>
      </section>

      {/* Quiet Footer */}
      <footer className="bg-[#123D2B] text-emerald-100/80 py-10">
        <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs">
          <div className="flex items-center gap-2.5 text-white font-semibold">
            <BrandLogoIcon className="w-6 h-6" />
            <span>eDNA Biodiversity Explorer · Identify. Analyze. Preserve.</span>
          </div>
          <div className="flex flex-wrap items-center gap-6">
            <PWAInstallButton variant="footer" />
            <button type="button" onClick={() => onNavigate('/login')} className="hover:text-white transition-colors">
              Sign In
            </button>
            <button type="button" onClick={() => onNavigate('/register')} className="hover:text-white transition-colors">
              Register
            </button>
            <span>© {new Date().getFullYear()} eDNA Biodiversity Explorer</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
