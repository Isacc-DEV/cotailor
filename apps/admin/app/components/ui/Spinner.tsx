import React from 'react';
import './Spinner.css';

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  text?: string;
}

export const Spinner: React.FC<SpinnerProps> = ({ size = 'md', text }) => {
  return (
    <div className={`spinner-container spinner-${size}`}>
      <div className="spinner" />
      {text && <p className="spinner-text">{text}</p>}
    </div>
  );
};
