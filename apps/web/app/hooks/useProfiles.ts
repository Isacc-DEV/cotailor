import { useState, useEffect } from 'react';
import { api } from '@/lib/api-client';

export interface Profile {
  id: string;
  name: string;
  category: string;
  skills: string[];
  baseResume: string;
  createdAt?: string;
  updatedAt?: string;
}

interface UseProfilesReturn {
  profiles: Profile[];
  loading: boolean;
  error: string | null;
  fetchProfiles: () => Promise<void>;
  createProfile: (data: Omit<Profile, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Profile>;
  updateProfile: (id: string, data: Partial<Profile>) => Promise<Profile>;
  deleteProfile: (id: string) => Promise<void>;
}

export function useProfiles(): UseProfilesReturn {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProfiles = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.profiles.list();
      setProfiles(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch profiles');
    } finally {
      setLoading(false);
    }
  };

  const createProfile = async (data: Omit<Profile, 'id' | 'createdAt' | 'updatedAt'>) => {
    setError(null);
    try {
      const newProfile = await api.profiles.create(data);
      setProfiles((prev) => [...prev, newProfile]);
      return newProfile;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create profile';
      setError(message);
      throw err;
    }
  };

  const updateProfile = async (id: string, data: Partial<Profile>) => {
    setError(null);
    try {
      // Remove id and other non-updatable fields before sending
      const { id: _, createdAt, updatedAt, ...updateData } = data as any;
      const updated = await api.profiles.update(id, updateData);
      setProfiles((prev) => prev.map((p) => (p.id === id ? updated : p)));
      return updated;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update profile';
      setError(message);
      throw err;
    }
  };

  const deleteProfile = async (id: string) => {
    setError(null);
    try {
      await api.profiles.delete(id);
      setProfiles((prev) => prev.filter((p) => p.id !== id));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete profile';
      setError(message);
      throw err;
    }
  };

  useEffect(() => {
    fetchProfiles();
  }, []);

  return {
    profiles,
    loading,
    error,
    fetchProfiles,
    createProfile,
    updateProfile,
    deleteProfile,
  };
}
