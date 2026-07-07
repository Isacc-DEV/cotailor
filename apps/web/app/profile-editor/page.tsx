'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useEffect } from 'react';
import { useProfiles } from '@/app/hooks/useProfiles';
import { Button, Spinner } from '@/app/components/ui';
import { api } from '@/lib/api-client';
import { exportProfile, importProfile, copyProfileToClipboard, pasteProfileFromClipboard } from '@/app/lib/profile-export';
import { normalizeSkills } from '@/app/lib/normalize-skills';
import WorkExperienceSection from '@/app/components/profile/WorkExperienceSection';
import EducationSection from '@/app/components/profile/EducationSection';
import CertificationsSection from '@/app/components/profile/CertificationsSection';
import {
  PROFILE_CATEGORIES as CATEGORIES,
  PROFILE_SUBTYPES as SUBTYPES,
} from '@cotailor/shared';
import { useResumeStyleOptions } from '@/app/hooks/useResumeStyleOptions';
import './page.css';

interface Profile {
  id: string;
  name: string;
  category: string;
  subtype?: string;
  resumeStyle?: string;
  header?: {
    name?: string;
    title?: string;
    address?: string;
    email?: string;
    phone?: string;
    linkedin?: string;
    url?: string;
  };
  workExperience?: Array<{
    company: string;
    position: string;
    startDate?: string;
    endDate?: string | null;
    location?: string;
    description?: string;
    bullets?: string[];
    technologies?: string[];
    impact?: string;
  }>;
  education?: Array<{
    institution: string;
    degree: string;
    field: string;
    startDate?: string;
    graduationYear: number | string;
    gpa?: string;
    honors?: string;
    relevantCoursework?: string[];
  }>;
  skills?: string[];
  topSkills?: Array<{
    name: string;
    years?: number;
    proficiency?: string;
  }>;
  certifications?: Array<{
    name: string;
    issuer?: string;
    issueDate?: string;
    expiryDate?: string;
    credentialId?: string;
    credentialUrl?: string;
  }>;
}

export default function ProfileEditor() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const profileId = searchParams.get('profileId');

  const { profiles, loading: loadingProfiles, updateProfile, deleteProfile } = useProfiles();
  const styleOptions = useResumeStyleOptions();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [formData, setFormData] = useState<Partial<Profile>>({});
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string[] | null>(null);
  const [undoStack, setUndoStack] = useState<Partial<Profile>[]>([]);
  // Bumped on import to remount the section components — an entry mid-edit
  // would otherwise keep its stale editing form open over the imported data.
  const [importVersion, setImportVersion] = useState(0);

  useEffect(() => {
    if (profileId && profiles.length > 0) {
      const found = profiles.find((p) => p.id === profileId) as any;
      if (found) {
        // The DB stores resume content inside baseResume JSON, and skills/subtypes
        // as relations. Map that shape back into the flat form structure.
        const br = (found.baseResume && typeof found.baseResume === 'object' ? found.baseResume : {}) as any;
        const skills =
          Array.isArray(found.skills) && found.skills.length > 0
            ? normalizeSkills(found.skills)
            : normalizeSkills(br.skills);
        const subtype =
          Array.isArray(found.subtypes) && found.subtypes.length > 0
            ? found.subtypes[0].name
            : br.subtype;

        const mapped: Partial<Profile> = {
          id: found.id,
          name: found.name,
          category: found.category,
          subtype,
          resumeStyle: br.resumeStyle,
          header: br.header || {},
          workExperience: br.workExperience || [],
          education: br.education || [],
          skills,
          topSkills: Array.isArray(br.topSkills) ? br.topSkills : [],
          certifications: br.certifications || [],
        };

        setProfile(mapped as Profile);
        setFormData(mapped);
      }
    }
  }, [profileId, profiles]);

  // Undo/Recovery Functions
  const saveToUndoStack = () => {
    setUndoStack((prev) => {
      const newStack = [...prev, JSON.parse(JSON.stringify(formData))];
      // Keep only last 2 states
      if (newStack.length > 2) {
        newStack.shift();
      }
      return newStack;
    });
  };

  const handleUndo = () => {
    if (undoStack.length === 0) return;

    const lastState = undoStack[undoStack.length - 1];
    setFormData(JSON.parse(JSON.stringify(lastState)));
    setUndoStack((prev) => prev.slice(0, -1));
  };

  // Keyboard listener for Ctrl+Z — must be registered before any early return
  // so hook order stays stable across renders.
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        handleUndo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undoStack, formData]);

  if (loadingProfiles || !profile) {
    return <Spinner text="Loading profile..." />;
  }

  // Export profile as JSON
  const handleExport = async () => {
    setExporting(true);
    try {
      exportProfile(formData);
      alert('Profile exported successfully!');
    } catch (err) {
      alert(`Export failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setExporting(false);
    }
  };

  // Copy profile to clipboard
  const handleCopyToClipboard = async () => {
    try {
      const success = await copyProfileToClipboard(formData);
      if (success) {
        alert('Profile copied to clipboard!');
      } else {
        alert('Failed to copy to clipboard');
      }
    } catch (err) {
      alert(`Copy failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  // Import profile from file (.json export, or a Word/PDF resume parsed by the API)
  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    try {
      const lower = file.name.toLowerCase();
      if (lower.endsWith('.doc')) {
        setImportError(['Legacy .doc files are not supported — save the file as .docx or PDF and try again.']);
        return;
      }
      if (lower.endsWith('.docx') || lower.endsWith('.pdf')) {
        const imported = await api.profiles.importResume(file);
        const draft = imported.draft;
        // Snapshot first so Ctrl+Z restores the pre-import form.
        saveToUndoStack();
        setFormData((prev) => ({
          ...prev,
          // Don't blank out identity fields the parser couldn't fill.
          name: draft.name || prev.name,
          category: draft.category || prev.category,
          subtype: draft.subtype || prev.subtype,
          header: draft.header || {},
          workExperience: draft.workExperience || [],
          education: draft.education || [],
          skills: normalizeSkills(draft.skills),
          certifications: draft.certifications || [],
        }));
        setImportError(null);
        setImportVersion((v) => v + 1);
        const warn = imported.meta.warnings.length ? `\n\nNote: ${imported.meta.warnings.join('\n')}` : '';
        alert(`Imported from ${imported.meta.filename} — review the fields, then save. Nothing is saved until you do.${warn}`);
        return;
      }

      const result = await importProfile(file);
      if (result.success && result.data) {
        const prof = result.data.profile as any;

        // Map fields from imported JSON to form structure
        const skillsArray = normalizeSkills(prof.skills ?? prof.baseResume?.skills);

        const importedData: Partial<Profile> = {
          name: prof.name,
          category: prof.category,
          subtype: prof.subtype || (Array.isArray(prof.subtypes) ? prof.subtypes[0] : undefined),
          resumeStyle: prof.resumeStyle,
          header: prof.header || {},
          workExperience: prof.workExperience || prof.baseResume?.workExperience || [],
          education: prof.education || prof.baseResume?.education || [],
          skills: skillsArray,
          topSkills: Array.isArray(prof.topSkills)
            ? prof.topSkills
            : Array.isArray(prof.baseResume?.topSkills)
              ? prof.baseResume.topSkills
              : [],
          certifications: prof.certifications || prof.baseResume?.certifications || [],
        };

        setFormData(importedData);
        setImportError(null);
        setImportVersion((v) => v + 1);
        alert('Profile imported successfully! Review and save your changes.');
      } else {
        setImportError(result.errors || []);
      }
    } catch (err) {
      setImportError([err instanceof Error ? err.message : 'Unknown error']);
    } finally {
      setImporting(false);
      e.target.value = '';
    }
  };

  // Paste profile from clipboard
  const handlePasteFromClipboard = async () => {
    setImporting(true);
    try {
      const result = await pasteProfileFromClipboard();
      if (result.success && result.data) {
        const prof = result.data.profile as any;

        // Map fields from imported JSON to form structure
        const skillsArray = normalizeSkills(prof.skills ?? prof.baseResume?.skills);

        const importedData: Partial<Profile> = {
          name: prof.name,
          category: prof.category,
          subtype: prof.subtype || (Array.isArray(prof.subtypes) ? prof.subtypes[0] : undefined),
          resumeStyle: prof.resumeStyle,
          header: prof.header || {},
          workExperience: prof.workExperience || prof.baseResume?.workExperience || [],
          education: prof.education || prof.baseResume?.education || [],
          skills: skillsArray,
          topSkills: Array.isArray(prof.topSkills)
            ? prof.topSkills
            : Array.isArray(prof.baseResume?.topSkills)
              ? prof.baseResume.topSkills
              : [],
          certifications: prof.certifications || prof.baseResume?.certifications || [],
        };

        setFormData(importedData);
        setImportError(null);
        setImportVersion((v) => v + 1);
        alert('Profile pasted successfully! Review and save your changes.');
      } else {
        setImportError(result.errors || []);
      }
    } catch (err) {
      setImportError([err instanceof Error ? err.message : 'Unknown error']);
    } finally {
      setImporting(false);
    }
  };

  const validateForm = () => {
    const errors: Record<string, string> = {};

    if (!formData.name?.trim()) {
      errors.name = 'Profile name is required';
    }
    if (!formData.category) {
      errors.category = 'Job category is required';
    }
    if (!formData.header?.name?.trim()) {
      errors.headerName = 'Your name is required';
    }
    const linkedin = formData.header?.linkedin?.trim();
    if (linkedin && !linkedin.toLowerCase().includes('linkedin.com/in')) {
      errors.headerLinkedin = 'LinkedIn must contain "linkedin.com/in"';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setLoading(true);
    setError(null);

    try {
      await updateProfile(profileId!, formData as Profile);
      setUndoStack([]);  // Clear undo stack after successful save
      setSuccess(true);
      setTimeout(() => {
        router.push('/profile-selector');
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    setLoading(true);
    setError(null);
    try {
      await deleteProfile(profileId!);
      router.push('/profile-selector');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete profile');
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>, path?: string) => {
    const { name, value } = e.target;

    if (path) {
      const [section, field] = path.split('.');
      setFormData((prev) => ({
        ...prev,
        [section]: {
          ...(prev[section as keyof Profile] as any),
          [field]: value,
        },
      }));
    } else if (name === 'skills') {
      const skillsArray = value
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
      setFormData((prev) => ({ ...prev, [name]: skillsArray }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }

    if (validationErrors[name]) {
      setValidationErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  if (success) {
    return (
      <div className="profile-editor">
        <div className="success-state">
          <div className="success-icon">✓</div>
          <h1>Profile Updated</h1>
          <p>Your profile has been saved successfully</p>
        </div>
      </div>
    );
  }

  const subtypeOptions = SUBTYPES[formData.category as string] || [];

  return (
    <div className="profile-editor">
      <h1>Edit Profile</h1>
      <div className="editor-header">
        <div className="header-left">
          <Button variant="secondary" className="profile-back-btn" onClick={() => router.push('/profile-selector')}>
            <span className="profile-toolbar-icon back-icon" aria-hidden="true" />
            <span>Back to Profiles</span>
          </Button>
        </div>

        <div className="header-actions">
          <button
            className="export-import-btn export-btn"
            onClick={handleExport}
            disabled={exporting}
            title="Download profile as JSON"
          >
            <span className="profile-toolbar-icon export-icon" aria-hidden="true" />
            <span>{exporting ? 'Exporting...' : 'Export'}</span>
          </button>

          <button
            className="export-import-btn copy-btn"
            onClick={handleCopyToClipboard}
            title="Copy profile JSON to clipboard"
          >
            <span className="profile-toolbar-icon copy-icon" aria-hidden="true" />
            <span>Copy</span>
          </button>

          <label
            className={`export-import-btn import-btn ${importing ? 'is-disabled' : ''}`}
            title="Import a profile JSON export or a Word/PDF resume"
            aria-disabled={importing}
          >
            <span className="profile-toolbar-icon import-icon" aria-hidden="true" />
            <span>{importing ? 'Importing...' : 'Import'}</span>
            <input
              type="file"
              accept=".json,.docx,.pdf"
              onChange={handleImportFile}
              disabled={importing}
              style={{ display: 'none' }}
            />
          </label>

          <button
            className="export-import-btn paste-btn"
            onClick={handlePasteFromClipboard}
            disabled={importing}
            title="Paste profile JSON from clipboard"
          >
            <span className="profile-toolbar-icon paste-icon" aria-hidden="true" />
            <span>{importing ? 'Pasting...' : 'Paste'}</span>
          </button>
        </div>
      </div>

      {/* Import Error Modal */}
      {importError && (
        <div className="import-error-overlay" onClick={() => setImportError(null)}>
          <div className="import-error-modal" onClick={(e) => e.stopPropagation()}>
            <h2>Import Error</h2>
            <p>The file could not be imported. Please check it and try again.</p>
            <ul className="error-list">
              {importError.map((err, idx) => (
                <li key={idx}>• {err}</li>
              ))}
            </ul>
            <button
              className="btn-primary"
              onClick={() => setImportError(null)}
            >
              Close
            </button>
          </div>
        </div>
      )}

      {error && <div className="error-message">{error}</div>}

      <form onSubmit={handleSubmit} className="profile-form">
        {/* Section 1: Basic Information */}
        <section className="form-section">
          <h2 className="section-title">Basic Information</h2>
          <div className="form-group">
            <label htmlFor="name">Profile Name *</label>
            <input
              type="text"
              id="name"
              name="name"
              placeholder="e.g., Senior Backend Engineer"
              value={formData.name || ''}
              onChange={handleInputChange}
              className={validationErrors.name ? 'error' : ''}
              disabled={loading}
            />
            {validationErrors.name && <span className="error-text">{validationErrors.name}</span>}
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="category">Job Category *</label>
              <select
                id="category"
                name="category"
                value={formData.category || ''}
                onChange={handleInputChange}
                className={validationErrors.category ? 'error' : ''}
                disabled={loading}
              >
                <option value="">— Select a category —</option>
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
              {validationErrors.category && <span className="error-text">{validationErrors.category}</span>}
            </div>

            {subtypeOptions.length > 0 && (
              <div className="form-group">
                <label htmlFor="subtype">Job Subtype</label>
                <select
                  id="subtype"
                  name="subtype"
                  value={formData.subtype || ''}
                  onChange={handleInputChange}
                  disabled={loading}
                >
                  <option value="">— Select subtype —</option>
                  {subtypeOptions.map((subtype) => (
                    <option key={subtype} value={subtype}>
                      {subtype}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="form-group">
              <label htmlFor="resumeStyle">Resume Style</label>
              <select
                id="resumeStyle"
                name="resumeStyle"
                value={formData.resumeStyle || ''}
                onChange={handleInputChange}
                disabled={loading}
              >
                <option value="">— Select style —</option>
                {styleOptions.map((style) => (
                  <option key={style.key} value={style.key} title={style.description ?? undefined}>
                    {style.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </section>

        {/* Section 2: Header (Contact Info) */}
        <section className="form-section">
          <h2 className="section-title">Header</h2>
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="headerName">Name *</label>
              <input
                type="text"
                id="headerName"
                name="headerName"
                placeholder="Your full name"
                value={formData.header?.name || ''}
                onChange={(e) => handleInputChange(e, 'header.name')}
                className={validationErrors.headerName ? 'error' : ''}
                disabled={loading}
              />
              {validationErrors.headerName && <span className="error-text">{validationErrors.headerName}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="headerTitle">Title</label>
              <input
                type="text"
                id="headerTitle"
                name="headerTitle"
                placeholder="e.g., Senior Backend Engineer"
                value={formData.header?.title || ''}
                onChange={(e) => handleInputChange(e, 'header.title')}
                disabled={loading}
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="headerAddress">Address</label>
              <input
                type="text"
                id="headerAddress"
                name="headerAddress"
                placeholder="City, State"
                value={formData.header?.address || ''}
                onChange={(e) => handleInputChange(e, 'header.address')}
                disabled={loading}
              />
            </div>

            <div className="form-group">
              <label htmlFor="headerEmail">Email</label>
              <input
                type="email"
                id="headerEmail"
                name="headerEmail"
                placeholder="you@example.com"
                value={formData.header?.email || ''}
                onChange={(e) => handleInputChange(e, 'header.email')}
                disabled={loading}
              />
            </div>

            <div className="form-group">
              <label htmlFor="headerPhone">Phone</label>
              <input
                type="tel"
                id="headerPhone"
                name="headerPhone"
                placeholder="(555) 123-4567"
                value={formData.header?.phone || ''}
                onChange={(e) => handleInputChange(e, 'header.phone')}
                disabled={loading}
              />
            </div>

            <div className="form-group">
              <label htmlFor="headerLinkedin">LinkedIn</label>
              <input
                type="text"
                id="headerLinkedin"
                name="headerLinkedin"
                placeholder="linkedin.com/in/yourprofile"
                value={formData.header?.linkedin || ''}
                onChange={(e) => handleInputChange(e, 'header.linkedin')}
                className={validationErrors.headerLinkedin ? 'error' : ''}
                disabled={loading}
              />
              {validationErrors.headerLinkedin && (
                <span className="error-text">{validationErrors.headerLinkedin}</span>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="headerUrl">Website/Portfolio</label>
              <input
                type="url"
                id="headerUrl"
                name="headerUrl"
                placeholder="https://yourwebsite.com"
                value={formData.header?.url || ''}
                onChange={(e) => handleInputChange(e, 'header.url')}
                disabled={loading}
              />
            </div>
          </div>
        </section>

        {/* Section 3: Work Experience */}
        <WorkExperienceSection
          key={`work-${importVersion}`}
          experiences={formData.workExperience || []}
          onChange={(experiences) =>
            setFormData((prev) => ({ ...prev, workExperience: experiences }))
          }
          disabled={loading}
          onDelete={saveToUndoStack}
        />

        {/* Section 4: Education */}
        <EducationSection
          key={`edu-${importVersion}`}
          education={formData.education || []}
          onChange={(education) =>
            setFormData((prev) => ({ ...prev, education }))
          }
          disabled={loading}
          onDelete={saveToUndoStack}
        />

        {/* Section 5: Skills */}
        <section className="form-section">
          <h2 className="section-title">Skills</h2>
          <div className="form-group">
            <label htmlFor="skills">Skills (comma-separated)</label>
            <p className="field-help">Technical skills and tools you are proficient in</p>
            <textarea
              id="skills"
              name="skills"
              value={Array.isArray(formData.skills) ? formData.skills.join(', ') : typeof formData.skills === 'string' ? formData.skills : ''}
              onChange={handleInputChange}
              placeholder="e.g., Node.js, PostgreSQL, React, AWS, Docker, TypeScript"
              disabled={loading}
              rows={4}
            />
          </div>
        </section>

        {/* Section 6: Certifications */}
        <CertificationsSection
          key={`cert-${importVersion}`}
          certifications={formData.certifications || []}
          onChange={(certifications) =>
            setFormData((prev) => ({ ...prev, certifications }))
          }
          disabled={loading}
          onDelete={saveToUndoStack}
        />

        {/* Form Actions */}
        <div className="form-actions">
          <Button
            type="button"
            variant="danger"
            onClick={() => setShowDeleteConfirm(true)}
            disabled={loading || showDeleteConfirm}
          >
            Delete Profile
          </Button>
          <div className="action-group">
            <Button
              type="button"
              variant="secondary"
              onClick={() => router.push('/profile-selector')}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={loading} disabled={loading}>
              Save Changes
            </Button>
          </div>
        </div>
      </form>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="delete-modal-overlay" onClick={() => !loading && setShowDeleteConfirm(false)}>
          <div className="delete-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-icon">⚠️</div>
            <h2>Delete Profile?</h2>
            <p>
              This will permanently delete the profile "<strong>{profile.name}</strong>". This action cannot be
              undone.
            </p>
            <div className="modal-actions">
              <Button
                variant="secondary"
                onClick={() => setShowDeleteConfirm(false)}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={handleDelete}
                disabled={loading}
                loading={loading}
              >
                Delete Forever
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
