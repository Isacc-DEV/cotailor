// Maps a visual style config (enumerated tokens from @cotailor/shared) onto
// the resume document: modifier classes + CSS variables consumed by
// style-tokens.css. Used by the real resume preview AND the admin live preview
// so both render identically.
import type { CSSProperties } from 'react';
import {
  DEFAULT_STYLE_CONFIG,
  FONT_STACKS,
  accentToHex,
  styleConfigSchema,
  type StyleConfig,
} from '@cotailor/shared';

export interface PublicStyle {
  key: string;
  name: string;
  description?: string | null;
  isDefault?: boolean;
  config: StyleConfig;
}

export function resolveStyleConfig(styles: PublicStyle[], styleKey?: string | null): StyleConfig {
  const byKey = styleKey ? styles.find((s) => s.key === styleKey) : undefined;
  const fallback = styles.find((s) => s.isDefault) ?? styles[0];
  return styleConfigSchema.parse((byKey ?? fallback)?.config ?? DEFAULT_STYLE_CONFIG);
}

export function styleClasses(cfg: StyleConfig): string {
  return [
    'rs',
    `rs-density-${cfg.density}`,
    `rs-header-${cfg.headerAlign}`,
    `rs-title-${cfg.sectionTitleStyle}`,
    `rs-bullet-${cfg.bulletMarker}`,
    `rs-name-${cfg.nameScale}`,
    `rs-text-${cfg.textScale}`,
    `rs-hrule-${cfg.headerRule}`,
    `rs-skills-${cfg.skillsLayout}`,
  ].join(' ');
}

export function styleVars(cfg: StyleConfig): CSSProperties {
  // 'black' means "no accent": inherit the theme text color on screen and
  // pure black in print — identical to the pre-styles rendering. Anything
  // else (palette name or custom hex) resolves to a concrete color.
  const isPlain = cfg.accentColor === 'black';
  const vars: Record<string, string> = {
    '--rs-accent': isPlain ? 'var(--text-primary)' : accentToHex(cfg.accentColor),
    '--rs-accent-print': isPlain ? '#000' : accentToHex(cfg.accentColor),
    '--rs-body-font': FONT_STACKS[cfg.bodyFont],
  };
  // 'match' = headings use the body font (the --rs-head-font fallback).
  if (cfg.headingFont !== 'match') vars['--rs-head-font'] = FONT_STACKS[cfg.headingFont];
  return vars as CSSProperties;
}
