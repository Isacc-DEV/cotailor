import React from 'react';
import './Badge.css';

interface BadgeProps {
  variant?: 'info' | 'warning' | 'success' | 'error' | 'default';
  children: React.ReactNode;
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({ variant = 'default', children, className = '' }) => {
  return <span className={`badge badge-${variant} ${className}`}>{children}</span>;
};
