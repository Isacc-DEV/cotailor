'use client';

import { Spinner } from '@/app/components/ui';
import '../../../styles/loading-screen.css';

interface LoadingScreenProps {
  phase: 'analyzing' | 'generating' | 'validating' | 'processing';
  title?: string;
  message?: string;
  estimatedTime?: number;
}

export function LoadingScreen({ phase, title, message, estimatedTime }: LoadingScreenProps) {
  const defaults = {
    analyzing: {
      title: 'Analyzing Your Job Description',
      message: 'We\'re extracting key requirements and matching them against your profile...',
      time: '30-45 seconds',
    },
    generating: {
      title: 'Generating Your Tailored Resume',
      message: 'We\'re crafting a resume that highlights your best match for this role...',
      time: '45-60 seconds',
    },
    validating: {
      title: 'Validating Your Resume',
      message: 'We\'re checking quality, formatting, and ATS compatibility...',
      time: '15-20 seconds',
    },
    processing: {
      title: 'Processing Your Request',
      message: 'Please wait while we process your request...',
      time: '20-30 seconds',
    },
  };

  const config = defaults[phase];
  const displayTitle = title || config.title;
  const displayMessage = message || config.message;

  return (
    <div className="loading-screen">
      <div className="loading-container">
        <div className="loading-content">
          <Spinner size="lg" />

          <h1 className="loading-title">{displayTitle}</h1>
          <p className="loading-message">{displayMessage}</p>

          <div className="loading-progress">
            <div className="progress-bar">
              <div className="progress-bar-animated" />
            </div>
            <div className="progress-text">
              <span className="phase-label">Phase: {phase}</span>
              <span className="time-estimate">~{estimatedTime ? estimatedTime + 's' : config.time}</span>
            </div>
          </div>

          <div className="loading-tips">
            <h3>What's Happening</h3>
            {phase === 'analyzing' && (
              <ul>
                <li>Extracting job requirements and skills</li>
                <li>Analyzing role category and subtype</li>
                <li>Matching against your profile</li>
              </ul>
            )}
            {phase === 'generating' && (
              <ul>
                <li>Selecting relevant experience</li>
                <li>Tailoring bullet points for the role</li>
                <li>Optimizing for ATS scanning</li>
              </ul>
            )}
            {phase === 'validating' && (
              <ul>
                <li>Checking formatting consistency</li>
                <li>Validating ATS compatibility</li>
                <li>Ensuring all tailoring is authentic</li>
              </ul>
            )}
            {phase === 'processing' && (
              <ul>
                <li>Processing your request</li>
                <li>Preparing results</li>
                <li>Finalizing output</li>
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
