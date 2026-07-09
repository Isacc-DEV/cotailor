import { clearToken, getToken, setStoredUser } from './auth';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const res = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (res.status === 401 && !endpoint.startsWith('/auth/')) {
    clearToken();
    if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/signin')) {
      window.location.assign('/signin');
    }
  }

  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      message = body?.message || body?.error?.message || message;
    } catch {
      /* keep status message */
    }
    throw new Error(message);
  }

  const data: any = await res.json();
  return (data?.data !== undefined ? data.data : data) as T;
}

export interface TaxonomySubtypeRow {
  id: string;
  name: string;
  sortOrder: number;
  enabled: boolean;
  familyId?: string | null;
}
export interface TaxonomyFamilyRow {
  id: string;
  name: string;
  sortOrder: number;
  enabled: boolean;
  subtypes: TaxonomySubtypeRow[];
}
// Public /taxonomy shape: flat category → subtypes.
export interface TaxonomyCategoryRow {
  id: string;
  name: string;
  sortOrder: number;
  enabled: boolean;
  subtypes: TaxonomySubtypeRow[];
}
// Admin /admin/taxonomy shape: category → families (+ ungrouped subtypes).
export interface TaxonomyAdminCategory {
  id: string;
  name: string;
  sortOrder: number;
  enabled: boolean;
  families: TaxonomyFamilyRow[];
  subtypes: TaxonomySubtypeRow[];
}

export const api = {
  auth: {
    signin: async (data: { email: string; password: string }) => {
      const res = await request<{
        userId: string;
        email: string;
        name: string | null;
        role: 'user' | 'admin';
        token: string;
      }>('/auth/signin', { method: 'POST', body: JSON.stringify(data) });
      setStoredUser({ id: res.userId, email: res.email, name: res.name, role: res.role });
      return res;
    },
    me: () =>
      request<{ userId: string; email: string; name: string | null; role: 'user' | 'admin' }>('/auth/me'),
  },

  admin: {
    stats: () =>
      request<{
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
      }>('/admin/stats'),

    users: {
      list: (
        params: {
          search?: string;
          role?: 'user' | 'admin';
          status?: 'pending' | 'active' | 'suspended';
          page?: number;
          pageSize?: number;
        } = {},
      ) => {
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
      get: (id: string) => request<any>(`/admin/users/${id}`),
      update: (id: string, data: { role?: 'user' | 'admin'; status?: 'active' | 'suspended' }) =>
        request<any>(`/admin/users/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    },

    styles: {
      list: () =>
        request<
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
        >('/admin/resume-styles'),
      create: (data: {
        key: string;
        name: string;
        description?: string;
        config: any;
        isDefault?: boolean;
        sortOrder?: number;
      }) => request<any>('/admin/resume-styles', { method: 'POST', body: JSON.stringify(data) }),
      update: (
        id: string,
        data: Partial<{
          name: string;
          description: string | null;
          config: any;
          enabled: boolean;
          isDefault: boolean;
          sortOrder: number;
        }>,
      ) => request<any>(`/admin/resume-styles/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
      delete: (id: string) => request<{ deleted: boolean }>(`/admin/resume-styles/${id}`, { method: 'DELETE' }),
    },

    certifications: {
      list: (params: { search?: string; category?: string; subtype?: string } = {}) => {
        const qs = new URLSearchParams();
        if (params.search) qs.set('search', params.search);
        if (params.category) qs.set('category', params.category);
        if (params.subtype) qs.set('subtype', params.subtype);
        const suffix = qs.toString() ? `?${qs.toString()}` : '';
        return request<
          Array<{
            id: string;
            name: string;
            issuer: string;
            level: string | null;
            categories: string[];
            subtypes: string[];
            aliases: string[];
            enabled: boolean;
            updatedAt: string;
          }>
        >(`/admin/certifications${suffix}`);
      },
      create: (data: {
        name: string;
        issuer: string;
        level?: string;
        categories: string[];
        subtypes: string[];
        aliases: string[];
        enabled?: boolean;
      }) => request<any>('/admin/certifications', { method: 'POST', body: JSON.stringify(data) }),
      update: (
        id: string,
        data: Partial<{
          name: string;
          issuer: string;
          level: string | null;
          categories: string[];
          subtypes: string[];
          aliases: string[];
          enabled: boolean;
        }>,
      ) => request<any>(`/admin/certifications/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
      delete: (id: string) => request<{ deleted: boolean }>(`/admin/certifications/${id}`, { method: 'DELETE' }),
      todos: (status: 'open' | 'done' | 'dismissed' = 'open') =>
        request<
          Array<{
            id: string;
            rawText: string;
            issuer: string | null;
            category: string | null;
            subtype: string | null;
            requestedBy: string | null;
            status: string;
            createdAt: string;
          }>
        >(`/admin/certifications/todos/list?status=${status}`),
      resolveTodo: (id: string, status: 'done' | 'dismissed') =>
        request<any>(`/admin/certifications/todos/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) }),
    },
  },

  taxonomy: {
    // Public tree (enabled only, flat) — for the cert picker via useTaxonomy.
    tree: () => request<TaxonomyCategoryRow[]>('/taxonomy'),
    // Admin tree (incl. disabled, family-structured) — for the console.
    adminTree: () => request<TaxonomyAdminCategory[]>('/admin/taxonomy'),

    createCategory: (data: { name: string; sortOrder?: number; enabled?: boolean }) =>
      request<any>('/admin/taxonomy/categories', { method: 'POST', body: JSON.stringify(data) }),
    updateCategory: (id: string, data: Partial<{ name: string; sortOrder: number; enabled: boolean }>) =>
      request<any>(`/admin/taxonomy/categories/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    deleteCategory: (id: string) =>
      request<{ deleted: boolean }>(`/admin/taxonomy/categories/${id}`, { method: 'DELETE' }),

    createFamily: (data: { categoryId: string; name: string; sortOrder?: number; enabled?: boolean }) =>
      request<any>('/admin/taxonomy/families', { method: 'POST', body: JSON.stringify(data) }),
    updateFamily: (id: string, data: Partial<{ name: string; sortOrder: number; enabled: boolean }>) =>
      request<any>(`/admin/taxonomy/families/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    deleteFamily: (id: string) =>
      request<{ deleted: boolean }>(`/admin/taxonomy/families/${id}`, { method: 'DELETE' }),

    createSubtype: (data: { categoryId: string; familyId?: string; name: string; sortOrder?: number; enabled?: boolean }) =>
      request<any>('/admin/taxonomy/subtypes', { method: 'POST', body: JSON.stringify(data) }),
    updateSubtype: (
      id: string,
      data: Partial<{ name: string; sortOrder: number; enabled: boolean; categoryId: string; familyId: string | null }>,
    ) => request<any>(`/admin/taxonomy/subtypes/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    deleteSubtype: (id: string) =>
      request<{ deleted: boolean }>(`/admin/taxonomy/subtypes/${id}`, { method: 'DELETE' }),
  },
};
