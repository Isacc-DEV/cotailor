'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api-client';
import { PROFILE_RESUME_STYLES } from '@cotailor/shared';

export interface StyleOption {
  key: string;
  name: string;
  description?: string | null;
}

// Hardcoded keys as the offline fallback so the dropdown never renders empty.
const FALLBACK: StyleOption[] = PROFILE_RESUME_STYLES.map((key) => ({
  key,
  name: key.charAt(0).toUpperCase() + key.slice(1),
}));

// The admin-managed style list for the profile form dropdowns. Styles created
// or renamed in Manage appear here without a deploy.
export function useResumeStyleOptions(): StyleOption[] {
  const [options, setOptions] = useState<StyleOption[]>(FALLBACK);

  useEffect(() => {
    let stale = false;
    api.styles
      .list()
      .then((styles) => {
        if (!stale && styles.length > 0) {
          setOptions(styles.map((s) => ({ key: s.key, name: s.name, description: s.description })));
        }
      })
      .catch(() => {
        // Keep the fallback list.
      });
    return () => {
      stale = true;
    };
  }, []);

  return options;
}
