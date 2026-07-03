'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/app/components/ui';
import './page.css';

export default function CategoryRejected() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const profileCategory = searchParams.get('profileCategory') || 'Unknown';
  const jdCategory = searchParams.get('jdCategory') || 'Unknown';
  const confidence = searchParams.get('confidence') || '0.95';

  const confidencePercent = Math.round(parseFloat(confidence) * 100);

  return (
    <div className="category-rejected">
      <div className="rejected-container">
        <div className="rejected-icon">❌</div>

        <h1>This Role Doesn't Match Your Profile</h1>

        <div className="mismatch-info">
          <div className="mismatch-card">
            <div className="mismatch-label">Your Profile Category</div>
            <div className="mismatch-value">{profileCategory}</div>
          </div>

          <div className="mismatch-arrow">→</div>

          <div className="mismatch-card rejected-badge">
            <div className="mismatch-label">Job Description Category</div>
            <div className="mismatch-value">{jdCategory}</div>
          </div>
        </div>

        <div className="confidence-info">
          <p>
            We detected the job category with <strong>{confidencePercent}% confidence</strong>. These categories don't align well, so we recommend against tailoring your resume for this role.
          </p>
        </div>

        <div className="explanation">
          <h2>Why This Matters</h2>
          <p>
            Applying to roles outside your primary category often leads to:
          </p>
          <ul>
            <li><strong>Long interview feedback loops</strong> — recruiters see a category mismatch immediately</li>
            <li><strong>ATS filtering</strong> — screening algorithms may rank you lower due to the mismatch</li>
            <li><strong>Less compelling resumes</strong> — tailoring experience from a different domain reads as inauthentic</li>
            <li><strong>Lower offer rates</strong> — hiring managers prefer candidates from the same category</li>
          </ul>
        </div>

        <div className="next-steps">
          <h2>What Should You Do?</h2>
          <div className="option-group">
            <div className="option">
              <div className="option-icon">📋</div>
              <h3>Select Another Profile</h3>
              <p>Do you have a profile for {jdCategory}? Select it and try again.</p>
              <Button variant="primary" size="lg" onClick={() => router.push('/profile-selector')}>
                Back to Profile Selector
              </Button>
            </div>

            <div className="option">
              <div className="option-icon">📄</div>
              <h3>Use Another Job Description</h3>
              <p>Look for a {profileCategory} role instead. Your resume will be much more competitive.</p>
              <Button
                variant="secondary"
                size="lg"
                onClick={() => {
                  // Go back to JD input if we have a session ID
                  const sessionId = new URLSearchParams(window.location.search).get('sessionId');
                  if (sessionId) {
                    router.push(`/jd-input?sessionId=${sessionId}`);
                  } else {
                    router.push('/profile-selector');
                  }
                }}
              >
                Try Another JD
              </Button>
            </div>
          </div>
        </div>

        <div className="pro-tip">
          <strong>💡 Pro Tip:</strong> If you're genuinely interested in transitioning to {jdCategory}, create a new profile
          that represents your transition story. List relevant cross-functional skills and highlight any adjacent experience.
        </div>
      </div>
    </div>
  );
}
