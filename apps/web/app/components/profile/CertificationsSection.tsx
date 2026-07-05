'use client';

import React, { useState } from 'react';
import { Button, ConfirmDialog } from '@/app/components/ui';
import { useConfirmDialog } from '@/app/hooks/useConfirmDialog';
import { formatDate as formatDisplayDate } from '@/app/lib/date-format';
import './CertificationsSection.css';

interface CertificationItem {
  name: string;
  issuer?: string;
  issueDate?: string;
  expiryDate?: string;
  credentialId?: string;
  credentialUrl?: string;
}

interface Props {
  certifications: CertificationItem[];
  onChange: (certifications: CertificationItem[]) => void;
  disabled?: boolean;
  /** Called right before a committed entry is deleted so the parent can snapshot for global undo. */
  onDelete?: () => void;
}

export default function CertificationsSection({
  certifications,
  onChange,
  disabled = false,
  onDelete,
}: Props) {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingData, setEditingData] = useState<CertificationItem | null>(null);
  const [noExpiry, setNoExpiry] = useState(false);

  const { state: confirmState, open: openConfirm, close: closeConfirm } = useConfirmDialog();
  const [pendingConfirm, setPendingConfirm] = useState<(() => void) | null>(null);

  const handleConfirm = () => {
    if (pendingConfirm) pendingConfirm();
    setPendingConfirm(null);
  };

  const handleAdd = () => {
    setEditingId(certifications.length);
    setEditingData({
      name: '',
      issuer: '',
      issueDate: '',
      expiryDate: '',
      credentialId: '',
      credentialUrl: '',
    });
    setNoExpiry(false);
  };

  const handleEdit = (id: number) => {
    setEditingId(id);
    setEditingData({ ...certifications[id] });
    setNoExpiry(!certifications[id].expiryDate);
  };

  const handleSave = () => {
    if (!editingData) return;

    if (!editingData.name.trim()) {
      alert('Certification name is required');
      return;
    }

    const updated = [...certifications];
    const dataToSave = {
      ...editingData,
      expiryDate: noExpiry ? '' : editingData.expiryDate,
    };

    if (editingId !== null && editingId < certifications.length) {
      updated[editingId] = dataToSave;
    } else {
      updated.push(dataToSave);
    }

    onChange(updated);
    setEditingId(null);
    setEditingData(null);
    setNoExpiry(false);
  };

  const handleDelete = (id: number) => {
    const cert = certifications[id];
    openConfirm({
      title: 'Delete this certification?',
      itemName: cert.issuer ? `${cert.name} — ${cert.issuer}` : cert.name,
      isDangerous: true,
    });
    setPendingConfirm(() => () => {
      onDelete?.();
      onChange(certifications.filter((_, i) => i !== id));
    });
  };

  const handleCancel = () => {
    setEditingId(null);
    setEditingData(null);
    setNoExpiry(false);
  };

  const formatDate = (dateStr?: string) => formatDisplayDate(dateStr);

  const isExpired = (expiryDate?: string) => {
    if (!expiryDate) return false;
    return new Date(expiryDate) < new Date();
  };

  const confirmDialog = (
    <ConfirmDialog
      isOpen={confirmState.isOpen}
      title={confirmState.title}
      message={confirmState.message}
      itemName={confirmState.itemName}
      isDangerous={confirmState.isDangerous}
      confirmText="Delete"
      onConfirm={handleConfirm}
      onCancel={closeConfirm}
    />
  );

  if (editingId !== null && editingData) {
    return (
      <section className="form-section">
        <h2 className="section-title">Certifications</h2>

        <div className="certification-form">
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="certName">Certification Name *</label>
              <input
                type="text"
                id="certName"
                value={editingData.name}
                onChange={(e) =>
                  setEditingData({ ...editingData, name: e.target.value })
                }
                placeholder="e.g., AWS Solutions Architect Associate"
                disabled={disabled}
              />
            </div>

            <div className="form-group">
              <label htmlFor="certIssuer">Issuer</label>
              <input
                type="text"
                id="certIssuer"
                value={editingData.issuer || ''}
                onChange={(e) =>
                  setEditingData({ ...editingData, issuer: e.target.value })
                }
                placeholder="e.g., Amazon Web Services"
                disabled={disabled}
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="issueDate">Issue Date</label>
              <input
                type="month"
                id="issueDate"
                value={editingData.issueDate || ''}
                onChange={(e) =>
                  setEditingData({ ...editingData, issueDate: e.target.value })
                }
                disabled={disabled}
              />
            </div>

            <div className="form-group">
              <label htmlFor="expiryDate">Expiry Date</label>
              <input
                type="month"
                id="expiryDate"
                value={editingData.expiryDate || ''}
                onChange={(e) =>
                  setEditingData({ ...editingData, expiryDate: e.target.value })
                }
                disabled={noExpiry || disabled}
              />
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={noExpiry}
                  onChange={(e) => setNoExpiry(e.target.checked)}
                  disabled={disabled}
                />
                No expiry date
              </label>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="credentialId">Credential ID</label>
              <input
                type="text"
                id="credentialId"
                value={editingData.credentialId || ''}
                onChange={(e) =>
                  setEditingData({
                    ...editingData,
                    credentialId: e.target.value,
                  })
                }
                placeholder="e.g., AWS-SAA-2023-05"
                disabled={disabled}
              />
            </div>

            <div className="form-group">
              <label htmlFor="credentialUrl">Credential URL</label>
              <input
                type="url"
                id="credentialUrl"
                value={editingData.credentialUrl || ''}
                onChange={(e) =>
                  setEditingData({
                    ...editingData,
                    credentialUrl: e.target.value,
                  })
                }
                placeholder="e.g., https://aws.amazon.com/verification"
                disabled={disabled}
              />
            </div>
          </div>

          <div className="form-actions">
            <Button
              type="button"
              variant="secondary"
              onClick={handleCancel}
              disabled={disabled}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              onClick={handleSave}
              disabled={disabled}
            >
              Save Certification
            </Button>
          </div>
        </div>

        {confirmDialog}
      </section>
    );
  }

  return (
    <section className="form-section">
      <h2 className="section-title">Certifications</h2>

      {certifications.length === 0 ? (
        <div className="empty-state">
          <p>No certifications added yet</p>
          <Button
            type="button"
            variant="primary"
            onClick={handleAdd}
            disabled={disabled}
          >
            + Add Certification
          </Button>
        </div>
      ) : (
        <>
          <div className="certifications-list">
            {certifications.map((cert, idx) => (
              <div
                key={idx}
                className={`certification-card ${
                  isExpired(cert.expiryDate) ? 'expired' : ''
                }`}
              >
                <div className="cert-header">
                  <div className="cert-title">
                    <h3>{cert.name}</h3>
                    {cert.issuer && <p className="issuer">{cert.issuer}</p>}
                    <div className="cert-dates">
                      {cert.issueDate && (
                        <span>Issued: {formatDate(cert.issueDate)}</span>
                      )}
                      {cert.expiryDate && (
                        <span
                          className={isExpired(cert.expiryDate) ? 'expired' : ''}
                        >
                          Expires: {formatDate(cert.expiryDate)}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="cert-actions">
                    <button
                      className="btn-edit"
                      onClick={() => handleEdit(idx)}
                      aria-label="Edit certification"
                      disabled={disabled}
                    >
                      Edit
                    </button>
                    <button
                      className="btn-delete"
                      onClick={() => handleDelete(idx)}
                      aria-label="Delete certification"
                      disabled={disabled}
                    >
                      Delete
                    </button>
                  </div>
                </div>

                <div className="cert-footer">
                  {cert.credentialId && (
                    <span className="credential-id">ID: {cert.credentialId}</span>
                  )}
                  {cert.credentialUrl && (
                    <a
                      href={cert.credentialUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="credential-link"
                    >
                      View Credential →
                    </a>
                  )}
                </div>

                {isExpired(cert.expiryDate) && (
                  <div className="expired-badge">Expired</div>
                )}
              </div>
            ))}
          </div>

          <Button
            type="button"
            variant="primary"
            onClick={handleAdd}
            disabled={disabled}
          >
            + Add Certification
          </Button>
        </>
      )}

      {confirmDialog}
    </section>
  );
}
