export interface CreditDetails {
  total_credits: number;
  theory_hours: number;
  practice_hours: number;
  self_study_hours: number;
}

export interface KSECMapping {
  K: boolean;
  S: boolean;
  E: boolean;
  C: boolean;
}

export interface KSABloomTaxonomy {
  domain_k: string | null;
  domain_s: string | null;
  domain_a: string | null;
}

export interface PLO {
  plo_number: number;
  plo_description: string;
  ksec_mapping: KSECMapping;
  ksa_bloom_taxonomy: KSABloomTaxonomy;
  outcome_type: 'Generic' | 'Specific';
}

export interface CurriculumAnalysis {
  curriculum_name: string;
  curriculum_version: string;
  plos: PLO[];
}

export interface CoursePLOMapping {
  course_code: string;
  course_name_th: string;
  curriculum_version: string;
  mappings: {
    plo_number: number;
    level: 'major' | 'minor' | 'none';
  }[];
}

export interface WeeklyPlan {
  week: number;
  topic: string;
  llo: string;
  tla: string;
  assessment: string;
}

export interface AssessmentItem {
  id: string;
  clo: string; // e.g. "CLO1: สามารถอธิบาย..."
  plos: number[]; // e.g. [1, 2]
  tla: string; // Teaching Learning Activity
  method: string; // Evaluation Method
  component: string; // Assessment Component (e.g. Final Exam)
  weight: number;
  weekStart: number;
  weekEnd: number;
  criteria?: string;
}

export interface Course {
  course_code: string;
  course_name_th: string;
  course_name_en: string;
  prerequisite: string;
  credits: string;
  credit_details: CreditDetails;
  description: string;
  curriculum_version: string;
}

export interface TQF3HistoryItem {
  instructorName: string;
  facultyName: string;
  academicYear: string;
  classroom: string;
  modificationDate: string;
  studyYear: string;
  curriculumVersion: string;
  weeklyPlans: WeeklyPlan[];
  assessments: AssessmentItem[];
  result: string | null;
  updatedAt: number;
}
