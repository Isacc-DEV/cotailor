'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useProfiles } from '@/app/hooks/useProfiles';
import { Button, Spinner } from '@/app/components/ui';
import './page.css';

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

export default function CreateProfile() {
  const router = useRouter();
  const { createProfile, loading, error } = useProfiles();

  const [formData, setFormData] = useState({
    name: '',
    category: '',
    subtype: '',
    resumeStyle: 'standard',
    header: {
      name: '',
      title: '',
      address: '',
      phone: '',
      linkedin: '',
      url: '',
    },
    workExperience: [] as any[],
    education: [] as any[],
    skills: [] as string[],
    certifications: [] as any[],
  });

  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

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

    try {
      await createProfile(formData as any);
      router.push('/profile-selector');
    } catch (err) {
      console.error('Error creating profile:', err);
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

  if (loading) {
    return <Spinner text="Creating profile..." />;
  }

  return (
    <div className="create-profile">
      <div className="form-header">
        <h1>Create New Profile</h1>
        <p>Build your professional profile with all the details we need for resume tailoring</p>
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
              value={formData.name}
              onChange={handleInputChange}
              placeholder="e.g., Senior Backend Engineer"
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
                value={formData.category}
                onChange={handleInputChange}
                className={validationErrors.category ? 'error' : ''}
                disabled={loading}
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
                  disabled={loading}
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
                disabled={loading}
              >
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
                value={formData.header.name}
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
                value={formData.header.title}
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
                value={formData.header.address}
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
                value={formData.header.phone}
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
                value={formData.header.linkedin}
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
                value={formData.header.url}
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
              value={JSON.stringify(formData.workExperience, null, 2)}
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
              value={JSON.stringify(formData.education, null, 2)}
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
              value={formData.skills.join(', ')}
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
              value={JSON.stringify(formData.certifications, null, 2)}
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
            variant="secondary"
            size="lg"
            onClick={() => router.push('/profile-selector')}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button type="submit" variant="primary" size="lg" loading={loading} disabled={loading}>
            Create Profile
          </Button>
        </div>
      </form>
    </div>
  );
}
