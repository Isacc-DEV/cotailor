// Profile export/import utilities

export interface ExportedProfile {
  profile: {
    id?: string;
    name: string;
    category: string;
    subtype?: string;
    resumeStyle?: string;
    header?: any;
    workExperience?: any[];
    education?: any[];
    skills?: string[];
    topSkills?: any[];
    certifications?: any[];
  };
  metadata: {
    exportedAt: string;
    exportedFrom: string;
  };
}

export const exportProfile = (profile: any) => {
  const exportData: ExportedProfile = {
    profile: {
      id: profile.id,
      name: profile.name,
      category: profile.category,
      subtype: profile.subtype,
      resumeStyle: profile.resumeStyle,
      header: profile.header,
      workExperience: profile.workExperience,
      education: profile.education,
      skills: profile.skills,
      topSkills: profile.topSkills,
      certifications: profile.certifications,
    },
    metadata: {
      exportedAt: new Date().toISOString(),
      exportedFrom: 'CoTailor v1.0',
    },
  };

  const jsonString = JSON.stringify(exportData, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  const fileName = `${profile.name.replace(/\s+/g, '_')}_profile_${new Date().toISOString().split('T')[0]}.json`;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export const validateProfileJSON = (data: unknown): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];

  if (!data || typeof data !== 'object') {
    errors.push('Invalid JSON structure');
    return { valid: false, errors };
  }

  const obj = data as Record<string, unknown>;

  // Validate profile
  if (!obj.profile || typeof obj.profile !== 'object') {
    errors.push('Missing or invalid "profile" field');
  } else {
    const profile = obj.profile as Record<string, unknown>;
    if (!profile.name || typeof profile.name !== 'string' || profile.name.length < 3) {
      errors.push('Profile name is required and must be at least 3 characters');
    }
    if (!profile.category || typeof profile.category !== 'string') {
      errors.push('Category is required');
    }
  }

  return { valid: errors.length === 0, errors };
};

export const importProfile = async (file: File): Promise<{ success: boolean; data?: ExportedProfile; errors?: string[] }> => {
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    const { valid, errors } = validateProfileJSON(data);

    if (!valid) {
      return { success: false, errors };
    }

    return { success: true, data };
  } catch (error) {
    return {
      success: false,
      errors: [error instanceof Error ? error.message : 'Unknown error parsing JSON'],
    };
  }
};

export const copyProfileToClipboard = async (profile: any): Promise<boolean> => {
  const exportData: ExportedProfile = {
    profile: {
      id: profile.id,
      name: profile.name,
      category: profile.category,
      subtype: profile.subtype,
      resumeStyle: profile.resumeStyle,
      header: profile.header,
      workExperience: profile.workExperience,
      education: profile.education,
      skills: profile.skills,
      topSkills: profile.topSkills,
      certifications: profile.certifications,
    },
    metadata: {
      exportedAt: new Date().toISOString(),
      exportedFrom: 'CoTailor v1.0',
    },
  };

  const jsonString = JSON.stringify(exportData, null, 2);

  try {
    await navigator.clipboard.writeText(jsonString);
    return true;
  } catch (error) {
    console.error('Failed to copy to clipboard:', error);
    return false;
  }
};

export const pasteProfileFromClipboard = async (): Promise<{ success: boolean; data?: ExportedProfile; errors?: string[] }> => {
  try {
    const text = await navigator.clipboard.readText();
    const data = JSON.parse(text);
    const { valid, errors } = validateProfileJSON(data);

    if (!valid) {
      return { success: false, errors };
    }

    return { success: true, data };
  } catch (error) {
    return {
      success: false,
      errors: [error instanceof Error ? error.message : 'Failed to read clipboard'],
    };
  }
};
