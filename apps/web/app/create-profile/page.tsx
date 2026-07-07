'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useProfiles } from '@/app/hooks/useProfiles';
import { Button } from '@/app/components/ui';
import { api } from '@/lib/api-client';
import { importProfile, pasteProfileFromClipboard } from '@/app/lib/profile-export';
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

export default function CreateProfile() {
  const router = useRouter();
  const { createProfile, error } = useProfiles();
  const styleOptions = useResumeStyleOptions();

  const [formData, setFormData] = useState({
    name: '',
    category: '',
    subtype: '',
    resumeStyle: 'standard',
    header: {
      name: '',
      title: '',
      address: '',
      email: '',
      phone: '',
      linkedin: '',
      url: '',
    },
    workExperience: [] as any[],
    education: [] as any[],
    skills: [] as string[],
    topSkills: [] as any[],
    certifications: [] as any[],
  });

  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string[] | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // Bumped on import to remount the section components — an entry mid-edit
  // would otherwise keep its stale editing form open over the imported data.
  const [importVersion, setImportVersion] = useState(0);

  // Same mapping as profile-editor: accept both flat exports and DB-shaped
  // JSON (fields under baseResume), and normalize skills from any shape.
  const applyImported = (prof: any) => {
    setFormData({
      name: prof.name || '',
      category: prof.category || '',
      subtype: prof.subtype || (Array.isArray(prof.subtypes) ? prof.subtypes[0] : '') || '',
      resumeStyle: prof.resumeStyle || prof.baseResume?.resumeStyle || 'standard',
      header: { ...formData.header, ...(prof.header || prof.baseResume?.header || {}) },
      workExperience: prof.workExperience || prof.baseResume?.workExperience || [],
      education: prof.education || prof.baseResume?.education || [],
      skills: normalizeSkills(prof.skills ?? prof.baseResume?.skills),
      topSkills: Array.isArray(prof.topSkills)
        ? prof.topSkills
        : Array.isArray(prof.baseResume?.topSkills)
          ? prof.baseResume.topSkills
          : [],
      certifications: prof.certifications || prof.baseResume?.certifications || [],
    });
    setValidationErrors({});
    setImportError(null);
    setImportVersion((v) => v + 1);
    setNotice('Profile imported — review the details below, then create.');
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setNotice(null);
    try {
      const lower = file.name.toLowerCase();
      if (lower.endsWith('.doc')) {
        setImportError(['Legacy .doc files are not supported — save the file as .docx or PDF and try again.']);
      } else if (lower.endsWith('.docx') || lower.endsWith('.pdf')) {
        // Word/PDF resume: the API extracts the text, parses it into a profile
        // draft, and returns it — the form below is the review step.
        const result = await api.profiles.importResume(file);
        applyImported(result.draft);
        const warn = result.meta.warnings.length ? ` Note: ${result.meta.warnings.join(' ')}` : '';
        setNotice(`Imported from ${result.meta.filename} — review the details below, then create.${warn}`);
      } else {
        const result = await importProfile(file);
        if (result.success && result.data) {
          applyImported(result.data.profile);
        } else {
          setImportError(result.errors || []);
        }
      }
    } catch (err) {
      setImportError([err instanceof Error ? err.message : 'Unknown error']);
    } finally {
      setImporting(false);
      e.target.value = '';
    }
  };

  const handlePasteFromClipboard = async () => {
    setImporting(true);
    setNotice(null);
    try {
      const result = await pasteProfileFromClipboard();
      if (result.success && result.data) {
        applyImported(result.data.profile);
      } else {
        setImportError(result.errors || []);
      }
    } catch (err) {
      setImportError([err instanceof Error ? err.message : 'Failed to read clipboard']);
    } finally {
      setImporting(false);
    }
  };

  const validateForm = () => {
    const errors: Record<string, string> = {};

    if (!formData.name.trim()) errors.name = 'Profile name is required';
    if (!formData.category) errors.category = 'Job category is required';
    if (!formData.header.name.trim()) errors.headerName = 'Your name is required';

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    setSubmitting(true);
    try {
      await createProfile(formData as any);
      router.push('/profile-selector');
    } catch (err) {
      console.error('Error creating profile:', err);
      setSubmitting(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>, path?: string) => {
    const { name, value } = e.target;

    if (path) {
      const [section, field] = path.split('.');
      setFormData((prev) => ({
        ...prev,
        [section]: {
          ...(prev[section as keyof typeof formData] as any),
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

  const subtypeOptions = SUBTYPES[formData.category as string] || [];

  return (
    <div className="create-profile">
      <div className="form-header">
        <h1>Create New Profile</h1>
        <p>Build your professional profile with all the details we need for resume tailoring</p>
      </div>

      <div className="header-actions">
        <label
          className={`export-import-btn import-btn ${importing ? 'is-disabled' : ''}`}
          title="Import a profile JSON export or a Word/PDF resume"
          aria-disabled={importing}
        >
          <span className="action-icon import-icon" aria-hidden="true" />
          <span className="action-copy">
            <span>{importing ? 'Importing...' : 'Import file'}</span>
            <small>JSON, Word, or PDF</small>
          </span>
          <input
            type="file"
            accept=".json,.docx,.pdf"
            onChange={handleImportFile}
            disabled={importing}
            style={{ display: 'none' }}
          />
        </label>
        <button
          type="button"
          className="export-import-btn paste-btn"
          onClick={handlePasteFromClipboard}
          disabled={importing}
          title="Paste profile JSON from clipboard"
        >
          <span className="action-icon paste-icon" aria-hidden="true" />
          <span className="action-copy">
            <span>{importing ? 'Pasting...' : 'Paste JSON'}</span>
            <small>From clipboard</small>
          </span>
        </button>
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
            <Button variant="primary" onClick={() => setImportError(null)}>
              Close
            </Button>
          </div>
        </div>
      )}

      {notice && <div className="notice-message">{notice}</div>}
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
              value={formData.name}
              onChange={handleInputChange}
              placeholder="e.g., Senior Backend Engineer"
              className={validationErrors.name ? 'error' : ''}
              disabled={submitting}
            />
            {validationErrors.name && <span className="error-text">{validationErrors.name}</span>}
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="category">Job Category *</label>
              <select
                id="category"
                name="category"
                value={formData.category}
                onChange={handleInputChange}
                className={validationErrors.category ? 'error' : ''}
                disabled={submitting}
              >
                <option value="">— Select category —</option>
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
                  value={formData.subtype}
                  onChange={handleInputChange}
                  disabled={submitting}
                >
                  <option value="">— Select subtype —</option>
                  {subtypeOptions.map((sub) => (
                    <option key={sub} value={sub}>
                      {sub}
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
                value={formData.resumeStyle}
                onChange={handleInputChange}
                disabled={submitting}
              >
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
                value={formData.header.name}
                onChange={(e) => handleInputChange(e, 'header.name')}
                className={validationErrors.headerName ? 'error' : ''}
                disabled={submitting}
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
                value={formData.header.title}
                onChange={(e) => handleInputChange(e, 'header.title')}
                disabled={submitting}
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
                value={formData.header.address}
                onChange={(e) => handleInputChange(e, 'header.address')}
                disabled={submitting}
              />
            </div>

            <div className="form-group">
              <label htmlFor="headerEmail">Email</label>
              <input
                type="email"
                id="headerEmail"
                name="headerEmail"
                placeholder="you@example.com"
                value={formData.header.email}
                onChange={(e) => handleInputChange(e, 'header.email')}
                disabled={submitting}
              />
            </div>

            <div className="form-group">
              <label htmlFor="headerPhone">Phone</label>
              <input
                type="tel"
                id="headerPhone"
                name="headerPhone"
                placeholder="(555) 123-4567"
                value={formData.header.phone}
                onChange={(e) => handleInputChange(e, 'header.phone')}
                disabled={submitting}
              />
            </div>

            <div className="form-group">
              <label htmlFor="headerLinkedin">LinkedIn</label>
              <input
                type="url"
                id="headerLinkedin"
                name="headerLinkedin"
                placeholder="https://linkedin.com/in/yourprofile"
                value={formData.header.linkedin}
                onChange={(e) => handleInputChange(e, 'header.linkedin')}
                disabled={submitting}
              />
            </div>

            <div className="form-group">
              <label htmlFor="headerUrl">Website/Portfolio</label>
              <input
                type="url"
                id="headerUrl"
                name="headerUrl"
                placeholder="https://yourwebsite.com"
                value={formData.header.url}
                onChange={(e) => handleInputChange(e, 'header.url')}
                disabled={submitting}
              />
            </div>
          </div>
        </section>

        {/* Section 3: Work Experience */}
        <WorkExperienceSection
          key={`work-${importVersion}`}
          experiences={formData.workExperience}
          onChange={(workExperience) => setFormData((prev) => ({ ...prev, workExperience }))}
          disabled={submitting}
        />

        {/* Section 4: Education */}
        <EducationSection
          key={`edu-${importVersion}`}
          education={formData.education}
          onChange={(education) => setFormData((prev) => ({ ...prev, education }))}
          disabled={submitting}
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
              value={formData.skills.join(', ')}
              onChange={handleInputChange}
              placeholder="e.g., Node.js, PostgreSQL, React, AWS, Docker, TypeScript"
              disabled={submitting}
              rows={4}
            />
          </div>
        </section>

        {/* Section 6: Certifications */}
        <CertificationsSection
          key={`cert-${importVersion}`}
          certifications={formData.certifications}
          onChange={(certifications) => setFormData((prev) => ({ ...prev, certifications }))}
          disabled={submitting}
        />

        {/* Form Actions */}
        <div className="form-actions">
          <Button
            type="button"
            variant="secondary"
            size="md"
            className="cancel-profile-btn"
            onClick={() => router.push('/profile-selector')}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="lg"
            className="create-profile-btn"
            loading={submitting}
            disabled={submitting}
          >
            Create Profile
          </Button>
        </div>
      </form>
    </div>
  );
}
