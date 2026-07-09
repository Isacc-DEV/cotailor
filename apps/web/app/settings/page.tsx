'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, ConfirmDialog } from '@/app/components/ui';
import { api } from '@/lib/api-client';
import { clearAuth, getStoredUser, getToken, updateStoredUser } from '@/lib/auth';
import { applyTheme, type ThemePref } from '@/lib/theme';
import './page.css';

type AiProviderMode = 'cotailor' | 'own_keys';

const THEME_OPTIONS: { value: ThemePref; label: string; icon: string }[] = [
  { value: 'light', label: 'Light', icon: '☀️' },
  { value: 'dark', label: 'Dark', icon: '🌙' },
  { value: 'system', label: 'System', icon: '🖥️' },
];

export default function Settings() {
  const router = useRouter();
  const [isClient, setIsClient] = useState(false);
  const [email, setEmail] = useState('');

  // Account
  const [name, setName] = useState('');
  const [savedName, setSavedName] = useState('');
  const [savingName, setSavingName] = useState(false);

  // Appearance
  const [theme, setTheme] = useState<ThemePref>('system');

  // AI provider
  const [aiMode, setAiMode] = useState<AiProviderMode>('cotailor');

  // Certification suggestions — how many certs the AI proposes per job.
  const [certCount, setCertCount] = useState(3);
  const [savingCertCount, setSavingCertCount] = useState(false);

  // Change password
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [pwMsg, setPwMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Danger zone
  const [confirmDeactivate, setConfirmDeactivate] = useState(false);
  const [deactivating, setDeactivating] = useState(false);

  const [banner, setBanner] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const flash = (type: 'success' | 'error', text: string) => {
    setBanner({ type, text });
    setTimeout(() => setBanner(null), 3500);
  };

  useEffect(() => {
    setIsClient(true);
    if (!getToken() || !getStoredUser()) {
      router.push('/auth/signin');
      return;
    }

    // Seed from the cached user for an instant paint, then reconcile with the
    // server (the source of truth for theme / provider mode).
    const cached = getStoredUser();
    if (cached) {
      setEmail(cached.email);
      setName(cached.name ?? '');
      setSavedName(cached.name ?? '');
      if (cached.theme) setTheme(cached.theme);
      if (cached.aiProviderMode) setAiMode(cached.aiProviderMode);
    }

    api.auth
      .me()
      .then((me) => {
        setEmail(me.email);
        setName(me.name ?? '');
        setSavedName(me.name ?? '');
        setTheme(me.theme);
        setAiMode(me.aiProviderMode);
        setCertCount(me.certSuggestionCount ?? 3);
        updateStoredUser({ name: me.name, theme: me.theme, aiProviderMode: me.aiProviderMode });
      })
      .catch(() => {
        /* keep cached values; api-client already handles 401 sign-out */
      });
  }, [router]);

  const handleSaveName = async () => {
    const trimmed = name.trim();
    setSavingName(true);
    try {
      const me = await api.auth.updateMe({ name: trimmed });
      setName(me.name ?? '');
      setSavedName(me.name ?? '');
      updateStoredUser({ name: me.name });
      flash('success', 'Name updated.');
    } catch (err: any) {
      flash('error', err?.message || 'Could not update name.');
    } finally {
      setSavingName(false);
    }
  };

  const handleThemeChange = async (next: ThemePref) => {
    const previous = theme;
    setTheme(next);
    applyTheme(next); // optimistic: reflect immediately
    updateStoredUser({ theme: next });
    try {
      await api.auth.updateMe({ theme: next });
    } catch (err: any) {
      setTheme(previous);
      applyTheme(previous);
      updateStoredUser({ theme: previous });
      flash('error', err?.message || 'Could not save theme.');
    }
  };

  const handleCertCountChange = async (next: number) => {
    const previous = certCount;
    setCertCount(next);
    setSavingCertCount(true);
    try {
      await api.auth.updateMe({ certSuggestionCount: next });
    } catch (err: any) {
      setCertCount(previous);
      flash('error', err?.message || 'Could not save your certification setting.');
    } finally {
      setSavingCertCount(false);
    }
  };

  const handleChangePassword = async () => {
    setPwMsg(null);
    if (!currentPassword) {
      setPwMsg({ type: 'error', text: 'Enter your current password.' });
      return;
    }
    if (newPassword.length < 8) {
      setPwMsg({ type: 'error', text: 'New password must be at least 8 characters.' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwMsg({ type: 'error', text: 'New passwords do not match.' });
      return;
    }
    if (newPassword === currentPassword) {
      setPwMsg({ type: 'error', text: 'New password must be different from the current one.' });
      return;
    }

    setChangingPassword(true);
    try {
      await api.auth.changePassword({ currentPassword, newPassword });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPwMsg({ type: 'success', text: 'Password changed.' });
    } catch (err: any) {
      setPwMsg({ type: 'error', text: err?.message || 'Could not change password.' });
    } finally {
      setChangingPassword(false);
    }
  };

  const handleDeactivate = async () => {
    setDeactivating(true);
    try {
      await api.auth.deactivate();
      clearAuth();
      router.push('/');
    } catch (err: any) {
      flash('error', err?.message || 'Could not deactivate account.');
      setDeactivating(false);
    }
  };

  if (!isClient) {
    return <div className="spinner">Loading...</div>;
  }

  const nameDirty = name.trim() !== savedName.trim();

  return (
    <div className="settings-container">
      <div className="settings-header">
        <h1>Settings</h1>
        <p>Manage your account, appearance, and AI preferences</p>
      </div>

      {banner && <div className={`message message-${banner.type}`}>{banner.text}</div>}

      <div className="settings-content">
        {/* ===== Account ===== */}
        <section className="settings-section">
          <h2>Account</h2>
          <p className="section-subtitle">Your identity across CoTailor.</p>

          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input id="email" type="email" value={email} readOnly className="readonly-input" />
            <p className="field-help">Your email can’t be changed. Contact an admin if it’s wrong.</p>
          </div>

          <div className="form-group">
            <label htmlFor="name">Display name</label>
            <div className="inline-field">
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                maxLength={120}
                disabled={savingName}
              />
              <Button
                variant="primary"
                size="md"
                onClick={handleSaveName}
                disabled={!nameDirty || savingName}
                loading={savingName}
              >
                Save
              </Button>
            </div>
          </div>
        </section>

        {/* ===== Change password ===== */}
        <section className="settings-section">
          <h2>Change password</h2>
          <p className="section-subtitle">Use at least 8 characters. You’ll stay signed in.</p>

          {pwMsg && <div className={`message message-${pwMsg.type} inline-message`}>{pwMsg.text}</div>}

          <div className="form-group">
            <label htmlFor="current-password">Current password</label>
            <input
              id="current-password"
              type={showPasswords ? 'text' : 'password'}
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              autoComplete="current-password"
              disabled={changingPassword}
            />
          </div>
          <div className="form-group">
            <label htmlFor="new-password">New password</label>
            <input
              id="new-password"
              type={showPasswords ? 'text' : 'password'}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoComplete="new-password"
              disabled={changingPassword}
            />
          </div>
          <div className="form-group">
            <label htmlFor="confirm-password">Confirm new password</label>
            <input
              id="confirm-password"
              type={showPasswords ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
              disabled={changingPassword}
            />
          </div>

          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={showPasswords}
              onChange={(e) => setShowPasswords(e.target.checked)}
            />
            Show passwords
          </label>

          <div className="section-actions">
            <Button
              variant="primary"
              size="md"
              onClick={handleChangePassword}
              disabled={changingPassword}
              loading={changingPassword}
            >
              Update password
            </Button>
          </div>
        </section>

        {/* ===== Appearance ===== */}
        <section className="settings-section">
          <h2>Appearance</h2>
          <p className="section-subtitle">Choose how CoTailor looks. “System” follows your device.</p>

          <div className="theme-options" role="radiogroup" aria-label="Theme">
            {THEME_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                role="radio"
                aria-checked={theme === opt.value}
                className={`theme-option ${theme === opt.value ? 'selected' : ''}`}
                onClick={() => handleThemeChange(opt.value)}
              >
                <span className="theme-option-icon">{opt.icon}</span>
                <span className="theme-option-label">{opt.label}</span>
              </button>
            ))}
          </div>
        </section>

        {/* ===== AI provider ===== */}
        <section className="settings-section">
          <h2>AI provider</h2>
          <p className="section-subtitle">
            Choose which AI powers your tailoring. Bring-your-own keys are coming soon.
          </p>

          <div className="radio-cards">
            <label className={`radio-card ${aiMode === 'cotailor' ? 'selected' : ''}`}>
              <input
                type="radio"
                name="ai-provider"
                checked={aiMode === 'cotailor'}
                onChange={() => setAiMode('cotailor')}
              />
              <div className="radio-card-body">
                <div className="radio-card-title">Use CoTailor’s AI</div>
                <div className="radio-card-desc">
                  We handle the AI for you — nothing to configure. Recommended.
                </div>
              </div>
            </label>

            <label className="radio-card disabled" aria-disabled="true">
              <input type="radio" name="ai-provider" disabled checked={false} readOnly />
              <div className="radio-card-body">
                <div className="radio-card-title">
                  Use your own API keys <span className="soon-badge">Coming soon</span>
                </div>
                <div className="radio-card-desc">
                  Bring your own provider credentials for full cost control. Not available yet.
                </div>
              </div>
            </label>
          </div>
        </section>

        {/* ===== Certification suggestions ===== */}
        <section className="settings-section">
          <h2>Certification suggestions</h2>
          <p className="section-subtitle">
            How many certifications the AI suggests for each job, picked from our curated catalog. Set to Off to skip
            them entirely.
          </p>

          <div className="form-group">
            <label htmlFor="cert-count">Suggestions per job</label>
            <div className="inline-field">
              <select
                id="cert-count"
                value={certCount}
                onChange={(e) => handleCertCountChange(Number(e.target.value))}
                disabled={savingCertCount}
              >
                {Array.from({ length: 11 }, (_, i) => (
                  <option key={i} value={i}>
                    {i === 0 ? 'Off' : `${i}`}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </section>

        {/* ===== Danger zone ===== */}
        <section className="settings-section danger-zone">
          <h2>Danger zone</h2>
          <div className="danger-row">
            <div className="danger-copy">
              <div className="danger-title">Deactivate account</div>
              <p className="field-help">
                Signs you out and disables your account. An administrator can reactivate it later.
              </p>
            </div>
            <Button
              variant="danger"
              size="md"
              onClick={() => setConfirmDeactivate(true)}
              disabled={deactivating}
              loading={deactivating}
            >
              Deactivate
            </Button>
          </div>
        </section>
      </div>

      <ConfirmDialog
        isOpen={confirmDeactivate}
        title="Deactivate your account?"
        message="You’ll be signed out immediately and won’t be able to sign in until an administrator reactivates your account. Your profiles and sessions are kept."
        confirmText="Deactivate"
        onConfirm={handleDeactivate}
        onCancel={() => setConfirmDeactivate(false)}
      />
    </div>
  );
}
