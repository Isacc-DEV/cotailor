// Visual resume-style tokens. A style is a named set of ENUMERATED tokens —
// never free CSS — so every admin-built style stays ATS-safe by construction:
// single column, real text, no graphics. The web preview maps each token to
// CSS classes/variables; the API validates admin-edited configs against the
// same schema. The one free-form value is accentColor, which may be a custom
// hex — it only ever colors the name and section titles.
import { z } from 'zod';

// Web-safe font families only: installed on Windows/macOS (with fallbacks in
// each stack), so the exported PDF renders identically without bundling fonts.
export const STYLE_FONT_KEYS = [
  'system-sans',
  'arial',
  'calibri',
  'verdana',
  'trebuchet',
  'georgia',
  'times',
  'garamond',
  'palatino',
  'cambria',
] as const;
export type StyleFontKey = (typeof STYLE_FONT_KEYS)[number];

// Heading font may also be 'match' = same as the body font.
export const STYLE_HEADING_FONT_KEYS = ['match', ...STYLE_FONT_KEYS] as const;

export const FONT_STACKS: Record<StyleFontKey, string> = {
  'system-sans': "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif",
  arial: "Arial, 'Helvetica Neue', Helvetica, sans-serif",
  calibri: "Calibri, 'Segoe UI', 'Gill Sans', 'Helvetica Neue', sans-serif",
  verdana: 'Verdana, Geneva, sans-serif',
  trebuchet: "'Trebuchet MS', 'Segoe UI', Tahoma, sans-serif",
  georgia: "Georgia, 'Times New Roman', serif",
  times: "'Times New Roman', Times, serif",
  garamond: "Garamond, 'EB Garamond', 'Palatino Linotype', serif",
  palatino: "'Palatino Linotype', Palatino, 'Book Antiqua', Georgia, serif",
  cambria: 'Cambria, Georgia, serif',
};

export const FONT_LABELS: Record<StyleFontKey, string> = {
  'system-sans': 'System Sans',
  arial: 'Arial',
  calibri: 'Calibri',
  verdana: 'Verdana',
  trebuchet: 'Trebuchet MS',
  georgia: 'Georgia',
  times: 'Times New Roman',
  garamond: 'Garamond',
  palatino: 'Palatino',
  cambria: 'Cambria',
};

export const STYLE_ACCENTS = ['black', 'navy', 'slate', 'burgundy', 'forest'] as const;
export const STYLE_DENSITIES = ['compact', 'normal', 'airy'] as const;
export const STYLE_HEADER_ALIGNS = ['left', 'centered'] as const;
export const STYLE_TITLE_STYLES = ['underline', 'caps-spaced', 'accent-bar'] as const;
export const STYLE_BULLET_MARKERS = ['disc', 'dash', 'arrow'] as const;
export const STYLE_NAME_SCALES = ['normal', 'large'] as const;
export const STYLE_TEXT_SCALES = ['small', 'normal', 'large'] as const;
export const STYLE_HEADER_RULES = ['strong', 'thin', 'accent', 'none'] as const;
export const STYLE_SKILLS_LAYOUTS = ['inline', 'pills'] as const;

// The resume document's sections, in default order. sectionOrder rearranges
// them (the contact header always stays on top).
export const RESUME_SECTION_KEYS = ['summary', 'skills', 'experience', 'education', 'certifications'] as const;
export type ResumeSectionKey = (typeof RESUME_SECTION_KEYS)[number];

export const STYLE_ACCENT_HEX: Record<(typeof STYLE_ACCENTS)[number], string> = {
  black: '#111111',
  navy: '#1e3a5f',
  slate: '#334155',
  burgundy: '#6d1f2c',
  forest: '#1f4d36',
};

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

// Defaults reproduce the pre-styles rendering exactly, so profiles without a
// (valid) style key look the same as before this feature existed.
export const DEFAULT_STYLE_CONFIG = {
  bodyFont: 'system-sans',
  headingFont: 'match',
  accentColor: 'black',
  density: 'normal',
  headerAlign: 'centered',
  sectionTitleStyle: 'underline',
  bulletMarker: 'disc',
  nameScale: 'normal',
  textScale: 'normal',
  headerRule: 'strong',
  skillsLayout: 'inline',
  sectionOrder: [...RESUME_SECTION_KEYS],
} as const;

// Dedupe and complete a section order so every section always renders exactly
// once, whatever a stored config contains.
function normalizeSectionOrder(arr: ResumeSectionKey[]): ResumeSectionKey[] {
  const seen = new Set<ResumeSectionKey>();
  const out: ResumeSectionKey[] = [];
  for (const k of arr) {
    if (!seen.has(k)) {
      seen.add(k);
      out.push(k);
    }
  }
  for (const k of RESUME_SECTION_KEYS) if (!seen.has(k)) out.push(k);
  return out;
}

// Configs written before bodyFont/headingFont existed carry the retired
// `font` token (sans | serif | mixed) — map it so stored styles keep their
// look without a data migration.
function upgradeLegacyFont(raw: unknown): unknown {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const r = raw as Record<string, unknown>;
    if (r.bodyFont === undefined && typeof r.font === 'string') {
      const legacy: Record<string, { bodyFont: string; headingFont: string }> = {
        sans: { bodyFont: 'system-sans', headingFont: 'match' },
        serif: { bodyFont: 'georgia', headingFont: 'match' },
        mixed: { bodyFont: 'system-sans', headingFont: 'georgia' },
      };
      const mapped = legacy[r.font];
      if (mapped) return { ...r, ...mapped };
    }
  }
  return raw;
}

// Per-field .catch(): a stored config with one bad/legacy token degrades that
// token to its default instead of failing the whole style.
export const styleConfigSchema = z.preprocess(
  upgradeLegacyFont,
  z
  .object({
    bodyFont: z.enum(STYLE_FONT_KEYS).catch(DEFAULT_STYLE_CONFIG.bodyFont),
    headingFont: z.enum(STYLE_HEADING_FONT_KEYS).catch(DEFAULT_STYLE_CONFIG.headingFont),
    // Named palette color OR a custom "#rrggbb" hex.
    accentColor: z
      .union([z.enum(STYLE_ACCENTS), z.string().regex(HEX_RE)])
      .catch(DEFAULT_STYLE_CONFIG.accentColor),
    density: z.enum(STYLE_DENSITIES).catch(DEFAULT_STYLE_CONFIG.density),
    headerAlign: z.enum(STYLE_HEADER_ALIGNS).catch(DEFAULT_STYLE_CONFIG.headerAlign),
    sectionTitleStyle: z.enum(STYLE_TITLE_STYLES).catch(DEFAULT_STYLE_CONFIG.sectionTitleStyle),
    bulletMarker: z.enum(STYLE_BULLET_MARKERS).catch(DEFAULT_STYLE_CONFIG.bulletMarker),
    nameScale: z.enum(STYLE_NAME_SCALES).catch(DEFAULT_STYLE_CONFIG.nameScale),
    textScale: z.enum(STYLE_TEXT_SCALES).catch(DEFAULT_STYLE_CONFIG.textScale),
    headerRule: z.enum(STYLE_HEADER_RULES).catch(DEFAULT_STYLE_CONFIG.headerRule),
    skillsLayout: z.enum(STYLE_SKILLS_LAYOUTS).catch(DEFAULT_STYLE_CONFIG.skillsLayout),
    sectionOrder: z
      .array(z.enum(RESUME_SECTION_KEYS))
      .catch([...RESUME_SECTION_KEYS])
      .transform(normalizeSectionOrder),
  })
  .catch({ ...DEFAULT_STYLE_CONFIG, sectionOrder: [...RESUME_SECTION_KEYS] }),
);
export type StyleConfig = z.infer<typeof styleConfigSchema>;

/** Resolve an accentColor token (palette name or custom hex) to a CSS color. */
export function accentToHex(accent: string): string {
  if (HEX_RE.test(accent)) return accent;
  return STYLE_ACCENT_HEX[accent as (typeof STYLE_ACCENTS)[number]] ?? STYLE_ACCENT_HEX.black;
}

// Seed styles — the four keys the profile form has always offered, now with
// actual visual meaning. Key strings must stay stable: profiles reference them.
export const STYLE_SEEDS: Array<{
  key: string;
  name: string;
  description: string;
  config: StyleConfig;
  isDefault: boolean;
  sortOrder: number;
}> = [
  {
    key: 'standard',
    name: 'Standard',
    description: 'Clean and conservative — the safest choice for any application.',
    config: styleConfigSchema.parse({}),
    isDefault: true,
    sortOrder: 0,
  },
  {
    key: 'modern',
    name: 'Modern',
    description: 'Left-aligned with navy accents, skill pills, and a bolder name.',
    config: styleConfigSchema.parse({
      accentColor: 'navy',
      density: 'normal',
      headerAlign: 'left',
      sectionTitleStyle: 'accent-bar',
      bulletMarker: 'disc',
      nameScale: 'large',
      headerRule: 'accent',
      skillsLayout: 'pills',
    }),
    isDefault: false,
    sortOrder: 1,
  },
  {
    key: 'minimal',
    name: 'Minimal',
    description: 'Compact and quiet — fits more on one page.',
    config: styleConfigSchema.parse({
      accentColor: 'black',
      density: 'compact',
      headerAlign: 'left',
      sectionTitleStyle: 'caps-spaced',
      bulletMarker: 'dash',
      nameScale: 'normal',
      textScale: 'small',
      headerRule: 'thin',
    }),
    isDefault: false,
    sortOrder: 2,
  },
  {
    key: 'creative',
    name: 'Creative',
    description: 'Serif headings, burgundy accents, arrow bullets, generous spacing.',
    config: styleConfigSchema.parse({
      bodyFont: 'system-sans',
      headingFont: 'georgia',
      accentColor: 'burgundy',
      density: 'airy',
      headerAlign: 'centered',
      sectionTitleStyle: 'accent-bar',
      bulletMarker: 'arrow',
      nameScale: 'large',
      headerRule: 'accent',
    }),
    isDefault: false,
    sortOrder: 3,
  },
];
