'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useProfiles } from '@/app/hooks/useProfiles';
import { useSession } from '@/app/hooks/useSession';
import { Button, Card, Badge, Spinner } from '@/app/components/ui';
import './page.css';

export default function ProfileSelector() {
  const router = useRouter();
  const { profiles, loading: profilesLoading, deleteProfile } = useProfiles();
  const { createSession, loading: sessionLoading, error } = useSession();
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const handleSelectProfile = async (profileId: string) => {
    try {
      const session = await createSession(profileId);
      if (session && session.id) {
        router.push(`/jd-input?sessionId=${session.id}`);
      }
    } catch (err) {
      console.error('Error creating session:', err);
    }
  };

  const handleEdit = (profileId: string) => {
    router.push(`/profile-editor?profileId=${profileId}`);
  };

  const handleDeleteClick = async (profileId: string) => {
    if (deleteConfirm === profileId) {
      setDeleting(profileId);
      try {
        await deleteProfile(profileId);
        setDeleteConfirm(null);
      } catch (err) {
        console.error('Failed to delete profile:', err);
      } finally {
        setDeleting(null);
      }
    } else {
      setDeleteConfirm(profileId);
    }
  };

  const renderProfileCard = (profile: any) => (
    <Card key={profile.id} className="profile-card" hoverable>
      <div className="profile-content">
        <div className="card-header">
          <h3>{profile.name}</h3>
          <div className="card-actions">
            <button
              className="action-btn edit-btn"
              onClick={() => handleEdit(profile.id)}
              title="Edit profile"
            >
              ✎
            </button>
            <button
              className={`action-btn delete-btn ${deleteConfirm === profile.id ? 'confirm' : ''}`}
              onClick={() => handleDeleteClick(profile.id)}
              disabled={deleting === profile.id}
              title={deleteConfirm === profile.id ? 'Click again to confirm delete' : 'Delete profile'}
            >
              {deleteConfirm === profile.id ? '✓ Delete?' : '✕'}
            </button>
          </div>
        </div>

        <div className="profile-meta">
          <Badge variant="info">{profile.category}</Badge>
        </div>

        <div className="profile-skills">
          <p className="skills-label">Skills ({profile.skills?.length || 0})</p>
          <div className="skills-list">
            {profile.skills?.slice(0, 5).map((skill: any, idx: number) => {
              const skillName = typeof skill === 'string' ? skill : skill.name || skill.title || 'Unnamed';
              return (
                <Badge key={`${skillName}-${idx}`} variant="default">
                  {skillName}
                </Badge>
              );
            })}
            {profile.skills && profile.skills.length > 5 && (
              <Badge key="more">+{profile.skills.length - 5} more</Badge>
            )}
          </div>
        </div>

        <Button
          variant="primary"
          className="select-btn"
          onClick={() => handleSelectProfile(profile.id)}
          disabled={sessionLoading}
          loading={sessionLoading}
        >
          Select & Start Session
        </Button>
      </div>
    </Card>
  );

  const renderProfileRow = (profile: any) => (
    <div key={profile.id} className="profile-row">
      <div className="row-info">
        <div className="row-name">{profile.name}</div>
        <div className="row-meta">
          <span className="meta-item">{profile.category}</span>
          <span className="meta-item">{profile.skills?.length || 0} skills</span>
        </div>
      </div>
      <div className="row-actions">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => handleSelectProfile(profile.id)}
          disabled={sessionLoading}
          loading={sessionLoading}
        >
          Start
        </Button>
        <button
          className="action-btn edit-btn"
          onClick={() => handleEdit(profile.id)}
          title="Edit profile"
        >
          ✎ Edit
        </button>
        <button
          className={`action-btn delete-btn ${deleteConfirm === profile.id ? 'confirm' : ''}`}
          onClick={() => handleDeleteClick(profile.id)}
          disabled={deleting === profile.id}
          title={deleteConfirm === profile.id ? 'Click again to confirm delete' : 'Delete profile'}
        >
          {deleteConfirm === profile.id ? '✓ Delete?' : '✕ Delete'}
        </button>
      </div>
    </div>
  );

  return (
    <div className="profile-selector">
      <div className="profile-header">
        <div className="header-top">
          <div>
            <h1>Profiles</h1>
            <p>Create, edit, or pick a profile to start a session with</p>
          </div>
        </div>
      </div>

      {error && <div className="error-message">{error}</div>}

      {profilesLoading ? (
        <Spinner text="Loading profiles..." />
      ) : profiles.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📄</div>
          <h2>No profiles yet</h2>
          <p>Create your first resume profile to get started</p>
          <Button variant="primary" size="lg" onClick={() => router.push('/create-profile')}>
            Create Profile
          </Button>
        </div>
      ) : (
        <>
          <div className="profiles-header">
            <Button variant="secondary" onClick={() => router.push('/create-profile')}>
              + Add New Profile
            </Button>
            <div className="view-toggles">
              <button
                className={`toggle-btn ${viewMode === 'grid' ? 'active' : ''}`}
                onClick={() => setViewMode('grid')}
                title="Grid view"
              >
                ▦ Grid
              </button>
              <button
                className={`toggle-btn ${viewMode === 'list' ? 'active' : ''}`}
                onClick={() => setViewMode('list')}
                title="List view"
              >
                ≡ List
              </button>
            </div>
          </div>

          {viewMode === 'grid' ? (
            <div className="profiles-grid">
              {profiles.map((profile) => renderProfileCard(profile))}
            </div>
          ) : (
            <div className="profiles-list">
              {profiles.map((profile) => renderProfileRow(profile))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
