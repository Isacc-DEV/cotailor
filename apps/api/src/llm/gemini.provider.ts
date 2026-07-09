import { Injectable, Logger } from '@nestjs/common';
import type {
  JdPrecheck,
  JdAnalysis,
  SkillExtraction,
  ResumeStrategy,
  ResumeContent,
  ResumeValidation,
  ProfileImport,
} from '@cotailor/shared';
import { CATEGORY_TAXONOMY } from '@cotailor/shared';
import type { CertSelectionResult } from '@cotailor/shared';
import type {
  BulletRewriteInput,
  CertSelectionInput,
  LLMProvider,
  SummaryInput,
} from './llm-provider.interface';
import { StubLlmProvider } from './stub.provider';
import { buildParseResumePrompt, buildSelectCertsPrompt } from './prompts';

// Real provider backed by Google Gemini (REST, no SDK dependency).
// Only the methods the current flow exercises are LLM-powered
// (analyzeJD, extractSkills, rewriteBullet); the rest reuse safe defaults.
// Reads GEMINI_API_KEY / GEMINI_MODEL from env for now; per-user keys (from the
// Settings DB) will replace the env lookup later.
@Injectable()
export class GeminiProvider implements LLMProvider {
  private readonly logger = new Logger(GeminiProvider.name);
  private readonly fallback = new StubLlmProvider();

  private get apiKey(): string {
    return process.env.GEMINI_API_KEY ?? '';
  }
  private get model(): string {
    return process.env.GEMINI_MODEL ?? 'gemini-2.5-flash';
  }

  // Throws on any failure. Callers for AI-powered methods let it propagate so a
  // real failure surfaces as an error — never as silently-wrong stub data.
  private async callJson<T>(prompt: string, temperature = 0.2): Promise<T> {
    if (!this.apiKey) throw new Error('GEMINI_API_KEY is not set');
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`;

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature,
          responseMimeType: 'application/json',
          maxOutputTokens: 8192,
          // Disable "thinking" so output tokens aren't consumed by reasoning,
          // which was truncating the JSON on 2.5-flash. Ignored by models
          // that don't support it.
          thinkingConfig: { thinkingBudget: 0 },
        },
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      this.logger.error(`Gemini HTTP ${res.status}: ${body.slice(0, 300)}`);
      throw new Error(`Gemini request failed (HTTP ${res.status}). Check GEMINI_MODEL/GEMINI_API_KEY.`);
    }
    const data: any = await res.json();
    const finish = data?.candidates?.[0]?.finishReason;
    const text: string = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    if (finish === 'MAX_TOKENS') {
      throw new Error('Gemini response was cut off (MAX_TOKENS). Try a shorter job description.');
    }
    if (!text) throw new Error('Gemini returned an empty response.');
    const cleaned = text.replace(/^```json\s*/i, '').replace(/```$/, '').trim();
    try {
      return JSON.parse(cleaned) as T;
    } catch {
      this.logger.error(`Gemini non-JSON response: ${cleaned.slice(0, 200)}`);
      throw new Error('Gemini returned a response that was not valid JSON.');
    }
  }

  // Cheap heuristic — avoids a round-trip for the precheck gate.
  async precheckJD(jdText: string): Promise<JdPrecheck> {
    return this.fallback.precheckJD(jdText);
  }

  async selectCertifications(input: CertSelectionInput): Promise<CertSelectionResult> {
    if (!input.candidates.length || input.topN <= 0) return { selected: [] };
    const out = await this.callJson<CertSelectionResult>(buildSelectCertsPrompt(input), 0.1);
    // Guardrail: keep only ids that were actually offered — the model can never
    // introduce a cert that isn't in the manager's list.
    const valid = new Set(input.candidates.map((c) => c.id));
    const selected = (out.selected ?? []).filter((s) => valid.has(s.catalogId)).slice(0, input.topN);
    return { selected };
  }

  async analyzeJD(jdText: string): Promise<JdAnalysis> {
    const prompt = `You are classifying a job description. Respond ONLY with JSON of shape:
{"is_job_description": boolean, "category": string, "category_confidence": number (0..1),
 "subtype": string, "subtype_confidence": number (0..1), "domain_keywords": string[],
 "summary": string, "language": string, "red_flags": string[]}
"category" MUST be one of: ${CATEGORY_TAXONOMY.join(', ')}.
"subtype" is the specific role (e.g. "Backend Engineer", "Full Stack Engineer").
Job description:
"""${jdText.slice(0, 12000)}"""`;
    return this.callJson<JdAnalysis>(prompt, 0.1);
  }

  async extractSkills(jdText: string): Promise<SkillExtraction> {
    const prompt = `You are an EXHAUSTIVE skill-keyword extractor for job descriptions.

GOAL: capture EVERY concrete, demonstrable skill keyword in the posting — skills,
tools, technologies, platforms, frameworks, libraries, databases, cloud services,
techniques, and methodologies. Test for inclusion: "could a person list this on a
resume as experience?" If yes, extract it. Missing an extractable keyword is a
FAILURE. Works for any job domain (software, data, design, marketing, sales,
finance, healthcare, operations, legal, education, trades, ...).

Return ONLY valid JSON. No markdown, no explanations, no text outside JSON.

EXTRACTION RULES:
1. BE EXHAUSTIVE. Scan the ENTIRE posting: tag/label lists at the top, the tech
   stack, description bullets, requirements, bonus sections — everywhere.
2. Atomic keywords only. One keyword per item. Short canonical names.
3. When the JD lists alternatives or examples — "FastAPI, Flask, or similar",
   "vector databases (Pinecone, ChromaDB, FAISS, Qdrant)", "ICU or critical
   care experience" — extract EACH named item individually (FastAPI, Flask,
   Pinecone, ChromaDB, FAISS, Qdrant / ICU, Critical Care).
   NEVER output the vague umbrella term ("APIs", "Cloud", "vector databases",
   "LLM frameworks") when concrete names are given. If ONLY an umbrella term
   appears with no concrete names, extract the umbrella term itself.
4. Techniques, methods, and named PRACTICES count as skills when demonstrable:
   "RAG", "Prompt Engineering", "Fine-tuning", "Embeddings", "ETL", "CI/CD",
   "A/B Testing", "SEO", "Lead Generation", "Financial Modeling",
   "Wireframing", "Agile", "Scrum". When a requirement enumerates concrete
   practices — "proper packaging, testing, type hints, async where appropriate"
   or "model versioning, drift monitoring, experiment tracking" — extract EACH:
   "Python Packaging", "Testing", "Type Hints", "Async", "Model Versioning",
   "Drift Monitoring", "Experiment Tracking". Same for "how to evaluate
   properly" -> "Model Evaluation", "code review through PRs" -> "Code Review".
5. Normalize long names: "Google Cloud Platform"->"GCP",
   "Amazon Web Services"->"AWS", "Microsoft Azure"->"Azure",
   "Microsoft Excel"->"Excel", "Weights and Biases"->"Weights & Biases",
   "Search Engine Optimization"->"SEO". Otherwise keep the JD's spelling.
6. Deduplicate case-insensitively across ALL buckets — each keyword appears in
   exactly ONE of the three buckets, with priority required > preferred > mentioned.
7. Do NOT extract: soft skills, personality traits, years of experience,
   seniority, job titles, salary/benefits, location, remote/onsite, schedule,
   equipment ("personal computer", "reliable internet"), availability/time zones,
   company culture, or vague filler ("production experience", "troubleshooting",
   "clean code", "communication").

BUCKETS:
- required_skills: from requirements / must-have / minimum qualifications, or
  clearly necessary for the role. If a requirements line makes an AREA mandatory
  ("Hands-on experience with LLM frameworks", "4+ years in growth or demand
  generation"), the named items AND the area keyword itself ("LLMs",
  "Demand Generation") are REQUIRED — never demote them to mentioned_skills.
- preferred_skills: from "nice to have" / "bonus points" / "plus" / "preferred".
- mentioned_skills: every other concrete skill keyword in the posting (tag lists,
  tech-stack mentions, description bullets) not already in the two buckets above.
  Items here must STILL pass the resume-experience test: concrete skills, tools,
  or techniques only. NEVER put responsibility or marketing phrases here
  ("data-driven systems", "analytics platforms", "workflow intelligence",
  "internal tools"), and never bare umbrella words ("AI", "ML") when concrete
  items from that area are already extracted.
- certifications: named certifications only ("AWS Certified Solutions Architect",
  "PMP", "CPA", "BLS", "OSHA 10").
- all_keywords: deduplicated union of required + preferred + mentioned.

Return JSON EXACTLY in this shape:
{"required_skills": string[], "preferred_skills": string[], "mentioned_skills": string[],
 "certifications": string[],
 "all_keywords": string[]}

EXAMPLE 1
JD: "Tags: AWS, PHP, WordPress. We build data pipelines with Airflow.
Requirements: Python; APIs (FastAPI, Flask, or similar); vector databases
(Pinecone, ChromaDB, or similar); cloud (AWS, GCP, or Azure). Must be authorized
to work in the US. Remote with your own laptop. Bonus: Docker, Kubernetes."
JSON: {"required_skills":["Python","FastAPI","Flask","Pinecone","ChromaDB","AWS","GCP","Azure"],
"preferred_skills":["Docker","Kubernetes"],
"mentioned_skills":["PHP","WordPress","Airflow","Data Pipelines"],
"certifications":[],
"all_keywords":["Python","FastAPI","Flask","Pinecone","ChromaDB","AWS","GCP","Azure","Docker","Kubernetes","PHP","WordPress","Airflow","Data Pipelines"]}

EXAMPLE 2
JD: "Growth Marketer. Must know SEO, Google Analytics, HubSpot, email marketing,
and A/B testing. Experience with Figma and paid ads (Google Ads, Meta Ads) a plus.
We use Slack and Notion daily."
JSON: {"required_skills":["SEO","Google Analytics","HubSpot","Email Marketing","A/B Testing"],
"preferred_skills":["Figma","Google Ads","Meta Ads"],
"mentioned_skills":["Slack","Notion"],
"certifications":[],
"all_keywords":["SEO","Google Analytics","HubSpot","Email Marketing","A/B Testing","Figma","Google Ads","Meta Ads","Slack","Notion"]}

Now extract from this job description:
"""
${jdText.slice(0, 20000)}
"""`;
    return this.callJson<SkillExtraction>(prompt, 0);
  }

  async rewriteBullet(input: BulletRewriteInput): Promise<{ text: string }> {
    const { bullet, skill, mode, relatedSkill, instruction, context } = input;
    const task =
      mode === 'add'
        ? `Write ONE concise, truthful resume bullet that demonstrates "${skill}". Do not invent specific employers, metrics, or dates.${
            context
              ? ` The bullet is for this job: ${context}. You may naturally connect "${skill}" to that stack, but do not fabricate accomplishments.`
              : ''
          }`
        : mode === 'exchange'
          ? `Rewrite the bullet to present "${relatedSkill}" experience as "${skill}" instead. Keep it truthful and natural; change only what's needed.`
          : mode === 'both'
            ? `Rewrite the bullet to mention BOTH "${relatedSkill}" and "${skill}" naturally. Keep it truthful; change only what's needed.`
            : `Rewrite this resume bullet per the instruction below. Keep ALL facts, technologies, and metrics exactly as they are — do NOT invent, add, or remove any claim. Keep roughly the same length.
Instruction: ${instruction ?? 'Improve the wording.'}`;
    const prompt = `${task}
Respond ONLY with JSON: {"text": string}.
Existing bullet: ${JSON.stringify(bullet || '')}`;
    const out = await this.callJson<{ text: string }>(prompt, 0.4);
    return { text: (out.text || '').trim() };
  }

  // Professional summary derived ONLY from the final tailored resume content —
  // written last, after every bullet is settled, and targeted at the JD role.
  async writeSummary(input: SummaryInput): Promise<{ text: string }> {
    const { targetRole, skills, experiences, domainKeywords } = input;
    const expLines = experiences
      .map((e) => `- ${e.position ?? 'Role'} at ${e.company}: ${e.bullets.slice(0, 4).join(' | ')}`)
      .join('\n');
    const prompt = `Write a professional resume summary for a candidate targeting the role of "${targetRole ?? 'the position'}".

STRICT RULES:
- 2 to 3 sentences, at most 55 words total.
- Base it ONLY on the real content below. Do NOT invent experience, employers, years, metrics, or skills that are not present.
- Third person implied, no "I"/"my". Start with the professional identity (e.g. "Backend engineer with ...").
- No clichés or filler: never use results-driven, team player, passionate, dynamic, proven track record, detail-oriented, self-starter, synergy, cutting-edge, seamlessly.
- No weak phrases: never use responsible for, worked on, utilized.
- Mention 3-5 of the most relevant skills naturally.
${domainKeywords?.length ? `- The target domain is: ${domainKeywords.join(', ')}. ONLY mention this domain if the experience bullets below explicitly show work in it — never claim domain experience the bullets don't contain.` : ''}

Skills on the resume: ${skills.join(', ')}
Experience on the resume:
${expLines}

Respond ONLY with JSON: {"text": string}`;
    const out = await this.callJson<{ text: string }>(prompt, 0.4);
    return { text: (out.text || '').trim() };
  }

  // Resume import: prompt lives in prompts.ts (new method — no inline copy here).
  async parseResumeToProfile(resumeText: string): Promise<ProfileImport> {
    return this.callJson<ProfileImport>(buildParseResumePrompt(resumeText), 0.1);
  }

  // Unused by the current flow — safe defaults.
  generateResumeStrategy(_input: unknown): Promise<ResumeStrategy> {
    return this.fallback.generateResumeStrategy();
  }
  generateResume(_input: unknown): Promise<ResumeContent> {
    return this.fallback.generateResume();
  }
  validateResume(_input: unknown): Promise<ResumeValidation> {
    return this.fallback.validateResume();
  }
  reviseResume(_input: unknown): Promise<ResumeContent> {
    return this.fallback.reviseResume();
  }
}
