'use client';

import { Fragment, useEffect, useState, type ReactNode } from 'react';
import { api } from '@/lib/api-client';
import { Button, Spinner } from '@/app/components/ui';
import ConfirmDialog from '@/app/components/ui/ConfirmDialog';
import {
  STYLE_FONT_KEYS,
  STYLE_HEADING_FONT_KEYS,
  FONT_STACKS,
  FONT_LABELS,
  STYLE_ACCENTS,
  STYLE_ACCENT_HEX,
  STYLE_DENSITIES,
  STYLE_HEADER_ALIGNS,
  STYLE_TITLE_STYLES,
  STYLE_BULLET_MARKERS,
  STYLE_NAME_SCALES,
  STYLE_TEXT_SCALES,
  STYLE_HEADER_RULES,
  STYLE_SKILLS_LAYOUTS,
  RESUME_SECTION_KEYS,
  DEFAULT_STYLE_CONFIG,
  accentToHex,
  styleConfigSchema,
  type ResumeSectionKey,
  type StyleConfig,
} from '@cotailor/shared';
import { styleClasses, styleVars } from '@/lib/resume-style';
// The real resume document's stylesheets, so the live preview is exactly what
// users see on the preview page and in the exported PDF.
import '@/app/resume-preview/page.css';
import '@/app/resume-preview/style-tokens.css';
import './styles.css';

type AdminStyle = Awaited<ReturnType<typeof api.admin.styles.list>>[number];

interface EditorState {
  id: string | null; // null = creating
  key: string;
  name: string;
  description: string;
  config: StyleConfig;
  isDefault: boolean;
  enabled: boolean;
}

const TOKEN_FIELDS: Array<{
  field: keyof Omit<StyleConfig, 'accentColor' | 'sectionOrder' | 'bodyFont' | 'headingFont'>;
  label: string;
  options: readonly string[];
}> = [
  { field: 'density', label: 'Density', options: STYLE_DENSITIES },
  { field: 'textScale', label: 'Text size', options: STYLE_TEXT_SCALES },
  { field: 'nameScale', label: 'Name size', options: STYLE_NAME_SCALES },
  { field: 'headerAlign', label: 'Header alignment', options: STYLE_HEADER_ALIGNS },
  { field: 'headerRule', label: 'Header rule', options: STYLE_HEADER_RULES },
  { field: 'sectionTitleStyle', label: 'Section titles', options: STYLE_TITLE_STYLES },
  { field: 'bulletMarker', label: 'Bullets', options: STYLE_BULLET_MARKERS },
  { field: 'skillsLayout', label: 'Skills layout', options: STYLE_SKILLS_LAYOUTS },
];

const SECTION_LABELS: Record<ResumeSectionKey, string> = {
  summary: 'Summary',
  skills: 'Skills',
  experience: 'Experience',
  education: 'Education',
  certifications: 'Certifications',
};

const SAMPLE_SKILLS = ['Node.js', 'TypeScript', 'PostgreSQL', 'Redis', 'Kubernetes', 'AWS'];

function SamplePreview({ config }: { config: StyleConfig }) {
  const blocks: Record<ResumeSectionKey, ReactNode> = {
    summary: (
      <section>
        <h3 className="resume-section-title">Summary</h3>
        <p className="resume-summary-text">
          Backend engineer with deep Node.js and PostgreSQL expertise, shipping payment systems that
          process millions of transactions a day.
        </p>
      </section>
    ),
    skills: (
      <section>
        <h3 className="resume-section-title">Skills</h3>
        {config.skillsLayout === 'pills' ? (
          <p className="resume-skills resume-skills-pills">
            {SAMPLE_SKILLS.map((s) => (
              <span key={s} className="skill-pill">
                {s}
              </span>
            ))}
          </p>
        ) : (
          <p className="resume-skills">{SAMPLE_SKILLS.join('  ·  ')}</p>
        )}
      </section>
    ),
    experience: (
      <section>
        <h3 className="resume-section-title">Experience</h3>
        <div className="resume-exp">
          <div className="resume-exp-head">
            <strong>Stripewave</strong>
            <span>Mar 2021 – Present</span>
          </div>
          <p className="resume-exp-pos">Senior Backend Engineer</p>
          <ul className="resume-bullets">
            <li>
              <span className="bullet-text">
                Built payment reconciliation services processing 2M transactions/day with PostgreSQL and Redis.
              </span>
            </li>
            <li>
              <span className="bullet-text">
                Led the migration to Kubernetes on AWS, cutting deploy time from 40 to 8 minutes.
              </span>
            </li>
          </ul>
        </div>
        <div className="resume-exp">
          <div className="resume-exp-head">
            <strong>Datakite</strong>
            <span>Jun 2018 – Feb 2021</span>
          </div>
          <p className="resume-exp-pos">Backend Engineer</p>
          <ul className="resume-bullets">
            <li>
              <span className="bullet-text">
                Developed REST APIs in Python/Django for dashboards used by 300+ enterprise customers.
              </span>
            </li>
          </ul>
        </div>
      </section>
    ),
    education: (
      <section>
        <h3 className="resume-section-title">Education</h3>
        <ul className="resume-certs">
          <li>Bachelor in Computer Science — University of Texas at Austin (2018)</li>
        </ul>
      </section>
    ),
    certifications: (
      <section>
        <h3 className="resume-section-title">Certifications</h3>
        <ul className="resume-certs">
          <li>AWS Certified Solutions Architect — Amazon Web Services</li>
        </ul>
      </section>
    ),
  };

  return (
    <div className={`resume-doc ${styleClasses(config)}`} style={styleVars(config)}>
      <div className="resume-doc-header">
        <h2>John Carter</h2>
        <p className="resume-title">Senior Backend Engineer</p>
        <p className="resume-contact">Austin, TX · (512) 555-0135 · linkedin.com/in/johncarter</p>
      </div>
      {config.sectionOrder.map((k) => (
        <Fragment key={k}>{blocks[k]}</Fragment>
      ))}
    </div>
  );
}

export default function AdminStyles() {
  const [styles, setStyles] = useState<AdminStyle[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [busy, setBusy] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AdminStyle | null>(null);

  const reload = () =>
    api.admin.styles
      .list()
      .then(setStyles)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load styles'));

  useEffect(() => {
    reload();
  }, []);

  const openEditor = (s?: AdminStyle, duplicate = false) =>
    setEditor(
      s
        ? {
            id: duplicate ? null : s.id,
            key: duplicate ? '' : s.key,
            name: duplicate ? `${s.name} Copy` : s.name,
            description: s.description ?? '',
            config: styleConfigSchema.parse(s.config),
            isDefault: duplicate ? false : s.isDefault,
            enabled: duplicate ? true : s.enabled,
          }
        : {
            id: null,
            key: '',
            name: '',
            description: '',
            config: styleConfigSchema.parse({}),
            isDefault: false,
            enabled: true,
          },
    );

  const setConfig = (patch: Partial<StyleConfig>) =>
    setEditor((prev) => (prev ? { ...prev, config: { ...prev.config, ...patch } } : prev));

  const moveSection = (index: number, delta: -1 | 1) => {
    if (!editor) return;
    const order = [...editor.config.sectionOrder];
    const target = index + delta;
    if (target < 0 || target >= order.length) return;
    [order[index], order[target]] = [order[target], order[index]];
    setConfig({ sectionOrder: order });
  };

  const saveEditor = async () => {
    if (!editor) return;
    setBusy(true);
    setError(null);
    try {
      if (editor.id === null) {
        await api.admin.styles.create({
          key: editor.key.trim().toLowerCase(),
          name: editor.name.trim(),
          description: editor.description.trim() || undefined,
          config: editor.config,
          isDefault: editor.isDefault,
        });
      } else {
        await api.admin.styles.update(editor.id, {
          name: editor.name.trim(),
          description: editor.description.trim() || null,
          config: editor.config,
          // Only send isDefault when turning it ON (turning it off is invalid —
          // the API requires promoting another style instead).
          ...(editor.isDefault ? { isDefault: true } : {}),
        });
      }
      setEditor(null);
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setBusy(false);
    }
  };

  const toggleEnabled = async (s: AdminStyle) => {
    setBusy(true);
    setError(null);
    try {
      await api.admin.styles.update(s.id, { enabled: !s.enabled });
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Update failed');
    } finally {
      setBusy(false);
    }
  };

  const doDelete = async (s: AdminStyle) => {
    setBusy(true);
    setError(null);
    try {
      await api.admin.styles.delete(s.id);
      if (editor?.id === s.id) setEditor(null);
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed');
    } finally {
      setBusy(false);
      setDeleteTarget(null);
    }
  };

  if (!styles) return <Spinner text="Loading styles..." />;

  const accentIsCustom = editor ? !(STYLE_ACCENTS as readonly string[]).includes(editor.config.accentColor) : false;

  return (
    <div>
      <div className="styles-header">
        <h1>Resume Styles</h1>
        <Button variant="primary" onClick={() => openEditor()} disabled={busy}>
          + New style
        </Button>
      </div>

      {error && <div className="admin-error">{error}</div>}

      <div className="styles-list">
        {styles.map((s) => (
          <div key={s.id} className={`style-row ${editor?.id === s.id ? 'editing' : ''}`}>
            <div className="style-row-main">
              <div className="style-row-title">
                <strong>{s.name}</strong>
                <code className="style-key">{s.key}</code>
                {s.isDefault && <span className="role-badge admin">default</span>}
                {!s.enabled && <span className="status-badge suspended">disabled</span>}
              </div>
              <div className="admin-muted style-row-desc">
                {s.description || '—'} · used by {s.usageCount} profile{s.usageCount === 1 ? '' : 's'}
              </div>
            </div>
            <div className="style-row-actions">
              <Button variant="secondary" onClick={() => openEditor(s)} disabled={busy}>
                Edit
              </Button>
              <Button variant="secondary" onClick={() => openEditor(s, true)} disabled={busy} title="Start a new style from this one">
                Duplicate
              </Button>
              {!s.isDefault && (
                <Button variant="secondary" onClick={() => toggleEnabled(s)} disabled={busy}>
                  {s.enabled ? 'Disable' : 'Enable'}
                </Button>
              )}
              {!s.isDefault && s.usageCount === 0 && (
                <Button variant="danger" onClick={() => setDeleteTarget(s)} disabled={busy}>
                  Delete
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>

      {editor && (
        <div className="style-editor">
          <h2 className="admin-section-title">{editor.id === null ? 'New style' : `Edit "${editor.name}"`}</h2>
          <div className="style-editor-grid">
            <div className="style-editor-form">
              <div className="se-field">
                <label>Name</label>
                <input
                  type="text"
                  value={editor.name}
                  onChange={(e) => setEditor({ ...editor, name: e.target.value })}
                  placeholder="e.g. Executive"
                  disabled={busy}
                />
              </div>
              <div className="se-field">
                <label>Key {editor.id !== null && <span className="admin-muted">(fixed — profiles reference it)</span>}</label>
                <input
                  type="text"
                  value={editor.key}
                  onChange={(e) => setEditor({ ...editor, key: e.target.value })}
                  placeholder="e.g. executive"
                  disabled={busy || editor.id !== null}
                />
              </div>
              <div className="se-field">
                <label>Description</label>
                <input
                  type="text"
                  value={editor.description}
                  onChange={(e) => setEditor({ ...editor, description: e.target.value })}
                  placeholder="Shown in the profile form dropdown"
                  disabled={busy}
                />
              </div>

              <div className="se-field">
                <label>Body font</label>
                <select
                  value={editor.config.bodyFont}
                  onChange={(e) => setConfig({ bodyFont: e.target.value as StyleConfig['bodyFont'] })}
                  disabled={busy}
                  style={{ fontFamily: FONT_STACKS[editor.config.bodyFont] }}
                >
                  {STYLE_FONT_KEYS.map((f) => (
                    <option key={f} value={f} style={{ fontFamily: FONT_STACKS[f] }}>
                      {FONT_LABELS[f]}
                    </option>
                  ))}
                </select>
              </div>

              <div className="se-field">
                <label>Heading font</label>
                <select
                  value={editor.config.headingFont}
                  onChange={(e) => setConfig({ headingFont: e.target.value as StyleConfig['headingFont'] })}
                  disabled={busy}
                  style={
                    editor.config.headingFont !== 'match'
                      ? { fontFamily: FONT_STACKS[editor.config.headingFont] }
                      : undefined
                  }
                >
                  {STYLE_HEADING_FONT_KEYS.map((f) => (
                    <option key={f} value={f} style={f !== 'match' ? { fontFamily: FONT_STACKS[f] } : undefined}>
                      {f === 'match' ? 'Same as body' : FONT_LABELS[f]}
                    </option>
                  ))}
                </select>
              </div>

              <div className="se-field">
                <label>Accent color</label>
                <div className="se-swatches">
                  {STYLE_ACCENTS.map((accent) => (
                    <button
                      key={accent}
                      type="button"
                      className={`se-swatch ${editor.config.accentColor === accent ? 'selected' : ''}`}
                      style={{ background: STYLE_ACCENT_HEX[accent] }}
                      title={accent}
                      onClick={() => setConfig({ accentColor: accent })}
                      disabled={busy}
                    />
                  ))}
                  <label
                    className={`se-swatch se-swatch-custom ${accentIsCustom ? 'selected' : ''}`}
                    style={accentIsCustom ? { background: editor.config.accentColor } : undefined}
                    title="Custom color"
                  >
                    <input
                      type="color"
                      value={accentToHex(editor.config.accentColor)}
                      onChange={(e) => setConfig({ accentColor: e.target.value })}
                      disabled={busy}
                    />
                    {!accentIsCustom && <span className="se-swatch-plus">+</span>}
                  </label>
                </div>
              </div>

              {TOKEN_FIELDS.map(({ field, label, options }) => (
                <div className="se-field" key={field}>
                  <label>{label}</label>
                  <select
                    value={editor.config[field]}
                    onChange={(e) => setConfig({ [field]: e.target.value } as Partial<StyleConfig>)}
                    disabled={busy}
                  >
                    {options.map((o) => (
                      <option key={o} value={o}>
                        {o.replace(/-/g, ' ')}
                      </option>
                    ))}
                  </select>
                </div>
              ))}

              <div className="se-field">
                <label>Section order</label>
                <div className="se-order">
                  {editor.config.sectionOrder.map((k, i) => (
                    <div key={k} className="se-order-row">
                      <span>{SECTION_LABELS[k]}</span>
                      <span className="se-order-btns">
                        <button type="button" onClick={() => moveSection(i, -1)} disabled={busy || i === 0} title="Move up">
                          ↑
                        </button>
                        <button
                          type="button"
                          onClick={() => moveSection(i, 1)}
                          disabled={busy || i === editor.config.sectionOrder.length - 1}
                          title="Move down"
                        >
                          ↓
                        </button>
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="se-field se-check">
                <label>
                  <input
                    type="checkbox"
                    checked={editor.isDefault}
                    onChange={(e) => setEditor({ ...editor, isDefault: e.target.checked })}
                    disabled={busy || (editor.id !== null && styles.find((s) => s.id === editor.id)?.isDefault)}
                  />{' '}
                  Default style (fallback for profiles without a valid style)
                </label>
              </div>

              <div className="se-actions">
                <Button
                  variant="primary"
                  onClick={saveEditor}
                  disabled={busy || !editor.name.trim() || (editor.id === null && !editor.key.trim())}
                >
                  {busy ? 'Saving…' : editor.id === null ? 'Create style' : 'Save changes'}
                </Button>
                <Button variant="secondary" onClick={() => setEditor(null)} disabled={busy}>
                  Cancel
                </Button>
              </div>
            </div>

            <div className="style-editor-preview">
              <div className="admin-muted se-preview-label">Live preview — exactly what users see and export</div>
              <SamplePreview config={editor.config} />
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={deleteTarget !== null}
        title="Delete style?"
        message="No profiles use this style, so it can be removed permanently."
        itemName={deleteTarget?.name}
        confirmText="Delete"
        onConfirm={() => deleteTarget && doDelete(deleteTarget)}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
