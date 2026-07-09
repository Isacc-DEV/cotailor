import {
  CATEGORY_TAXONOMY,
  PROFILE_CATEGORIES,
  PROFILE_SUBTYPES,
  PROFILE_DEGREES,
  RESUME_IMPORT_CHAR_CAP,
} from '@cotailor/shared';
import type { BulletRewriteInput, SummaryInput } from './llm-provider.interface';

// Shared prompt builders, extracted VERBATIM from GeminiProvider so every
// provider (OpenAI today, others later) produces identical behavior.
// NOTE: GeminiProvider still carries its own inline copies by explicit user
// request ("don't edit gemini") — if you change a prompt here, mirror it there
// (or refactor Gemini to import from this file when that's allowed).

export function buildAnalyzeJDPrompt(jdText: string): string {
  return `You are classifying a job description. Respond ONLY with JSON of shape:
{"is_job_description": boolean, "category": string, "category_confidence": number (0..1),
 "subtype": string, "subtype_confidence": number (0..1), "domain_keywords": string[],
 "summary": string, "language": string, "red_flags": string[]}
"category" MUST be one of: ${CATEGORY_TAXONOMY.join(', ')}.
"subtype" is the specific role (e.g. "Backend Engineer", "Full Stack Engineer").
Job description:
"""${jdText.slice(0, 12000)}"""`;
}

export function buildExtractSkillsPrompt(jdText: string): string {
  return `You are an EXHAUSTIVE skill-keyword extractor for job descriptions.

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
}

export function buildRewriteBulletPrompt(input: BulletRewriteInput): string {
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
  return `${task}
Respond ONLY with JSON: {"text": string}.
Existing bullet: ${JSON.stringify(bullet || '')}`;
}

export function buildParseResumePrompt(resumeText: string): string {
  const subtypeLines = PROFILE_CATEGORIES.map(
    (c) => `  ${c}: ${(PROFILE_SUBTYPES[c] ?? []).join(', ')}`,
  ).join('\n');
  return `You are parsing the plain text of a candidate's resume into a structured profile.

CORE RULE — EXTRACT ONLY, NEVER INVENT: every value must come from the resume
text. Anything not present is "" (empty string), null, or [] — never guessed.
This profile feeds a tool whose promise is that nothing untrue ever reaches a
resume, so a fabricated field is a FAILURE.

Return ONLY valid JSON. No markdown, no explanations, no text outside JSON.

FIELD RULES:
1. "name": a short profile label from the candidate's current/most recent role
   title (e.g. "Senior Backend Engineer") — NOT the person's name.
2. "category": the closest match from this exact list, else "":
   ${PROFILE_CATEGORIES.join(', ')}.
   "category_confidence": 0..1 — how clearly the resume fits that category.
3. "subtype": the closest match from the chosen category's list below, else "":
${subtypeLines}
4. "header": the candidate's contact block. "name" is their full name,
   "title" their professional title, "address" city/state or location,
   "email" their email address, "linkedin" the LinkedIn URL or handle, "url"
   any personal site/portfolio.
5. "workExperience": one entry per role, most recent first.
   - "position" = job title, "company" = employer.
   - "startDate"/"endDate" as "YYYY-MM" if month is known, else "YYYY".
     A current role ("Present", "Now", no end date) → "endDate": null.
   - "bullets": the role's achievement/description bullets COPIED VERBATIM —
     do not rewrite, merge, shorten, or improve them.
   - "technologies": tools/tech named within that role's text.
   - "description"/"impact": only if the resume has such prose; else "".
6. "education": one entry per school. "degree" mapped to the closest of:
   ${PROFILE_DEGREES.join(', ')} (e.g. "B.Sc." → "Bachelor", "MBA" → "Master");
   use "Other" if unmappable. "field" is the major/discipline.
   "startDate" as "YYYY-MM" if month is known, else "YYYY"; "graduationYear"
   as a 4-digit year string, else "".
7. "skills": a flat, deduplicated array of concrete skills, tools, technologies,
   and techniques listed anywhere in the resume (skills section, role bullets).
   Atomic keywords only, no proficiency labels or years.
8. "certifications": named certifications/licenses only, with issuer and dates
   when stated.
9. "warnings": short notes on anything you could NOT extract cleanly — e.g.
   "employment dates for Acme Corp were ambiguous", "two-column layout may have
   scrambled some text", "no education section found". Empty array if none.

Return JSON EXACTLY in this shape:
{"name": string, "category": string, "category_confidence": number,
 "subtype": string,
 "header": {"name": string, "title": string, "address": string, "email": string, "phone": string, "linkedin": string, "url": string},
 "workExperience": [{"company": string, "position": string, "startDate": string, "endDate": string|null, "location": string, "description": string, "bullets": string[], "technologies": string[], "impact": string}],
 "education": [{"institution": string, "degree": string, "field": string, "startDate": string, "graduationYear": string, "gpa": string, "honors": string, "relevantCoursework": string[]}],
 "skills": string[],
 "certifications": [{"name": string, "issuer": string, "issueDate": string, "expiryDate": string, "credentialId": string, "credentialUrl": string}],
 "warnings": string[]}

Resume text:
"""
${resumeText.slice(0, RESUME_IMPORT_CHAR_CAP)}
"""`;
}

export function buildWriteSummaryPrompt(input: SummaryInput): string {
  const { targetRole, skills, experiences, domainKeywords } = input;
  const expLines = experiences
    .map((e) => `- ${e.position ?? 'Role'} at ${e.company}: ${e.bullets.slice(0, 4).join(' | ')}`)
    .join('\n');
  return `Write a professional resume summary for a candidate targeting the role of "${targetRole ?? 'the position'}".

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
}

// Certification selection. The model picks the best-fitting certs for a job from
// the manager's candidate list — it may ONLY return ids from the list, so it can
// never invent a certification the manager didn't approve.
export function buildSelectCertsPrompt(input: {
  jdText: string;
  subtype?: string;
  candidates: Array<{ id: string; name: string; issuer: string; aliases: string[] }>;
  topN: number;
}): string {
  const list = input.candidates
    .map(
      (c) =>
        `- id: ${c.id} | ${c.name} (${c.issuer})${c.aliases.length ? ` [aka ${c.aliases.join(', ')}]` : ''}`,
    )
    .join('\n');
  return `You are selecting the certifications most relevant to a job${
    input.subtype ? ` (role: ${input.subtype})` : ''
  }.

Pick AT MOST ${input.topN} certifications from the CANDIDATE LIST that genuinely fit
the work described below. Fewer is fine. A job rarely names a certification — infer
relevance from the skills, tools, and responsibilities in the posting.

RULES:
- You may ONLY choose ids from the CANDIDATE LIST. NEVER invent a certification or
  return an id that is not listed.
- Order best-fit first; return at most ${input.topN} items.

Return ONLY JSON of shape: {"selected": [{"catalogId": string, "reason": string}]}

CANDIDATE LIST:
${list}

JOB DESCRIPTION:
"""${input.jdText.slice(0, 12000)}"""`;
}
