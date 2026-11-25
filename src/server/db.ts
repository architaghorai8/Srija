import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const UPLOADS_DIR = path.resolve(DATA_DIR, 'uploads');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

export const dbPath = path.join(DATA_DIR, 'edna_bioscope.db');
export const uploadsDir = UPLOADS_DIR;

export const db = new DatabaseSync(dbPath);
db.exec('PRAGMA foreign_keys = ON;');
db.exec('PRAGMA journal_mode = WAL;');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    uid TEXT PRIMARY KEY,
    full_name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    phone TEXT DEFAULT '',
    institution TEXT DEFAULT '',
    country TEXT NOT NULL DEFAULT 'Global',
    user_category TEXT NOT NULL DEFAULT 'Researcher',
    role TEXT NOT NULL DEFAULT 'user',
    status TEXT NOT NULL DEFAULT 'active',
    profile_image TEXT DEFAULT '',
    email_verified INTEGER NOT NULL DEFAULT 0,
    verification_token TEXT DEFAULT '',
    password_hash TEXT NOT NULL,
    password_salt TEXT NOT NULL,
    notify_analysis INTEGER NOT NULL DEFAULT 1,
    notify_security INTEGER NOT NULL DEFAULT 1,
    notify_digest INTEGER NOT NULL DEFAULT 0,
    last_login_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS user_activity (
    activity_id TEXT PRIMARY KEY,
    uid TEXT NOT NULL,
    activity_type TEXT NOT NULL,
    description TEXT NOT NULL,
    ip_address TEXT DEFAULT '',
    timestamp TEXT NOT NULL,
    FOREIGN KEY (uid) REFERENCES users(uid) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS notifications (
    notification_id TEXT PRIMARY KEY,
    uid TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    read INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    FOREIGN KEY (uid) REFERENCES users(uid) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS application_settings (
    setting_id TEXT PRIMARY KEY,
    setting_value TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS datasets (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    dataset_name TEXT NOT NULL,
    sample_id TEXT NOT NULL,
    sample_type TEXT NOT NULL,
    location TEXT NOT NULL,
    latitude REAL,
    longitude REAL,
    collection_date TEXT NOT NULL,
    notes TEXT DEFAULT '',
    file_path TEXT NOT NULL,
    file_format TEXT NOT NULL,
    file_size INTEGER NOT NULL DEFAULT 0,
    sequence_count INTEGER NOT NULL DEFAULT 0,
    gc_content REAL NOT NULL DEFAULT 0,
    mean_read_length REAL NOT NULL DEFAULT 0,
    mean_quality_score REAL,
    upload_status TEXT NOT NULL DEFAULT 'validated',
    analysis_mode TEXT NOT NULL DEFAULT 'local_reference_demo',
    created_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(uid) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS analysis_jobs (
    id TEXT PRIMARY KEY,
    dataset_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    status TEXT NOT NULL,
    progress INTEGER NOT NULL DEFAULT 0,
    analysis_mode TEXT NOT NULL DEFAULT 'local_reference_demo',
    started_at TEXT NOT NULL,
    completed_at TEXT,
    error_message TEXT,
    FOREIGN KEY (dataset_id) REFERENCES datasets(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(uid) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS taxonomic_results (
    id TEXT PRIMARY KEY,
    dataset_id TEXT NOT NULL,
    scientific_name TEXT NOT NULL,
    common_name TEXT NOT NULL DEFAULT '',
    kingdom TEXT NOT NULL,
    phylum TEXT NOT NULL,
    class_name TEXT NOT NULL,
    order_name TEXT NOT NULL,
    family TEXT NOT NULL,
    genus TEXT NOT NULL,
    species TEXT NOT NULL,
    read_count INTEGER NOT NULL DEFAULT 1,
    relative_abundance REAL NOT NULL DEFAULT 0,
    similarity REAL NOT NULL,
    confidence REAL NOT NULL,
    uncertain_matches_json TEXT NOT NULL DEFAULT '[]',
    reference_database TEXT NOT NULL,
    accession_id TEXT NOT NULL,
    marker_gene TEXT NOT NULL DEFAULT 'COI',
    FOREIGN KEY (dataset_id) REFERENCES datasets(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS biodiversity_metrics (
    id TEXT PRIMARY KEY,
    dataset_id TEXT NOT NULL UNIQUE,
    species_richness INTEGER NOT NULL DEFAULT 0,
    shannon_index REAL NOT NULL DEFAULT 0,
    simpson_index REAL NOT NULL DEFAULT 0,
    simpson_diversity REAL NOT NULL DEFAULT 0,
    evenness_index REAL NOT NULL DEFAULT 0,
    total_reads INTEGER NOT NULL DEFAULT 0,
    abundance_supported INTEGER NOT NULL DEFAULT 1,
    calculated_at TEXT NOT NULL,
    FOREIGN KEY (dataset_id) REFERENCES datasets(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS reports (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    dataset_id TEXT NOT NULL,
    report_name TEXT NOT NULL,
    format TEXT NOT NULL,
    file_path TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(uid) ON DELETE CASCADE,
    FOREIGN KEY (dataset_id) REFERENCES datasets(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS species_reference (
    id TEXT PRIMARY KEY,
    scientific_name TEXT NOT NULL UNIQUE,
    common_name TEXT NOT NULL,
    kingdom TEXT NOT NULL,
    phylum TEXT NOT NULL,
    class_name TEXT NOT NULL,
    order_name TEXT NOT NULL,
    family TEXT NOT NULL,
    genus TEXT NOT NULL,
    species TEXT NOT NULL,
    organism_category TEXT NOT NULL,
    marker_gene TEXT NOT NULL,
    reference_database TEXT NOT NULL,
    accession_id TEXT NOT NULL,
    habitat TEXT NOT NULL,
    conservation_status TEXT NOT NULL,
    reference_motif TEXT NOT NULL,
    description TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS learning_modules (
    id TEXT PRIMARY KEY,
    slug TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    category TEXT NOT NULL,
    summary TEXT NOT NULL,
    content TEXT NOT NULL,
    key_formula TEXT DEFAULT '',
    order_index INTEGER NOT NULL DEFAULT 0,
    published INTEGER NOT NULL DEFAULT 1,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    actor_uid TEXT,
    actor_email TEXT,
    action TEXT NOT NULL,
    target_type TEXT NOT NULL,
    target_id TEXT DEFAULT '',
    details TEXT DEFAULT '',
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS password_resets (
    id TEXT PRIMARY KEY,
    uid TEXT NOT NULL,
    token_hash TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    used INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    FOREIGN KEY (uid) REFERENCES users(uid) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_datasets_user ON datasets(user_id);
  CREATE INDEX IF NOT EXISTS idx_jobs_user ON analysis_jobs(user_id);
  CREATE INDEX IF NOT EXISTS idx_taxa_dataset ON taxonomic_results(dataset_id);
  CREATE INDEX IF NOT EXISTS idx_activity_uid ON user_activity(uid);
  CREATE INDEX IF NOT EXISTS idx_notifications_uid ON notifications(uid);
`);

function seedReferenceData() {
  const now = new Date().toISOString();
  const speciesCount = db.prepare('SELECT COUNT(*) as c FROM species_reference').get() as { c: number };
  if (speciesCount.c === 0) {
    const insertSpecies = db.prepare(`
      INSERT INTO species_reference (
        id, scientific_name, common_name, kingdom, phylum, class_name, order_name,
        family, genus, species, organism_category, marker_gene, reference_database,
        accession_id, habitat, conservation_status, reference_motif, description, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const speciesSeed = [
      ['sp-01', 'Salmo trutta', 'Brown Trout', 'Animalia', 'Chordata', 'Actinopterygii', 'Salmoniformes', 'Salmonidae', 'Salmo', 'Salmo trutta', 'Freshwater Fish', '12S rRNA', 'NCBI GenBank', 'NC_010007.1', 'Cold freshwater rivers and alpine streams', 'Least Concern (IUCN)', 'ATGGCTTAGTCCGAAACACCTATGTTACGA', 'Indicator salmonid sensitive to dissolved oxygen, thermal shifts, and riparian siltation.', now],
      ['sp-02', 'Oncorhynchus mykiss', 'Rainbow Trout', 'Animalia', 'Chordata', 'Actinopterygii', 'Salmoniformes', 'Salmonidae', 'Oncorhynchus', 'Oncorhynchus mykiss', 'Freshwater Fish', 'COI', 'BOLD Systems', 'BOLD:AAA4218', 'Cool oxygenated rivers and lakes', 'Least Concern (IUCN)', 'CCTCTATCTTGTATTTGGTGCCTGAGCCG', 'Widely surveyed freshwater teleost used as a benchmark vertebrate target in aquatic eDNA metabarcoding.', now],
      ['sp-03', 'Cottus gobio', 'European Bullhead', 'Animalia', 'Chordata', 'Actinopterygii', 'Scorpaeniformes', 'Cottidae', 'Cottus', 'Cottus gobio', 'Freshwater Fish', '12S rRNA', 'NCBI GenBank', 'MF124891.1', 'Benthic gravel beds in clear streams', 'Least Concern (IUCN)', 'TGCCAGCAGCCGCGGTTATACGAGAGGC', 'Benthic indicator species vulnerable to barrier fragmentation and sediment hypoxia.', now],
      ['sp-04', 'Rana temporaria', 'Common Frog', 'Animalia', 'Chordata', 'Amphibia', 'Anura', 'Ranidae', 'Rana', 'Rana temporaria', 'Amphibian', '12S rRNA', 'NCBI GenBank', 'AY145582.1', 'Wetlands, marshes, and woodland ponds', 'Least Concern (IUCN)', 'GCTAGACGAGTCATACCATTAATCCATG', 'Semi-aquatic amphibian frequently detected during spring spawning via surface water eDNA.', now],
      ['sp-05', 'Triturus cristatus', 'Great Crested Newt', 'Animalia', 'Chordata', 'Amphibia', 'Urodela', 'Salamandridae', 'Triturus', 'Triturus cristatus', 'Amphibian', 'COI', 'BOLD Systems', 'BOLD:AAB9104', 'Vegetated lowland ponds and fens', 'Protected / Near Threatened (Regional)', 'ATTGGAGCCCCAGACATGGCATTCCCCC', 'Flagship conservation amphibian routinely monitored using standardized qPCR and eDNA metabarcoding.', now],
      ['sp-06', 'Austropotamobius pallipes', 'White-clawed Crayfish', 'Animalia', 'Arthropoda', 'Malacostraca', 'Decapoda', 'Astacidae', 'Austropotamobius', 'Austropotamobius pallipes', 'Crustacean', 'COI', 'BOLD Systems', 'BOLD:AAC3319', 'Calcareous streams with rocky refugia', 'Endangered (IUCN)', 'GGTCAACAAATCATAAAGATATTGGAA', 'Endangered native freshwater decapod tracked via eDNA to detect cryptic populations and crayfish plague.', now],
      ['sp-07', 'Daphnia magna', 'Water Flea', 'Animalia', 'Arthropoda', 'Branchiopoda', 'Diplostraca', 'Daphniidae', 'Daphnia', 'Daphnia magna', 'Zooplankton', '18S rRNA', 'NCBI GenBank', 'AF532884.1', 'Freshwater lakes and eutrophic ponds', 'Least Concern (IUCN)', 'CGATGCTCTTAGCTGAGTGTCCCGCGGG', 'Keystone cladoceran grazer linking phytoplankton productivity to higher freshwater trophic levels.', now],
      ['sp-08', 'Baetis rhodani', 'Large Dark Olive Mayfly', 'Animalia', 'Arthropoda', 'Insecta', 'Ephemeroptera', 'Baetidae', 'Baetis', 'Baetis rhodani', 'Macroinvertebrate', 'COI', 'BOLD Systems', 'BOLD:AAD7741', 'Riffle zones of unpolluted streams', 'Least Concern (IUCN)', 'TACTTTATATTTTATTTTTGGAATTTGA', 'Ephemeroptera bioindicator species widely scored in EPT biotic water quality indices.', now],
      ['sp-09', 'Gammarus pulex', 'Freshwater Shrimp', 'Animalia', 'Arthropoda', 'Malacostraca', 'Amphipoda', 'Gammaridae', 'Gammarus', 'Gammarus pulex', 'Crustacean', 'COI', 'NCBI GenBank', 'AJ269593.1', 'Leaf litter in flowing streams', 'Least Concern (IUCN)', 'GGAACTGTTTATCCACCTTTATCTGGAA', 'Shredder detritivore essential for riparian leaf decomposition and stream nutrient cycling.', now],
      ['sp-10', 'Margaritifera margaritifera', 'Freshwater Pearl Mussel', 'Animalia', 'Mollusca', 'Bivalvia', 'Unionida', 'Margaritiferidae', 'Margaritifera', 'Margaritifera margaritifera', 'Bivalve Mollusk', 'COI', 'NCBI GenBank', 'DQ272385.1', 'Oligotrophic granite-bed rivers', 'Endangered (IUCN)', 'TTGGTGCATGAGCAGGAATAGTGGGAAC', 'Critically imperiled filter-feeding mussel dependent on salmonid hosts for glochidia dispersal.', now],
      ['sp-11', 'Thalassiosira pseudonana', 'Marine Centric Diatom', 'Chromista', 'Bacillariophyta', 'Mediophyceae', 'Thalassiosirales', 'Thalassiosiraceae', 'Thalassiosira', 'Thalassiosira pseudonana', 'Phytoplankton', '18S rRNA', 'SILVA / NCBI', 'EF192982.1', 'Coastal marine and estuarine photic zones', 'Not Evaluated', 'AGTAGTCATATGCTTGTCTCAAAGATTA', 'Silicified marine diatom driving coastal primary production and carbon export.', now],
      ['sp-12', 'Navicula cryptocephala', 'Pennate Freshwater Diatom', 'Chromista', 'Bacillariophyta', 'Bacillariophyceae', 'Naviculales', 'Naviculaceae', 'Navicula', 'Navicula cryptocephala', 'Benthic Microalgae', 'rbcL', 'NCBI GenBank', 'AM501977.1', 'Benthic biofilms on stream cobbles', 'Not Evaluated', 'TGGTACATGGACAACTGTGTGGACCGAC', 'Benthic diatom used in diatom-based river trophic status assessment.', now],
      ['sp-13', 'Posidonia oceanica', 'Neptune Grass', 'Plantae', 'Tracheophyta', 'Liliopsida', 'Alismatales', 'Posidoniaceae', 'Posidonia', 'Posidonia oceanica', 'Seagrass', 'rbcL', 'NCBI GenBank', 'U80719.1', 'Sublittoral coastal seagrass meadows', 'Least Concern (IUCN)', 'ATGTCACCACAAACAGAGACTAAAGCA', 'Endemic Mediterranean seagrass forming carbon-rich blue-carbon nursery habitats.', now],
      ['sp-14', 'Quercus robur', 'Pedunculate Oak', 'Plantae', 'Tracheophyta', 'Magnoliopsida', 'Fagales', 'Fagaceae', 'Quercus', 'Quercus robur', 'Terrestrial Angiosperm', 'rbcL', 'BOLD Systems', 'BOLD:PLNT1042', 'Temperate broadleaf woodland soils', 'Least Concern (IUCN)', 'CCGTTGGAGAGATCGTTTCTTATTTTGT', 'Canopy oak detected in soil and airborne eDNA surveys via chloroplast rbcL markers.', now],
      ['sp-15', 'Sphagnum capillifolium', 'Red Bog-moss', 'Plantae', 'Bryophyta', 'Sphagnopsida', 'Sphagnales', 'Sphagnaceae', 'Sphagnum', 'Sphagnum capillifolium', 'Bryophyte', 'ITS2', 'NCBI GenBank', 'AY309702.1', 'Ombrotrophic peatlands and bogs', 'Least Concern (IUCN)', 'GCATCGATGAAGAACGTAGCGAAATGCG', 'Peat-forming bryophyte regulating carbon sequestration and acidic mire hydrology.', now],
      ['sp-16', 'Glomus intraradices', 'Arbuscular Mycorrhizal Fungus', 'Fungi', 'Mucoromycota', 'Glomeromycetes', 'Glomerales', 'Glomeraceae', 'Rhizophagus', 'Glomus intraradices', 'Mycorrhizal Fungus', 'ITS', 'UNITE / NCBI', 'AF185682.1', 'Rhizosphere and agricultural/forest soils', 'Not Evaluated', 'TCCTCCGCTTATTGATATGCGAAGTAGG', 'Obligate root symbiont enhancing phosphorus uptake and soil aggregate stability.', now],
      ['sp-17', 'Laccaria bicolor', 'Bicoloured Deceiver', 'Fungi', 'Basidiomycota', 'Agaricomycetes', 'Agaricales', 'Hydnangiaceae', 'Laccaria', 'Laccaria bicolor', 'Ectomycorrhizal Fungus', 'ITS', 'UNITE / NCBI', 'DQ149869.1', 'Conifer and birch forest litter', 'Least Concern (IUCN)', 'AACCTGCGGAAGGATCATTATTGAATAA', 'Model ectomycorrhizal basidiomycete indicative of intact temperate forest mycoflora.', now],
      ['sp-18', 'Batrachochytrium dendrobatidis', 'Amphibian Chytrid Fungus', 'Fungi', 'Chytridiomycota', 'Chytridiomycetes', 'Rhizophydiales', 'Incertae sedis', 'Batrachochytrium', 'Batrachochytrium dendrobatidis', 'Fungal Pathogen', 'ITS', 'NCBI GenBank', 'AY997031.1', 'Cool moist freshwater habitats', 'Pathogen Surveillance Target', 'CCTTATTTGGAGACTTTTTTGTCTATTT', 'High-priority wildlife pathogen monitored via aquatic eDNA for early amphibian conservation alerts.', now],
      ['sp-19', 'Pseudomonas fluorescens', 'Rhizosphere Bacterium', 'Bacteria', 'Pseudomonadota', 'Gammaproteobacteria', 'Pseudomonadales', 'Pseudomonadaceae', 'Pseudomonas', 'Pseudomonas fluorescens', 'Soil & Water Bacterium', '16S rRNA', 'SILVA / NCBI', 'NR_113647.1', 'Plant roots, freshwater, and moist soil', 'Not Evaluated', 'AGAGTTTGATCCTGGCTCAGATTGAACG', 'Plant-growth-promoting gram-negative bacterium producing siderophores in healthy soils.', now],
      ['sp-20', 'Nitrospira moscoviensis', 'Nitrite-Oxidizing Bacterium', 'Bacteria', 'Nitrospirota', 'Nitrospiria', 'Nitrospirales', 'Nitrospiraceae', 'Nitrospira', 'Nitrospira moscoviensis', 'Nitrifying Bacterium', '16S rRNA', 'SILVA / NCBI', 'NR_029287.1', 'Freshwater biofilms and wastewater wetlands', 'Not Evaluated', 'GTGCCAGCAGCCGCGGTAATACAGAGGG', 'Keystone nitrifying bacterium driving nitrogen oxidation in freshwater sediments.', now],
      ['sp-21', 'Synechococcus elongatus', 'Freshwater Cyanobacterium', 'Bacteria', 'Cyanobacteriota', 'Cyanophyceae', 'Synechococcales', 'Synechococcaceae', 'Synechococcus', 'Synechococcus elongatus', 'Cyanobacterium', '16S rRNA', 'SILVA / NCBI', 'NR_074309.1', 'Surface freshwater and sunlit estuaries', 'Not Evaluated', 'GGATTAGATACCCTGGTAGTCCACGCCG', 'Unicellular photosynthetic cyanobacterium contributing to pelagic oxygen production.', now],
      ['sp-22', 'Caretta caretta', 'Loggerhead Sea Turtle', 'Animalia', 'Chordata', 'Reptilia', 'Testudines', 'Cheloniidae', 'Caretta', 'Caretta caretta', 'Marine Reptile', '12S rRNA', 'NCBI GenBank', 'NC_016923.1', 'Coastal pelagic and nesting beaches', 'Vulnerable (IUCN)', 'AAACTGGGATTAGATACCCCACTATGCT', 'Migratory marine vertebrate detectable in coastal eDNA plumes around foraging reefs.', now],
      ['sp-23', 'Lutra lutra', 'Eurasian Otter', 'Animalia', 'Chordata', 'Mammalia', 'Carnivora', 'Mustelidae', 'Lutra', 'Lutra lutra', 'Semi-aquatic Mammal', '12S rRNA', 'NCBI GenBank', 'NC_011358.1', 'Riparian rivers, estuaries, and lakes', 'Near Threatened (IUCN)', 'TACACATGCAAGTATCCGCACCCCCGTG', 'Apex semi-aquatic mammal serving as an umbrella indicator for healthy watershed corridors.', now],
      ['sp-24', 'Zostera marina', 'Common Eelgrass', 'Plantae', 'Tracheophyta', 'Liliopsida', 'Alismatales', 'Zosteraceae', 'Zostera', 'Zostera marina', 'Marine Seagrass', 'rbcL', 'BOLD Systems', 'BOLD:AAZ2014', 'Temperate intertidal mudflats and bays', 'Least Concern (IUCN)', 'GTTGGATTCAAAGCTGGTGTTAAAGATT', 'Habitat-forming marine angiosperm supporting juvenile fish recruitment and shoreline stabilization.', now]
    ];

    for (const row of speciesSeed) {
      insertSpecies.run(...row);
    }
  }

  const moduleCount = db.prepare('SELECT COUNT(*) as c FROM learning_modules').get() as { c: number };
  if (moduleCount.c === 0) {
    const insertMod = db.prepare(`
      INSERT INTO learning_modules (id, slug, title, category, summary, content, key_formula, order_index, published, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
    `);

    const modulesSeed = [
      [
        'mod-01',
        'what-is-edna',
        'What is Environmental DNA (eDNA)?',
        'Foundations',
        'Trace genetic material shed by organisms into water, soil, sediment, and air enables non-invasive biodiversity monitoring.',
        'Environmental DNA (eDNA) consists of intracellular and extracellular DNA fragments released into the surrounding environment through shed skin cells, mucus, scales, gametes, feces, root exudates, or decomposing tissue. Unlike traditional capture-based surveys, eDNA sampling captures signals from elusive, nocturnal, microscopic, and endangered species without disturbing habitats.',
        'Detection Signal = Shedding Rate - (Degradation + Dilution + Transport)',
        1,
        now
      ],
      [
        'mod-02',
        'how-edna-sampling-works',
        'How eDNA Sampling Works in the Field',
        'Field Protocol',
        'Sterile water filtration, soil coring, and contamination controls preserve trace DNA molecules from field to bench.',
        'Water samples (typically 0.5 to 2.0 liters) are drawn through 0.22–0.45 µm sterile membrane filters using peristaltic or syringe pumps. Soil and sediment cores capture adsorbed extracellular DNA bound to clay and humic particles. Field blanks (ultrapure nuclease-free water filtered on-site) and sterile single-use consumables prevent cross-site contamination before cold-chain transport or silica/buffer preservation.',
        'Filter Pore Size: 0.22 um - 0.45 um | Cold Storage: -20 C or Longmire Buffer',
        2,
        now
      ],
      [
        'mod-03',
        'dna-sequencing-fundamentals',
        'DNA Sequencing & Metabarcoding Fundamentals',
        'Molecular Biology',
        'Targeted barcode loci (COI, 12S, 16S, 18S, ITS, rbcL) amplify taxonomic signatures across mixed environmental extracts.',
        'Following DNA extraction, polymerase chain reaction (PCR) primers target conserved flanking regions around hypervariable taxonomic barcodes: mitochondrial COI or 12S rRNA for animals, 16S rRNA for prokaryotes, 18S rRNA for micro-eukaryotes, nuclear ITS for fungi, and chloroplast rbcL for plants. High-throughput sequencing generates FASTQ reads with per-base Phred quality scores (Q30 = 99.9% base call accuracy) prior to denoising into Amplicon Sequence Variants (ASVs).',
        'Q = -10 * log10(P_error)  |  Q30 => P_error = 0.001',
        3,
        now
      ],
      [
        'mod-04',
        'taxonomic-classification',
        'Taxonomic Classification & Reference Curation',
        'Bioinformatics',
        'Assigning sequences across Kingdom to Species requires curated reference databases and conservative confidence thresholds.',
        'Denoised reads are aligned against curated voucher databases such as NCBI GenBank, BOLD Systems, SILVA, and UNITE. High sequence similarity (>= 97–99%) against well-vouchered barcodes supports species-level assignment, whereas lower similarity (80–94%) or multi-taxon ties should be reported conservatively at Genus, Family, or candidate-match resolution to prevent false positives.',
        'Kingdom -> Phylum -> Class -> Order -> Family -> Genus -> Species',
        4,
        now
      ],
      [
        'mod-05',
        'biodiversity-assessment',
        'Biodiversity Assessment & Read-Count Limitations',
        'Ecology',
        'Understanding alpha diversity, relative read abundance, and why PCR bias requires cautious quantitative interpretation.',
        'Biodiversity assessment evaluates species richness (how many taxa are present) alongside community evenness (how evenly detections are distributed). In eDNA metabarcoding, raw read counts are influenced by differential primer binding efficiency, mitochondrial copy number variation, body biomass, water temperature, and DNA degradation rates. Therefore, relative read abundance is informative within standardized protocols but should be interpreted alongside presence/absence and replicate consistency.',
        'p_i = n_i / N  (Relative proportion of taxon i reads)',
        5,
        now
      ],
      [
        'mod-06',
        'shannon-diversity-index',
        "Shannon Diversity Index (H')",
        'Quantitative Metrics',
        'Information-theoretic measure combining species richness and proportional abundance across a sampled community.',
        "The Shannon-Wiener Diversity Index (H') quantifies uncertainty in predicting the species identity of a randomly drawn individual or sequence read from a community. Values typically range from 1.5 to 3.5 in natural ecological communities, increasing when both species richness and evenness rise.",
        "H' = -sum(p_i * ln(p_i))",
        6,
        now
      ],
      [
        'mod-07',
        'simpson-diversity-index',
        'Simpson Dominance (D) & Diversity (1 - D)',
        'Quantitative Metrics',
        'Probability-based metrics distinguishing community dominance from overall biodiversity.',
        'Simpson Dominance Index (D) represents the probability that two reads randomly selected from a sample belong to the same taxon (ranging from 0 to 1, where higher D means lower diversity and stronger dominance). Simpson Diversity Index (1 - D) expresses the complementary probability that two randomly drawn entities represent different species, making 1 - D intuitive for comparing conservation health.',
        'D = sum(p_i^2)   |   Simpson Diversity = 1 - D',
        7,
        now
      ],
      [
        'mod-08',
        'biodiversity-conservation',
        'Importance of Biodiversity Conservation',
        'Conservation',
        'Early detection of invasive species, cryptic endangered taxa, and ecosystem baseline shifts informs evidence-led stewardship.',
        'Freshwater, marine, and terrestrial ecosystems are experiencing rapid habitat compression and climate variability. Environmental DNA monitoring provides rapid, reproducible early-warning detection for invasive colonizers, wildlife pathogens like Batrachochytrium dendrobatidis, and endangered umbrella species like Margaritifera margaritifera, empowering watershed agencies and conservation researchers to act before populations collapse.',
        'Detect Early -> Map Taxonomic Change -> Prioritize Habitat Protection',
        8,
        now
      ]
    ];

    for (const m of modulesSeed) {
      insertMod.run(...m);
    }
  }

  const settingsCount = db.prepare('SELECT COUNT(*) as c FROM application_settings').get() as { c: number };
  if (settingsCount.c === 0) {
    const insertSetting = db.prepare(
      'INSERT INTO application_settings (setting_id, setting_value, updated_at) VALUES (?, ?, ?)'
    );
    insertSetting.run('max_upload_mb', '10', now);
    insertSetting.run('default_confidence_threshold', '75', now);
    insertSetting.run('require_email_verification', 'true', now);
    insertSetting.run('analysis_engine_label', 'Local Reference Alignment (Simulated Demo Mode)', now);
  }
}

seedReferenceData();
