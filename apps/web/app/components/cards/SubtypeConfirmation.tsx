'use client';

import { useState } from 'react';
import { Button } from '@/app/components/ui';
import '../../../styles/subtype-confirmation.css';

interface SubtypeConfirmationProps {
  profileSubtype: string;
  detectedSubtype: string;
  confidence: number;
  onConfirm: (acceptDetected: boolean) => void;
  disabled?: boolean;
}

export function SubtypeConfirmation({
  profileSubtype,
  detectedSubtype,
  confidence,
  onConfirm,
  disabled = false,
}: SubtypeConfirmationProps) {
  const [selected, setSelected] = useState<'profile' | 'detected' | null>(null);

  const confidencePercent = Math.round(confidence * 100);

  return (
    <div className="subtype-confirmation-modal">
      <div className="modal-overlay" onClick={() => !disabled && onConfirm(selected === 'detected')} />

      <div className="modal-content">
        <div className="modal-header">
          <div className="modal-icon">⚠️</div>
          <h2>Role Subtype Mismatch</h2>
          <p>
            The JD seems to be for a <strong>{detectedSubtype}</strong> role, but your profile is{' '}
            <strong>{profileSubtype}</strong>
          </p>
        </div>

        <div className="confidence-meter">
          <div className="meter-bar">
            <div className="meter-fill" style={{ width: `${confidencePercent}%` }} />
          </div>
          <span className="meter-text">{confidencePercent}% confident</span>
        </div>

        <div className="subtype-options">
          <div
            className={`subtype-option ${selected === 'profile' ? 'selected' : ''}`}
            onClick={() => !disabled && setSelected('profile')}
          >
            <div className="option-radio">
              <input type="radio" name="subtype" value="profile" checked={selected === 'profile'} disabled={disabled} />
            </div>
            <div className="option-content">
              <h3>Keep {profileSubtype}</h3>
              <p>Tailor your resume using your original profile's subtype</p>
            </div>
          </div>

          <div
            className={`subtype-option ${selected === 'detected' ? 'selected' : ''}`}
            onClick={() => !disabled && setSelected('detected')}
          >
            <div className="option-radio">
              <input type="radio" name="subtype" value="detected" checked={selected === 'detected'} disabled={disabled} />
            </div>
            <div className="option-content">
              <h3>Use {detectedSubtype}</h3>
              <p>Tailor for the {detectedSubtype} role instead</p>
            </div>
          </div>
        </div>

        <div className="info-box">
          <strong>💡 Tip:</strong> Switching subtypes will adjust your tailoring strategy. The resume will emphasize
          different skills and experience based on the new subtype.
        </div>

        <div className="modal-actions">
          <Button
            variant="secondary"
            onClick={() => onConfirm(selected === 'detected')}
            disabled={selected === null || disabled}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={() => onConfirm(selected === 'detected')}
            disabled={selected === null || disabled}
          >
            Continue with {selected === 'detected' ? detectedSubtype : profileSubtype}
          </Button>
        </div>
      </div>
    </div>
  );
}
