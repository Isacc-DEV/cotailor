import { clearAuth, getToken } from './auth';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: { message: string; code: string };
  timestamp: string;
}

interface FetchOptions extends RequestInit {
  timeout?: number;
}

async function fetchWithTimeout(url: string, options: FetchOptions = {}) {
  const { timeout = 30000, ...fetchOptions } = options;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...fetchOptions,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

async function request<T>(
  endpoint: string,
  options: FetchOptions = {},
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;

  try {
    const token = getToken();
    // FormData bodies must NOT get a Content-Type — the browser sets
    // multipart/form-data with its boundary itself.
    const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
    const response = await fetchWithTimeout(url, {
      ...options,
      headers: {
        ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
    });

    // Expired/invalid token: drop it and send the user back to signin.
    // Auth endpoints are excluded so a wrong password doesn't cause a redirect.
    if (response.status === 401 && !endpoint.startsWith('/auth/')) {
      clearAuth();
      if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/auth')) {
        window.location.assign('/auth/signin');
      }
    }

    if (!response.ok) {
      let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
      try {
        const errorBody = await response.json();
        if (errorBody?.message) errorMessage = errorBody.message;
        if (errorBody?.error?.message) errorMessage = errorBody.error.message;
      } catch {
        // Response had no JSON body; keep the status-based message.
      }
      throw new Error(errorMessage);
    }

    const data: any = await response.json();

    // Handle both response formats
    if (data.success === false) {
      throw new Error(data.error?.message || 'Unknown error');
    }

    // If response has data field, return it; otherwise return the whole response
    if (data.data !== undefined) {
      return data.data as T;
    }

    // If response is an array (from profiles endpoint), return it directly
    if (Array.isArray(data)) {
      return data as T;
    }

    return data as T;
  } catch (error) {
    console.error(`API request failed: ${endpoint}`, error);
    throw error;
  }
}

export const api = {
  auth: {
    signup: async (data: { email: string; password: string; name?: string }) => {
      // token is present only for bootstrap admins; normal signups come back
      // status: 'pending' and must wait for admin approval.
      return request<{
        userId: string;
        email: string;
        name: string | null;
        role: 'user' | 'admin';
        status: 'pending' | 'active';
        token?: string;
        message?: string;
      }>('/auth/signup', { method: 'POST', body: JSON.stringify(data) });
    },

    signin: async (data: { email: string; password: string }) => {
      return request<{ userId: string; email: string; name: string | null; role: 'user' | 'admin'; token: string }>(
        '/auth/signin',
        { method: 'POST', body: JSON.stringify(data) },
      );
    },

    me: async () => {
      return request<{ userId: string; email: string; name: string | null; role: 'user' | 'admin' }>('/auth/me');
    },
  },

  styles: {
    // Enabled visual resume styles, in display order (for dropdowns + preview).
    list: async () => {
      return request<
        Array<{
          key: string;
          name: string;
          description: string | null;
          isDefault: boolean;
          config: any;
        }>
      >('/resume-styles');
    },
  },

  admin: {
    stats: async () => {
      return request<{
        users: { total: number; pending: number; active: number; suspended: number; admins: number };
        profiles: { total: number };
        sessions: { total: number; byState: Record<string, number> };
        recentAdminActivity: Array<{
          id: string;
          eventType: string;
          payload: any;
          createdAt: string;
          user: { email: string } | null;
        }>;
      }>('/admin/stats');
    },

    users: {
      list: async (params: {
        search?: string;
        role?: 'user' | 'admin';
        status?: 'pending' | 'active' | 'suspended';
        page?: number;
        pageSize?: number;
      } = {}) => {
        const qs = new URLSearchParams();
        if (params.search) qs.set('search', params.search);
        if (params.role) qs.set('role', params.role);
        if (params.status) qs.set('status', params.status);
        if (params.page) qs.set('page', String(params.page));
        if (params.pageSize) qs.set('pageSize', String(params.pageSize));
        const suffix = qs.toString() ? `?${qs.toString()}` : '';
        return request<{
          users: Array<{
            id: string;
            email: string;
            name: string | null;
            role: 'user' | 'admin';
            status: 'pending' | 'active' | 'suspended';
            createdAt: string;
            profileCount: number;
            sessionCount: number;
            lastActivityAt: string | null;
          }>;
          total: number;
          page: number;
          pageSize: number;
        }>(`/admin/users${suffix}`);
      },

      get: async (id: string) => {
        return request<any>(`/admin/users/${id}`);
      },

      update: async (id: string, data: { role?: 'user' | 'admin'; status?: 'active' | 'suspended' }) => {
        return request<any>(`/admin/users/${id}`, {
          method: 'PATCH',
          body: JSON.stringify(data),
        });
      },
    },

    styles: {
      list: async () => {
        return request<
          Array<{
            id: string;
            key: string;
            name: string;
            description: string | null;
            config: any;
            enabled: boolean;
            isDefault: boolean;
            sortOrder: number;
            updatedAt: string;
            usageCount: number;
          }>
        >('/admin/resume-styles');
      },

      create: async (data: {
        key: string;
        name: string;
        description?: string;
        config: any;
        isDefault?: boolean;
        sortOrder?: number;
      }) => {
        return request<any>('/admin/resume-styles', {
          method: 'POST',
          body: JSON.stringify(data),
        });
      },

      update: async (
        id: string,
        data: Partial<{
          name: string;
          description: string | null;
          config: any;
          enabled: boolean;
          isDefault: boolean;
          sortOrder: number;
        }>,
      ) => {
        return request<any>(`/admin/resume-styles/${id}`, {
          method: 'PATCH',
          body: JSON.stringify(data),
        });
      },

      delete: async (id: string) => {
        return request<{ deleted: boolean }>(`/admin/resume-styles/${id}`, {
          method: 'DELETE',
        });
      },
    },
  },

  profiles: {
    list: async () => {
      return request<any[]>('/profiles');
    },

    get: async (id: string) => {
      return request<any>(`/profiles/${id}`);
    },

    create: async (data: {
      name: string;
      category: string;
      skills: string[];
      baseResume: string;
    }) => {
      return request<any>('/profiles', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },

    update: async (
      id: string,
      data: Partial<{
        name: string;
        category: string;
        skills: string[];
        baseResume: string;
      }>,
    ) => {
      return request<any>(`/profiles/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });
    },

    delete: async (id: string) => {
      return request<void>(`/profiles/${id}`, {
        method: 'DELETE',
      });
    },

    // Upload a .docx/.pdf resume; the API extracts + parses it and returns a
    // profile DRAFT to prefill the form — nothing is saved by this call.
    importResume: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      return request<{
        draft: any;
        meta: {
          filename: string;
          fileType: 'pdf' | 'docx';
          charCount: number;
          truncated: boolean;
          warnings: string[];
        };
      }>('/profiles/import-resume', {
        method: 'POST',
        body: formData,
        // Extraction + LLM parsing can take a while on long resumes.
        timeout: 120000,
      });
    },
  },

  sessions: {
    list: async () => {
      return request<any[]>('/sessions');
    },

    create: async (profileId: string) => {
      return request<any>('/sessions', {
        method: 'POST',
        body: JSON.stringify({ profile_id: profileId }),
      });
    },

    get: async (id: string) => {
      return request<any>(`/sessions/${id}`);
    },

    delete: async (id: string) => {
      return request<{ deleted: boolean }>(`/sessions/${id}`, {
        method: 'DELETE',
      });
    },

    submitJD: async (sessionId: string, jdText: string) => {
      return request<any>(`/sessions/${sessionId}/jd`, {
        method: 'POST',
        body: JSON.stringify({ text: jdText }),
      });
    },

    answerCards: async (
      sessionId: string,
      decisions: Array<{
        cardId: string;
        answer: any;
      }>,
    ) => {
      return request<any>(`/sessions/${sessionId}/decisions`, {
        method: 'POST',
        body: JSON.stringify({ decisions }),
      });
    },

    answerCard: async (sessionId: string, cardId: string, optionId: string, note?: string) => {
      return request<any>(`/sessions/${sessionId}/cards/${cardId}/answer`, {
        method: 'POST',
        body: JSON.stringify({ option_id: optionId, ...(note ? { note } : {}) }),
      });
    },

    getStrategy: async (sessionId: string) => {
      return request<any>(`/sessions/${sessionId}/strategy`);
    },

    approveStrategy: async (sessionId: string) => {
      return request<any>(`/sessions/${sessionId}/approve-strategy`, {
        method: 'POST',
      });
    },

    // Generation and first-read resume builds run several LLM calls — allow
    // well beyond the default 30s request timeout.
    generate: async (sessionId: string) => {
      return request<any>(`/sessions/${sessionId}/generate`, {
        method: 'POST',
        timeout: 180000,
      });
    },

    getResume: async (sessionId: string) => {
      return request<any>(`/sessions/${sessionId}/resume`, { timeout: 180000 });
    },

    saveResume: async (sessionId: string, content: Record<string, unknown>) => {
      return request<any>(`/sessions/${sessionId}/resume`, {
        method: 'PUT',
        body: JSON.stringify(content),
      });
    },

    fixBullet: async (
      sessionId: string,
      body: { text: string; instruction: string; avoid_openers?: string[] },
    ) => {
      return request<{ text: string; verified?: boolean }>(`/sessions/${sessionId}/resume/fix-bullet`, {
        method: 'POST',
        body: JSON.stringify(body),
        timeout: 90000,
      });
    },

    exportResume: async (sessionId: string, format: 'docx' | 'pdf' | 'json') => {
      return request<Blob>(`/sessions/${sessionId}/export`, {
        method: 'POST',
        body: JSON.stringify({ format }),
      });
    },
  },

  health: {
    check: async () => {
      try {
        const response = await fetch(`${API_BASE_URL.replace('/api/v1', '')}/health`);
        return response.ok;
      } catch {
        return false;
      }
    },
  },
};
