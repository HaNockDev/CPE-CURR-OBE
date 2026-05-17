/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Upload,
  FileText,
  Download,
  Loader2,
  Search,
  CheckCircle2,
  LayoutGrid,
  ListChecks,
  Target,
  BrainCircuit,
  ShieldAlert,
  Award,
  FileCode,
  Wand2,
  FileSearch,
  Trash2,
  FileX,
  Import,
  User,
  Calendar,
  Settings2,
  Sparkles,
  Printer,
  History,
  Eye,
  Edit3,
  Book,
  ChevronRight,
  ChevronLeft,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";
import { marked } from "marked";
import { extractTextFromPdf } from "./lib/pdf";
import { extractDataFromExcel } from "./lib/excel";
import {
  extractCoursesFromText,
  extractPLOsFromText,
  extractCoursePLOMappingsFromText,
  generateTQF3,
  suggestWeeklyPlan,
  suggestAssessmentMapping,
} from "./services/geminiService";
import {
  Course,
  CurriculumAnalysis,
  CoursePLOMapping,
  PLO,
  WeeklyPlan,
  AssessmentItem,
  TQF3HistoryItem,
} from "./types";

type Mode = "courses" | "plos" | "mapping" | "import" | "tqf3" | "history";

export default function App() {
  const [mode, setMode] = useState<Mode>("courses");
  const [courses, setCourses] = useState<Course[]>(() => {
    const saved = localStorage.getItem("obe_courses");
    return saved ? JSON.parse(saved) : [];
  });
  const [curriculums, setCurriculums] = useState<CurriculumAnalysis[]>(() => {
    const saved = localStorage.getItem("obe_curriculums");
    if (saved) return JSON.parse(saved);
    // Migration from old single object
    const old = localStorage.getItem("obe_curriculum"); // Check both old possible keys
    const old2 = localStorage.getItem("obe_curriculum_data");
    const data = old ? JSON.parse(old) : (old2 ? JSON.parse(old2) : null);
    return data ? [data] : [];
  });
  const [coursePloMappings, setCoursePloMappings] = useState<
    CoursePLOMapping[]
  >(() => {
    const saved = localStorage.getItem("obe_mappings");
    return saved ? JSON.parse(saved) : [];
  });
  const [showPloModal, setShowPloModal] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectionTerm, setSelectionTerm] = useState("");
  const [selectedCourseCode, setSelectedCourseCode] = useState<string | null>(
    null,
  );
  const [tqf3Result, setTqf3Result] = useState<string | null>(null);
  const [tqf3Store, setTqf3Store] = useState<Record<string, TQF3HistoryItem>>(() => {
    const saved = localStorage.getItem("obe_tqf3_store");
    return saved ? JSON.parse(saved) : {};
  });

  const [curriculumVersion, setCurriculumVersion] = useState(() => localStorage.getItem("obe_curriculum_version") || "2568");

  React.useEffect(() => {
    localStorage.setItem("obe_curriculum_version", curriculumVersion);
  }, [curriculumVersion]);

  const isInternalLoading = useRef(false);
  const [isHistoryAction, setIsHistoryAction] = useState<"edit" | "preview" | null>(null);

  // TQF3 Inputs
  const [instructorName, setInstructorName] = useState(() => localStorage.getItem("obe_instructor") || "");
  const [facultyName, setFacultyName] = useState(() => localStorage.getItem("obe_faculty") || "เทคโนโลยีอุตสาหกรรม");
  const [academicYear, setAcademicYear] = useState(() => localStorage.getItem("obe_year") || "1/2568");
  const [classroom, setClassroom] = useState(() => localStorage.getItem("obe_classroom") || "อาคารปฏิบัติการฯ ห้อง 6102");
  const [modificationDate, setModificationDate] = useState(() => localStorage.getItem("obe_modification_date") || "17/10/2568");
  const [studyYear, setStudyYear] = useState(() => localStorage.getItem("obe_study_year") || "2");
  const [reportDate, setReportDate] = useState(() => localStorage.getItem("obe_report_date") || "17/10/2568");
  const [programChair, setProgramChair] = useState(() => localStorage.getItem("obe_program_chair") || "อาจารย์ชิตณรงค์ เพ็งแตง");
  const [programChairRole, setProgramChairRole] = useState(() => localStorage.getItem("obe_program_chair_role") || "ประธานหลักสูตร/Program Chair");
  const [weeklyPlans, setWeeklyPlans] = useState<WeeklyPlan[]>(() => {
    const saved = localStorage.getItem("obe_weekly_plans");
    return saved ? JSON.parse(saved) : [];
  });
  const [assessments, setAssessments] = useState<AssessmentItem[]>(() => {
    const saved = localStorage.getItem("obe_assessments");
    const defaultData: AssessmentItem[] = [
      {
        id: "1",
        clo: "CLO1: สามารถอธิบายหลักการเบื้องต้นของวิชาชีพ",
        plos: [1, 2],
        tla: "การบรรยาย, การอภิปรายกลุ่ม",
        method: "การทดสอบย่อย, การเข้าชั้นเรียน",
        component: "Quiz 1",
        weight: 10,
        weekStart: 1,
        weekEnd: 4,
      },
      {
        id: "2",
        clo: "CLO2: ประยุกต์ใช้ความรู้ในการแก้ปัญหาโจทย์แบบฝึกหัด",
        plos: [2, 3],
        tla: "การทำแบบฝึกหัด, Case Study",
        method: "สมุดบันทึกงาน, การตรวจผลงาน",
        component: "Homework Set A",
        weight: 20,
        weekStart: 5,
        weekEnd: 8,
      },
      {
        id: "3",
        clo: "CLO3: ออกแบบและพัฒนาโครงงานขนาดย่อมได้",
        plos: [4, 5],
        tla: "Project-based Learning",
        method: "การนำเสนอโครงงาน, รายงาน",
        component: "Mini Project",
        weight: 30,
        weekStart: 9,
        weekEnd: 15,
      },
      {
        id: "4",
        clo: "CLO4: วิเคราะห์และสรุปผลการทดลองได้อย่างถูกต้อง",
        plos: [1],
        tla: "Lab Session",
        method: "การสอบข้อเขียน",
        component: "Mid-term Exam",
        weight: 20,
        weekStart: 8,
        weekEnd: 8,
      },
      {
        id: "5",
        clo: "CLO5: มีจรรยาบรรณวิชาชีพและรับผิดชอบต่องาน",
        plos: [6],
        tla: "Role Playing, Seminar",
        method: "การสอบข้อเขียน",
        component: "Final Exam",
        weight: 20,
        weekStart: 16,
        weekEnd: 16,
      },
    ];

    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return parsed.map((item: any) => ({
          ...item,
          clo: item.clo || (item.clos && item.clos[0] ? item.clos[0] : ""),
          plos: Array.isArray(item.plos) ? item.plos : [],
          tla: item.tla || "",
          component: item.component || item.method || "",
          method: item.method || "",
        }));
      } catch (e) {
        return defaultData;
      }
    }
    return defaultData;
  });
  const [activeConfigTab, setActiveConfigTab] = useState<
    "info" | "weekly" | "assessment"
  >("info");

  const handleAddWeekly = () => {
    const nextWeek =
      weeklyPlans.length > 0
        ? Math.max(...weeklyPlans.map((p) => p.week)) + 1
        : 1;
    setWeeklyPlans([
      ...weeklyPlans,
      { week: nextWeek, topic: "", llo: "", tla: "", assessment: "" },
    ]);
  };

  const handleRemoveWeekly = (index: number) => {
    setWeeklyPlans(weeklyPlans.filter((_, i) => i !== index));
  };

  const handleAddAssessment = () => {
    const newId = (
      Math.max(0, ...assessments.map((a) => parseInt(a.id) || 0)) + 1
    ).toString();
    setAssessments([
      ...assessments,
      { 
        id: newId, 
        clo: `CLO${assessments.length + 1}: `, 
        plos: [], 
        tla: "", 
        method: "", 
        component: "",
        weekStart: 1, 
        weekEnd: 1, 
        weight: 0, 
        criteria: "" 
      },
    ]);
  };

  const handleRemoveAssessment = (id: string) => {
    setAssessments(assessments.filter((a) => a.id !== id));
  };

  const fileInputRef = useRef<HTMLInputElement>(null);
  const jsonInputRef = useRef<HTMLInputElement>(null);
  const [importTarget, setImportTarget] = useState<
    "courses" | "plos" | "mapping" | "all"
  >("all");

  // Persistence
  React.useEffect(() => {
    localStorage.setItem("obe_courses", JSON.stringify(courses));
  }, [courses]);

  React.useEffect(() => {
    localStorage.setItem("obe_curriculums", JSON.stringify(curriculums));
  }, [curriculums]);

  React.useEffect(() => {
    localStorage.setItem("obe_mappings", JSON.stringify(coursePloMappings));
  }, [coursePloMappings]);

  React.useEffect(() => {
    localStorage.setItem("obe_instructor", instructorName);
  }, [instructorName]);

  React.useEffect(() => {
    localStorage.setItem("obe_faculty", facultyName);
  }, [facultyName]);

  React.useEffect(() => {
    localStorage.setItem("obe_year", academicYear);
  }, [academicYear]);

  React.useEffect(() => {
    localStorage.setItem("obe_classroom", classroom);
  }, [classroom]);

  React.useEffect(() => {
    localStorage.setItem("obe_modification_date", modificationDate);
  }, [modificationDate]);

  React.useEffect(() => {
    localStorage.setItem("obe_report_date", reportDate);
  }, [reportDate]);

  React.useEffect(() => {
    localStorage.setItem("obe_program_chair", programChair);
  }, [programChair]);

  React.useEffect(() => {
    localStorage.setItem("obe_program_chair_role", programChairRole);
  }, [programChairRole]);

  React.useEffect(() => {
    localStorage.setItem("obe_study_year", studyYear);
  }, [studyYear]);

  React.useEffect(() => {
    localStorage.setItem("obe_weekly_plans", JSON.stringify(weeklyPlans));
  }, [weeklyPlans]);

  React.useEffect(() => {
    localStorage.setItem("obe_assessments", JSON.stringify(assessments));
  }, [assessments]);

  React.useEffect(() => {
    localStorage.setItem("obe_tqf3_store", JSON.stringify(tqf3Store));
  }, [tqf3Store]);

  // Security: Reset selection if version changes to prevent version-leakage
  React.useEffect(() => {
    setSelectedCourseCode(null);
    setTqf3Result(null);
    setWeeklyPlans([]);
    setAssessments([]);
  }, [curriculumVersion]);

  // Sync current TQF3 fields to store per course (namespaced by version)
  React.useEffect(() => {
    if (selectedCourseCode && mode === "tqf3" && !isInternalLoading.current) {
      const storeKey = `${curriculumVersion}-${selectedCourseCode}`;
      setTqf3Store((prev) => ({
        ...prev,
        [storeKey]: {
          instructorName,
          facultyName,
          academicYear,
          classroom,
          modificationDate,
          studyYear,
          curriculumVersion,
          weeklyPlans,
          assessments,
          result: tqf3Result,
          updatedAt: Date.now(),
        },
      }));
    }
  }, [
    instructorName,
    facultyName,
    academicYear,
    classroom,
    modificationDate,
    studyYear,
    curriculumVersion,
    weeklyPlans,
    assessments,
    tqf3Result,
    selectedCourseCode,
    mode,
  ]);

  // Load TQF3 fields when course selection changes (using namespaced key)
  React.useEffect(() => {
    const storeKey = `${curriculumVersion}-${selectedCourseCode}`;
    if (selectedCourseCode && tqf3Store[storeKey]) {
      const data = tqf3Store[storeKey];
      isInternalLoading.current = true;
      setInstructorName(data.instructorName || "");
      setFacultyName(data.facultyName || "เทคโนโลยีอุตสาหกรรม");
      setAcademicYear(data.academicYear || "1/2568");
      setClassroom(data.classroom || "อาคารปฏิบัติการฯ ห้อง 6102");
      setModificationDate(data.modificationDate || "17/10/2568");
      setStudyYear(data.studyYear || "2");
      
      // Migrate assessment data if necessary
      const migratedAssessments = (data.assessments || []).map((item: any) => ({
        ...item,
        clos: Array.isArray(item.clos) ? item.clos : (item.clo ? item.clo.split(',').map((s: string) => s.trim()) : []),
        weekStart: item.weekStart || item.week || 1,
        weekEnd: item.weekEnd || item.week || 1,
      }));
      
      setWeeklyPlans(data.weeklyPlans || []);
      setAssessments(migratedAssessments);
      
      if (isHistoryAction === "preview") {
        setTqf3Result(data.result || null);
      } else if (isHistoryAction === "edit") {
        setTqf3Result(null);
      } else {
        setTqf3Result(data.result || null);
      }
      
      // Delay resetting the guard to ensure save effect doesn't catch intermediate states
      setTimeout(() => {
        isInternalLoading.current = false;
      }, 100);
    } else if (selectedCourseCode) {
      // New course, reset everything to defaults for this specific course in current version
      isInternalLoading.current = true;
      setInstructorName("");
      setFacultyName("เทคโนโลยีอุตสาหกรรม");
      setAcademicYear("1/2568");
      setClassroom("อาคารปฏิบัติการฯ ห้อง 6102");
      setModificationDate("17/10/2568");
      setStudyYear("2");
      setTqf3Result(null);
      setWeeklyPlans([]);
      setAssessments([
        {
          id: "1",
          clo: "CLO1: สามารถอธิบายหลักการเบื้องต้นของวิชาชีพ",
          plos: [1, 2],
          tla: "การบรรยาย, การอภิปรายกลุ่ม",
          method: "การทดสอบย่อย, การเข้าชั้นเรียน",
          component: "Quiz 1",
          weight: 10,
          criteria: "ผ่านเกณฑ์เมื่อได้คะแนนร้อยละ 60 ขึ้นไป",
          weekStart: 1,
          weekEnd: 4
        }
      ]);
      
      setTimeout(() => {
        isInternalLoading.current = false;
      }, 100);
    }
  }, [selectedCourseCode, curriculumVersion]);

  const filteredCourses = useMemo(() => {
    return (courses || []).filter(c => c.curriculum_version === curriculumVersion);
  }, [courses, curriculumVersion]);

  const displayCourses = useMemo(() => {
    return filteredCourses.filter(
      (c) =>
        (c.course_name_th || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (c.course_name_en || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (c.course_code || "").toLowerCase().includes(searchTerm.toLowerCase()),
    );
  }, [filteredCourses, searchTerm]);

  const selectionFilteredCourses = useMemo(() => {
    return filteredCourses.filter(
      (c) =>
        (c.course_name_th || "").toLowerCase().includes(selectionTerm.toLowerCase()) ||
        (c.course_name_en || "").toLowerCase().includes(selectionTerm.toLowerCase()) ||
        (c.course_code || "").toLowerCase().includes(selectionTerm.toLowerCase()),
    );
  }, [filteredCourses, selectionTerm]);

  const currentCurriculum = useMemo(() => {
    return curriculums.find(c => normalizeVersion(c.curriculum_version) === curriculumVersion) || null;
  }, [curriculums, curriculumVersion]);

  const filteredPLOs = useMemo(() => {
    if (!currentCurriculum) return [];
    return currentCurriculum.plos.filter(
      (p) =>
        (p.plo_description || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.plo_number || "").toString().includes(searchTerm),
    );
  }, [currentCurriculum, searchTerm]);

  const filteredMappings = useMemo(() => {
    return (coursePloMappings || []).filter(m => m.curriculum_version === curriculumVersion);
  }, [coursePloMappings, curriculumVersion]);

  const normalizeVersion = (v: any) => {
    const s = String(v);
    if (s === "64") return "2564";
    if (s === "68") return "2568";
    return s;
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsLoading(true);

      if (mode === "mapping") {
        setStatus("กำลังอ่านไฟล์ Excel...");
        const excelData = await extractDataFromExcel(file);
        setStatus("กำลังวิเคราะห์ข้อมูลด้วย AI...");
        const mappings = await extractCoursePLOMappingsFromText(excelData);
        
        let targetVersion = curriculumVersion;
        const rawDetected = mappings.find(m => m.curriculum_version)?.curriculum_version;
        const detectedVersion = rawDetected ? normalizeVersion(rawDetected) : null;
        
        if (detectedVersion && detectedVersion !== curriculumVersion) {
          if (confirm(`พบข้อมูลของปี ${detectedVersion} แต่ปัจจุบันเลือก ${curriculumVersion} ต้องการเปลี่ยนไปใช้เวอร์ชันตามไฟล์ใช่หรือไม่?`)) {
            targetVersion = detectedVersion;
            setCurriculumVersion(detectedVersion);
          }
        }

        const taggedMappings = mappings.map(m => ({
          ...m,
          curriculum_version: normalizeVersion(m.curriculum_version || targetVersion)
        }));
        
        setCoursePloMappings(prev => {
          const others = prev.filter(p => p.curriculum_version !== targetVersion);
          return [...others, ...taggedMappings];
        });
      } else {
        setStatus("กำลังอ่านไฟล์ PDF...");
        const text = await extractTextFromPdf(file);
        setStatus("กำลังวิเคราะห์ข้อมูลด้วย AI...");
        if (mode === "courses") {
          const extractedCourses = await extractCoursesFromText(text, curriculumVersion);
          
          let targetVersion = curriculumVersion;
          const rawDetected = extractedCourses.find(c => c.curriculum_version)?.curriculum_version;
          const detectedVersion = rawDetected ? normalizeVersion(rawDetected) : null;
          
          if (detectedVersion && detectedVersion !== curriculumVersion) {
            if (confirm(`พบข้อมูลของปี ${detectedVersion} แต่ปัจจุบันเลือก ${curriculumVersion} ต้องการเปลี่ยนไปใช้เวอร์ชันตามไฟล์ใช่หรือไม่?`)) {
              targetVersion = detectedVersion;
              setCurriculumVersion(detectedVersion);
            }
          }

          const taggedCourses = extractedCourses.map(c => ({
            ...c,
            curriculum_version: normalizeVersion(c.curriculum_version || targetVersion)
          }));
          
          setCourses(prev => {
            const others = prev.filter(p => p.curriculum_version !== targetVersion);
            return [...others, ...taggedCourses];
          });
        } else if (mode === "plos") {
          const analysis = await extractPLOsFromText(text);
          if (analysis) {
             const targetVersion = normalizeVersion(analysis.curriculum_version || curriculumVersion);
             if (targetVersion !== curriculumVersion) {
               if (confirm(`พบข้อมูลรุ่นปี ${targetVersion} ต้องการสลับไปจัดการหลักสูตรรุ่นนี้ใช่หรือไม่?`)) {
                 setCurriculumVersion(targetVersion);
               }
             }
             setCurriculums(prev => {
               const others = prev.filter(c => normalizeVersion(c.curriculum_version) !== targetVersion);
               return [...others, { ...analysis, curriculum_version: targetVersion }];
             });
          }
        }
      }
      setStatus("");
    } catch (error) {
      console.error(error);
      alert("เกิดข้อผิดพลาดในการประมวลผลไฟล์");
    } finally {
      setIsLoading(false);
    }
    if (e.target) e.target.value = "";
  };

  const handleJsonImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);

        if (importTarget === "courses") {
          if (
            Array.isArray(json) &&
            json.length > 0 &&
            "course_code" in json[0]
          ) {
            const detectedVersion = normalizeVersion(json[0]?.curriculum_version || curriculumVersion);
            if (detectedVersion !== curriculumVersion) {
              if (confirm(`ข้อมูลนี้เป็นรุ่นปี ${detectedVersion} ต้องการสลับไปจัดการหลักสูตรรุ่นนี้ใช่หรือไม่?`)) {
                setCurriculumVersion(detectedVersion);
              }
            }
            const tagged = json.map((c: any) => ({
              ...c,
              curriculum_version: normalizeVersion(c.curriculum_version || detectedVersion)
            }));
            setCourses(prev => {
              const others = prev.filter(p => normalizeVersion(p.curriculum_version) !== detectedVersion);
              return [...others, ...tagged];
            });
          } else alert("JSON นี้ไม่ใช่ข้อมูลรายวิชา");
        } else if (importTarget === "plos") {
          if (json && "plos" in json) {
            const targetVersion = normalizeVersion(json.curriculum_version || curriculumVersion);
            if (targetVersion !== curriculumVersion) {
              if (confirm(`ข้อมูลนี้เป็นรุ่นปี ${targetVersion} ต้องการสลับไปจัดการหลักสูตรรุ่นนี้ใช่หรือไม่?`)) {
                setCurriculumVersion(targetVersion);
              }
            }
            setCurriculumData({
              ...(json as CurriculumAnalysis),
              curriculum_version: targetVersion
            });
          } else alert("JSON นี้ไม่ใช่ข้อมูล PLO Analysis");
        } else if (importTarget === "mapping") {
          if (Array.isArray(json) && json.length > 0 && "mappings" in json[0]) {
            const detectedVersion = normalizeVersion(json[0]?.curriculum_version || curriculumVersion);
            if (detectedVersion !== curriculumVersion) {
              if (confirm(`ข้อมูลนี้เป็นรุ่นปี ${detectedVersion} ต้องการสลับไปจัดการหลักสูตรรุ่นนี้ใช่หรือไม่?`)) {
                setCurriculumVersion(detectedVersion);
              }
            }
            const tagged = json.map((m: any) => ({
              ...m,
              curriculum_version: normalizeVersion(m.curriculum_version || detectedVersion)
            }));
            setCoursePloMappings(prev => {
              const others = prev.filter(p => normalizeVersion(p.curriculum_version) !== detectedVersion);
              return [...others, ...tagged];
            });
          } else alert("JSON นี้ไม่ใช่ข้อมูล Mapping");
        } else if (importTarget === "all") {
          if (json && typeof json === "object") {
            const versionInFile = json.curriculumVersion ? normalizeVersion(json.curriculumVersion) : null;
            const versionToUse = versionInFile || curriculumVersion;
            
            // Validation: If version mismatch, ask user
            if (versionInFile && versionInFile !== curriculumVersion) {
              const confirmImport = confirm(`ข้อมูลที่นำเข้าเป็นเวอร์ชัน ${versionInFile} แต่ปัจจุบันคุณเลือกปี ${curriculumVersion} ต้องการเปลี่ยนไปใช้เวอร์ชันตามไฟล์ใช่หรือไม่?`);
              if (confirmImport) setCurriculumVersion(versionInFile);
            }

            if (json.courses) {
              const tagged = (json.courses as Course[]).map(c => ({
                ...c,
                curriculum_version: normalizeVersion(c.curriculum_version || versionToUse)
              }));
              setCourses(tagged);
            }
            
            if (json.curriculumData) {
              const data = json.curriculumData as CurriculumAnalysis;
              setCurriculumData({
                ...data,
                curriculum_version: normalizeVersion(data.curriculum_version || versionToUse)
              });
            }
            
            if (json.mappings) {
              const tagged = (json.mappings as CoursePLOMapping[]).map(m => ({
                ...m,
                curriculum_version: normalizeVersion(m.curriculum_version || versionToUse)
              }));
              setCoursePloMappings(tagged);
            }
            
            if (json.tqf3Store) {
              setTqf3Store(json.tqf3Store);
              localStorage.setItem("obe_tqf3_store", JSON.stringify(json.tqf3Store));
            }
            
            alert(`นำเข้าข้อมูลทั้งหมดเรียบร้อยแล้ว (จัดการเป็นเวอร์ชัน: ${versionToUse})`);
          }
        } else {
          // Auto guess if target is 'all'
          if (Array.isArray(json)) {
            if (json.length > 0 && "mappings" in json[0])
              setCoursePloMappings(json as CoursePLOMapping[]);
            else if (json.length > 0 && "course_code" in json[0])
              setCourses(json as Course[]);
          } else if (json && "plos" in json) {
            setCurriculumData(json as CurriculumAnalysis);
          }
        }
      } catch (error) {
        alert("รูปแบบไฟล์ JSON ไม่ถูกต้อง");
      }
    };
    reader.readAsText(file);
    if (e.target) e.target.value = "";
  };

  const filteredHistory = useMemo(() => {
    return Object.entries(tqf3Store).filter(([_, data]) => data.curriculumVersion === curriculumVersion);
  }, [tqf3Store, curriculumVersion]);

  const handleGenerateTQF3 = async () => {
    if (!selectedCourseCode || !courses.length || filteredPLOs.length === 0) {
      alert("กรุณาเลือกวิชาและตรวจสอบว่ามีข้อมูล PLO ของหลักสูตรปีที่เลือกแล้ว");
      return;
    }

    const course = courses.find((c) => c.course_code === selectedCourseCode && normalizeVersion(c.curriculum_version) === curriculumVersion);
    if (!course) {
      alert("ไม่พบข้อมูลรายวิชานี้ในหลักสูตรเวอร์ชันปัจจุบัน");
      return;
    }

    const mapping = coursePloMappings.find(
      (m) => m.course_code === selectedCourseCode && normalizeVersion(m.curriculum_version) === curriculumVersion,
    );
    
    // Safety check: Use only PLOs from this version
    const plos = filteredPLOs;

    try {
      setIsLoading(true);
      setStatus("กำลังสร้าง มคอ. 3 ด้วย AI...");
      const result = await generateTQF3(
        course,
        plos,
        mapping,
        {
          instructorName,
          faculty: facultyName,
          academicYear,
          venue: classroom,
          updateDate: modificationDate,
          studentYear: studyYear,
          programChair,
          programChairRole,
          reportDate
        },
        weeklyPlans,
        assessments,
      );
      setTqf3Result(result);
      
      // Explicitly update store immediately upon success (use namespaced key)
      const storeKey = `${curriculumVersion}-${selectedCourseCode}`;
      setTqf3Store((prev) => {
        const updatedStore = {
          ...prev,
          [storeKey]: {
            instructorName,
            facultyName,
            academicYear,
            classroom,
            modificationDate,
            studyYear,
            reportDate,
            programChair,
            programChairRole,
            curriculumVersion,
            weeklyPlans,
            assessments,
            result: result,
            updatedAt: Date.now(),
          },
        };
        localStorage.setItem("obe_tqf3_store", JSON.stringify(updatedStore));
        return updatedStore;
      });
    } catch (error) {
      console.error(error);
      alert("ไม่สามารถสร้าง มคอ. 3 ได้");
    } finally {
      setIsLoading(false);
      setStatus("");
    }
  };

  const handleAutoFillWeekly = async () => {
    if (!selectedCourseCode || !courses.length) return;
    const course = courses.find((c) => c.course_code === selectedCourseCode && normalizeVersion(c.curriculum_version) === curriculumVersion);
    if (!course) return;

    try {
      setIsLoading(true);
      setStatus("AI กำลังวิเคราะห์หัวข้อรายสัปดาห์...");
      const mapping = coursePloMappings.find(
        (m) => m.course_code === selectedCourseCode && normalizeVersion(m.curriculum_version) === curriculumVersion,
      );
      const suggestions = await suggestWeeklyPlan(
        course,
        filteredPLOs,
        mapping,
      );
      setWeeklyPlans(suggestions);
      
      // Persist immediately
      localStorage.setItem("obe_weekly_plans", JSON.stringify(suggestions));
    } catch (error) {
      alert("ไม่สามารถดึงข้อมูลแนะนำได้");
    } finally {
      setIsLoading(false);
      setStatus("");
    }
  };

  const handleAutoFillAssessment = async () => {
    if (!selectedCourseCode || !courses.length) return;
    const course = courses.find((c) => c.course_code === selectedCourseCode && normalizeVersion(c.curriculum_version) === curriculumVersion);
    if (!course) return;

    try {
      setIsLoading(true);
      setStatus("AI กำลังจับคู่การประเมินกับ CLOs...");
      const suggestions = await suggestAssessmentMapping(course, assessments);
      setAssessments(suggestions);
      
      // Persist immediately
      localStorage.setItem("obe_assessments", JSON.stringify(suggestions));
    } catch (error) {
      alert("ไม่สามารถดึงข้อมูลแนะนำได้");
    } finally {
      setIsLoading(false);
      setStatus("");
    }
  };

  const exportToPDF = async () => {
    const element = document.querySelector(
      ".markdown-container",
    ) as HTMLElement;
    if (!element) return;

    try {
      setIsLoading(true);
      setStatus("กำลังสร้างไฟล์ PDF...");
      const canvas = await html2canvas(element, { 
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: "#ffffff"
      });
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4");
      
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      const ratio = pdfWidth / imgWidth;
      const finalImgHeight = imgHeight * ratio;
      
      let heightLeft = finalImgHeight;
      let position = 0;

      pdf.addImage(imgData, "PNG", 0, position, pdfWidth, finalImgHeight);
      heightLeft -= pdfHeight;

      while (heightLeft > 0) {
        position = heightLeft - finalImgHeight;
        pdf.addPage();
        pdf.addImage(imgData, "PNG", 0, position, pdfWidth, finalImgHeight);
        heightLeft -= pdfHeight;
      }

      pdf.save(`TQF3_${selectedCourseCode}.pdf`);
    } catch (error) {
      console.error(error);
      alert("เกิดข้อผิดพลาดในการสร้าง PDF");
    } finally {
      setIsLoading(false);
      setStatus("");
    }
  };

  const exportToDocx = async () => {
    if (!tqf3Result) return;
    try {
      setIsLoading(true);
      setStatus("กำลังสร้างไฟล์ Word...");
      
      const htmlContent = await marked.parse(tqf3Result);
      
      // Creating a blob with Word-compatible HTML
      const header = `
        <html xmlns:o='urn:schemas-microsoft-com:office:office' 
              xmlns:w='urn:schemas-microsoft-com:office:word' 
              xmlns='http://www.w3.org/TR/REC-html40'>
        <head><meta charset='utf-8'><title>TQF3</title>
        <style>
          body { font-family: 'Sarabun', 'Anuphan', sans-serif; }
          table { border-collapse: collapse; width: 100%; margin-bottom: 20px; }
          th, td { border: 1px solid black; padding: 8px; text-align: left; }
          h1, h2, h3 { color: #1a365d; }
        </style>
        </head><body>`;
      const footer = "</body></html>";
      const sourceHTML = header + htmlContent + footer;
      
      const blob = new Blob(['\ufeff', sourceHTML], {
        type: 'application/msword'
      });
      
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `TQF3_${selectedCourseCode}.doc`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error(error);
      alert("เกิดข้อผิดพลาดในการสร้าง Word");
    } finally {
      setIsLoading(false);
      setStatus("");
    }
  };

  const downloadJson = () => {
    let data;
    let filename;
    if (mode === "courses") {
      data = courses;
      filename = "courses.json";
    } else if (mode === "plos") {
      data = curriculumData;
      filename = "curriculum_analysis.json";
    } else if (mode === "mapping") {
      data = coursePloMappings;
      filename = "course_plo_mapping.json";
    } else if (mode === "import") {
      data = {
        curriculumVersion,
        courses,
        curriculumData,
        mappings: coursePloMappings,
        tqf3Store,
      };
      filename = `obe_backup_v${curriculumVersion}_${new Date().toLocaleDateString("th-TH").replace(/\//g, "-")}.json`;
    } else {
      data = tqf3Result;
      filename = `TQF3_${selectedCourseCode}.md`;
      const dataStr =
        "data:text/markdown;charset=utf-8," + encodeURIComponent(data || "");
      const downloadAnchorNode = document.createElement("a");
      downloadAnchorNode.setAttribute("href", dataStr);
      downloadAnchorNode.setAttribute("download", filename);
      document.body.appendChild(downloadAnchorNode);
      downloadAnchorNode.click();
      downloadAnchorNode.remove();
      return;
    }

    const dataStr =
      "data:text/json;charset=utf-8," +
      encodeURIComponent(JSON.stringify(data, null, 2));
    const downloadAnchorNode = document.createElement("a");
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", filename);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  const resetData = () => {
    setCourses([]);
    setCurriculumData(null);
    setCoursePloMappings([]);
    setTqf3Result(null);
    setSelectedCourseCode(null);
  };

  return (
    <div className="flex min-h-screen bg-[#F5F5F7] text-[#1D1D1F] font-sans selection:bg-[#0071E3] selection:text-white">
      {/* Sidebar Navigation */}
      <aside className="fixed inset-y-0 left-0 w-80 bg-white border-r border-[#DEDEDE] z-50 flex flex-col hidden lg:flex">
        {/* Sidebar Header / Branding */}
        <div className="p-8 pb-6">
          <div className="flex items-start gap-3 mb-6">
            <div className="w-10 h-10 bg-[#1D1D1F] rounded-xl flex items-center justify-center shadow-lg transform -rotate-3 group-hover:rotate-0 transition-transform shrink-0 mt-0.5">
              <BrainCircuit className="text-white w-6 h-6" />
            </div>
            <div>
              <h1 className="text-[20px] font-heading font-black tracking-tighter text-black leading-none whitespace-nowrap mb-1">
                ระบบบริหารจัดการ <span className="text-[#0071E3]">มคอ.3</span>
              </h1>
              <p className="text-[13.5px] font-sans font-bold text-[#4d4d4d] uppercase tracking-[0.05em] leading-none whitespace-nowrap text-left flex items-center gap-2">
                สาขาวิศวกรรมคอมพิวเตอร์
                <span className="bg-[#0071E3]/10 text-[#0071E3] text-[10px] px-1.5 py-0.5 rounded border border-[#0071E3]/20">
                  พ.ศ. {curriculumVersion}
                </span>
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-2 px-1">
                Engineering Curriculum
              </p>
              <div className="bg-[#F5F5F7] p-1.5 rounded-2xl border border-[#DEDEDE]">
                <div className="flex flex-col gap-1">
                  <button
                    onClick={() => setCurriculumVersion("2568")}
                    className={`flex items-center justify-between px-3 py-2 rounded-xl text-[11px] font-black transition-all ${curriculumVersion === "2568" ? "bg-white shadow-sm text-[#0071E3]" : "text-gray-500 hover:text-gray-900"}`}
                  >
                    <span className="flex items-center gap-2">
                      <Book className="w-3.5 h-3.5" />
                      ปรับปรุง 2568
                    </span>
                    {curriculumVersion === "2568" && <div className="w-1.5 h-1.5 rounded-full bg-[#0071E3]" />}
                  </button>
                  <button
                    onClick={() => setCurriculumVersion("2564")}
                    className={`flex items-center justify-between px-3 py-2 rounded-xl text-[11px] font-black transition-all ${curriculumVersion === "2564" ? "bg-white shadow-sm text-[#0071E3]" : "text-gray-500 hover:text-gray-900"}`}
                  >
                    <span className="flex items-center gap-2">
                      <Book className="w-3.5 h-3.5" />
                      ปรับปรุง 2564
                    </span>
                    {curriculumVersion === "2564" && <div className="w-1.5 h-1.5 rounded-full bg-[#0071E3]" />}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar Menu */}
        <nav className="flex-1 px-4 py-4 space-y-1">
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-3 px-4">
            Main Menu
          </p>
          {[
            { m: "courses", label: "จัดการรายวิชา", icon: LayoutGrid, desc: "จัดการวิชาในหลักสูตร" },
            { m: "plos", label: "วิเคราะห์ PLOs", icon: ListChecks, desc: "โครงสร้างหลักสูตร" },
            { m: "mapping", label: "ผังหลักสูตร", icon: Target, desc: "ความเชื่อมโยง PLOs" },
            { m: "import", label: "นำเข้า/ส่งออก", icon: Import, desc: "JSON Management" },
            { m: "tqf3", label: "จัดทำ มคอ.3", icon: FileText, desc: "Document Generation" },
          ].map((item) => (
            <button
              key={item.m}
              onClick={() => setMode(item.m as any)}
              className={`w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl transition-all group ${mode === item.m ? "bg-[#0071E3] text-white shadow-lg shadow-blue-500/20" : "text-gray-600 hover:bg-[#F5F5F7] hover:text-black"}`}
            >
              <item.icon className={`w-5 h-5 shrink-0 ${mode === item.m ? "text-white" : "text-gray-400 group-hover:text-black"}`} />
              <div className="text-left leading-none">
                <p className="text-sm font-bold tracking-tight">{item.label}</p>
                <p className={`text-[10px] mt-1 font-medium ${mode === item.m ? "text-blue-100" : "text-gray-400"}`}>
                  {item.desc}
                </p>
              </div>
            </button>
          ))}
        </nav>

        {/* Sidebar Footer Actions */}
        <div className="p-6 border-t border-[#DEDEDE] space-y-3">
          {(courses.length > 0 || curriculumData || coursePloMappings.length > 0 || tqf3Result) && (
            <>
              {tqf3Result && (
                <button
                  onClick={exportToPDF}
                  className="w-full flex items-center justify-center gap-2 bg-[#0071E3] text-white px-4 py-3 rounded-2xl text-xs font-black hover:bg-[#0077ED] transition-all shadow-lg shadow-blue-500/20"
                >
                  <Printer className="w-4 h-4" />
                  EXPORT PDF
                </button>
              )}
              <button
                onClick={downloadJson}
                className="w-full flex items-center justify-center gap-2 bg-black text-white px-4 py-3 rounded-2xl text-xs font-black hover:bg-zinc-800 transition-all"
              >
                <Download className="w-4 h-4" />
                BACKUP DATA
              </button>
            </>
          )}
          <div className="text-center">
            <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">
              PSRU AI OBE SYSTEM v2.0
            </p>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 lg:ml-80 flex flex-col min-h-screen">
        {/* Mobile Header (Small) */}
        <header className="lg:hidden sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-[#DEDEDE] p-4 px-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BrainCircuit className="text-[#0071E3] w-6 h-6" />
            <h1 className="text-sm font-black tracking-tighter">
              ระบบบริหารจัดการ <span className="text-[#0071E3]">มคอ.3</span>
            </h1>
          </div>
          <div className="bg-[#F5F5F7] px-3 py-1 rounded-full text-[10px] font-black text-gray-500 uppercase tracking-widest">
            {curriculumVersion} Edition
          </div>
        </header>

        <main className="flex-1 w-full max-w-6xl mx-auto p-6 md:p-12 pt-8 md:pt-12">

        {/* Mobile Mode Switcher */}
        <div className="lg:hidden flex bg-white p-1 rounded-xl border border-[#DEDEDE] mb-8 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setMode("courses")}
            className={`min-w-[80px] flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all ${mode === "courses" ? "bg-[#F5F5F7] text-[#0071E3]" : "text-black"}`}
          >
            รายวิชา
          </button>
          <button
            onClick={() => setMode("plos")}
            className={`min-w-[80px] flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all ${mode === "plos" ? "bg-[#F5F5F7] text-[#0071E3]" : "text-black"}`}
          >
            PLOs
          </button>
          <button
            onClick={() => setMode("mapping")}
            className={`min-w-[80px] flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all ${mode === "mapping" ? "bg-[#F5F5F7] text-[#0071E3]" : "text-black"}`}
          >
            ผังหลักสูตร
          </button>
          <button
            onClick={() => setMode("import")}
            className={`min-w-[80px] flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all ${mode === "import" ? "bg-[#F5F5F7] text-indigo-600" : "text-black"}`}
          >
            ข้อมูล
          </button>
          <button
            onClick={() => setMode("tqf3")}
            className={`min-w-[80px] flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all ${mode === "tqf3" ? "bg-[#F5F5F7] text-[#0071E3]" : "text-black"}`}
          >
            มคอ.3
          </button>
        </div>

        {!filteredCourses.length &&
        !filteredPLOs.length &&
        !filteredMappings.length &&
        !tqf3Result &&
        mode !== "import" &&
        mode !== "tqf3" &&
        !isLoading ? (
          <div className="max-w-3xl mx-auto mt-12 text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <span className="inline-block px-3 py-1 bg-blue-50 text-blue-600 rounded-full text-[10px] uppercase font-bold tracking-widest mb-4">
                {mode === "courses"
                  ? "Information Extraction"
                  : mode === "plos"
                    ? "Outcome-Based Education Analysis"
                    : mode === "mapping"
                      ? "แผนผังความสอดคล้องหลักสูตร"
                      : "Course Specification Generator"}
              </span>
              <h2 className="text-4xl md:text-6xl font-heading font-bold tracking-tight mb-8">
                {mode === "courses" ? (
                  <>
                    จัดการข้อมูล{" "}
                    <span className="text-[#0071E3]">หลักสูตร</span>
                    <br />
                    ด้วยปัญญาประดิษฐ์
                  </>
                ) : mode === "plos" ? (
                  <>
                    วิเคราะห์ <span className="text-[#0071E3]">PLOs & KSA</span>
                    <br />
                    ตอบโจทย์แนวทาง OBE
                  </>
                ) : mode === "mapping" ? (
                  <>
                    เชื่อมโยง{" "}
                    <span className="text-[#0071E3]">รายวิชา & PLOs</span>
                    <br />
                    ด้วย AI Mapping
                  </>
                ) : (
                  <>
                    จัดทำเอกสาร <span className="text-[#0071E3]">มคอ. 3</span>
                    <br />
                    อัตโนมัติด้วย AI
                  </>
                )}
              </h2>
              <p className="text-xl text-black mb-12 max-w-xl mx-auto">
                {mode === "courses"
                  ? "อัพโหลดไฟล์ มคอ.2 เพื่อสกัดข้อมูลรายวิชาทั้งหมดให้อยู่ในรูปแบบตัวแปร JSON ที่พร้อมใช้งาน"
                  : mode === "plos"
                    ? "วิเคราะห์ความสอดคล้อง PLOs กับ KSEC Mapping และพฤติกรรมตาม Bloom’s Taxonomy โดยอัตโนมัติ"
                    : mode === "mapping"
                      ? "สกัดข้อมูลความสัมพันธ์ระหว่างรายวิชาและ PLOs (Curriculum Mapping) ในรูปแบบ JSON"
                      : 'นำเข้าไฟล์ JSON จากเมนู "Data Manager" เพื่อเลือกรายวิชาและสร้างรายละเอียดของรายวิชา (มคอ. 3)'}
              </p>

              {(mode as string) !== "import" && (mode as string) !== "tqf3" && (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="group relative cursor-pointer max-w-lg mx-auto"
                >
                  <div className="absolute -inset-1 bg-gradient-to-r from-[#0071E3] via-[#8E2DE2] to-[#4A00E0] rounded-[2rem] blur opacity-20 group-hover:opacity-40 transition duration-1000"></div>
                  <div className="relative bg-white border border-[#D2D2D7] rounded-[2rem] p-12 transition-all group-hover:bg-[#FBFBFF] overflow-hidden">
                    <div className="absolute top-4 right-4 bg-[#0071E3] text-white px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest z-20 shadow-lg shadow-blue-500/20">
                      Target: {curriculumVersion} Edition
                    </div>
                    <div className="absolute top-0 right-0 p-8 opacity-[0.03] group-hover:scale-110 transition-transform">
                      {mode === "courses" ? (
                        <FileCode className="w-32 h-32" />
                      ) : (
                        <ShieldAlert className="w-32 h-32" />
                      )}
                    </div>
                    <div className="flex flex-col items-center gap-6 relative z-10">
                      <div className="w-20 h-20 bg-[#F5F5F7] rounded-3xl flex items-center justify-center group-hover:scale-110 group-hover:rotate-3 transition-all duration-500">
                        <Upload className="w-8 h-8 text-[#1D1D1F]" />
                      </div>
                      <div className="space-y-2">
                        <p className="text-xl font-bold text-[#1D1D1F]">
                          {mode === "courses"
                            ? "อัพโหลดไฟล์ รายวิชา"
                            : mode === "plos"
                              ? "อัพโหลดไฟล์ มคอ.2 (PLOs)"
                              : "อัพโหลดไฟล์ Excel Mapping"}
                        </p>
                        <p className="text-sm text-gray-900">
                          {mode === "mapping"
                            ? "ลากและวางไฟล์ Excel (.xlsx, .xls) หรือคลิกเพื่อเลือก"
                            : "ลากและวางไฟล์ PDF หรือคลิกที่นี่เพื่อเลือก"}
                        </p>
                      </div>
                    </div>
                  </div>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    accept={mode === "mapping" ? ".xlsx, .xls" : ".pdf"}
                    className="hidden"
                  />
                </div>
              )}
            </motion.div>
          </div>
        ) : null}

        {/* Data Manager Menu */}
        {mode === "import" && (
          <div className="max-w-6xl mx-auto space-y-12 py-8 animate-in fade-in slide-in-from-bottom-4">
            <div className="text-center space-y-4">
              <h2 className="text-4xl font-bold">Data Manager</h2>
              <p className="text-gray-900">
                จัดการข้อมูล JSON สำคัญสำหรับใช้งานในระบบ OBE
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div
                className={`relative p-8 rounded-[2.5rem] border-2 transition-all ${courses.length > 0 ? "bg-green-50/50 border-green-200" : "bg-white border-dashed border-[#DEDEDE]"}`}
              >
                <div className="flex flex-col items-center gap-4">
                  <div
                    className={`w-14 h-14 rounded-2xl flex items-center justify-center ${courses.length > 0 ? "bg-green-500 text-white" : "bg-[#F5F5F7] text-gray-900"}`}
                  >
                    <LayoutGrid className="w-7 h-7" />
                  </div>
                  <div className="text-center">
                    <p className="font-black text-sm uppercase tracking-widest mb-1">
                      Courses JSON ({curriculumVersion})
                    </p>
                    <p className="text-xs text-gray-900 mb-4 flex items-center gap-1.5">
                      {filteredCourses.length > 0
                        ? `พบ ${filteredCourses.length} รายวิชา (พ.ศ. ${curriculumVersion})`
                        : "ไม่มีข้อมูลในปีนี้"}
                      {courses.length > filteredCourses.length && (
                        <span className="text-[9px] bg-gray-100 px-1 rounded">
                          มี {courses.length - filteredCourses.length} วิชาในเวอร์ชันอื่น
                        </span>
                      )}
                    </p>
                    <button
                      onClick={() => {
                        setImportTarget("courses");
                        jsonInputRef.current?.click();
                      }}
                      className={`px-4 py-2 rounded-full text-xs font-bold transition-all ${courses.length > 0 ? "bg-white border border-green-200 text-green-600 hover:bg-green-100" : "bg-[#0071E3] text-white"}`}
                    >
                      นำเข้า/อัพเดท
                    </button>
                  </div>
                </div>
              </div>

              <div
                className={`relative p-8 rounded-[2.5rem] border-2 transition-all ${curriculumData ? "bg-blue-50/50 border-blue-200" : "bg-white border-dashed border-[#DEDEDE]"}`}
              >
                <div className="flex flex-col items-center gap-4">
                  <div
                    className={`w-14 h-14 rounded-2xl flex items-center justify-center ${curriculumData ? "bg-blue-500 text-white" : "bg-[#F5F5F7] text-gray-900"}`}
                  >
                    <ListChecks className="w-7 h-7" />
                  </div>
                  <div className="text-center">
                    <p className="font-black text-sm uppercase tracking-widest mb-1">
                      PLO Analysis JSON ({curriculumVersion})
                    </p>
                    <p className="text-xs text-black mb-4">
                      {filteredPLOs.length > 0
                        ? `พบ ${filteredPLOs.length} PLOs (${curriculumVersion})`
                        : (curriculumData ? "ข้อมูลเป็นเวอร์ชันอื่น" : "ยังไม่มีข้อมูล")}
                    </p>
                    <button
                      onClick={() => {
                        setImportTarget("plos");
                        jsonInputRef.current?.click();
                      }}
                      className={`px-4 py-2 rounded-full text-xs font-bold transition-all ${curriculumData ? "bg-white border border-blue-200 text-blue-600 hover:bg-blue-100" : "bg-[#0071E3] text-white"}`}
                    >
                      นำเข้า/อัพเดท
                    </button>
                  </div>
                </div>
              </div>

              <div
                className={`relative p-8 rounded-[2.5rem] border-2 transition-all ${coursePloMappings.length > 0 ? "bg-indigo-50/50 border-indigo-200" : "bg-white border-dashed border-[#DEDEDE]"}`}
              >
                <div className="flex flex-col items-center gap-4">
                  <div
                    className={`w-14 h-14 rounded-2xl flex items-center justify-center ${coursePloMappings.length > 0 ? "bg-indigo-500 text-white" : "bg-[#F5F5F7] text-gray-900"}`}
                  >
                    <Target className="w-7 h-7" />
                  </div>
                  <div className="text-center">
                    <p className="font-black text-sm uppercase tracking-widest mb-1">
                      Mapping JSON ({curriculumVersion})
                    </p>
                    <p className="text-xs text-gray-900 mb-4 flex items-center gap-1.5">
                      {filteredMappings.length > 0
                        ? `พบ ${filteredMappings.length} รายวิชา (พ.ศ. ${curriculumVersion})`
                        : "ไม่มีข้อมูลในปีนี้"}
                      {coursePloMappings.length > filteredMappings.length && (
                        <span className="text-[9px] bg-gray-100 px-1 rounded">
                          มี {coursePloMappings.length - filteredMappings.length} รายการในเวอร์ชันอื่น
                        </span>
                      )}
                    </p>
                    <button
                      onClick={() => {
                        setImportTarget("mapping");
                        jsonInputRef.current?.click();
                      }}
                      className={`px-4 py-2 rounded-full text-xs font-bold transition-all ${coursePloMappings.length > 0 ? "bg-white border border-indigo-200 text-indigo-600 hover:bg-indigo-100" : "bg-[#0071E3] text-white"}`}
                    >
                      นำเข้า/อัพเดท
                    </button>
                  </div>
                </div>
              </div>

              <div
                className={`relative p-8 rounded-[2.5rem] border-2 transition-all ${courses.length > 0 && curriculumData && coursePloMappings.length > 0 ? "bg-[#1D1D1F]/5 border-[#1D1D1F]/20" : "bg-white border-dashed border-[#DEDEDE]"}`}
              >
                <div className="flex flex-col items-center gap-4">
                  <div
                    className={`w-14 h-14 rounded-2xl flex items-center justify-center ${courses.length > 0 && curriculumData && coursePloMappings.length > 0 ? "bg-[#1D1D1F] text-white" : "bg-[#F5F5F7] text-[#86868B]"}`}
                  >
                    <Settings2 className="w-7 h-7" />
                  </div>
                  <div className="text-center">
                    <p className="font-black text-sm uppercase tracking-widest mb-1">
                      Bulk All Data
                    </p>
                    <p className="text-xs text-[#86868B] mb-4">
                      สำรองหรือกู้คืนข้อมูลทั้งหมด
                    </p>
                    <div className="flex gap-2">
                       <button
                        onClick={() => {
                          setImportTarget("all");
                          jsonInputRef.current?.click();
                        }}
                        className="px-4 py-2 rounded-full text-xs font-bold bg-[#0071E3] text-white"
                      >
                        นำเข้า
                      </button>
                      <button
                        onClick={downloadJson}
                        className="px-4 py-2 rounded-full text-xs font-bold border border-[#DEDEDE] text-[#1D1D1F] hover:bg-[#F5F5F7]"
                      >
                        ส่งออก
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div
                className={`relative p-8 rounded-[2.5rem] border-2 transition-all ${Object.keys(tqf3Store).length > 0 ? "bg-amber-50/50 border-amber-200" : "bg-white border-dashed border-[#DEDEDE]"}`}
              >
                <div className="flex flex-col items-center gap-4">
                  <div
                    className={`w-14 h-14 rounded-2xl flex items-center justify-center ${Object.keys(tqf3Store).length > 0 ? "bg-amber-500 text-white" : "bg-[#F5F5F7] text-gray-900"}`}
                  >
                    <History className="w-7 h-7" />
                  </div>
                  <div className="text-center">
                    <p className="font-black text-sm uppercase tracking-widest mb-1">
                      TQF3 History
                    </p>
                    <p className="text-xs text-gray-900 mb-4">
                      {Object.keys(tqf3Store).length > 0
                        ? `พบประวัติ ${Object.keys(tqf3Store).length} รายการ`
                        : "ยังไม่มีประวัติ"}
                    </p>
                    <button
                      onClick={() => setMode("history")}
                      className={`px-4 py-2 rounded-full text-xs font-bold transition-all ${Object.keys(tqf3Store).length > 0 ? "bg-white border border-amber-200 text-amber-600 hover:bg-amber-100" : "bg-[#0071E3] text-white"}`}
                    >
                      เปิดคลังข้อมูล
                    </button>
                  </div>
                </div>
              </div>
            </div>
            <input
              type="file"
              ref={jsonInputRef}
              onChange={handleJsonImport}
              accept=".json"
              className="hidden"
            />
          </div>
        )}

        {/* Loading State */}
        {isLoading && (
          <div className="flex flex-col items-center justify-center min-h-[50vh]">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-white p-12 rounded-[2.5rem] shadow-2xl border border-[#DEDEDE] flex flex-col items-center gap-8 max-w-sm w-full"
            >
              <div className="relative w-20 h-20">
                <div className="absolute inset-0 bg-blue-100 rounded-full animate-ping opacity-25"></div>
                <div className="absolute inset-4 bg-white border-4 border-[#0071E3] rounded-full border-t-transparent animate-spin"></div>
              </div>
              <div className="text-center space-y-2">
                <p className="text-xl font-bold">{status}</p>
                <p className="text-sm text-gray-900">
                  AI กำลังตรวจสอบโครงสร้างเอกสาร มคอ.2
                </p>
              </div>
              <div className="w-full bg-[#F5F5F7] h-1.5 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-[#0071E3]"
                  initial={{ width: 0 }}
                  animate={{ width: "100%" }}
                  transition={{ duration: 30, ease: "linear" }}
                />
              </div>
            </motion.div>
          </div>
        )}

        {/* Results - Courses Mode */}
        {mode === "courses" && filteredCourses.length > 0 && !isLoading && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-1000">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white/50 backdrop-blur-sm p-6 rounded-[2rem] border border-[#DEDEDE]">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-green-500 rounded-2xl flex items-center justify-center shadow-lg shadow-green-500/20">
                  <CheckCircle2 className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="text-xs uppercase font-bold text-gray-900 tracking-widest font-heading">
                    ผลการสกัดข้อมูล (Extraction Result) | หลักสูตร {curriculumVersion}
                  </p>
                  <p className="text-2xl font-bold">
                    สกัดพบ {displayCourses.length} รายวิชา
                  </p>
                </div>
              </div>

              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-900" />
                <input
                  type="text"
                  placeholder="ค้นหารหัสวิชา หรือ ชื่อวิชา..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-white border border-[#D2D2D7] rounded-2xl pl-12 pr-4 py-3 text-sm focus:ring-2 focus:ring-[#0071E3] focus:border-transparent outline-none transition-all shadow-sm text-black placeholder:text-gray-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <AnimatePresence mode="popLayout">
                {displayCourses.map((course, index) => (
                  <motion.div
                    key={course.course_code}
                    layout
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ delay: index * 0.03 }}
                    className="group bg-white rounded-[2rem] p-8 border border-[#D2D2D7] hover:shadow-3xl hover:border-[#0071E3]/20 transition-all cursor-default relative overflow-hidden"
                  >
                    <div className="absolute top-0 right-0 p-6 opacity-[0.02] group-hover:scale-150 transition-transform duration-700">
                      <FileText className="w-24 h-24" />
                    </div>

                    <div className="flex justify-between items-start mb-6">
                      <span className="bg-[#1D1D1F] text-white text-[10px] font-bold px-3 py-1.5 rounded-lg uppercase tracking-widest">
                        {course.course_code}
                      </span>
                      <div className="text-right">
                        <p className="text-[10px] font-bold text-gray-900 uppercase tracking-tighter font-heading">
                          หน่วยกิต
                        </p>
                        <p className="text-lg font-bold text-black">
                          {course.credits}
                        </p>
                      </div>
                    </div>

                    <h3 className="text-lg font-bold text-black mb-1 group-hover:text-[#0071E3] transition-colors leading-tight">
                      {course.course_name_th}
                    </h3>
                    <p className="text-sm text-gray-900 font-medium italic mb-6">
                      {course.course_name_en}
                    </p>

                    <div className="grid grid-cols-4 gap-2 mb-8">
                      {[
                        {
                          label: "TH",
                          value: course.credit_details.theory_hours,
                          color: "bg-blue-50 text-blue-600",
                        },
                        {
                          label: "PR",
                          value: course.credit_details.practice_hours,
                          color: "bg-purple-50 text-purple-600",
                        },
                        {
                          label: "SS",
                          value: course.credit_details.self_study_hours,
                          color: "bg-amber-50 text-amber-600",
                        },
                        {
                          label: "Tot",
                          value: course.credit_details.total_credits,
                          color: "bg-[#1D1D1F] text-white",
                        },
                      ].map((stat) => (
                        <div
                          key={stat.label}
                          className={`${stat.color} rounded-xl p-2.5 text-center`}
                        >
                          <p className="text-[8px] font-black uppercase opacity-60">
                            {stat.label}
                          </p>
                          <p className="text-sm font-black">{stat.value}</p>
                        </div>
                      ))}
                    </div>

                    <div className="space-y-4 pt-4 border-t border-[#F5F5F7]">
                      <div>
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <Target className="w-3 h-3 text-[#0071E3]" />
                          <p className="text-[10px] uppercase font-bold text-gray-900 tracking-widest font-heading">
                            วิชาบังคับก่อน (Prerequisite)
                          </p>
                        </div>
                        <p className="text-xs font-bold text-black">
                          {course.prerequisite}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase font-bold text-gray-900 tracking-widest mb-1.5 font-heading">
                          คำอธิบายรายวิชา (Course Description)
                        </p>
                        <p className="text-xs text-black leading-relaxed line-clamp-3 group-hover:line-clamp-none transition-all">
                          {course.description}
                        </p>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>
        )}

        {/* Results - PLO Analysis Mode */}
        {mode === "plos" && curriculumData && !isLoading && (
          <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-1000">
            <div className="bg-white rounded-[2.5rem] p-10 border border-[#DEDEDE] shadow-sm relative overflow-hidden">
              <div className="absolute top-0 right-0 p-12 opacity-[0.02]">
                <BrainCircuit className="w-64 h-64" />
              </div>
              <div className="relative z-10">
                <span className="inline-block px-3 py-1 bg-blue-100 text-[#0071E3] rounded-full text-[10px] font-black uppercase tracking-[0.2em] mb-4 font-heading">
                  โครงสร้างหลักสูตร (Curriculum Profile) | ปี {curriculumVersion}
                </span>
                <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-8">
                  {curriculumData.curriculum_name}
                </h2>

                <div className="flex flex-wrap gap-12">
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-black uppercase tracking-widest">
                      Total Outcomes
                    </p>
                    <p className="text-3xl font-black">
                      {filteredPLOs.length} PLOs
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-black uppercase tracking-widest">
                      Analysis Type
                    </p>
                    <p className="text-lg font-bold">
                      OBE & Bloom Taxonomy Mapping
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <h3 className="text-2xl font-bold tracking-tight font-heading">
                ผลลัพธ์การเรียนรู้ระดับหลักสูตร (PLOs)
              </h3>
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-black" />
                <input
                  type="text"
                  placeholder="ค้นหารายละเอียด PLO..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-white border border-[#D2D2D7] rounded-2xl pl-12 pr-4 py-3 text-sm focus:ring-2 focus:ring-[#0071E3] outline-none transition-all text-black"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <AnimatePresence mode="popLayout">
                {filteredPLOs.map((plo, index) => (
                  <motion.div
                    key={plo.plo_number}
                    layout
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="bg-white rounded-[2rem] p-10 border border-[#D2D2D7] hover:border-[#0071E3] transition-colors relative group"
                  >
                    <div className="flex items-start justify-between mb-8">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-[#1D1D1F] text-white rounded-2xl flex items-center justify-center text-xl font-black">
                          {plo.plo_number}
                        </div>
                        <div>
                          <p className="text-[10px] font-black text-black uppercase tracking-[0.2em] font-heading">
                            Outcome Level
                          </p>
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-[10px] font-black uppercase ${plo.outcome_type === "Specific" ? "bg-orange-50 text-orange-700" : "bg-blue-50 text-blue-700"}`}
                          >
                            ทักษะ {plo.outcome_type === "Specific" ? "เฉพาะทาง" : "ทั่วไป"}
                          </span>
                        </div>
                      </div>
                      <div className="flex gap-1.5">
                        {Object.entries(plo.ksec_mapping).map(
                          ([key, value]) => (
                            <div
                              key={key}
                              className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black transition-all ${value ? "bg-[#0071E3] text-white shadow-lg shadow-blue-200" : "bg-[#F5F5F7] text-[#D2D2D7]"}`}
                            >
                              {key}
                            </div>
                          ),
                        )}
                      </div>
                    </div>

                    <div className="mb-10">
                      <p className="text-lg font-bold text-black leading-relaxed leading-[1.6]">
                        {plo.plo_description}
                      </p>
                    </div>

                    <div className="pt-8 border-t border-[#F5F5F7]">
                      <div className="flex items-center gap-3 mb-4">
                        <Award className="w-4 h-4 text-[#0071E3]" />
                        <h4 className="text-xs font-black text-black uppercase tracking-[0.2em] font-heading">
                          ระดับการเรียนรู้ตาม Bloom’s Taxonomy
                        </h4>
                      </div>
                      <div className="grid grid-cols-3 gap-3">
                        {[
                          {
                            label: "พุทธิพิสัย (Cognitive)",
                            value: plo.ksa_bloom_taxonomy.domain_k,
                            color: "text-blue-600 bg-blue-50",
                          },
                          {
                            label: "ทักษะพิสัย (Psychomotor)",
                            value: plo.ksa_bloom_taxonomy.domain_s,
                            color: "text-purple-600 bg-purple-50",
                          },
                          {
                            label: "จิตพิสัย (Affective)",
                            value: plo.ksa_bloom_taxonomy.domain_a,
                            color: "text-rose-600 bg-rose-50",
                          },
                        ].map((domain) => (
                          <div
                            key={domain.label}
                            className={`${domain.color} rounded-2xl p-4 flex flex-col items-center justify-center`}
                          >
                            <p className="text-[9px] font-black uppercase opacity-60 mb-1">
                              {domain.label}
                            </p>
                            <p className="text-lg font-black">
                              {domain.value || "—"}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>
        )}

        {/* Results - Mapping Mode */}
        {mode === "mapping" && coursePloMappings.length > 0 && !isLoading && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-1000">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white/50 backdrop-blur-sm p-6 rounded-[2rem] border border-[#DEDEDE]">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-indigo-500 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
                  <Target className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="text-xs uppercase font-bold text-[#86868B] tracking-widest font-heading">
                    แผนผังหลักสูตร (Mapping Result) | หลักสูตร {curriculumVersion}
                  </p>
                  <p className="text-2xl font-bold">
                    สกัดพบ {filteredMappings.length} ความสัมพันธ์รายวิชา
                  </p>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto bg-white rounded-[2rem] border border-[#D2D2D7] shadow-sm">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-[#F5F5F7] border-b border-[#D2D2D7]">
                    <th className="px-6 py-4 text-left text-xs font-black uppercase tracking-widest text-black sticky left-0 bg-[#F5F5F7] z-10">
                      รหัสวิชา
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-black uppercase tracking-widest text-black">
                      ชื่อวิชา
                    </th>
                    {Array.from(
                      {
                        length: Math.max(
                          ...coursePloMappings.flatMap((c) =>
                            c.mappings.map((m) => m.plo_number),
                          ),
                          0,
                        ),
                      },
                      (_, i) => i + 1,
                    ).map((ploNum) => (
                      <th
                        key={ploNum}
                        className="px-4 py-4 text-center text-xs font-black uppercase tracking-widest text-black"
                      >
                        PLO{ploNum}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F5F5F7]">
                  {filteredMappings.map((item, idx) => {
                    const maxPlo = Math.max(
                      ...filteredMappings.flatMap((c) =>
                        c.mappings.map((m) => m.plo_number),
                      ),
                      0,
                    );
                    return (
                      <tr
                        key={idx}
                        className="hover:bg-blue-50/30 transition-colors group"
                      >
                        <td className="px-6 py-4 text-sm font-bold sticky left-0 bg-white/80 backdrop-blur-sm group-hover:bg-blue-50/30 z-10 border-r border-[#F5F5F7]">
                          {item.course_code}
                        </td>
                        <td className="px-6 py-4 text-sm text-black font-medium">
                          {item.course_name_th}
                        </td>
                        {Array.from({ length: maxPlo }, (_, i) => i + 1).map(
                          (ploNum) => {
                            const m = item.mappings.find(
                              (mapping) => mapping.plo_number === ploNum,
                            );
                            return (
                              <td
                                key={ploNum}
                                className="px-4 py-4 text-center"
                              >
                                {m?.level === "major" && (
                                  <div className="flex justify-center">
                                    <div
                                      className="w-4 h-4 bg-[#1D1D1F] rounded-full shadow-sm"
                                      title={`PLO${ploNum}: Major`}
                                    ></div>
                                  </div>
                                )}
                                {m?.level === "minor" && (
                                  <div className="flex justify-center">
                                    <div
                                      className="w-4 h-4 border-2 border-[#1D1D1F] rounded-full"
                                      title={`PLO${ploNum}: Minor`}
                                    ></div>
                                  </div>
                                )}
                              </td>
                            );
                          },
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* History Menu */}
        {mode === "history" && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-white p-10 rounded-[2.5rem] border border-[#DEDEDE] shadow-sm">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-xl shadow-indigo-100">
                    <History className="w-7 h-7 text-white" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-[#1D1D1F]">คลังข้อมูล มคอ.3</h3>
                    <p className="text-gray-500 font-medium">จัดการและเรียกดูเอกสาร มคอ.3 ที่เคยสร้างไว้ทั้งหมด</p>
                  </div>
                </div>
                <div className="bg-[#F5F5F7] px-4 py-2 rounded-full">
                  <span className="text-xs font-black text-indigo-600 uppercase tracking-widest">{filteredHistory.length} รายการ</span>
                </div>
              </div>

              {filteredHistory.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredHistory.sort((a, b) => (b[1].updatedAt || 0) - (a[1].updatedAt || 0)).map(([code, data]) => {
                    const course = courses.find(c => c.course_code === code && c.curriculum_version === curriculumVersion);
                    return (
                      <div
                        key={code}
                        className="bg-white border border-[#DEDEDE] p-6 rounded-[2rem] flex flex-col gap-6 hover:shadow-2xl hover:border-indigo-300 transition-all group relative overflow-hidden"
                      >
                        <div className="absolute top-0 right-0 p-8 opacity-[0.03] group-hover:scale-110 transition-all">
                          <FileText className="w-20 h-20" />
                        </div>
                        
                        <div className="flex items-start justify-between relative z-10">
                          <div className="space-y-2">
                            <span className="bg-indigo-50 text-indigo-600 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider">{code}</span>
                            <h4 className="text-lg font-black text-[#1D1D1F] line-clamp-2 leading-tight">{course?.course_name_th || code}</h4>
                            <div className="flex items-center gap-2 text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-2">
                              <Calendar className="w-3 h-3" />
                              {new Date(data.updatedAt).toLocaleDateString()} {new Date(data.updatedAt).toLocaleTimeString()}
                            </div>
                          </div>
                   
                          <button 
                            onClick={() => {
                              if(confirm("ยืนยันการลบประวัติ?")) {
                                const newStore = { ...tqf3Store };
                                delete newStore[code];
                                setTqf3Store(newStore);
                                localStorage.setItem("obe_tqf3_store", JSON.stringify(newStore));
                              }
                            }}
                            className="p-3 text-red-400 hover:bg-red-50 hover:text-red-600 rounded-xl transition-all"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-3 relative z-10 mt-2">
                          <button
                            onClick={() => {
                              setIsHistoryAction("edit");
                              setSelectedCourseCode(code);
                              setActiveConfigTab("info");
                              setTqf3Result(null);
                              setMode("tqf3");
                            }}
                            className="flex-1 bg-[#1D1D1F] text-white py-3 rounded-2xl text-xs font-bold hover:bg-black transition-all flex items-center justify-center gap-2 shadow-lg"
                          >
                            <Edit3 className="w-4 h-4" />
                            แก้ไขข้อมูล
                          </button>
                          {data.result ? (
                            <button
                              onClick={() => {
                                setIsHistoryAction("preview");
                                setSelectedCourseCode(code);
                                setTqf3Result(data.result);
                                setMode("tqf3");
                              }}
                              className="flex-1 bg-indigo-50 text-indigo-600 border border-indigo-100 py-3 rounded-2xl text-xs font-bold hover:bg-indigo-100 transition-all flex items-center justify-center gap-2"
                            >
                              <Eye className="w-4 h-4" />
                              เปิดดูไฟล์
                            </button>
                          ) : (
                             <div className="flex-1 bg-gray-50 text-gray-300 py-3 rounded-2xl text-xs font-bold flex items-center justify-center gap-2">
                               <FileX className="w-4 h-4" />
                               ไม่มีไฟล์
                             </div>
                          )}
                        </div>

                        {data.result && (
                          <div className="flex gap-2">
                            <button
                                onClick={() => {
                                  const blob = new Blob([data.result || ""], { type: "text/markdown" });
                                  const url = URL.createObjectURL(blob);
                                  const a = document.createElement("a");
                                  a.href = url;
                                  a.download = `TQF3_${code}.md`;
                                  a.click();
                                  URL.revokeObjectURL(url);
                                }}
                                className="flex-1 bg-white text-black border border-[#DEDEDE] py-3 rounded-2xl text-[10px] font-bold hover:bg-[#F5F5F7] transition-all flex items-center justify-center gap-2"
                              >
                                <Download className="w-3.5 h-3.5" />
                                DOWNLOAD MD
                            </button>
                            <button
                                onClick={() => {
                                  setIsHistoryAction("preview");
                                  setSelectedCourseCode(code);
                                  setTqf3Result(data.result);
                                  setMode("tqf3");
                                  setTimeout(() => exportToPDF(), 100);
                                }}
                                className="bg-[#0071E3] text-white px-4 rounded-2xl flex items-center justify-center hover:bg-[#0077ED] transition-all shadow-lg shadow-blue-500/10"
                                title="Export PDF"
                              >
                                <Printer className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-32 bg-[#F5F5F7] rounded-[3rem] border-2 border-dashed border-[#DEDEDE]">
                  <div className="w-20 h-20 bg-white rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-sm">
                    <History className="w-10 h-10 text-[#D2D2D7]" />
                  </div>
                  <h4 className="text-xl font-bold text-black mb-2">ยังไม่มีประวัติการสร้างในหลักสูตร {curriculumVersion}</h4>
                  <p className="text-gray-500 max-w-sm mx-auto">เริ่มสร้าง มคอ.3 ได้ที่เมนู "มคอ.3" ข้อมูลจะถูกเก็บไว้ที่นี่โดยอัตโนมัติแยกตามหลักสูตร</p>
                  <button 
                    onClick={() => setMode("tqf3")}
                    className="mt-8 bg-[#0071E3] text-white px-8 py-3 rounded-full font-bold shadow-lg shadow-blue-500/20 hover:scale-105 active:scale-95 transition-all"
                  >
                    เริ่มสร้าง มคอ.3
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Course Selection & TQF3 Result */}
        {mode === "tqf3" && !isLoading && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-1000">
            {!tqf3Result ? (
              <div className="space-y-8">
                {!selectedCourseCode && Object.keys(tqf3Store).length > 0 && (
                  <div className="bg-indigo-50 border border-indigo-100 p-6 rounded-2xl flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-sm">
                        <History className="w-6 h-6 text-indigo-600" />
                      </div>
                      <div>
                        <p className="font-bold text-[#1D1D1F]">คุณมี มคอ.3 ที่เคยสร้างไว้ {Object.keys(tqf3Store).length} รายการ</p>
                        <p className="text-xs text-indigo-600 font-medium">สามารถเรียกดูและจัดการย้อนหลังได้ที่เมนู "คลังข้อมูล"</p>
                      </div>
                    </div>
                    <button 
                      onClick={() => setMode("history")}
                      className="bg-indigo-600 text-white px-6 py-2 rounded-full text-xs font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200"
                    >
                      เปิดคลังข้อมูล
                    </button>
                  </div>
                )}

                {courses.length > 0 && curriculumData ? (
                  <div className="space-y-6">
                    {!selectedCourseCode ? (
                      <>
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white/50 backdrop-blur-sm p-6 rounded-[2rem] border border-[#DEDEDE]">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-blue-500 rounded-2xl flex items-center justify-center shadow-lg">
                              <FileSearch className="w-6 h-6 text-white" />
                            </div>
                            <div>
                              <p className="text-xs uppercase font-bold text-gray-900 tracking-widest font-heading">
                                Course Selection
                              </p>
                              <p className="text-2xl font-bold">
                                เลือกรายวิชาที่ต้องการสร้าง มคอ. 3
                              </p>
                            </div>
                          </div>
                          <div className="relative flex-1 max-w-md">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-black" />
                            <input
                              type="text"
                              placeholder="ค้นหารหัสวิชาที่นำเข้า..."
                              value={selectionTerm}
                              onChange={(e) => setSelectionTerm(e.target.value)}
                              className="w-full bg-white border border-[#D2D2D7] rounded-2xl pl-12 pr-4 py-3 text-sm focus:ring-2 focus:ring-[#0071E3] focus:border-transparent outline-none transition-all shadow-sm text-black"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pt-[36px]">
                          {selectionFilteredCourses.map((course) => {
                            const mapping = coursePloMappings.find(
                              (m) => m.course_code === course.course_code,
                            );
                            const mappedPlos =
                              mapping?.mappings
                                .map((m) => m.plo_number)
                                .sort((a, b) => a - b) || [];

                            return (
                              <div
                                key={course.course_code}
                                onClick={() => {
                                  setSelectedCourseCode(course.course_code);
                                  setTqf3Result(null);
                                  setIsHistoryAction(null);
                                  setActiveConfigTab("info");
                                }}
                                className="group px-[30px] pt-[16px] pb-[16px] rounded-[3rem] border-2 border-transparent bg-white shadow-sm hover:shadow-2xl hover:border-[#0071E3]/20 transition-all cursor-pointer relative overflow-hidden"
                              >
                                <div className="absolute top-0 right-0 p-8 opacity-[0.03] group-hover:scale-110 group-hover:opacity-[0.05] transition-all">
                                  <FileSearch className="w-24 h-24" />
                                </div>
                                <div className="flex justify-between items-center pt-[32px] mb-[21px]">
                                  <div className="flex items-center gap-3">
                                    <div className="w-[85px] h-[65px] bg-[#F5F5F7] rounded-2xl flex items-center justify-center font-black text-[#0071E3] group-hover:bg-[#0071E3] group-hover:text-white transition-all shadow-sm">
                                      {course.course_code.slice(0, 4)}
                                    </div>
                                    <span className="text-[28px] font-black text-[#1D1D1F] tracking-tighter">
                                      {course.course_code}
                                    </span>
                                  </div>
                                  <div className="text-right">
                                    <p className="text-[10px] font-black text-gray-900 uppercase tracking-widest mb-0.5">
                                      Credits
                                    </p>
                                    <p className="text-sm font-black text-[#1D1D1F]">
                                      {course.credits}
                                    </p>
                                  </div>
                                </div>

                                <h4 className="font-black text-black mb-2 leading-tight text-[13px] group-hover:text-[#0071E3] transition-colors">
                                  {course.course_name_th}
                                </h4>
                                <p className="text-[14px] text-gray-900 font-medium mb-8 opacity-80 font-sans">
                                  {course.course_name_en}
                                </p>

                                <div className="space-y-4 pt-[6px] border-t border-[#F5F5F7]">
                                  <div className="flex items-center justify-between pt-[4px] text-[14px]">
                                    <div className="flex items-center gap-2">
                                      <div
                                        className={`w-2 h-2 rounded-full ${mapping ? "bg-green-500" : "bg-amber-400"}`}
                                      ></div>
                                      <p className="text-[13px] font-black uppercase text-black tracking-widest leading-none text-left font-sans">
                                        {mapping
                                          ? "ผลลัพธ์การเรียนรู้ (PLOs)"
                                          : "รอยืนยัน PLOs"}
                                      </p>
                                    </div>
                                    {mapping && (
                                       <div className="flex -space-x-1">
                                          {mappedPlos.slice(0, 4).map(p => (
                                            <div key={p} className="w-6 h-6 rounded-full bg-black border border-white flex items-center justify-center text-[16px] font-black text-white">
                                              {p}
                                            </div>
                                          ))}
                                          {mappedPlos.length > 4 && (
                                            <div className="w-6 h-6 rounded-full bg-[#F5F5F7] border border-white flex items-center justify-center text-[16px] font-black text-gray-900">
                                              +{mappedPlos.length - 4}
                                            </div>
                                          )}
                                       </div>
                                    )}
                                  </div>
                                  <div className="flex items-center justify-between group-hover:translate-x-1 transition-transform text-[14px]">
                                    <span className="text-[16px] font-bold text-[#0071E3]">เริ่มสร้าง มคอ.3</span>
                                    <ChevronRight className="w-[31px] h-[31px] text-[#0071E3]" />
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </>
                    ) : (
                      <motion.div
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="max-w-6xl mx-auto space-y-8 pb-20"
                      >
                        <div className="flex items-center justify-between mb-8">
                          <button
                            onClick={() => {
                              setSelectedCourseCode(null);
                              setIsHistoryAction(null);
                            }}
                            className="flex items-center gap-3 text-[#1D1D1F] font-bold hover:gap-4 transition-all group"
                          >
                            <div className="w-10 h-10 rounded-full bg-white border border-[#DEDEDE] flex items-center justify-center shadow-sm group-hover:bg-[#F5F5F7]">
                              <ChevronLeft className="w-5 h-5 text-gray-900 group-hover:text-black" />
                            </div>
                            <span className="text-sm">กลับไปหน้ารายวิชาทั้งหมด</span>
                          </button>
                          <div className="flex gap-2 p-1 bg-white border border-[#DEDEDE] rounded-full">
                            {(["info", "weekly", "assessment"] as const).map(
                              (tab) => (
                                <button
                                  key={tab}
                                  onClick={() => setActiveConfigTab(tab)}
                                  className={`px-6 py-1.5 rounded-full text-xs font-bold transition-all ${
                                    activeConfigTab === tab
                                      ? "bg-black text-white shadow-lg"
                                      : "text-gray-900 hover:bg-[#F5F5F7]"
                                  }`}
                                >
                                  {tab === "info"
                                    ? "ข้อมูลพื้นฐาน"
                                    : tab === "weekly"
                                    ? "แผนการสอนรายสัปดาห์"
                                    : "แผนการประเมินผล"}
                                </button>
                              ),
                            )}
                          </div>
                        </div>

                        <div className="bg-white border border-[#DEDEDE] rounded-[3rem] p-4 md:p-10 shadow-sm relative overflow-hidden min-h-[600px]">
                          {activeConfigTab === "info" && (
                            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
                              {/* Clean Header */}
                              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 border-b border-gray-100 pb-8">
                                <div className="flex items-center gap-6">
                                  <div className="w-20 h-20 bg-gray-50 rounded-2xl flex items-center justify-center border border-gray-200">
                                    <span className="text-3xl font-black text-gray-900">
                                      {selectedCourseCode?.slice(0, 4)}
                                    </span>
                                  </div>
                                  <div>
                                    <h3 className="text-2xl font-black text-gray-900 tracking-tight">
                                      {courses.find(c => c.course_code === selectedCourseCode && c.curriculum_version === curriculumVersion)?.course_name_th}
                                    </h3>
                                    <p className="text-sm text-gray-800 font-mono font-medium">
                                      {courses.find(c => c.course_code === selectedCourseCode && c.curriculum_version === curriculumVersion)?.course_name_en}
                                    </p>
                                  </div>
                                </div>
                                <div className="flex bg-gray-50 p-1.5 rounded-xl border border-gray-100">
                                  {[
                                    { label: "Theory", val: courses.find(c => c.course_code === selectedCourseCode && c.curriculum_version === curriculumVersion)?.credit_details.theory_hours },
                                    { label: "Practice", val: courses.find(c => c.course_code === selectedCourseCode && c.curriculum_version === curriculumVersion)?.credit_details.practice_hours },
                                    { label: "Self", val: courses.find(c => c.course_code === selectedCourseCode && c.curriculum_version === curriculumVersion)?.credit_details.self_study_hours },
                                  ].map((credit, i) => (
                                    <div key={i} className="px-4 py-1 text-center border-r last:border-0 border-gray-200">
                                      <p className="text-[13px] font-black uppercase text-black tracking-widest">{credit.label}</p>
                                      <p className="text-lg font-black text-gray-900">{credit.val}</p>
                                    </div>
                                  ))}
                                </div>
                              </div>

                              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                                {/* Left Side: Basic Details */}
                                <div className="lg:col-span-2 space-y-8">
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                      <label className="text-[13px] font-black uppercase text-black tracking-wider">ชื่ออาจารย์ผู้สอน</label>
                                      <input
                                        type="text"
                                        placeholder="ระบุชื่อ-นามสกุล"
                                        value={instructorName}
                                        onChange={(e) => setInstructorName(e.target.value)}
                                        className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm font-medium focus:border-black focus:ring-1 focus:ring-black outline-none transition-all text-black"
                                      />
                                    </div>
                                    <div className="space-y-2">
                                      <label className="text-[13px] font-black uppercase text-black tracking-wider">คณะ / วิทยาลัย</label>
                                      <input
                                        type="text"
                                        placeholder="ระบุชื่อคณะ"
                                        value={facultyName}
                                        onChange={(e) => setFacultyName(e.target.value)}
                                        className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm font-medium focus:border-black focus:ring-1 focus:ring-black outline-none transition-all"
                                      />
                                    </div>
                                    <div className="space-y-2">
                                      <label className="text-[13px] font-black uppercase text-black tracking-wider">ปีการศึกษา</label>
                                      <input
                                        type="text"
                                        placeholder="เช่น 1/2568"
                                        value={academicYear}
                                        onChange={(e) => setAcademicYear(e.target.value)}
                                        className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm font-medium focus:border-black focus:ring-1 focus:ring-black outline-none transition-all"
                                      />
                                    </div>
                                    <div className="space-y-2">
                                      <label className="text-[13px] font-black uppercase text-black tracking-wider">ชั้นปีที่เรียน</label>
                                      <input
                                        type="text"
                                        placeholder="ระบุชั้นปี"
                                        value={studyYear}
                                        onChange={(e) => setStudyYear(e.target.value)}
                                        className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm font-medium focus:border-black focus:ring-1 focus:ring-black outline-none transition-all"
                                      />
                                    </div>
                                    <div className="space-y-2 md:col-span-2">
                                      <label className="text-[13px] font-black uppercase text-black tracking-wider">สถานที่เรียน (อาคาร/ห้อง)</label>
                                      <input
                                        type="text"
                                        placeholder="ระบุอาคารและหมายเลขห้อง"
                                        value={classroom}
                                        onChange={(e) => setClassroom(e.target.value)}
                                        className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm font-medium focus:border-black focus:ring-1 focus:ring-black outline-none transition-all"
                                      />
                                    </div>
                                    <div className="space-y-2 md:col-span-2">
                                      <label className="text-[13px] font-black uppercase text-black tracking-wider">วันที่ปรับปรุงเนื้อหาล่าสุด</label>
                                      <input
                                        type="text"
                                        placeholder="วว/ดด/ปปปป"
                                        value={modificationDate}
                                        onChange={(e) => setModificationDate(e.target.value)}
                                        className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm font-medium focus:border-black focus:ring-1 focus:ring-black outline-none transition-all"
                                      />
                                    </div>
                                    <div className="space-y-2 md:col-span-2 border-t border-gray-100 pt-6 mt-2">
                                      <h4 className="text-[13px] font-black uppercase text-blue-600 tracking-wider mb-4">ส่วนการลงชื่อรับรอง (Signing Configuration)</h4>
                                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="space-y-2">
                                          <label className="text-[13px] font-black uppercase text-black tracking-wider">วันที่ออกรายงาน (Report Date)</label>
                                          <input
                                            type="text"
                                            placeholder="วว/ดด/ปปปป"
                                            value={reportDate}
                                            onChange={(e) => setReportDate(e.target.value)}
                                            className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm font-medium focus:border-black focus:ring-1 focus:ring-black outline-none transition-all"
                                          />
                                        </div>
                                        <div className="space-y-2">
                                          <label className="text-[13px] font-black uppercase text-black tracking-wider">ชื่อประธานหลักสูตร</label>
                                          <input
                                            type="text"
                                            placeholder="ชื่อ-นามสกุล"
                                            value={programChair}
                                            onChange={(e) => setProgramChair(e.target.value)}
                                            className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm font-medium focus:border-black focus:ring-1 focus:ring-black outline-none transition-all"
                                          />
                                        </div>
                                        <div className="space-y-2 md:col-span-2">
                                          <label className="text-[13px] font-black uppercase text-black tracking-wider">ตำแหน่ง (Role Label)</label>
                                          <input
                                            type="text"
                                            placeholder="เช่น ประธานหลักสูตร/Program Chair"
                                            value={programChairRole}
                                            onChange={(e) => setProgramChairRole(e.target.value)}
                                            className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm font-medium focus:border-black focus:ring-1 focus:ring-black outline-none transition-all"
                                          />
                                        </div>
                                      </div>
                                    </div>
                                  </div>

                                  <div className="pt-6 border-t border-gray-50">
                                    <h4 className="text-[13px] font-black uppercase text-black tracking-wider mb-4">ผลลัพธ์การเรียนรู้ที่เกี่ยวข้อง (Mapped PLOs)</h4>
                                    <div className="grid grid-cols-1 gap-4">
                                      {coursePloMappings.find(m => m.course_code === selectedCourseCode && m.curriculum_version === curriculumVersion)?.mappings.map((mapping) => {
                                        const plo = curriculumData?.plos.find(p => p.plo_number === mapping.plo_number && curriculumData.curriculum_version === curriculumVersion);
                                        return (
                                          <div key={mapping.plo_number} className="p-4 rounded-2xl bg-[#F5F5F7] border border-[#DEDEDE] hover:border-[#0071E3] transition-all group">
                                            <div className="flex items-center gap-3 mb-2">
                                              <div className="w-8 h-8 rounded-lg bg-white border border-[#DEDEDE] text-[#1D1D1F] flex items-center justify-center text-xs font-black shadow-sm group-hover:bg-[#0071E3] group-hover:text-white group-hover:border-transparent transition-all">
                                                {mapping.plo_number}
                                              </div>
                                              <span className="font-bold text-sm text-[#1D1D1F]">PLO {mapping.plo_number}</span>
                                            </div>
                                            <p className="text-xs text-[#1D1D1F] leading-relaxed opacity-70">
                                              {plo?.plo_description || "ไม่พบคำอธิบาย"}
                                            </p>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>

                                  <div className="pt-6 border-t border-gray-50">
                                    <h4 className="text-[13px] font-black uppercase text-black tracking-wider mb-2">คำอธิบายรายวิชา (Default Curriculum)</h4>
                                    <div className="bg-gray-50 rounded-2xl p-6 text-sm text-black leading-relaxed font-medium">
                                      {courses.find(c => c.course_code === selectedCourseCode && c.curriculum_version === curriculumVersion)?.description}
                                    </div>
                                  </div>
                                </div>

                                {/* Right Side: Analysis */}
                                <div className="space-y-6">
                                  <div className="bg-gray-900 rounded-3xl p-8 text-white relative overflow-hidden shadow-2xl">
                                    <div className="relative z-10">
                                      <div 
                                        onClick={() => setShowPloModal(true)}
                                        className="flex items-center justify-between cursor-pointer group/plo mb-6 pb-[12px]"
                                      >
                                        <p className="text-[18px] font-black uppercase tracking-widest text-gray-400 group-hover/plo:text-white transition-colors">ผลลัพธ์การเรียนรู้หลักสูตร {curriculumVersion}</p>
                                        <Eye className="w-4 h-4 text-gray-600 group-hover/plo:text-gray-400 transition-colors" />
                                      </div>
                                      <div className="grid grid-cols-4 gap-3">
                                        {[1, 2, 3, 4, 5, 6, 7].map((num) => {
                                          const mapping = coursePloMappings.find(m => m.course_code === selectedCourseCode && m.curriculum_version === curriculumVersion)?.mappings.find(m => m.plo_number === num);
                                          return (
                                            <div
                                              key={num}
                                              className={`aspect-square rounded-xl flex items-center justify-center text-xs font-black transition-all ${
                                                mapping 
                                                  ? "bg-white text-gray-900 shadow-[0_0_15px_rgba(255,255,255,0.3)]" 
                                                  : "bg-gray-800 text-gray-600"
                                              }`}
                                            >
                                              {num}
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </div>
                                    <Target className="absolute -bottom-4 -right-4 w-32 h-32 text-white opacity-5" />
                                  </div>

                                  <div className="p-8 rounded-3xl border border-gray-100 bg-white shadow-sm space-y-6">
                                    <div className="flex items-center gap-3">
                                      <div className="w-2 h-2 rounded-full bg-green-500" />
                                      <span className="text-[13px] font-black uppercase tracking-widest text-black/60">Preparation Complete</span>
                                    </div>
                                    <button
                                      onClick={() => setActiveConfigTab("weekly")}
                                      className="w-full bg-blue-600 text-white py-4 rounded-2xl text-sm font-black hover:bg-blue-700 transition-all flex items-center justify-center gap-2 group shadow-lg shadow-blue-200"
                                    >
                                      ขั้นตอนถัดไป
                                      <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}

                          {activeConfigTab === "weekly" && (
                            <div className="space-y-8 animate-in fade-in slide-in-from-right-4">
                              <div className="flex items-center justify-between border-b border-[#F5F5F7] pb-6">
                                <div>
                                  <h3 className="text-2xl font-bold">
                                    แผนการสอนรายสัปดาห์ (16 Weeks)
                                  </h3>
                                  <p className="text-sm text-black">
                                    ระบุหัวข้อ, LLO, TLA
                                    และการประเมินเพื่อใช้ในการสร้างเนื้อหาที่สอดคล้อง
                                  </p>
                                </div>
                                <div className="flex gap-2">
                                  <button
                                    onClick={handleAddWeekly}
                                    className="flex items-center gap-2 rounded-full border border-[#DEDEDE] bg-white px-4 py-2 text-xs font-bold text-[#1D1D1F] transition-all hover:bg-[#F5F5F7]"
                                  >
                                    + เพิ่มรายสัปดาห์
                                  </button>
                                <button
                                  onClick={handleAutoFillWeekly}
                                  className="flex items-center gap-2 rounded-full bg-blue-50 px-4 py-2 text-xs font-black uppercase tracking-widest text-[#0071E3] transition-all hover:bg-blue-100"
                                >
                                  <Sparkles className="w-4 h-4" />
                                  เติมข้อมูลด้วย AI
                                </button>
                                </div>
                              </div>

                              <div className="overflow-x-auto">
                                <table className="w-full text-left">
                                  <thead>
                                    <tr className="text-[13px] font-black uppercase tracking-widest text-black">
                                      <th className="pb-4 pr-4">Week</th>
                                      <th className="pb-4 pr-4">Topics</th>
                                      <th className="pb-4 pr-4">LLO</th>
                                      <th className="pb-4 pr-4">TLA</th>
                                      <th className="pb-4">Assessment</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-[#F5F5F7]">
                                    {weeklyPlans.length > 0 ? (
                                      weeklyPlans.map((plan, idx) => (
                                        <tr key={idx} className="group">
                                          <td className="py-4 pr-4">
                                            <div className="w-8 h-8 rounded-lg bg-[#F5F5F7] flex items-center justify-center text-xs font-bold">
                                              {plan.week}
                                            </div>
                                          </td>
                                          <td className="py-4 pr-4">
                                            <input
                                              type="text"
                                              value={plan.topic}
                                              onChange={(e) => {
                                                const newPlans = [
                                                  ...weeklyPlans,
                                                ];
                                                newPlans[idx].topic =
                                                  e.target.value;
                                                setWeeklyPlans(newPlans);
                                              }}
                                              className="w-full bg-transparent border-b border-transparent focus:border-[#0071E3] py-1 text-sm outline-none"
                                            />
                                          </td>
                                          <td className="py-4 pr-4">
                                            <textarea
                                              rows={2}
                                              value={plan.llo}
                                              onChange={(e) => {
                                                const newPlans = [
                                                  ...weeklyPlans,
                                                ];
                                                newPlans[idx].llo =
                                                  e.target.value;
                                                setWeeklyPlans(newPlans);
                                              }}
                                              className="w-full bg-transparent border-0 text-xs text-[#424245] outline-none"
                                            />
                                          </td>
                                          <td className="py-4 pr-4">
                                            <input
                                              type="text"
                                              value={plan.tla}
                                              onChange={(e) => {
                                                const newPlans = [
                                                  ...weeklyPlans,
                                                ];
                                                newPlans[idx].tla =
                                                  e.target.value;
                                                setWeeklyPlans(newPlans);
                                              }}
                                              className="w-full bg-transparent border-0 text-xs text-[#86868B] outline-none"
                                            />
                                          </td>
                                          <td className="py-4">
                                            <div className="flex items-center gap-2">
                                              <input
                                                type="text"
                                                value={plan.assessment}
                                                onChange={(e) => {
                                                  const newPlans = [
                                                    ...weeklyPlans,
                                                  ];
                                                  newPlans[idx].assessment =
                                                    e.target.value;
                                                  setWeeklyPlans(newPlans);
                                                }}
                                                className="w-full border-0 bg-transparent text-xs text-[#86868B] outline-none"
                                              />
                                              <button
                                                onClick={() =>
                                                  handleRemoveWeekly(idx)
                                                }
                                                className="rounded-md p-1 text-red-400 opacity-0 transition-opacity hover:bg-red-50 group-hover:opacity-100"
                                              >
                                                <Trash2 className="w-3.5 h-3.5" />
                                              </button>
                                            </div>
                                          </td>
                                        </tr>
                                      ))
                                    ) : (
                                      <tr>
                                        <td
                                          colSpan={5}
                                          className="py-20 text-center"
                                        >
                                          <div className="max-w-xs mx-auto space-y-4">
                                            <Calendar className="w-12 h-12 text-[#D2D2D7] mx-auto opacity-50" />
                                            <p className="text-black text-sm italic">
                                              ยังไม่มีแผนการสอนรายสัปดาห์
                                              <br />
                                              คลิกปุ่ม Auto-Fill เพื่อให้ AI
                                              ช่วยร่างต้นแบบตามคำอธิบายรายวิชา
                                            </p>
                                          </div>
                                        </td>
                                      </tr>
                                    )}
                                  </tbody>
                                </table>
                              </div>

                              <div className="flex justify-end gap-3 pt-6 border-t border-[#F5F5F7]">
                                <button
                                  onClick={() => setActiveConfigTab("info")}
                                  className="px-6 py-2 rounded-full text-sm font-bold text-[#86868B] hover:bg-[#F5F5F7]"
                                >
                                  Back
                                </button>
                                <button
                                  onClick={() => setActiveConfigTab("assessment")}
                                  className="flex items-center justify-center gap-3 bg-[#1D1D1F] text-white px-12 py-5 rounded-[2rem] text-lg font-bold hover:bg-black transition-all hover:scale-[1.02] active:scale-95 shadow-xl"
                                >
                                  ขั้นตอนถัดไป (แผนการประเมินผล)
                                  <Settings2 className="w-6 h-6" />
                                </button>
                              </div>
                            </div>
                          )}

                          {activeConfigTab === "assessment" && (
                            <div className="space-y-10 animate-in fade-in slide-in-from-right-4">
                              <div className="flex items-center justify-between border-b-2 border-[#F5F5F7] pb-8">
                                <div>
                                  <h3 className="text-3xl font-black text-[#1D1D1F] tracking-tight">
                                    แผนการประเมินผลและการวัดผลเรียนรู้
                                  </h3>
                                  <p className="text-sm text-gray-900 font-medium mt-1">
                                    Mapping CLOs, PLOs, TLA, and assessment methods in one integrated table.
                                  </p>
                                </div>
                                <div className="flex gap-4">
                                  <button
                                    onClick={handleAddAssessment}
                                    className="flex items-center gap-2 rounded-2xl border-2 border-[#1D1D1F] bg-white px-6 py-3 text-sm font-black text-[#1D1D1F] transition-all hover:bg-[#F5F5F7] shadow-sm"
                                  >
                                    <ListChecks className="w-5 h-5" />
                                    เพิ่มรายการประเมิน
                                  </button>
                                  <button
                                    onClick={handleAutoFillAssessment}
                                    className="flex items-center gap-2 rounded-2xl bg-[#0071E3] px-6 py-3 text-sm font-black text-white transition-all hover:bg-[#0077ED] shadow-lg shadow-blue-500/20"
                                  >
                                    <Sparkles className="w-5 h-5" />
                                    AI แนะนำการจับคู่
                                  </button>
                                </div>
                              </div>

                              <div className="overflow-x-auto -mx-4 md:mx-0">
                                <table className="w-full border-collapse">
                                  <thead>
                                    <tr className="border-b border-[#F5F5F7]">
                                      <th className="py-4 px-4 text-left text-[13px] font-black uppercase text-black tracking-widest w-12">#</th>
                                      <th className="py-4 px-4 text-left text-[13px] font-black uppercase text-black tracking-widest">Course Learning Outcome (CLO)</th>
                                      <th className="py-4 px-4 text-center text-[13px] font-black uppercase text-black tracking-widest w-40">Linked PLOs</th>
                                      <th className="py-4 px-4 text-left text-[13px] font-black uppercase text-black tracking-widest">TLA (Teaching Method)</th>
                                      <th className="py-4 px-4 text-left text-[13px] font-black uppercase text-black tracking-widest">วิธีการประเมิน (Method)</th>
                                      <th className="py-4 px-4 text-left text-[13px] font-black uppercase text-black tracking-widest">น้ำหนัก (%)</th>
                                      <th className="py-4 px-4 text-center text-[13px] font-black uppercase text-black tracking-widest w-12"></th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {assessments.map((item, idx) => (
                                      <tr 
                                        key={item.id} 
                                        className="group border-b border-[#F5F5F7] hover:bg-[#FBFBFF] transition-colors"
                                      >
                                        <td className="py-6 px-4">
                                          <div className="w-8 h-8 bg-blue-50 text-[#0071E3] rounded-lg flex items-center justify-center text-xs font-black">
                                            {idx + 1}
                                          </div>
                                        </td>
                                        <td className="py-6 px-4 min-w-[300px]">
                                          <textarea
                                            value={item.clo}
                                            onChange={(e) => {
                                              const newArr = [...assessments];
                                              newArr[idx].clo = e.target.value;
                                              setAssessments(newArr);
                                            }}
                                            rows={2}
                                            className="w-full bg-transparent border-0 font-bold text-[#1D1D1F] text-sm resize-none outline-none focus:text-[#0071E3]"
                                            placeholder="มคอ.3: CLO..."
                                          />
                                        </td>
                                        <td className="py-6 px-4">
                                          <div className="flex flex-wrap justify-center gap-1">
                                            {(coursePloMappings.find(m => m.course_code === selectedCourseCode && m.curriculum_version === curriculumVersion)?.mappings.map(m => m.plo_number) || []).sort((a, b) => a - b).map((num) => {
                                              const isActive = (item.plos || []).includes(num);
                                              return (
                                                <button
                                                  key={num}
                                                  onClick={() => {
                                                    const newArr = [...assessments];
                                                    const cur = newArr[idx].plos || [];
                                                    if (cur.includes(num)) {
                                                      newArr[idx].plos = cur.filter(p => p !== num);
                                                    } else {
                                                      newArr[idx].plos = [...cur, num].sort();
                                                    }
                                                    setAssessments(newArr);
                                                  }}
                                                  className={`w-6 h-6 rounded-md text-[8px] font-black transition-all flex items-center justify-center ${
                                                    isActive 
                                                      ? "bg-[#1D1D1F] text-white shadow-sm" 
                                                      : "bg-[#F5F5F7] text-gray-900 hover:bg-[#DEDEDE]"
                                                  }`}
                                                >
                                                  {num}
                                                </button>
                                              );
                                            })}
                                          </div>
                                        </td>
                                        <td className="py-6 px-4 min-w-[150px]">
                                          <input
                                            type="text"
                                            value={item.tla}
                                            onChange={(e) => {
                                              const newArr = [...assessments];
                                              newArr[idx].tla = e.target.value;
                                              setAssessments(newArr);
                                            }}
                                            className="w-full bg-white border border-[#DEDEDE] rounded-xl px-4 py-2 text-xs font-medium focus:ring-1 focus:ring-[#0071E3] outline-none"
                                            placeholder="Ex: Lecture, PBL"
                                          />
                                        </td>
                                        <td className="py-6 px-4 min-w-[200px]">
                                          <div className="space-y-2">
                                            <input
                                              type="text"
                                              value={item.method}
                                              onChange={(e) => {
                                                const newArr = [...assessments];
                                                newArr[idx].method = e.target.value;
                                                setAssessments(newArr);
                                              }}
                                              className="w-full bg-white border border-[#DEDEDE] rounded-xl px-4 py-2 text-xs font-medium focus:ring-1 focus:ring-[#0071E3] outline-none"
                                              placeholder="Ex: การสอบ, การตรวจผลงาน"
                                            />
                                            <input
                                              type="text"
                                              value={item.component}
                                              onChange={(e) => {
                                                const newArr = [...assessments];
                                                newArr[idx].component = e.target.value;
                                                setAssessments(newArr);
                                              }}
                                              className="w-full bg-[#F5F5F7] border-0 rounded-xl px-4 py-1.5 text-[10px] font-bold text-black outline-none"
                                              placeholder="ชื่อชุดการประเมิน (เช่น สอบกลางภาค)"
                                            />
                                          </div>
                                        </td>
                                        <td className="py-6 px-4">
                                          <div className="flex items-center gap-2">
                                            <input
                                              type="number"
                                              value={item.weight}
                                              onChange={(e) => {
                                                const newArr = [...assessments];
                                                newArr[idx].weight = parseInt(e.target.value) || 0;
                                                setAssessments(newArr);
                                              }}
                                              className="w-16 bg-blue-50 text-[#0071E3] border-0 rounded-xl px-3 py-2 text-sm font-black text-center"
                                            />
                                            <span className="text-xs text-black font-bold">%</span>
                                          </div>
                                        </td>
                                        <td className="py-6 px-4">
                                          <button
                                            onClick={() => handleRemoveAssessment(item.id)}
                                            className="w-8 h-8 rounded-full flex items-center justify-center text-red-400 hover:bg-red-50 transition-all opacity-0 group-hover:opacity-100"
                                          >
                                            <Trash2 className="w-4 h-4" />
                                          </button>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>

                              <div className="flex flex-col md:flex-row justify-between items-center bg-[#FBFBFF] p-8 rounded-[2.5rem] border border-[#F0F0FF] gap-8">
                                <div className="space-y-2">
                                  <p className="text-[13px] font-black uppercase text-black tracking-widest">Total Progress</p>
                                  <div className="flex items-center gap-4">
                                    <div className="w-48 h-2 bg-white rounded-full overflow-hidden border border-[#DEDEDE]">
                                      <div 
                                        className={`h-full transition-all duration-1000 ${
                                          assessments.reduce((sum, item) => sum + item.weight, 0) === 100 
                                            ? "bg-green-500" 
                                            : "bg-blue-600"
                                        }`}
                                        style={{ width: `${Math.min(100, assessments.reduce((sum, item) => sum + item.weight, 0))}%` }}
                                      />
                                    </div>
                                    <span 
                                      className={`text-2xl font-black ${
                                        assessments.reduce((sum, item) => sum + item.weight, 0) === 100 
                                          ? "text-green-600" 
                                          : "text-blue-600"
                                      }`}
                                    >
                                      {assessments.reduce((sum, item) => sum + item.weight, 0)}%
                                    </span>
                                  </div>
                                </div>

                                <div className="flex gap-4">
                                  <button
                                    onClick={() => setActiveConfigTab("weekly")}
                                    className="px-10 py-5 rounded-[2rem] text-sm font-black text-[#86868B] hover:bg-white transition-all"
                                  >
                                    ย้อนกลับ
                                  </button>
                                  <button
                                    onClick={handleGenerateTQF3}
                                    disabled={assessments.reduce((sum, item) => sum + item.weight, 0) !== 100}
                                    className="flex items-center justify-center gap-4 bg-[#1D1D1F] text-white px-16 py-5 rounded-[2rem] text-lg font-black hover:bg-black transition-all hover:scale-[1.02] active:scale-95 shadow-2xl disabled:opacity-30 disabled:scale-100 disabled:grayscale"
                                  >
                                    <Award className="w-6 h-6 text-yellow-400" />
                                    ยืนยันและสรุป มคอ. 3
                                  </button>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </div>
                ) : (
                  <div className="bg-white border border-[#DEDEDE] p-12 rounded-[2.5rem] text-center max-w-xl mx-auto">
                    <div className="w-20 h-20 bg-amber-50 rounded-3xl flex items-center justify-center mx-auto mb-6">
                      <ShieldAlert className="w-10 h-10 text-amber-500" />
                    </div>
                    <h3 className="text-2xl font-bold mb-4">
                      ข้อมูลยังไม่พร้อม
                    </h3>
                    <p className="text-black mb-8">
                      กรุณานำเข้าข้อมูล JSON (รายวิชา และ PLO Analysis) ในเมนู{" "}
                      <strong>Data Manager</strong> ก่อนเพื่อเริ่มต้นสร้าง มคอ.
                      3
                    </p>
                    <button
                      onClick={() => setMode("import")}
                      className="inline-flex items-center gap-2 bg-indigo-600 text-white px-8 py-3 rounded-full font-bold hover:bg-indigo-700 transition-all"
                    >
                      <Import className="w-5 h-5" />
                      เปิด Data Manager
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-8 animate-in zoom-in duration-500">
                <div className="flex items-center justify-between bg-white p-6 rounded-[2rem] border border-[#DEDEDE] shadow-sm">
                  <div className="flex items-center gap-4">
                    <button
                      onClick={() => {
                        setSelectedCourseCode(null);
                        setTqf3Result(null);
                        setIsHistoryAction(null);
                      }}
                      className="w-10 h-10 bg-[#F5F5F7] rounded-full flex items-center justify-center hover:bg-[#E8E8ED] transition-all group"
                      title="กลับไปหน้ารายวิชาทั้งหมด"
                    >
                      <ChevronLeft className="w-5 h-5 text-[#1D1D1F] group-hover:-translate-x-0.5 transition-transform" />
                    </button>
                    <div>
                      <p className="text-xs uppercase font-bold text-[#86868B] tracking-widest">
                        TQF3 Ready
                      </p>
                      <p className="text-2xl font-bold">
                        มคอ. 3 สำหรับ {selectedCourseCode}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <button
                      onClick={() => setTqf3Result(null)}
                      className="flex items-center gap-2 text-black font-bold px-4 py-2 hover:bg-[#F5F5F7] rounded-full transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                      สร้างใหม่
                    </button>
                    <button
                      onClick={downloadJson}
                      className="flex items-center gap-2 text-black font-bold px-4 py-2 hover:bg-[#F5F5F7] rounded-full transition-all"
                    >
                      <Download className="w-4 h-4" />
                      MD
                    </button>
                    <button
                      onClick={exportToDocx}
                      className="flex items-center gap-2 text-black font-bold px-4 py-2 hover:bg-[#F5F5F7] rounded-full transition-all"
                    >
                      <Download className="w-4 h-4" />
                      DOCX
                    </button>
                    <button
                      onClick={exportToPDF}
                      className="flex items-center gap-3 bg-[#0071E3] text-white px-6 py-2 rounded-full font-bold hover:shadow-xl hover:scale-105 transition-all shadow-lg shadow-blue-500/20"
                    >
                      <Printer className="w-5 h-5" />
                      ดาวน์โหลด PDF
                    </button>
                  </div>
                </div>

                <div 
                  id="tqf3-preview"
                  className="bg-white p-12 rounded-[3rem] border border-[#DEDEDE] shadow-2xl relative overflow-hidden"
                >
                  <div className="absolute top-0 right-0 p-12 opacity-[0.01]">
                    <BrainCircuit className="w-96 h-96" />
                  </div>
                  <div className="prose prose-slate prose-lg max-w-none prose-headings:font-bold prose-headings:tracking-tight prose-p:leading-relaxed markdown-container">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{tqf3Result}</ReactMarkdown>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Empty States for filtering */}
        {((mode === "courses" &&
          courses.length > 0 &&
          filteredCourses.length === 0) ||
          (mode === "plos" && curriculumData && filteredPLOs.length === 0)) && (
          <div className="text-center py-32">
            <Search className="w-16 h-16 text-[#D2D2D7] mx-auto mb-6" />
            <p className="text-xl font-bold text-black">
              ไม่พบข้อมูลที่ค้นหา
            </p>
            <button
              onClick={() => setSearchTerm("")}
              className="mt-4 text-[#0071E3] font-bold text-sm hover:underline"
            >
              ล้างการค้นหา
            </button>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="max-w-6xl mx-auto px-6 py-12 border-t border-[#DEDEDE] mt-24">
        <div className="flex flex-col md:flex-row justify-between items-center gap-8 text-[11px] text-black font-bold tracking-widest uppercase">
          <div className="flex items-center gap-4">
            <p>© 2026 OBE Data Analyst AI</p>
            <span className="w-1 h-1 bg-black rounded-full"></span>
            <p>Powered by Gemini 3.0</p>
          </div>
          <div className="flex gap-8">
            <a href="#" className="hover:text-black transition-colors">
              Privacy
            </a>
            <a href="#" className="hover:text-black transition-colors">
              Contact
            </a>
            <a href="#" className="hover:text-black transition-colors">
              v2.1.0
            </a>
          </div>
        </div>
      </footer>
      </div>

      {/* Action Bar Overlay */}
      <AnimatePresence>
        {(courses.length > 0 ||
          curriculumData ||
          coursePloMappings.length > 0) && (
          <motion.div
            initial={{ y: 100 }}
            animate={{ y: 0 }}
            exit={{ y: 100 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 px-6"
          >
            <div className="bg-white/80 backdrop-blur-2xl border border-[#DEDEDE] shadow-2xl rounded-2xl px-6 py-3 flex items-center gap-6">
              <div className="pr-6 border-r border-[#DEDEDE]">
                <p className="text-[10px] font-black text-black uppercase tracking-widest">
                  Status
                </p>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                  <p className="text-xs font-bold">Analysis Ready</p>
                </div>
              </div>
              <button
                onClick={resetData}
                className="text-xs font-bold text-[#E30000] px-4 py-2 hover:bg-rose-50 rounded-xl transition-all"
              >
                Clear Data
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {/* PLO Modal */}
      <AnimatePresence>
        {showPloModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-[2.5rem] p-10 max-w-2xl w-full max-h-[85vh] overflow-y-auto shadow-2xl relative"
            >
              <button 
                onClick={() => setShowPloModal(false)}
                className="absolute top-8 right-8 p-3 hover:bg-[#F5F5F7] rounded-full transition-all group"
              >
                <div className="w-5 h-5 relative flex items-center justify-center">
                   <div className="absolute w-full h-0.5 bg-black rotate-45" />
                   <div className="absolute w-full h-0.5 bg-black -rotate-45" />
                </div>
              </button>

              <div className="mb-10">
                <div className="w-16 h-16 bg-[#0071E3] rounded-2xl flex items-center justify-center mb-6 shadow-xl shadow-blue-200">
                  <Award className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-3xl font-black text-[#1D1D1F]">คำอธิบาย PLOs</h3>
                <p className="text-gray-500 mt-2 font-medium">ผลลัพธ์การเรียนรู้ที่คาดหวังของหลักสูตร (Program Learning Outcomes)</p>
              </div>

              <div className="space-y-4">
                {curriculumData?.plos && curriculumData.plos.length > 0 ? (
                  curriculumData.plos.map((plo) => (
                    <div key={plo.plo_number} className="p-6 rounded-3xl bg-[#F5F5F7] border border-transparent hover:border-[#DEDEDE] transition-all group">
                      <div className="flex items-center gap-4 mb-3">
                        <div className="w-10 h-10 rounded-xl bg-white border border-[#DEDEDE] text-[#1D1D1F] flex items-center justify-center text-sm font-black shadow-sm group-hover:bg-[#0071E3] group-hover:text-white group-hover:border-transparent transition-all">
                          {plo.plo_number}
                        </div>
                        <span className="font-bold text-[#1D1D1F]">PLO {plo.plo_number}</span>
                      </div>
                      <p className="text-sm text-[#1D1D1F] leading-relaxed opacity-80">{plo.plo_description}</p>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-12 bg-[#F5F5F7] rounded-3xl">
                    <p className="text-gray-400 font-bold uppercase tracking-widest text-xs">No PLO data available</p>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
