'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api-client';
import { PROFILE_CATEGORIES, PROFILE_SUBTYPES } from '@cotailor/shared';

export interface TaxonomyOptions {
  categories: string[];
  subtypes: Record<string, string[]>;
}

// Offline fallback so the profile form never renders empty if the API is down.
const FALLBACK: TaxonomyOptions = {
  categories: [...PROFILE_CATEGORIES],
  subtypes: PROFILE_SUBTYPES,
};

// The admin-managed Category -> Subtype list for the profile form dropdowns.
// Categories/subtypes added or renamed in the admin appear here without a deploy.
export function useTaxonomy(): TaxonomyOptions {
  const [options, setOptions] = useState<TaxonomyOptions>(FALLBACK);

  useEffect(() => {
    let stale = false;
    api.taxonomy
      .tree()
      .then((tree) => {
        if (stale || tree.length === 0) return;
        setOptions({
          categories: tree.map((c) => c.name),
          subtypes: Object.fromEntries(tree.map((c) => [c.name, c.subtypes.map((s) => s.name)])),
        });
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
