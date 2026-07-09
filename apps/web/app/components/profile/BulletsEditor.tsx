'use client';

import { useState } from 'react';
import './BulletsEditor.css';

// Inline bullet editor for the profile form, mirroring the resume-preview UX:
// click a line to edit it in place, clear the text and save to delete it, add
// with the + control, and drag the grip handle to reorder. Operates on a plain
// string[]; every change is pushed up via onChange (the parent persists on Save).
export default function BulletsEditor({
  bullets,
  onChange,
  disabled = false,
  addLabel = 'Add a responsibility',
  splitOnComma = false,
  columns = 1,
}: {
  bullets: string[];
  onChange: (bullets: string[]) => void;
  disabled?: boolean;
  addLabel?: string;
  /** For short, comma-friendly items (skills, coursework): a saved value with
   *  commas splits into multiple entries. Off for sentence bullets. */
  splitOnComma?: boolean;
  /** Lay items out in this many columns (grid). 1 = single-column list. */
  columns?: number;
}) {
  const grid = columns > 1;
  const [editing, setEditing] = useState<{ index: number; value: string; added?: boolean } | null>(null);
  const [drag, setDrag] = useState<{ from: number; over: number; after: boolean } | null>(null);

  const startEdit = (i: number) => {
    if (!disabled) setEditing({ index: i, value: bullets[i] ?? '' });
  };

  const commit = () => {
    if (!editing) return;
    const next = [...bullets];
    if (splitOnComma) {
      // Replace the edited slot with its comma-separated parts (0 = delete).
      const parts = editing.value.split(',').map((s) => s.trim()).filter(Boolean);
      next.splice(editing.index, 1, ...parts);
    } else {
      const text = editing.value.trim();
      if (text === '') next.splice(editing.index, 1); // cleared → delete
      else next[editing.index] = text;
    }
    setEditing(null);
    onChange(next);
  };

  const cancel = () => {
    if (editing?.added) onChange(bullets.filter((_, i) => i !== editing.index)); // discard new empty
    setEditing(null);
  };

  const add = () => {
    if (disabled) return;
    onChange([...bullets, '']);
    setEditing({ index: bullets.length, value: '', added: true });
  };

  const move = (from: number, to: number) => {
    if (from === to) return;
    const next = [...bullets];
    const [m] = next.splice(from, 1);
    next.splice(to, 0, m);
    onChange(next);
  };

  const dropBullet = () => {
    if (!drag) return;
    let to = drag.over + (drag.after ? 1 : 0);
    if (drag.from < to) to -= 1; // account for the removed slot
    const from = drag.from;
    setDrag(null);
    move(from, to);
  };

  return (
    <div
      className={`pb-list${grid ? ' pb-grid' : ''}`}
      style={grid ? { gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` } : undefined}
    >
      {bullets.map((b, i) => {
        const isEditing = editing?.index === i;
        const cls = [
          'pb-item',
          isEditing ? 'pb-editing' : '',
          drag && drag.from === i ? 'pb-dragging' : '',
          drag && drag.over === i && drag.from !== i ? (drag.after ? 'pb-drop-after' : 'pb-drop-before') : '',
        ]
          .filter(Boolean)
          .join(' ');
        return (
          <div
            key={i}
            className={cls}
            onDragOver={(e) => {
              if (!drag) return;
              e.preventDefault();
              e.dataTransfer.dropEffect = 'move';
              const rect = e.currentTarget.getBoundingClientRect();
              // Grid flows left-to-right, so use the horizontal midpoint there.
              const after = grid
                ? e.clientX > rect.left + rect.width / 2
                : e.clientY > rect.top + rect.height / 2;
              if (drag.over !== i || drag.after !== after) setDrag({ ...drag, over: i, after });
            }}
            onDrop={(e) => {
              e.preventDefault();
              dropBullet();
            }}
          >
            {isEditing ? (
              <div className="pb-editor">
                <textarea
                  value={editing.value}
                  onChange={(e) => setEditing({ ...editing, value: e.target.value })}
                  rows={2}
                  autoFocus
                  disabled={disabled}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                      e.preventDefault();
                      commit();
                    } else if (e.key === 'Escape') {
                      e.preventDefault();
                      cancel();
                    }
                  }}
                />
                <div className="pb-editor-actions">
                  <button type="button" className="pb-save" onClick={commit} disabled={disabled}>
                    Save
                  </button>
                  <button type="button" className="pb-cancel" onClick={cancel} disabled={disabled}>
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <>
                <span
                  className="pb-grip"
                  draggable={!disabled}
                  onDragStart={(e) => {
                    setDrag({ from: i, over: i, after: false });
                    e.dataTransfer.effectAllowed = 'move';
                    e.dataTransfer.setData('text/plain', String(i)); // Firefox needs a payload
                  }}
                  onDragEnd={() => setDrag(null)}
                  title="Drag to reorder"
                  aria-hidden="true"
                >
                  ⠿
                </span>
                <button type="button" className="pb-text" onClick={() => startEdit(i)} disabled={disabled}>
                  {b || <span className="pb-empty">(empty — click to edit)</span>}
                </button>
              </>
            )}
          </div>
        );
      })}
      <button type="button" className="pb-add" onClick={add} disabled={disabled} title={addLabel} aria-label={addLabel}>
        <span className="pb-plus">+</span>
        <span className="pb-line" />
        <span className="pb-add-label">{addLabel}</span>
      </button>
    </div>
  );
}
