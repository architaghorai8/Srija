export type UserCategory = 'Student' | 'Researcher' | 'Scientist' | 'Teacher' | 'General user';

export interface UserProfile {
  uid: string;
  fullName: string;
  email: string;
  phone: string;
  institution: string;
  country: string;
  userCategory: UserCategory;
  role: 'user' | 'admin';
  status: 'active' | 'suspended';
  profileImage: string;
  emailVerified: boolean;
  notifyAnalysis: boolean;
  notifySecurity: boolean;
  notifyDigest: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

export interface UncertainMatchCandidate {
  scientific_name: string;
  genus: string;
  family: string;
  similarity: number;
  note: string;
}

export interface TaxonomicResult {
  id: string;
  dataset_id: string;
  scientific_name: string;
  common_name: string;
  kingdom: string;
  phylum: string;
  class_name: string;
  order_name: string;
  family: string;
  genus: string;
  species: string;
  read_count: number;
  relative_abundance: number;
  similarity: number;
  confidence: number;
  uncertain_matches: UncertainMatchCandidate[];
  reference_database: string;
  accession_id: string;
  marker_gene: string;
  dataset_name?: string;
  location?: string;
  collection_date?: string;
  sample_type?: string;
}

export interface BiodiversityMetrics {
  id?: string;
  dataset_id?: string;
  species_richness: number;
  shannon_index: number;
  simpson_index: number;
  simpson_diversity: number;
  evenness_index: number;
  total_reads: number;
  abundance_supported: number | boolean;
  calculated_at?: string;
}

export interface DatasetRecord {
  id: string;
  user_id: string;
  dataset_name: string;
  sample_id: string;
  sample_type: 'water' | 'soil' | 'sediment' | 'air' | 'biofilm' | 'tissue' | 'other';
  location: string;
  latitude: number | null;
  longitude: number | null;
  collection_date: string;
  notes: string;
  file_path: string;
  file_format: 'fasta' | 'fastq' | 'csv' | 'txt';
  file_size: number;
  sequence_count: number;
  gc_content: number;
  mean_read_length: number;
  mean_quality_score: number | null;
  upload_status: string;
  analysis_mode: string;
  created_at: string;
  species_richness?: number;
  shannon_index?: number;
  simpson_index?: number;
  simpson_diversity?: number;
  evenness_index?: number;
  total_reads?: number;
  job_status?: string;
  job_progress?: number;
}

export interface SampleDatasetTemplate {
  key: string;
  datasetName: string;
  sampleId: string;
  sampleType: 'water' | 'soil' | 'sediment' | 'air' | 'biofilm' | 'tissue' | 'other';
  location: string;
  latitude: number;
  longitude: number;
  collectionDate: string;
  format: 'fasta' | 'fastq' | 'csv' | 'txt';
  notes: string;
  content: string;
}

export interface SpeciesReferenceItem {
  id: string;
  scientific_name: string;
  common_name: string;
  kingdom: string;
  phylum: string;
  class_name: string;
  order_name: string;
  family: string;
  genus: string;
  species: string;
  organism_category: string;
  marker_gene: string;
  reference_database: string;
  accession_id: string;
  habitat: string;
  conservation_status: string;
  reference_motif: string;
  description: string;
  updated_at: string;
}

export interface LearningModuleItem {
  id: string;
  slug: string;
  title: string;
  category: string;
  summary: string;
  content: string;
  key_formula: string;
  order_index: number;
  published: number;
  updated_at: string;
}

export interface UserActivityItem {
  activity_id: string;
  uid: string;
  activity_type: string;
  description: string;
  ip_address: string;
  timestamp: string;
}

export interface NotificationItem {
  notification_id: string;
  uid: string;
  title: string;
  message: string;
  read: number;
  created_at: string;
}

export interface ReportRecord {
  id: string;
  user_id: string;
  dataset_id: string;
  report_name: string;
  format: 'pdf' | 'csv';
  file_path: string;
  created_at: string;
  dataset_name?: string;
  sample_id?: string;
  location?: string;
  collection_date?: string;
}

export type AppPage =
  | 'dashboard'
  | 'analyze'
  | 'datasets'
  | 'taxonomy'
  | 'biodiversity'
  | 'species'
  | 'reports'
  | 'learning'
  | 'profile'
  | 'settings';
