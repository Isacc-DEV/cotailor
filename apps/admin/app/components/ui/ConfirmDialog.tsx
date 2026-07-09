'use client';

import React from 'react';
import './ConfirmDialog.css';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message?: string;
  itemName?: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  isDangerous?: boolean;
}

export default function ConfirmDialog({
  isOpen,
  title,
  message,
  itemName,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  onConfirm,
  onCancel,
  isDangerous = true,
}: ConfirmDialogProps) {
  if (!isOpen) return null;

  return (
    <div className="confirm-dialog-overlay" onClick={onCancel}>
      <div className="confirm-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="confirm-dialog-header">
          <h2 className="confirm-dialog-title">{title}</h2>
        </div>

        <div className="confirm-dialog-content">
          {message && <p className="confirm-dialog-message">{message}</p>}
          {itemName && <p className="confirm-dialog-item">{itemName}</p>}
        </div>

        <div className="confirm-dialog-actions">
          <button
            className="confirm-dialog-btn confirm-dialog-btn-cancel"
            onClick={onCancel}
            autoFocus
          >
            {cancelText}
          </button>
          <button
            className={`confirm-dialog-btn confirm-dialog-btn-confirm ${
              isDangerous ? 'dangerous' : ''
            }`}
            onClick={() => {
              onConfirm();
              onCancel();
            }}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
