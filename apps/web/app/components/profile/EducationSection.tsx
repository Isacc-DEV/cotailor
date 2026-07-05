'use client';

import React, { useState, useEffect } from 'react';
import { Button, ConfirmDialog } from '@/app/components/ui';
import { useConfirmDialog } from '@/app/hooks/useConfirmDialog';
import './EducationSection.css';

interface EducationItem {
  institution: string;
  degree: string;
  field: string;
  graduationYear: number | string;
  gpa?: string;
  honors?: string;
  relevantCoursework?: string[];
}

interface Props {
  education: EducationItem[];
  onChange: (education: EducationItem[]) => void;
  disabled?: boolean;
  /** Called right before a committed entry is deleted so the parent can snapshot for global undo. */
  onDelete?: () => void;
}

const DEGREES = [
  'High School',
  'Associate',
  'Bachelor',
  'Master',
  'PhD',
  'Certificate',
  'Other',
];

export default function EducationSection({
  education,
  onChange,
  disabled = false,
  onDelete,
}: Props) {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingData, setEditingData] = useState<EducationItem | null>(null);
  const [newCourse, setNewCourse] = useState('');

  // Local undo stack for in-form edits (coursework). Keeps last 1-2 states.
  const [editingUndo, setEditingUndo] = useState<EducationItem[]>([]);

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
    setEditingId(education.length);
    setEditingData({
      institution: '',
      degree: 'Bachelor',
      field: '',
      graduationYear: new Date().getFullYear(),
      gpa: '',
      honors: '',
      relevantCoursework: [],
    });
  };

  const handleEdit = (id: number) => {
    setEditingUndo([]);
    setEditingId(id);
    setEditingData({ ...education[id] });
  };

  const handleSave = () => {
    if (!editingData) return;

    if (!editingData.institution.trim() || !editingData.field.trim()) {
      alert('Institution and Field of Study are required');
      return;
    }
    if (!editingData.degree || !String(editingData.degree).trim()) {
      alert('Degree is required');
      return;
    }
    if (!editingData.graduationYear || !String(editingData.graduationYear).trim()) {
      alert('Graduation Year is required');
      return;
    }

    const updated = [...education];
    if (editingId !== null && editingId < education.length) {
      updated[editingId] = editingData;
    } else {
      updated.push(editingData);
    }

    onChange(updated);
    setEditingId(null);
    setEditingData(null);
    setNewCourse('');
    setEditingUndo([]);
  };

  const handleDelete = (id: number) => {
    const edu = education[id];
    requestConfirm(
      {
        title: 'Delete this education?',
        itemName: `${edu.institution} — ${edu.degree} in ${edu.field}`,
      },
      () => {
        onDelete?.();
        onChange(education.filter((_, i) => i !== id));
      },
    );
  };

  const handleCancel = () => {
    setEditingId(null);
    setEditingData(null);
    setNewCourse('');
    setEditingUndo([]);
  };

  const handleAddCourse = () => {
    if (!newCourse.trim() || !editingData) return;
    pushEditingUndo();
    const courses = editingData.relevantCoursework || [];
    setEditingData({
      ...editingData,
      relevantCoursework: [...courses, newCourse],
    });
    setNewCourse('');
  };

  const handleRemoveCourse = (courseId: number) => {
    if (!editingData) return;
    const courseText = (editingData.relevantCoursework || [])[courseId] || '';
    requestConfirm(
      {
        title: 'Delete this course?',
        itemName: courseText,
      },
      () => {
        pushEditingUndo();
        setEditingData((prev) =>
          prev
            ? {
                ...prev,
                relevantCoursework: (prev.relevantCoursework || []).filter(
                  (_, i) => i !== courseId,
                ),
              }
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
        <h2 className="section-title">Education</h2>

        <div className="education-form">
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="institution">Institution *</label>
              <input
                type="text"
                id="institution"
                value={editingData.institution}
                onChange={(e) =>
                  setEditingData({ ...editingData, institution: e.target.value })
                }
                placeholder="e.g., State University"
                disabled={disabled}
              />
            </div>

            <div className="form-group">
              <label htmlFor="field">Field of Study *</label>
              <input
                type="text"
                id="field"
                value={editingData.field}
                onChange={(e) =>
                  setEditingData({ ...editingData, field: e.target.value })
                }
                placeholder="e.g., Computer Science"
                disabled={disabled}
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="degree">Degree</label>
              <select
                id="degree"
                value={editingData.degree}
                onChange={(e) =>
                  setEditingData({ ...editingData, degree: e.target.value })
                }
                disabled={disabled}
              >
                {DEGREES.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="graduationYear">Graduation Year</label>
              <input
                type="number"
                id="graduationYear"
                value={editingData.graduationYear}
                onChange={(e) =>
                  setEditingData({
                    ...editingData,
                    graduationYear: e.target.value ? parseInt(e.target.value) : '',
                  })
                }
                placeholder="e.g., 2018"
                min="1950"
                max={new Date().getFullYear()}
                disabled={disabled}
              />
            </div>

            <div className="form-group">
              <label htmlFor="gpa">GPA</label>
              <input
                type="text"
                id="gpa"
                value={editingData.gpa || ''}
                onChange={(e) =>
                  setEditingData({ ...editingData, gpa: e.target.value })
                }
                placeholder="e.g., 3.7/4.0"
                disabled={disabled}
              />
            </div>

            <div className="form-group">
              <label htmlFor="honors">Honors</label>
              <input
                type="text"
                id="honors"
                value={editingData.honors || ''}
                onChange={(e) =>
                  setEditingData({ ...editingData, honors: e.target.value })
                }
                placeholder="e.g., Cum Laude"
                disabled={disabled}
              />
            </div>
          </div>

          <div className="form-group">
            <label>Relevant Coursework</label>
            <div className="courses-list">
              {(editingData.relevantCoursework || []).map((course, idx) => (
                <div key={idx} className="course-item">
                  <span>{course}</span>
                  <button
                    type="button"
                    className="btn-remove"
                    onClick={() => handleRemoveCourse(idx)}
                    aria-label="Remove course"
                    disabled={disabled}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>

            <div className="add-course">
              <input
                type="text"
                value={newCourse}
                onChange={(e) => setNewCourse(e.target.value)}
                placeholder="Add a course (e.g., Data Structures)..."
                onKeyPress={(e) => e.key === 'Enter' && handleAddCourse()}
                disabled={disabled}
              />
              <button
                type="button"
                className="btn-add"
                onClick={handleAddCourse}
                disabled={disabled}
              >
                + Add
              </button>
            </div>
          </div>

          <div className="form-actions">
            <Button
              type="button"
              variant="secondary"
              onClick={handleCancel}
              disabled={disabled}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              onClick={handleSave}
              disabled={disabled}
            >
              Save Education
            </Button>
          </div>
        </div>

        {confirmDialog}
      </section>
    );
  }

  return (
    <section className="form-section">
      <h2 className="section-title">Education</h2>

      {education.length === 0 ? (
        <div className="empty-state">
          <p>No education added yet</p>
          <Button
            type="button"
            variant="primary"
            onClick={handleAdd}
            disabled={disabled}
          >
            + Add Education
          </Button>
        </div>
      ) : (
        <>
          <div className="education-list">
            {education.map((edu, idx) => (
              <div key={idx} className="education-card">
                <div className="edu-header">
                  <div className="edu-title">
                    <h3>{edu.institution}</h3>
                    <p className="degree-info">
                      {edu.degree} in {edu.field}
                    </p>
                    <p className="graduation">Graduated: {edu.graduationYear}</p>
                  </div>
                  <div className="edu-actions">
                    <button
                      className="btn-edit"
                      onClick={() => handleEdit(idx)}
                      aria-label="Edit education"
                      disabled={disabled}
                    >
                      Edit
                    </button>
                    <button
                      className="btn-delete"
                      onClick={() => handleDelete(idx)}
                      aria-label="Delete education"
                      disabled={disabled}
                    >
                      Delete
                    </button>
                  </div>
                </div>

                <div className="edu-details">
                  {edu.gpa && <span className="detail">GPA: {edu.gpa}</span>}
                  {edu.honors && (
                    <span className="detail honors">
                      🏆 {edu.honors}
                    </span>
                  )}
                </div>

                {(edu.relevantCoursework || []).length > 0 && (
                  <div className="coursework">
                    <strong>Relevant Coursework:</strong>
                    <div className="course-tags">
                      {edu.relevantCoursework!.map((course, cIdx) => (
                        <span key={cIdx} className="course-tag">
                          {course}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          <Button
            type="button"
            variant="primary"
            onClick={handleAdd}
            disabled={disabled}
          >
            + Add Education
          </Button>
        </>
      )}

      {confirmDialog}
    </section>
  );
}
