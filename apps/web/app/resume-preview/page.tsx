'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useResume } from '@/app/hooks/useResume';
import { Button, Spinner, Badge } from '@/app/components/ui';
import './page.css';

export default function ResumePreview() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('sessionId');
  const [exporting, setExporting] = useState<'docx' | 'pdf' | 'json' | null>(null);

  const { resume, validation, matchReport, loading, error, exportResume } = useResume(sessionId);

  useEffect(() => {
    if (!sessionId) {
      router.push('/profile-selector');
    }
  }, [sessionId, router]);

  const handleExport = async (format: 'docx' | 'pdf' | 'json') => {
    setExporting(format);
    try {
      await exportResume(format);
      // In a real app, this would trigger a download
      // For now, just show a success message
      alert(`Resume exported as ${format.toUpperCase()}`);
    } catch (err) {
      console.error('Export error:', err);
    } finally {
      setExporting(null);
    }
  };

  return (
    <div className="resume-preview">
      <div className="preview-header">
        <h1>Your Tailored Resume</h1>
        <p>Review, download, or make changes</p>
      </div>

      {error && <div className="error-message">{error}</div>}

      {loading ? (
        <Spinner text="Generating your resume..." />
      ) : resume && validation && matchReport ? (
        <div className="preview-container">
          {/* Left Column: Resume */}
          <div className="resume-column">
            <div className="resume-document">
              {/* Profile/Header */}
              {resume.contentJson.profile && (
                <div className="resume-header">
                  <h2 className="resume-name">{resume.contentJson.profile.name}</h2>
                  <p className="resume-title">{resume.contentJson.profile.title}</p>
                  {resume.contentJson.profile.summary && (
                    <p className="resume-summary">{resume.contentJson.profile.summary}</p>
                  )}
                </div>
              )}

              {/* Experience */}
              {resume.contentJson.experience && resume.contentJson.experience.length > 0 && (
                <section className="resume-section">
                  <h3 className="section-title">Experience</h3>
                  {resume.contentJson.experience.map((job, idx) => (
                    <div key={idx} className="resume-job">
                      <div className="job-header">
                        <h4 className="job-title">{job.title}</h4>
                        <span className="job-duration">{job.duration}</span>
                      </div>
                      <p className="job-company">{job.company}</p>
                      {job.bullets && (
                        <ul className="job-bullets">
                          {job.bullets.map((bullet, bidx) => (
                            <li key={bidx} className={`bullet-${bullet.provenance}`}>
                              {bullet.text}
                              <span className="provenance-badge">{bullet.provenance.replace(/_/g, ' ')}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
                </section>
              )}

              {/* Skills */}
              {resume.contentJson.skills && (
                <section className="resume-section">
                  <h3 className="section-title">Skills</h3>
                  <div className="skills-grid">
                    {Object.entries(resume.contentJson.skills).map(([category, skills]) => (
                      skills && skills.length > 0 && (
                        <div key={category} className="skill-category">
                          <h4 className="category-name">{category}</h4>
                          <p className="category-items">{skills.join(' • ')}</p>
                        </div>
                      )
                    ))}
                  </div>
                </section>
              )}

              {/* Education */}
              {resume.contentJson.education && resume.contentJson.education.length > 0 && (
                <section className="resume-section">
                  <h3 className="section-title">Education</h3>
                  {resume.contentJson.education.map((edu, idx) => (
                    <div key={idx} className="resume-edu">
                      <h4 className="edu-degree">{edu.title}</h4>
                      <p className="edu-school">{edu.company}</p>
                    </div>
                  ))}
                </section>
              )}
            </div>

            {/* Export Buttons */}
            <div className="export-buttons">
              <Button
                variant="secondary"
                size="md"
                onClick={() => handleExport('docx')}
                loading={exporting === 'docx'}
                disabled={!!exporting}
              >
                Download DOCX
              </Button>
              <Button
                variant="secondary"
                size="md"
                onClick={() => handleExport('pdf')}
                loading={exporting === 'pdf'}
                disabled={!!exporting}
              >
                Download PDF
              </Button>
              <Button
                variant="secondary"
                size="md"
                onClick={() => handleExport('json')}
                loading={exporting === 'json'}
                disabled={!!exporting}
              >
                Download JSON
              </Button>
            </div>
          </div>

          {/* Right Column: Match Report */}
          <div className="report-column">
            <div className="match-report">
              {/* Overall Score */}
              <div className="report-section">
                <h3>Match Score</h3>
                <div className="score-gauge">
                  <div className="score-circle">
                    <div className="score-value">{matchReport.overallScore}</div>
                    <div className="score-max">/100</div>
                  </div>
                  <div className="score-bar">
                    <div
                      className={`score-bar-fill score-${
                        matchReport.overallScore >= 80
                          ? 'good'
                          : matchReport.overallScore >= 60
                          ? 'fair'
                          : 'poor'
                      }`}
                      style={{ width: `${matchReport.overallScore}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Validation Scores */}
              <div className="report-section">
                <h3>Validation Results</h3>
                <div className="score-item">
                  <span className="score-label">Content Check</span>
                  <Badge variant={validation.contentCheckPassed ? 'success' : 'error'}>
                    {validation.contentCheckPassed ? 'Passed' : 'Failed'}
                  </Badge>
                </div>
                <div className="score-item">
                  <span className="score-label">ATS Score</span>
                  <span className="score-number">{validation.atsScore}/100</span>
                </div>
                <div className="score-item">
                  <span className="score-label">Recruiter Readability</span>
                  <span className="score-number">{validation.recruiterReadabilityScore}/100</span>
                </div>
              </div>

              {/* Skills Coverage */}
              <div className="report-section">
                <h3>Skills Coverage</h3>
                <div className="coverage-item">
                  <span className="coverage-label">Required Skills</span>
                  <span className="coverage-value">
                    {matchReport.requiredSkillsCovered.covered}/{matchReport.requiredSkillsCovered.total}
                  </span>
                </div>
                <div className="coverage-bar">
                  <div
                    className="coverage-fill"
                    style={{
                      width: `${
                        (matchReport.requiredSkillsCovered.covered /
                          matchReport.requiredSkillsCovered.total) *
                        100
                      }%`,
                    }}
                  />
                </div>

                <div className="coverage-item" style={{ marginTop: '1rem' }}>
                  <span className="coverage-label">Preferred Skills</span>
                  <span className="coverage-value">
                    {matchReport.preferredSkillsCovered.covered}/{matchReport.preferredSkillsCovered.total}
                  </span>
                </div>
                <div className="coverage-bar">
                  <div
                    className="coverage-fill"
                    style={{
                      width: `${
                        (matchReport.preferredSkillsCovered.covered /
                          matchReport.preferredSkillsCovered.total) *
                        100
                      }%`,
                    }}
                  />
                </div>
              </div>

              {/* Warnings */}
              {validation.warnings && validation.warnings.length > 0 && (
                <div className="report-section warnings">
                  <h3>Warnings</h3>
                  <ul className="warnings-list">
                    {validation.warnings.map((warning, idx) => (
                      <li key={idx}>{warning}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Changes Made */}
              {matchReport.changes && matchReport.changes.length > 0 && (
                <div className="report-section">
                  <h3>Changes Made</h3>
                  <ul className="changes-list">
                    {matchReport.changes.map((change, idx) => (
                      <li key={idx}>{change}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="preview-actions">
              <Button
                variant="secondary"
                size="lg"
                onClick={() => router.push('/profile-selector')}
                style={{ width: '100%' }}
              >
                Start New Tailoring
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="empty-state">
          <p>Resume not available. Please complete the approval process.</p>
          <Button variant="primary" onClick={() => router.push('/profile-selector')}>
            Start Over
          </Button>
        </div>
      )}
    </div>
  );
}
