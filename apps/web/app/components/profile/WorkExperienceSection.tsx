'use client';

import React, { useState, useEffect } from 'react';
import { Button, ConfirmDialog } from '@/app/components/ui';
import { useConfirmDialog } from '@/app/hooks/useConfirmDialog';
import { formatDateRange } from '@/app/lib/date-format';
import BulletsEditor from './BulletsEditor';
import './WorkExperienceSection.css';

interface WorkExperienceItem {
  company: string;
  position: string;
  startDate?: string;
  endDate?: string | null;
  location?: string;
  description?: string;
  bullets?: string[];
  technologies?: string[];
  impact?: string;
}

interface Props {
  experiences: WorkExperienceItem[];
  onChange: (experiences: WorkExperienceItem[]) => void;
  disabled?: boolean;
  /** Called right before a committed entry is deleted so the parent can snapshot for global undo. */
  onDelete?: () => void;
}

export default function WorkExperienceSection({
  experiences,
  onChange,
  disabled = false,
  onDelete,
}: Props) {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingData, setEditingData] = useState<WorkExperienceItem | null>(null);

  // Local undo stack for in-form edits (bullets/tech). Keeps last 1-2 states.
  const [editingUndo, setEditingUndo] = useState<WorkExperienceItem[]>([]);

  // Confirmation dialog + pending action to run on confirm.
  const { state: confirmState, open: openConfirm, close: closeConfirm } = useConfirmDialog();
  const [pendingConfirm, setPendingConfirm] = useState<(() => void) | null>(null);

  const pushEditingUndo = () => {
    if (!editingData) return;
    setEditingUndo((prev) => {
      const next = [...prev, JSON.parse(JSON.stringify(editingData))];
      if (next.length > 2) next.shift();
      return next;
    });
  };

  const popEditingUndo = () => {
    setEditingUndo((prev) => {
      if (prev.length === 0) return prev;
      const last = prev[prev.length - 1];
      setEditingData(JSON.parse(JSON.stringify(last)));
      return prev.slice(0, -1);
    });
  };

  // While editing, handle Ctrl+Z locally (capture phase) so the parent's global
  // undo doesn't fire and wipe the whole form. Only entry-level deletes use the
  // parent's undo stack.
  useEffect(() => {
    if (editingId === null) return;
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        e.stopPropagation();
        popEditingUndo();
      }
    };
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, [editingId, editingUndo]);

  const requestConfirm = (
    config: { title: string; message?: string; itemName?: string },
    action: () => void,
  ) => {
    openConfirm({ ...config, isDangerous: true });
    setPendingConfirm(() => action);
  };

  const handleConfirm = () => {
    if (pendingConfirm) pendingConfirm();
    setPendingConfirm(null);
  };

  const handleAdd = () => {
    setEditingUndo([]);
    setEditingId(experiences.length);
    setEditingData({
      company: '',
      position: '',
      startDate: '',
      endDate: null,
      location: '',
      description: '',
      bullets: [],
      technologies: [],
      impact: '',
    });
  };

  const handleEdit = (id: number) => {
    setEditingUndo([]);
    setEditingId(id);
    setEditingData({ ...experiences[id] });
  };

  const handleSave = () => {
    if (!editingData) return;

    if (!editingData.company.trim() || !editingData.position.trim()) {
      alert('Company and Position are required');
      return;
    }
    if (!editingData.startDate || !editingData.startDate.trim()) {
      alert('Start Date is required');
      return;
    }

    const updated = [...experiences];
    if (editingId !== null && editingId < experiences.length) {
      updated[editingId] = editingData;
    } else {
      updated.push(editingData);
    }

    onChange(updated);
    setEditingId(null);
    setEditingData(null);
    setEditingUndo([]);
  };

  const handleDelete = (id: number) => {
    const exp = experiences[id];
    requestConfirm(
      {
        title: 'Delete this job?',
        itemName: `${exp.company} — ${exp.position}`,
      },
      () => {
        onDelete?.();
        onChange(experiences.filter((_, i) => i !== id));
      },
    );
  };

  const handleCancel = () => {
    setEditingId(null);
    setEditingData(null);
    setEditingUndo([]);
  };

  const handleAddTech = (tech: string) => {
    if (!tech.trim() || !editingData) return;
    const technologies = editingData.technologies || [];
    if (!technologies.includes(tech)) {
      pushEditingUndo();
      setEditingData({ ...editingData, technologies: [...technologies, tech] });
    }
  };

  const handleRemoveTech = (techId: number) => {
    if (!editingData) return;
    const techText = (editingData.technologies || [])[techId] || '';
    requestConfirm(
      {
        title: 'Delete this technology?',
        itemName: techText,
      },
      () => {
        pushEditingUndo();
        setEditingData((prev) =>
          prev
            ? { ...prev, technologies: (prev.technologies || []).filter((_, i) => i !== techId) }
            : prev,
        );
      },
    );
  };

  const confirmDialog = (
    <ConfirmDialog
      isOpen={confirmState.isOpen}
      title={confirmState.title}
      message={confirmState.message}
      itemName={confirmState.itemName}
      isDangerous={confirmState.isDangerous}
      confirmText="Delete"
      onConfirm={handleConfirm}
      onCancel={closeConfirm}
    />
  );

  if (editingId !== null && editingData) {
    return (
      <section className="form-section">
        <h2 className="section-title">Work Experience</h2>

        <div className="experience-form">
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="company">Company *</label>
              <input
                type="text"
                id="company"
                value={editingData.company}
                onChange={(e) => setEditingData({ ...editingData, company: e.target.value })}
                placeholder="e.g., TechCorp Financial"
                disabled={disabled}
              />
            </div>

            <div className="form-group">
              <label htmlFor="position">Position *</label>
              <input
                type="text"
                id="position"
                value={editingData.position}
                onChange={(e) => setEditingData({ ...editingData, position: e.target.value })}
                placeholder="e.g., Senior Backend Engineer"
                disabled={disabled}
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="location">Location</label>
              <input
                type="text"
                id="location"
                value={editingData.location || ''}
                onChange={(e) => setEditingData({ ...editingData, location: e.target.value })}
                placeholder="e.g., San Francisco, CA"
                disabled={disabled}
              />
            </div>

            <div className="form-group">
              <label htmlFor="startDate">Start Date *</label>
              <input
                type="month"
                id="startDate"
                value={editingData.startDate || ''}
                onChange={(e) => setEditingData({ ...editingData, startDate: e.target.value })}
                disabled={disabled}
              />
            </div>

            <div className="form-group">
              <label htmlFor="endDate">End Date</label>
              <input
                type="month"
                id="endDate"
                value={editingData.endDate || ''}
                onChange={(e) => setEditingData({ ...editingData, endDate: e.target.value })}
                disabled={editingData.endDate === null || disabled}
              />
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={editingData.endDate === null}
                  onChange={(e) =>
                    setEditingData({
                      ...editingData,
                      endDate: e.target.checked ? null : '',
                    })
                  }
                  disabled={disabled}
                />
                Currently employed
              </label>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="description">Description</label>
            <textarea
              id="description"
              value={editingData.description || ''}
              onChange={(e) => setEditingData({ ...editingData, description: e.target.value })}
              placeholder="Brief overview of your role..."
              rows={2}
              disabled={disabled}
            />
          </div>

          <div className="form-group">
            <label>Responsibilities</label>
            <BulletsEditor
              bullets={editingData.bullets || []}
              onChange={(bullets) => {
                pushEditingUndo();
                setEditingData((prev) => (prev ? { ...prev, bullets } : prev));
              }}
              disabled={disabled}
            />
            <p className="undo-hint">
              Tip: click a line to edit, drag ⠿ to reorder, clear the text to delete. Ctrl+Z undoes.
            </p>
          </div>

          <div className="form-group">
            <label>Technologies</label>
            <div className="tech-tags">
              {(editingData.technologies || []).map((tech, idx) => (
                <div key={idx} className="tech-tag">
                  <span>{tech}</span>
                  <button
                    type="button"
                    className="btn-remove-tag"
                    onClick={() => handleRemoveTech(idx)}
                    aria-label="Remove technology"
                    disabled={disabled}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>

            <div className="add-tech">
              <input
                type="text"
                placeholder="Add technology (e.g., Node.js, AWS)..."
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    const input = e.currentTarget;
                    handleAddTech(input.value);
                    input.value = '';
                  }
                }}
                disabled={disabled}
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="impact">Impact/Achievement</label>
            <textarea
              id="impact"
              value={editingData.impact || ''}
              onChange={(e) => setEditingData({ ...editingData, impact: e.target.value })}
              placeholder="e.g., Reduced latency by 45%, Generated $2M+ revenue..."
              rows={2}
              disabled={disabled}
            />
          </div>

          <div className="form-actions">
            <Button type="button" variant="secondary" onClick={handleCancel} disabled={disabled}>
              Cancel
            </Button>
            <Button type="button" variant="primary" onClick={handleSave} disabled={disabled}>
              Save Job
            </Button>
          </div>
        </div>

        {confirmDialog}
      </section>
    );
  }

  return (
    <section className="form-section">
      <h2 className="section-title">Work Experience</h2>

      {experiences.length === 0 ? (
        <div className="empty-state">
          <p>No work experience added yet</p>
          <Button type="button" variant="primary" onClick={handleAdd} disabled={disabled}>
            + Add Job
          </Button>
        </div>
      ) : (
        <>
          <div className="experiences-list">
            {experiences.map((exp, idx) => (
              <div key={idx} className="experience-card">
                <div className="exp-header">
                  <div className="exp-title">
                    <h3>{exp.company}</h3>
                    <p className="position">{exp.position}</p>
                    <p className="duration">
                      {formatDateRange(exp.startDate, exp.endDate)}
                      {exp.location ? ` · ${exp.location}` : ''}
                    </p>
                  </div>
                  <div className="exp-actions">
                    <button
                      type="button"
                      className="btn-edit"
                      onClick={() => handleEdit(idx)}
                      aria-label="Edit job"
                      disabled={disabled}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="btn-delete"
                      onClick={() => handleDelete(idx)}
                      aria-label="Delete job"
                      disabled={disabled}
                    >
                      Delete
                    </button>
                  </div>
                </div>

                {exp.description && <p className="exp-description">{exp.description}</p>}

                {(exp.bullets || []).length > 0 && (
                  <ul className="bullets">
                    {exp.bullets!.map((bullet, bIdx) => (
                      <li key={bIdx}>{bullet}</li>
                    ))}
                  </ul>
                )}

                {(exp.technologies || []).length > 0 && (
                  <div className="technologies">
                    {exp.technologies!.map((tech, tIdx) => (
                      <span key={tIdx} className="tech-badge">
                        {tech}
                      </span>
                    ))}
                  </div>
                )}

                {exp.impact && (
                  <p className="exp-impact">
                    <strong>Impact:</strong> {exp.impact}
                  </p>
                )}
              </div>
            ))}
          </div>

          <Button type="button" variant="primary" onClick={handleAdd} disabled={disabled}>
            + Add Job
          </Button>
        </>
      )}

      {confirmDialog}
    </section>
  );
}
