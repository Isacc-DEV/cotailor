'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useProfiles } from '@/app/hooks/useProfiles';
import { useSession } from '@/app/hooks/useSession';
import { Button, Spinner } from '@/app/components/ui';
import ConfirmDialog from '@/app/components/ui/ConfirmDialog';
import './page.css';

export default function ProfileSelector() {
  const router = useRouter();
  const { profiles, loading: profilesLoading, deleteProfile } = useProfiles();
  const { createSession, loading: sessionLoading, error } = useSession();
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [startingProfileId, setStartingProfileId] = useState<string | null>(null);

  const handleSelectProfile = async (profileId: string) => {
    setStartingProfileId(profileId);
    try {
      const session = await createSession(profileId);
      if (session && session.id) {
        router.push(`/jd-input?sessionId=${session.id}`);
      }
    } catch (err) {
      console.error('Error creating session:', err);
    } finally {
      setStartingProfileId(null);
    }
  };

  const handleEdit = (profileId: string) => {
    router.push(`/profile-editor?profileId=${profileId}`);
  };

  const handleDeleteProfile = async () => {
    if (!deleteTarget) return;
    setDeleting(deleteTarget.id);
    try {
      await deleteProfile(deleteTarget.id);
      setDeleteTarget(null);
    } catch (err) {
      console.error('Failed to delete profile:', err);
    } finally {
      setDeleting(null);
    }
  };

  const getSkillName = (skill: any) =>
    typeof skill === 'string' ? skill : skill?.name || skill?.title || 'Unnamed';

  const getProfileInitial = (profile: any) => (profile.name || 'P').charAt(0).toUpperCase();

  const renderProfileCard = (profile: any) => {
    const skills = Array.isArray(profile.skills) ? profile.skills : [];
    const isStarting = startingProfileId === profile.id;
    const topSkillNames = skills.slice(0, 2).map(getSkillName).join(' & ');

    return (
      <article key={profile.id} className="profile-card">
        <div className="profile-card-top">
          <div className="profile-tags">
            <span className="profile-tag tag-ready">Ready to tailor</span>
            <span className="profile-tag">{skills.length} skill{skills.length === 1 ? '' : 's'}</span>
          </div>
          <div className="card-actions">
            <button
              className="profile-icon-btn edit-btn"
              onClick={() => handleEdit(profile.id)}
              aria-label={`Edit ${profile.name}`}
              title="Edit profile"
              type="button"
            >
              <span className="profile-action-icon icon-edit" aria-hidden="true" />
            </button>
            <button
              className="profile-icon-btn delete-btn"
              onClick={() => setDeleteTarget(profile)}
              disabled={deleting === profile.id}
              aria-label={`Delete ${profile.name}`}
              title="Delete profile"
              type="button"
            >
              <span className="profile-action-icon icon-delete" aria-hidden="true" />
            </button>
          </div>
        </div>

        <button
          className="profile-title-button"
          onClick={() => handleSelectProfile(profile.id)}
          disabled={sessionLoading}
          type="button"
        >
          <h3>{profile.name}</h3>
        </button>

        <div className="profile-details">
          <span>{profile.category || 'Uncategorized'}</span>
          <span className="detail-line">
            <span className="detail-icon" aria-hidden="true" />
            {topSkillNames || 'Add skills to improve tailoring'}
          </span>
        </div>

        <div className="profile-skills">
          <div className="skills-list">
            {skills.length === 0 ? (
              <span className="skill-chip muted">No skills yet</span>
            ) : (
              skills.slice(0, 4).map((skill: any, idx: number) => {
                const skillName = getSkillName(skill);
                return (
                  <span className="skill-chip" key={`${skillName}-${idx}`}>
                    {skillName}
                  </span>
                );
              })
            )}
            {skills.length > 4 && (
              <span className="skill-chip muted" key="more">
                +{skills.length - 4} more
              </span>
            )}
          </div>
        </div>

        <button
          className="profile-start-pill"
          onClick={() => handleSelectProfile(profile.id)}
          disabled={sessionLoading}
          type="button"
        >
          <span className="start-check" aria-hidden="true" />
          <span>{isStarting ? 'Starting...' : 'Start session'}</span>
        </button>
      </article>
    );
  };

  const renderProfileRow = (profile: any) => {
    const skills = Array.isArray(profile.skills) ? profile.skills : [];
    const isStarting = startingProfileId === profile.id;
    const topSkillNames = skills.slice(0, 2).map(getSkillName).join(' & ');

    return (
      <div key={profile.id} className="profile-row">
        <div className="row-main">
          <div className="profile-tags">
            <span className="profile-tag tag-ready">Ready to tailor</span>
            <span className="profile-tag">{skills.length} skill{skills.length === 1 ? '' : 's'}</span>
          </div>
          <button
            className="profile-title-button row-title-button"
            onClick={() => handleSelectProfile(profile.id)}
            disabled={sessionLoading}
            type="button"
          >
            <span>{profile.name}</span>
          </button>
          <div className="profile-details row-details">
            <span>{profile.category || 'Uncategorized'}</span>
            <span className="detail-line">
              <span className="detail-icon" aria-hidden="true" />
              {topSkillNames || 'Add skills to improve tailoring'}
            </span>
          </div>
        </div>
        <div className="row-actions">
          <button
            className="profile-start-pill row-start"
            onClick={() => handleSelectProfile(profile.id)}
            disabled={sessionLoading}
            type="button"
          >
            <span className="start-check" aria-hidden="true" />
            <span>{isStarting ? 'Starting...' : 'Start'}</span>
          </button>
          <button
            className="profile-icon-btn edit-btn"
            onClick={() => handleEdit(profile.id)}
            aria-label={`Edit ${profile.name}`}
            title="Edit profile"
            type="button"
          >
            <span className="profile-action-icon icon-edit" aria-hidden="true" />
          </button>
          <button
            className="profile-icon-btn delete-btn"
            onClick={() => setDeleteTarget(profile)}
            disabled={deleting === profile.id}
            aria-label={`Delete ${profile.name}`}
            title="Delete profile"
            type="button"
          >
            <span className="profile-action-icon icon-delete" aria-hidden="true" />
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="profile-selector">
      <div className="profile-header">
        <div className="header-top">
          <div>
            <h1>Profiles</h1>
            <p>Choose the profile you want to tailor from, or keep your profiles up to date.</p>
          </div>
          {!profilesLoading && profiles.length > 0 && (
            <button
              className="new-profile-action"
              onClick={() => router.push('/create-profile')}
              type="button"
            >
              <span className="new-profile-icon" aria-hidden="true" />
              <span>New profile</span>
            </button>
          )}
        </div>
      </div>

      {error && <div className="error-message">{error}</div>}

      {profilesLoading ? (
        <Spinner text="Loading profiles..." />
      ) : profiles.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon" aria-hidden="true">
            <span className="empty-icon-page" />
          </div>
          <h2>No profiles yet</h2>
          <p>Create one profile with your verified experience, skills, and resume preferences.</p>
          <Button variant="primary" size="lg" onClick={() => router.push('/create-profile')}>
            Create Profile
          </Button>
        </div>
      ) : (
        <>
          <div className="profiles-header">
            <div className="profiles-count">
              {profiles.length} profile{profiles.length === 1 ? '' : 's'}
            </div>
            <div className="view-toggles">
              <button
                className={`toggle-btn ${viewMode === 'grid' ? 'active' : ''}`}
                onClick={() => setViewMode('grid')}
                title="Grid view"
                type="button"
                aria-pressed={viewMode === 'grid'}
              >
                <span className="toggle-icon grid-icon" aria-hidden="true" />
                <span>Grid</span>
              </button>
              <button
                className={`toggle-btn ${viewMode === 'list' ? 'active' : ''}`}
                onClick={() => setViewMode('list')}
                title="List view"
                type="button"
                aria-pressed={viewMode === 'list'}
              >
                <span className="toggle-icon list-icon" aria-hidden="true" />
                <span>List</span>
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

      <ConfirmDialog
        isOpen={deleteTarget !== null}
        title="Delete profile?"
        message="This removes the saved profile. Existing sessions are kept, but you will not be able to start new sessions from this profile."
        itemName={deleteTarget?.name}
        confirmText="Delete"
        onConfirm={handleDeleteProfile}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
