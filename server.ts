import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '50mb' }));

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

// API Routes
app.post("/api/gemini/extract-mappings", async (req, res) => {
  try {
    const { data } = req.body;
    const textContext = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
    
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Analyze the following curriculum mapping data (Relationship between Courses and PLOs). 
      The data is provided as a structured representation (often a table or grid).
      
      **MAPPING RECOGNITION RULES**:
      - Identify the Course Code and Course Name (Thai) for each row.
      - Identify the PLO columns (usually labeled PLO1, PLO2, etc., or indicated in the header).
      - Determine the level of mapping based on symbols in the cells:
        - A **filled circle (●)**, solid dot, or indicator indicating 'major' focus -> 'major'.
        - An **empty circle (○)**, hollow dot, or indicator indicating 'minor' focus -> 'minor'.
        - An empty cell or lack of indicator -> 'none'.
      - If the source uses different symbols (like '1' for major, '2' for minor), adapt accordingly.
      
      Data:
      ${textContext}

      Output must be a JSON array of CoursePLOMapping objects. Ensure every course found is included.
      `,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              course_code: { type: Type.STRING },
              course_name_th: { type: Type.STRING },
              curriculum_version: { type: Type.STRING },
              mappings: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    plo_number: { type: Type.NUMBER },
                    level: { type: Type.STRING, enum: ["major", "minor", "none"] }
                  },
                  required: ["plo_number", "level"]
                }
              }
            },
            required: ["course_code", "course_name_th", "mappings"]
          }
        }
      }
    });
    
    res.json(JSON.parse(response.text || "[]"));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to extract mappings" });
  }
});

app.post("/api/gemini/extract-courses", async (req, res) => {
  try {
    const { text, versionHint } = req.body;
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Extract course information from the following curriculum text and format it as a JSON array. 
      
      **IDENTIFICATION RULES**:
      - Find the curriculum version year (e.g., 2568, 2564) if mentioned in the header or text. Hint: ${versionHint || "Not provided"}.
      - For each course, identify Course Code, Thai Name, English Name, Credits, and Description.
      
      CRITICAL: The output must be valid JSON matching the schema. 
      If a field is missing, use "ไม่ระบุ" for strings or 0 for numbers.
      Include every course found in the text.
      
      Text:
      ${text}
      `,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              course_code: { type: Type.STRING },
              course_name_th: { type: Type.STRING },
              course_name_en: { type: Type.STRING },
              prerequisite: { type: Type.STRING },
              credits: { type: Type.STRING },
              curriculum_version: { type: Type.STRING, description: "Detect the year, e.g. 2568" },
              credit_details: {
                type: Type.OBJECT,
                properties: {
                  total_credits: { type: Type.NUMBER },
                  theory_hours: { type: Type.NUMBER },
                  practice_hours: { type: Type.NUMBER },
                  self_study_hours: { type: Type.NUMBER }
                },
                required: ["total_credits", "theory_hours", "practice_hours", "self_study_hours"]
              },
              description: { type: Type.STRING }
            },
            required: ["course_code", "course_name_th", "course_name_en", "prerequisite", "credits", "credit_details", "description"]
          }
        }
      }
    });
    res.json(JSON.parse(response.text || "[]"));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to extract courses" });
  }
});

app.post("/api/gemini/extract-plos", async (req, res) => {
  try {
    const { text } = req.body;
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Analyze the provided curriculum text to extract PLOs.
      Text Context:
      ${text}
      `,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            curriculum_name: { type: Type.STRING },
            curriculum_version: { type: Type.STRING },
            plos: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  plo_number: { type: Type.NUMBER },
                  plo_description: { type: Type.STRING },
                  ksec_mapping: {
                    type: Type.OBJECT,
                    properties: {
                      K: { type: Type.BOOLEAN },
                      S: { type: Type.BOOLEAN },
                      E: { type: Type.BOOLEAN },
                      C: { type: Type.BOOLEAN }
                    },
                    required: ["K", "S", "E", "C"]
                  },
                  ksa_bloom_taxonomy: {
                    type: Type.OBJECT,
                    properties: {
                      domain_k: { type: Type.STRING, nullable: true },
                      domain_s: { type: Type.STRING, nullable: true },
                      domain_a: { type: Type.STRING, nullable: true }
                    }
                  },
                  outcome_type: { type: Type.STRING, enum: ["Generic", "Specific"] }
                },
                required: ["plo_number", "plo_description", "ksec_mapping", "ksa_bloom_taxonomy", "outcome_type"]
              }
            }
          },
          required: ["curriculum_name", "plos"]
        }
      }
    });
    res.json(JSON.parse(response.text || "null"));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to extract PLOs" });
  }
});

app.post("/api/gemini/suggest-weekly", async (req, res) => {
  try {
    const { course, plos, mapping } = req.body;
    const mappingText = mapping ? mapping.mappings.map((m: any) => `PLO ${m.plo_number}`).join(', ') : 'General PLOs';
    
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Suggest a 15-week teaching plan for:
      Course: ${course.course_name_th} (${course.course_code})
      Target PLOs: ${mappingText}
      `,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              week: { type: Type.NUMBER },
              topic: { type: Type.STRING },
              llo: { type: Type.STRING },
              tla: { type: Type.STRING },
              assessment: { type: Type.STRING }
            },
            required: ["week", "topic", "llo", "tla", "assessment"]
          }
        }
      }
    });
    res.json(JSON.parse(response.text || "[]"));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to suggest weekly plan" });
  }
});

app.post("/api/gemini/suggest-assessment", async (req, res) => {
  try {
    const { course, assessments } = req.body;
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Update assessment items for OBE mapping:
      Course: ${course.course_name_th} (${course.course_code})
      Items: ${JSON.stringify(assessments)}
      `,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              clo: { type: Type.STRING },
              plos: { type: Type.ARRAY, items: { type: Type.NUMBER } },
              tla: { type: Type.STRING },
              method: { type: Type.STRING },
              component: { type: Type.STRING },
              weekStart: { type: Type.NUMBER },
              weekEnd: { type: Type.NUMBER },
              weight: { type: Type.NUMBER },
              criteria: { type: Type.STRING }
            },
            required: ["id", "clo", "plos", "tla", "method", "component", "weekStart", "weekEnd", "weight", "criteria"]
          }
        }
      }
    });
    res.json(JSON.parse(response.text || "[]"));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to suggest assessment mapping" });
  }
});

app.post("/api/gemini/generate-tqf3", async (req, res) => {
  try {
    const { course, plos, mappingText, config, weeklyPlans, assessments } = req.body;
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `คุณคือผู้เชี่ยวชาญด้านเอกสาร มคอ. 3...
      ข้อมูล:
      - รายวิชา: ${course.course_code} ${course.course_name_th}
      - ผู้สอน: ${config.instructorName}
      - แผนการสอน: ${JSON.stringify(weeklyPlans || [])}
      - การประเมิน: ${JSON.stringify(assessments || [])}
      - PLOs ที่เกี่ยวข้อง: ${mappingText}
      `,
    });
    res.json({ text: response.text });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to generate TQF3" });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
