'use client';

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Button } from '@/app/components/ui';
import { formatDateRange } from '@/app/lib/date-format';
import { styleClasses, styleVars } from '@/lib/resume-style';
import { RESUME_SECTION_KEYS, type ResumeSectionKey, type StyleConfig } from '@cotailor/shared';
import './paged-preview.css';

// US Letter at 96 CSS px/in, 0.6in margins (matches the @page rule used for
// browser print). Pagination packs blocks into CONTENT_H of usable height.
const DPI = 96;
const MARGIN_IN = 0.6;
const PAGE_W = 8.5 * DPI;
const PAGE_H = 11 * DPI;
const MARGIN = MARGIN_IN * DPI;
const CONTENT_W = PAGE_W - 2 * MARGIN;
const CONTENT_H = Math.floor(PAGE_H - 2 * MARGIN); // slight slack against rounding
const PAGE_GAP = 20; // matches .pp-stack gap (1.25rem)

interface PreviewResume {
  header?: Record<string, any>;
  summary?: string;
  skills?: string[];
  workExperience?: Array<{
    company: string;
    position?: string;
    startDate?: string;
    endDate?: string | null;
    bullets: Array<{ text: string }>;
  }>;
  education?: any[];
  certifications?: any[];
}

interface Block {
  key: string;
  node: ReactNode;
  /** This block must not be stranded at the bottom of a page (headings, heads). */
  keepWithNext?: boolean;
  className?: string;
}

function educationText(ed: any): string {
  if (typeof ed === 'string') return ed;
  const head = [[ed.degree, ed.field].filter(Boolean).join(' in '), ed.institution].filter(Boolean).join(' — ');
  const when = ed.startDate || ed.graduationYear ? ` (${formatDateRange(ed.startDate, ed.graduationYear)})` : '';
  return head + when;
}

function certText(c: any): string {
  return `${c.name}${c.status ? ` (${c.status})` : ''}${c.issuer ? ` — ${c.issuer}` : ''}`;
}

// Flatten the resume into atomic, page-packable blocks in the style's section
// order — mirroring the on-screen document, minus editing chrome.
function buildBlocks(resume: PreviewResume, styleCfg: StyleConfig | null): Block[] {
  const h = resume.header || {};
  const blocks: Block[] = [];

  blocks.push({
    key: 'header',
    keepWithNext: true,
    node: (
      <div className="resume-doc-header">
        <h2>{h.name || 'Your Name'}</h2>
        {h.title && <p className="resume-title">{h.title}</p>}
        <p className="resume-contact">
          {[h.address, h.email, h.phone, h.linkedin, h.url].filter(Boolean).join('  ·  ')}
        </p>
      </div>
    ),
  });

  const title = (key: string, text: string): Block => ({
    key,
    keepWithNext: true,
    node: <h3 className="resume-section-title">{text}</h3>,
  });

  const sectionOrder: ResumeSectionKey[] = styleCfg?.sectionOrder ?? [...RESUME_SECTION_KEYS];

  const builders: Record<ResumeSectionKey, () => void> = {
    summary: () => {
      if (!resume.summary) return;
      blocks.push(title('t-summary', 'Summary'));
      blocks.push({ key: 'summary', node: <p className="resume-summary-text">{resume.summary}</p> });
    },
    skills: () => {
      if (!resume.skills?.length) return;
      blocks.push(title('t-skills', 'Skills'));
      blocks.push({
        key: 'skills',
        node:
          styleCfg?.skillsLayout === 'pills' ? (
            <p className="resume-skills resume-skills-pills">
              {resume.skills.map((s, i) => (
                <span key={i} className="skill-pill">
                  {s}
                </span>
              ))}
            </p>
          ) : (
            <p className="resume-skills">{resume.skills.join('  ·  ')}</p>
          ),
      });
    },
    experience: () => {
      if (!resume.workExperience?.length) return;
      blocks.push(title('t-exp', 'Experience'));
      resume.workExperience.forEach((e, ei) => {
        const [firstBullet, ...restBullets] = e.bullets;
        // Company + title + dates + the FIRST bullet travel together as one
        // inseparable block, so a job header is never stranded alone at the
        // bottom of a page while its bullets sit on the next.
        blocks.push({
          key: `exp-${ei}-head`,
          className: ei > 0 ? 'pp-exp-gap' : undefined,
          node: (
            <>
              <div className="resume-exp-head">
                <strong>{e.company}</strong>
                <span>{formatDateRange(e.startDate, e.endDate)}</span>
              </div>
              {e.position && <p className="resume-exp-pos">{e.position}</p>}
              {firstBullet && (
                <ul className="resume-bullets">
                  <li>{firstBullet.text}</li>
                </ul>
              )}
            </>
          ),
        });
        restBullets.forEach((b, bi) => {
          blocks.push({
            key: `exp-${ei}-b-${bi + 1}`,
            node: (
              <ul className="resume-bullets">
                <li>{b.text}</li>
              </ul>
            ),
          });
        });
      });
    },
    education: () => {
      if (!resume.education?.length) return;
      blocks.push(title('t-edu', 'Education'));
      resume.education.forEach((ed, i) => {
        blocks.push({
          key: `edu-${i}`,
          node: (
            <ul className="resume-certs">
              <li>{educationText(ed)}</li>
            </ul>
          ),
        });
      });
    },
    certifications: () => {
      if (!resume.certifications?.length) return;
      blocks.push(title('t-cert', 'Certifications'));
      resume.certifications.forEach((c, i) => {
        blocks.push({
          key: `cert-${i}`,
          node: (
            <ul className="resume-certs">
              <li>{certText(c)}</li>
            </ul>
          ),
        });
      });
    },
  };

  sectionOrder.forEach((k) => builders[k]?.());
  return blocks;
}

// Greedy top-to-bottom packing. A block that won't fit starts a new page; a
// keepWithNext block is moved to the next page rather than left alone at the
// bottom (so a heading never gets separated from what follows it).
function paginate(heights: number[], blocks: Block[]): number[][] {
  const pages: number[][] = [];
  let current: number[] = [];
  let used = 0;

  for (let i = 0; i < heights.length; i++) {
    const hgt = heights[i];
    if (used > 0 && used + hgt > CONTENT_H) {
      pages.push(current);
      current = [];
      used = 0;
    }
    current.push(i);
    used += hgt;

    if (blocks[i].keepWithNext && i + 1 < heights.length && current.length > 1) {
      if (used + heights[i + 1] > CONTENT_H) {
        current.pop();
        used -= hgt;
        pages.push(current);
        current = [i];
        used = hgt;
      }
    }
  }
  if (current.length) pages.push(current);
  return pages;
}

export default function PagedPreview({
  resume,
  styleCfg,
  onClose,
}: {
  resume: PreviewResume;
  styleCfg: StyleConfig | null;
  onClose: () => void;
}) {
  const blocks = useMemo(() => buildBlocks(resume, styleCfg), [resume, styleCfg]);
  const measureRef = useRef<HTMLDivElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [pages, setPages] = useState<number[][]>([]);
  const [scale, setScale] = useState(1);

  const docClass = `resume-doc pp-doc${styleCfg ? ` ${styleClasses(styleCfg)}` : ''}`;
  const docStyle = styleCfg ? styleVars(styleCfg) : undefined;

  // Measure each block, then pack into pages. Re-run once web fonts are ready
  // so heights reflect the real typeface, not the fallback.
  useLayoutEffect(() => {
    let cancelled = false;
    const measure = () => {
      const root = measureRef.current;
      if (!root || cancelled) return;
      const nodes = Array.from(root.querySelectorAll<HTMLElement>('.pp-block'));
      const heights = nodes.map((n) => n.getBoundingClientRect().height);
      setPages(paginate(heights, blocks));
    };
    measure();
    (document as any).fonts?.ready?.then(measure);
    return () => {
      cancelled = true;
    };
  }, [blocks]);

  // Scale the fixed-size sheets down to fit narrow viewports.
  useEffect(() => {
    const compute = () => {
      const el = scrollRef.current;
      if (!el) return;
      const avail = el.clientWidth - 32;
      setScale(Math.min(1, avail / PAGE_W));
    };
    compute();
    window.addEventListener('resize', compute);
    return () => window.removeEventListener('resize', compute);
  }, []);

  // Lock background scroll + wire Escape to close while open.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    // Marks that the preview is open so the print stylesheet knows to output
    // these sheets instead of the live document (see paged-preview.css @print).
    document.body.classList.add('pp-open');
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      document.body.classList.remove('pp-open');
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  const stackHeight = pages.length * PAGE_H + Math.max(0, pages.length - 1) * PAGE_GAP;

  return (
    <div className="pp-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-label="Resume preview">
      <div className="pp-bar" onClick={(e) => e.stopPropagation()}>
        <div>
          <span className="pp-bar-title">Preview</span>
          <span className="pp-bar-count">
            {pages.length > 0 ? `${pages.length} page${pages.length === 1 ? '' : 's'} · US Letter` : 'Laying out…'}
          </span>
        </div>
        <div className="pp-bar-actions">
          <Button variant="secondary" className="resume-toolbar-btn" onClick={() => window.print()}>
            Print / Save PDF
          </Button>
          <Button variant="primary" className="resume-toolbar-btn primary" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>

      <div className="pp-scroll" ref={scrollRef} onClick={onClose}>
        <div
          className="pp-stack-outer"
          style={{ width: PAGE_W * scale, height: stackHeight * scale }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="pp-stack" style={{ transform: `scale(${scale})` }}>
            {pages.map((pageBlockIdxs, pi) => (
              <div
                key={pi}
                className="pp-page"
                style={{ width: PAGE_W, height: PAGE_H, padding: MARGIN }}
              >
                <div className={docClass} style={{ ...docStyle, width: CONTENT_W }}>
                  {pageBlockIdxs.map((bi) => (
                    <div key={blocks[bi].key} className={`pp-block${blocks[bi].className ? ` ${blocks[bi].className}` : ''}`}>
                      {blocks[bi].node}
                    </div>
                  ))}
                </div>
                <span className="pp-page-num">
                  {pi + 1} / {pages.length}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Off-screen measurer: identical block markup at exact content width. */}
      <div className="pp-measure" ref={measureRef} aria-hidden="true">
        <div className={docClass} style={{ ...docStyle, width: CONTENT_W }}>
          {blocks.map((b) => (
            <div key={b.key} className={`pp-block${b.className ? ` ${b.className}` : ''}`}>
              {b.node}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
