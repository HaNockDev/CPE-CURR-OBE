import { Course, CurriculumAnalysis, CoursePLOMapping, PLO, WeeklyPlan, AssessmentItem } from "../types";

export const extractCoursePLOMappingsFromText = async (data: any): Promise<CoursePLOMapping[]> => {
  const response = await fetch("/api/gemini/extract-mappings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ data }),
  });
  if (!response.ok) throw new Error("Failed to extract mappings");
  return await response.json();
};

export const extractCoursesFromText = async (text: string, versionHint?: string): Promise<Course[]> => {
  const response = await fetch("/api/gemini/extract-courses", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, versionHint }),
  });
  if (!response.ok) throw new Error("Failed to extract courses");
  return await response.json();
};

export const extractPLOsFromText = async (text: string): Promise<CurriculumAnalysis | null> => {
  const response = await fetch("/api/gemini/extract-plos", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  if (!response.ok) throw new Error("Failed to extract PLOs");
  return await response.json();
};

export const suggestWeeklyPlan = async (course: Course, plos: PLO[], mapping?: CoursePLOMapping): Promise<WeeklyPlan[]> => {
  const response = await fetch("/api/gemini/suggest-weekly", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ course, plos, mapping }),
  });
  if (!response.ok) throw new Error("Failed to suggest weekly plan");
  return await response.json();
};

export const suggestAssessmentMapping = async (course: Course, assessmentItems: AssessmentItem[]): Promise<AssessmentItem[]> => {
  const response = await fetch("/api/gemini/suggest-assessment", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ course, assessments: assessmentItems }),
  });
  if (!response.ok) throw new Error("Failed to suggest assessment mapping");
  return await response.json();
};

export const generateTQF3 = async (
  course: Course, 
  plos: PLO[], 
  mapping: CoursePLOMapping | undefined,
  config: {
    instructorName: string;
    faculty: string;
    academicYear: string;
    venue: string;
    updateDate: string;
    studentYear: string;
    programChair: string;
    programChairRole: string;
    reportDate: string;
  },
  weeklyPlans?: WeeklyPlan[],
  assessments?: AssessmentItem[]
): Promise<string> => {
  const mappedPloNumbers = mapping?.mappings
    .filter(m => m.level !== 'none')
    .map(m => m.plo_number) || [];
  
  const relevantPlos = plos.filter(p => mappedPloNumbers.includes(p.plo_number));

  const mappingText = relevantPlos.map(p => {
    const levelChar = mapping?.mappings.find(m => m.plo_number === p.plo_number)?.level === 'major' ? '(●)' : '(○)';
    return `PLO ${p.plo_number}: ${p.plo_description} ${levelChar}`;
  }).join('\n');

  const response = await fetch("/api/gemini/generate-tqf3", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      course,
      plos,
      mappingText,
      config,
      weeklyPlans,
      assessments
    }),
  });
  if (!response.ok) throw new Error("Failed to generate TQF3");
  const data = await response.json();
  return data.text || "Failed to generate TQF3";
};
