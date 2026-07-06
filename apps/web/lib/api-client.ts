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
    const response = await fetchWithTimeout(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
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
      return request<{ userId: string; email: string; name: string | null; token: string }>(
        '/auth/signup',
        { method: 'POST', body: JSON.stringify(data) },
      );
    },

    signin: async (data: { email: string; password: string }) => {
      return request<{ userId: string; email: string; name: string | null; token: string }>(
        '/auth/signin',
        { method: 'POST', body: JSON.stringify(data) },
      );
    },

    me: async () => {
      return request<{ userId: string; email: string; name: string | null }>('/auth/me');
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

    getStrategy: async (sessionId: string) => {
      return request<any>(`/sessions/${sessionId}/strategy`);
    },

    approveStrategy: async (sessionId: string) => {
      return request<any>(`/sessions/${sessionId}/approve-strategy`, {
        method: 'POST',
      });
    },

    getResume: async (sessionId: string) => {
      return request<any>(`/sessions/${sessionId}/resume`);
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
