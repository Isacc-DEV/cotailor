'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/app/components/ui';
import './page.css';

export default function CategoryConfirmation() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const profileCategory = searchParams.get('profileCategory') || 'Unknown';
  const detectedCategory = searchParams.get('detectedCategory') || 'Unknown';
  const confidence = searchParams.get('confidence') || '0.65';
  const sessionId = searchParams.get('sessionId') || '';

  const confidencePercent = Math.round(parseFloat(confidence) * 100);

  const handleContinue = () => {
    // Continue with the current session (profile category takes precedence)
    if (sessionId) {
      router.push(`/decision-board?sessionId=${sessionId}`);
    } else {
      router.push('/profile-selector');
    }
  };

  const handleSwitch = () => {
    // This would require creating a new session with the detected category
    // For now, redirect to profile selector to manually choose or create
    if (sessionId) {
      router.push(`/jd-input?sessionId=${sessionId}`);
    } else {
      router.push('/profile-selector');
    }
  };

  return (
    <div className="category-confirmation">
      <div className="confirmation-container">
        <div className="confirmation-icon">🤔</div>

        <h1>We Detected a Different Category</h1>

        <p className="confirmation-intro">
          The job description appears to be for a <strong>{detectedCategory}</strong> role, but you selected a{' '}
          <strong>{profileCategory}</strong> profile. We're {confidencePercent}% confident in this detection.
        </p>

        <div className="category-comparison">
          <div className="category-card your-profile">
            <div className="category-label">Your Profile</div>
            <div className="category-name">{profileCategory}</div>
          </div>

          <div className="category-divider">
            <div className="divider-line" />
            <div className="divider-text">vs</div>
            <div className="divider-line" />
          </div>

          <div className="category-card detected-category">
            <div className="category-label">Detected from JD</div>
            <div className="category-name">{detectedCategory}</div>
            <div className="confidence-badge">{confidencePercent}% confidence</div>
          </div>
        </div>

        <div className="recommendation-box">
          <h2>What Should You Do?</h2>
          <p>
            If you're actually applying for a <strong>{detectedCategory}</strong> role, it's better to use a profile
            in that category. This will produce a more authentic and compelling resume.
          </p>
        </div>

        <div className="action-buttons">
          <Button
            variant="primary"
            size="lg"
            onClick={handleSwitch}
          >
            Try With {detectedCategory} Profile
          </Button>
          <Button
            variant="secondary"
            size="lg"
            onClick={handleContinue}
          >
            Continue With {profileCategory}
          </Button>
        </div>

        <div className="info-note">
          <strong>Note:</strong> You'll need a profile in the {detectedCategory} category to switch. If you don't have
          one yet, you can create it after going back to the profile selector.
        </div>
      </div>
    </div>
  );
}
