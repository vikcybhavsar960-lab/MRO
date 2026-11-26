/**
 * ProcureMRO Production REST API Client
 * Connects frontend to the persistent database backend with error handling and fallback
 */

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

const API_BASE = '/api';

async function request<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  try {
    const res = await fetch(url, {
      ...options,
      headers,
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      const msg = data.error || data.message || `Server returned HTTP status ${res.status}`;
      throw new Error(msg);
    }

    return data;
  } catch (err: any) {
    console.error(`[API Error] ${endpoint}:`, err);
    throw new Error(err.message || 'Data could not be saved. Please check server/database connection.');
  }
}

export const apiService = {
  // Health & Diagnostics
  async getHealth() {
    return request('/health');
  },

  async getDbStatus() {
    return request('/db/status');
  },

  // Auth
  async login(credentials: { username: string; password: string }) {
    return request('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
  },

  async changePassword(params: { userId: string; currentPassword: string; newPassword: string }) {
    return request('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  },

  // User Management
  async getUsers() {
    return request('/users');
  },

  async createUser(userData: any) {
    return request('/users', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
  },

  async updateUser(id: string, updates: any) {
    return request(`/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  },

  async deleteUser(id: string) {
    return request(`/users/${id}`, {
      method: 'DELETE',
    });
  },

  // Roles & Permissions
  async getRoles() {
    return request('/roles');
  },

  async updateRole(id: string, updates: any) {
    return request(`/roles/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  },

  // Approvals
  async getApprovals(status?: string) {
    const query = status && status !== 'ALL' ? `?status=${encodeURIComponent(status)}` : '';
    return request(`/approvals${query}`);
  },

  async createApproval(data: any) {
    return request('/approvals', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async processApproval(id: string, actionData: { action: 'APPROVE' | 'REJECT' | 'SEND_BACK'; approverId: string; approverName: string; comments?: string }) {
    return request(`/approvals/${id}/action`, {
      method: 'POST',
      body: JSON.stringify(actionData),
    });
  },

  // RFQ Closure (Customer Confirmation)
  async closeRfq(rfqId: string, closureData: {
    customerName: string;
    customerRfqReference: string;
    closureDate: string;
    closureReason: string;
    customerEmailReference: string;
    remarks: string;
    closedBy: string;
  }) {
    return request(`/rfqs/${rfqId}/close`, {
      method: 'POST',
      body: JSON.stringify(closureData),
    });
  },

  // Collections (Requirements, RFQs, Vendors, POs, Audit, Notifications)
  async getRequirements() {
    return request('/requirements');
  },

  async saveRequirements(requirements: any[]) {
    return request('/requirements', {
      method: 'POST',
      body: JSON.stringify(requirements),
    });
  },

  async getRfqs() {
    return request('/rfqs');
  },

  async saveRfqs(rfqs: any[]) {
    return request('/rfqs', {
      method: 'POST',
      body: JSON.stringify(rfqs),
    });
  },

  async getVendors() {
    return request('/vendors');
  },

  async saveVendors(vendors: any[]) {
    return request('/vendors', {
      method: 'POST',
      body: JSON.stringify(vendors),
    });
  },

  async getAuditLogs() {
    return request('/audit-logs');
  },

  async createAuditLog(log: any) {
    return request('/audit-logs', {
      method: 'POST',
      body: JSON.stringify(log),
    });
  },

  async getNotifications() {
    return request('/notifications');
  },

  async createNotification(notif: any) {
    return request('/notifications', {
      method: 'POST',
      body: JSON.stringify(notif),
    });
  },
};
