'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useEffect } from 'react';
import { useProfiles } from '@/app/hooks/useProfiles';
import { Button, Spinner } from '@/app/components/ui';
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
    phone?: string;
    linkedin?: string;
    url?: string;
  };
  workExperience?: Array<{
    company: string;
    title?: string;
    startDate?: string;
    endDate?: string;
    description?: string;
  }>;
  education?: Array<{
    university: string;
    degree?: string;
    field?: string;
    graduationYear?: string;
  }>;
  skills?: string[];
  certifications?: Array<{
    name: string;
    issuer?: string;
    year?: string;
  }>;
}

const CATEGORIES = [
  'Software Engineering',
  'Data Science',
  'Product Management',
  'Design',
  'Sales',
  'Marketing',
  'Operations',
  'Finance',
  'Human Resources',
];

const RESUME_STYLES = ['standard', 'modern', 'minimal', 'creative'];

const SUBTYPES: Record<string, string[]> = {
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

export default function ProfileEditor() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const profileId = searchParams.get('profileId');

  const { profiles, loading: loadingProfiles, updateProfile, deleteProfile } = useProfiles();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [formData, setFormData] = useState<Partial<Profile>>({});
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    if (profileId && profiles.length > 0) {
      const found = profiles.find((p) => p.id === profileId);
      if (found) {
        setProfile(found as Profile);
        setFormData(found as Profile);
      }
    }
  }, [profileId, profiles]);

  if (loadingProfiles || !profile) {
    return <Spinner text="Loading profile..." />;
  }

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
      <div className="editor-header">
        <Button variant="secondary" onClick={() => router.push('/profile-selector')}>
          ← Back to Profiles
        </Button>
        <h1>Edit Profile</h1>
      </div>

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
                {RESUME_STYLES.map((style) => (
                  <option key={style} value={style}>
                    {style.charAt(0).toUpperCase() + style.slice(1)}
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
                type="url"
                id="headerLinkedin"
                name="headerLinkedin"
                placeholder="https://linkedin.com/in/yourprofile"
                value={formData.header?.linkedin || ''}
                onChange={(e) => handleInputChange(e, 'header.linkedin')}
                disabled={loading}
              />
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
        <section className="form-section">
          <h2 className="section-title">Work Experience</h2>
          <div className="form-group">
            <label htmlFor="workExperience">Companies</label>
            <p className="field-help">Enter work experience in JSON format</p>
            <textarea
              id="workExperience"
              name="workExperience"
              value={JSON.stringify(formData.workExperience || [], null, 2)}
              onChange={(e) => {
                try {
                  const parsed = JSON.parse(e.target.value);
                  setFormData((prev) => ({ ...prev, workExperience: parsed }));
                } catch {
                  // Invalid JSON, ignore
                }
              }}
              placeholder={JSON.stringify([{ company: 'Company Name', title: 'Job Title', startDate: '2020-01', endDate: '2023-12', description: 'Description' }], null, 2)}
              disabled={loading}
              rows={6}
            />
          </div>
        </section>

        {/* Section 4: Education */}
        <section className="form-section">
          <h2 className="section-title">Education</h2>
          <div className="form-group">
            <label htmlFor="education">Universities</label>
            <p className="field-help">Enter education in JSON format</p>
            <textarea
              id="education"
              name="education"
              value={JSON.stringify(formData.education || [], null, 2)}
              onChange={(e) => {
                try {
                  const parsed = JSON.parse(e.target.value);
                  setFormData((prev) => ({ ...prev, education: parsed }));
                } catch {
                  // Invalid JSON, ignore
                }
              }}
              placeholder={JSON.stringify([{ university: 'University Name', degree: 'BS', field: 'Computer Science', graduationYear: '2020' }], null, 2)}
              disabled={loading}
              rows={6}
            />
          </div>
        </section>

        {/* Section 5: Skills */}
        <section className="form-section">
          <h2 className="section-title">Skills</h2>
          <div className="form-group">
            <label htmlFor="skills">Skills (comma-separated)</label>
            <p className="field-help">Technical skills and tools you are proficient in</p>
            <textarea
              id="skills"
              name="skills"
              value={(formData.skills || []).join(', ')}
              onChange={handleInputChange}
              placeholder="e.g., Node.js, PostgreSQL, React, AWS, Docker, TypeScript"
              disabled={loading}
              rows={4}
            />
          </div>
        </section>

        {/* Section 6: Certifications */}
        <section className="form-section">
          <h2 className="section-title">Certifications</h2>
          <div className="form-group">
            <label htmlFor="certifications">Certifications</label>
            <p className="field-help">Enter certifications in JSON format</p>
            <textarea
              id="certifications"
              name="certifications"
              value={JSON.stringify(formData.certifications || [], null, 2)}
              onChange={(e) => {
                try {
                  const parsed = JSON.parse(e.target.value);
                  setFormData((prev) => ({ ...prev, certifications: parsed }));
                } catch {
                  // Invalid JSON, ignore
                }
              }}
              placeholder={JSON.stringify([{ name: 'Certification Name', issuer: 'Issuer', year: '2023' }], null, 2)}
              disabled={loading}
              rows={5}
            />
          </div>
        </section>

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
