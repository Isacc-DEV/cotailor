'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/app/components/ui';
import './page.css';

interface UserSettings {
  aiProvider: string;
  aiApiKey: string;
}

export default function Settings() {
  const router = useRouter();
  const [isClient, setIsClient] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [settings, setSettings] = useState<UserSettings>({
    aiProvider: 'claude',
    aiApiKey: '',
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showApiKey, setShowApiKey] = useState(false);

  useEffect(() => {
    setIsClient(true);
    const authToken = localStorage.getItem('auth_token');
    const userStr = localStorage.getItem('user');

    if (!authToken || !userStr) {
      router.push('/auth/signin');
      return;
    }

    setUser(JSON.parse(userStr));

    // Load settings from localStorage
    const savedSettings = localStorage.getItem('ai_settings');
    if (savedSettings) {
      setSettings(JSON.parse(savedSettings));
    }
  }, [router]);

  const handleProviderChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSettings({ ...settings, aiProvider: e.target.value });
  };

  const handleApiKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSettings({ ...settings, aiApiKey: e.target.value });
  };

  const handleSave = async () => {
    if (!settings.aiProvider) {
      setMessage({ type: 'error', text: 'Please select an AI provider' });
      return;
    }

    if (!settings.aiApiKey) {
      setMessage({ type: 'error', text: 'Please enter your API key' });
      return;
    }

    setLoading(true);
    try {
      // Save to localStorage
      localStorage.setItem('ai_settings', JSON.stringify(settings));
      setMessage({ type: 'success', text: 'Settings saved successfully!' });

      // Clear message after 3 seconds
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to save settings' });
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setSettings({ aiProvider: 'claude', aiApiKey: '' });
    localStorage.removeItem('ai_settings');
    setMessage({ type: 'success', text: 'Settings reset to defaults' });
    setTimeout(() => setMessage(null), 3000);
  };

  if (!isClient || !user) {
    return <div className="spinner">Loading...</div>;
  }

  return (
    <div className="settings-container">
      <div className="settings-header">
        <h1>Settings</h1>
        <p>Configure your AI provider and API credentials</p>
      </div>

      {message && (
        <div className={`message message-${message.type}`}>
          {message.text}
        </div>
      )}

      <div className="settings-content">
        <div className="settings-section">
          <h2>AI Provider Configuration</h2>
          <p className="section-subtitle">
            Each user brings their own AI provider credentials. This keeps costs transparent and under your control.
          </p>

          {/* AI Provider Selection */}
          <div className="form-group">
            <label htmlFor="provider">AI Provider *</label>
            <select
              id="provider"
              value={settings.aiProvider}
              onChange={handleProviderChange}
              className="provider-select"
              disabled={loading}
            >
              <option value="">-- Select Provider --</option>
              <option value="claude">Claude (Anthropic)</option>
              <option value="openai">OpenAI (GPT-4)</option>
              <option value="gemini">Google Gemini</option>
              <option value="local">Local LLM</option>
            </select>
            <p className="field-help">
              Choose your preferred AI provider. You'll need an API key from the provider.
            </p>
          </div>

          {/* API Key Input */}
          <div className="form-group">
            <label htmlFor="api-key">API Key *</label>
            <div className="api-key-input-wrapper">
              <input
                id="api-key"
                type={showApiKey ? 'text' : 'password'}
                value={settings.aiApiKey}
                onChange={handleApiKeyChange}
                placeholder={`Enter your ${settings.aiProvider || 'API'} key`}
                className="api-key-input"
                disabled={loading}
              />
              <button
                type="button"
                className="toggle-visibility"
                onClick={() => setShowApiKey(!showApiKey)}
                title={showApiKey ? 'Hide' : 'Show'}
              >
                {showApiKey ? '👁️' : '👁️‍🗨️'}
              </button>
            </div>
            <p className="field-help">
              Your API key is stored locally in your browser. Never shared with our servers.
            </p>
          </div>

          {/* Provider-Specific Help */}
          {settings.aiProvider === 'claude' && (
            <div className="help-box">
              <h4>Claude Setup</h4>
              <p>
                Get your API key from{' '}
                <a href="https://console.anthropic.com" target="_blank" rel="noopener noreferrer">
                  console.anthropic.com
                </a>
              </p>
              <p>Key format: sk-ant-...</p>
            </div>
          )}

          {settings.aiProvider === 'openai' && (
            <div className="help-box">
              <h4>OpenAI Setup</h4>
              <p>
                Get your API key from{' '}
                <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer">
                  platform.openai.com/api-keys
                </a>
              </p>
              <p>Key format: sk-...</p>
            </div>
          )}

          {settings.aiProvider === 'gemini' && (
            <div className="help-box">
              <h4>Google Gemini Setup</h4>
              <p>
                Get your API key from{' '}
                <a href="https://ai.google.dev/tutorials/setup" target="_blank" rel="noopener noreferrer">
                  ai.google.dev
                </a>
              </p>
            </div>
          )}

          {settings.aiProvider === 'local' && (
            <div className="help-box">
              <h4>Local LLM Setup</h4>
              <p>Point to your local LLM endpoint (e.g., Ollama, LM Studio)</p>
              <p>Example: http://localhost:11434</p>
            </div>
          )}
        </div>

        {/* Account Info */}
        <div className="settings-section account-info">
          <h2>Account</h2>
          <div className="info-item">
            <span className="label">Email:</span>
            <span className="value">{user?.email}</span>
          </div>
          <div className="info-item">
            <span className="label">Status:</span>
            <span className="value status-active">Active</span>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="settings-actions">
        <Button
          variant="primary"
          size="lg"
          onClick={handleSave}
          disabled={loading}
          loading={loading}
        >
          Save Settings
        </Button>
        <Button
          variant="secondary"
          size="lg"
          onClick={handleReset}
          disabled={loading}
        >
          Reset to Defaults
        </Button>
        <Button
          variant="secondary"
          size="lg"
          onClick={() => router.push('/profile-selector')}
          disabled={loading}
        >
          Back to Profiles
        </Button>
      </div>
    </div>
  );
}
