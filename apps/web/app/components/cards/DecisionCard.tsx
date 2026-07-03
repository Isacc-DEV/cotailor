'use client';

import React, { useState } from 'react';
import { Badge } from '@/app/components/ui';
import './DecisionCard.css';

export interface DecisionCardData {
  id: string;
  type: string;
  severity: 'info' | 'warning' | 'blocking' | 'critical';
  status: 'pending' | 'answered' | 'auto_resolved';
  question: string;
  options: Array<{
    value: string;
    label: string;
    description?: string;
  }>;
  data?: Record<string, any>;
}

interface DecisionCardProps {
  card: DecisionCardData;
  onAnswer: (cardId: string, response: string) => void;
  answered?: boolean;
  selectedValue?: string;
  disabled?: boolean;
}

const severityColors: Record<string, 'info' | 'warning' | 'success' | 'error' | 'default'> = {
  info: 'info',
  warning: 'warning',
  blocking: 'error',
  critical: 'error',
};

export const DecisionCard: React.FC<DecisionCardProps> = ({
  card,
  onAnswer,
  answered = false,
  selectedValue,
  disabled = false,
}) => {
  const [selected, setSelected] = useState<string | null>(selectedValue || null);

  const handleChange = (value: string) => {
    setSelected(value);
    onAnswer(card.id, value);
  };

  return (
    <div className={`decision-card decision-card-${card.severity}`}>
      <div className="card-header">
        <div className="card-title-group">
          <h3 className="card-title">{card.question}</h3>
          <Badge variant={severityColors[card.severity]}>{card.severity}</Badge>
        </div>
        {answered && <div className="answered-checkmark">✓</div>}
      </div>

      <div className="card-options">
        {card.options.map((option) => (
          <label key={option.value} className="option-label">
            <input
              type="radio"
              name={`card-${card.id}`}
              value={option.value}
              checked={selected === option.value}
              onChange={() => handleChange(option.value)}
              disabled={disabled}
              className="option-input"
            />
            <div className="option-content">
              <span className="option-name">{option.label}</span>
              {option.description && <span className="option-description">{option.description}</span>}
            </div>
          </label>
        ))}
      </div>
    </div>
  );
};
