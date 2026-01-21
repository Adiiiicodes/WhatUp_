// API client for communicating with the backend
import type { User, Message, Conversation, AuthResponse, ApiResponse } from '../types/chat';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

class ApiClient {
  private token: string | null = null;

  setToken(token: string | null) {
    this.token = token;
    if (token) {
      localStorage.setItem('auth_token', token);
    } else {
      localStorage.removeItem('auth_token');
    }
  }

  getToken(): string | null {
    if (this.token) return this.token;
    if (typeof window !== 'undefined') {
      this.token = localStorage.getItem('auth_token');
    }
    return this.token;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const token = this.getToken();

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (token) {
      (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });

    const data = await response.json();
    return data;
  }

  // Auth endpoints
  async signup(email: string, password: string, name: string) {
    const res = await this.request<AuthResponse>('/api/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ email, password, name }),
    });
    if (res.success && res.data?.token) {
      this.setToken(res.data.token);
    }
    return res;
  }

  async login(email: string, password: string) {
    const res = await this.request<AuthResponse>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    if (res.success && res.data?.token) {
      this.setToken(res.data.token);
    }
    return res;
  }

  async logout() {
    const res = await this.request<null>('/api/auth/logout', { method: 'POST' });
    this.setToken(null);
    return res;
  }

  async setPassword(email: string, password: string) {
    return this.request<{ message: string }>('/api/auth/set-password', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  }

  async getMe() {
    return this.request<User>('/api/auth/me');
  }

  // Users
  async getUsers() {
    return this.request<User[]>('/api/users');
  }

  async getUserById(id: string) {
    return this.request<User>(`/api/users/${id}`);
  }

  async deleteUser(userId: string) {
    return this.request<{ deleted: boolean }>(`/api/users/${userId}`, {
      method: 'DELETE',
    });
  }

  // Conversations
  async getConversations() {
    return this.request<Conversation[]>('/api/conversations');
  }

  async createConversation(participantId: string) {
    return this.request<Conversation>('/api/conversations', {
      method: 'POST',
      body: JSON.stringify({ participantId }),
    });
  }

  async getConversation(id: string) {
    return this.request<Conversation>(`/api/conversations/${id}`);
  }

  // Messages
  async getMessages(conversationId: string) {
    return this.request<Message[]>(`/api/messages?conversationId=${conversationId}`);
  }

  async sendMessage(params: {
    conversationId: string;
    receiverId: string;
    content: string;
    type?: string;
  }) {
    return this.request<Message>('/api/messages', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  async deleteMessage(messageId: string, conversationId: string) {
    return this.request<{ deleted: boolean }>(`/api/messages/${messageId}?conversationId=${conversationId}`, {
      method: 'DELETE',
    });
  }

  // File upload
  async uploadFile(
    file: File,
    conversationId: string,
    receiverId: string,
    type: 'image' | 'document' | 'voice'
  ) {
    const token = this.getToken();
    const formData = new FormData();
    formData.append('file', file);
    formData.append('conversationId', conversationId);
    formData.append('receiverId', receiverId);
    formData.append('type', type);

    const response = await fetch(`${API_BASE_URL}/api/files/upload`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    });

    return response.json() as Promise<ApiResponse<Message>>;
  }

  getFileUrl(fileId: string) {
    return `${API_BASE_URL}/api/files/${fileId}`;
  }

  // Admin endpoints
  async adminLogin(id: string, pass: string) {
    return this.request<{ token: string }>('/api/admin/login', {
      method: 'POST',
      body: JSON.stringify({ id, pass }),
    });
  }

  async adminGetUsers() {
    return this.request<User[]>('/api/admin/users');
  }

  async adminGetConversations() {
    return this.request<Conversation[]>('/api/admin/conversations');
  }

  async adminDeleteConversation(conversationId: string) {
    return this.request<{ deleted: boolean }>(`/api/admin/conversations/${conversationId}`, {
      method: 'DELETE',
    });
  }

  async makeAdmin(userId: string) {
    return this.request<{ message: string }>('/api/admin/make-admin', {
      method: 'POST',
      body: JSON.stringify({ userId }),
    });
  }
}

export const apiClient = new ApiClient();
export default apiClient;
