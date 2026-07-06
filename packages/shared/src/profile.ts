// Profile-form vocabulary. These lists drive the category/subtype/style selects
// on the create-profile and profile-editor pages AND constrain what the
// resume-import LLM prompt may output — one source so they can never drift.
// (Distinct from CATEGORY_TAXONOMY in gates.ts, which is the JD-side taxonomy.)

export const PROFILE_CATEGORIES = [
  'Software Engineering',
  'Data Science',
  'Product Management',
  'Design',
  'Sales',
  'Marketing',
  'Operations',
  'Finance',
  'Human Resources',
] as const;
export type ProfileCategory = (typeof PROFILE_CATEGORIES)[number];

export const PROFILE_SUBTYPES: Record<string, string[]> = {
  'Software Engineering': ['Frontend', 'Backend', 'Full Stack', 'DevOps', 'Mobile'],
  'Data Science': ['ML Engineer', 'Data Analyst', 'Analytics', 'Research'],
  'Product Management': ['APM', 'PM', 'Technical PM', 'Strategy'],
  'Design': ['UX', 'UI', 'Visual', 'Product Designer'],
  'Sales': ['Enterprise', 'SMB', 'Field', 'Inside Sales'],
  'Marketing': ['Growth', 'Content', 'Brand', 'Performance'],
  'Operations': ['HR', 'Finance', 'Supply Chain', 'IT Ops'],
  'Finance': ['FP&A', 'Accounting', 'Investment', 'Trading'],
  'Human Resources': ['Recruiter', 'HRBP', 'Compensation', 'Learning'],
};

// Rendering style of the profile's base resume (form-level; distinct from the
// per-session RESUME_STYLES tailoring choice in enums.ts).
export const PROFILE_RESUME_STYLES = ['standard', 'modern', 'minimal', 'creative'] as const;

export const PROFILE_DEGREES = [
  'High School',
  'Associate',
  'Bachelor',
  'Master',
  'PhD',
  'Certificate',
  'Other',
] as const;

// Minimum confidence for the import parser's category guess to prefill the
// form; below it the category is left blank for the user to pick.
export const IMPORT_CATEGORY_CONFIDENCE_THRESHOLD = 0.7;
