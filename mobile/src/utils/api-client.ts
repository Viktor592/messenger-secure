import { Buffer } from 'buffer';
import { Message, User, Contact, VerifyResponse, AuthResponse, ContactSearchResponse } from '../types';

/**
 * API Client for Messenger Secure Backend
 * Handles all HTTP communication with the relay server
 */

export interface ApiClientConfig {
  baseUrl: string;
  timeout?: number;
  onUnauthorized?: () => void;
}

export class ApiClient {
  private baseUrl: string;
  private timeout: number;
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private onUnauthorized: (() => void) | null = null;

  constructor(config: ApiClientConfig) {
    this.baseUrl = config.baseUrl;
    this.timeout = config.timeout || 30000;
    this.onUnauthorized = config.onUnauthorized || null;
  }

  /**
   * Set authentication tokens
   */
  setTokens(accessToken: string, refreshToken: string): void {
    this.accessToken = accessToken;
    this.refreshToken = refreshToken;
  }

  /**
   * Clear authentication tokens
   */
  clearTokens(): void {
    this.accessToken = null;
    this.refreshToken = null;
  }

  /**
   * Make HTTP request with error handling and token refresh
   */
  private async request<T>(
    method: string,
    path: string,
    body?: any,
    headers?: Record<string, string>
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;

    const defaultHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.accessToken) {
      defaultHeaders['Authorization'] = `Bearer ${this.accessToken}`;
    }

    const allHeaders = { ...defaultHeaders, ...headers };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        method,
        headers: allHeaders,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Handle 401 - refresh token and retry
      if (response.status === 401) {
        if (this.refreshToken) {
          await this.refreshAccessToken();
          // Retry the request with new token
          return this.request<T>(method, path, body, headers);
        } else {
          this.onUnauthorized?.();
          throw new Error('Unauthorized');
        }
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `HTTP ${response.status}`);
      }

      return data;
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  // ========== AUTH ==========

  /**
   * Send SMS verification code
   */
  async registerPhoneNumber(phone: string): Promise<AuthResponse> {
    const response = await this.request<{ data: AuthResponse }>('POST', '/api/auth/register', {
      phone,
    });
    return response.data;
  }

  /**
   * Verify SMS code and get JWT tokens
   */
  async verifyCode(
    phoneHash: string,
    sessionToken: string,
    code: string
  ): Promise<VerifyResponse> {
    const response = await this.request<{ data: VerifyResponse }>('POST', '/api/auth/verify', {
      phoneHash,
      sessionToken,
      code,
    });

    const data = response.data;
    this.setTokens(data.accessToken, data.refreshToken);

    return data;
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken(): Promise<void> {
    if (!this.refreshToken) {
      throw new Error('No refresh token available');
    }

    const response = await this.request<{ data: { accessToken: string; refreshToken: string } }>(
      'POST',
      '/api/auth/refresh',
      { refreshToken: this.refreshToken }
    );

    this.setTokens(response.data.accessToken, response.data.refreshToken);
  }

  /**
   * Logout
   */
  async logout(): Promise<void> {
    await this.request('POST', '/api/auth/logout', {});
    this.clearTokens();
  }

  // ========== CONTACTS ==========

  /**
   * Search for a contact by phone number
   */
  async searchContact(phone: string): Promise<ContactSearchResponse> {
    const response = await this.request<{ data: ContactSearchResponse }>(
      'GET',
      `/api/contacts/search?phone=${encodeURIComponent(phone)}`
    );
    return response.data;
  }

  /**
   * Add a contact
   */
  async addContact(phoneHash: string, displayName: string): Promise<Contact> {
    const response = await this.request<{ data: Contact }>('POST', '/api/contacts/add', {
      phoneHash,
      displayName,
    });
    return response.data;
  }

  /**
   * Verify contact fingerprint
   */
  async verifyContactFingerprint(fingerprint: string): Promise<{ verified: boolean }> {
    const response = await this.request<{ data: { verified: boolean } }>(
      'GET',
      `/api/contacts/verify/${encodeURIComponent(fingerprint)}`
    );
    return response.data;
  }

  // ========== MESSAGES ==========

  /**
   * Get pending offline messages
   */
  async getPendingMessages(): Promise<Message[]> {
    const response = await this.request<{ data: Message[] }>('GET', '/api/messages/pending');
    return response.data;
  }

  /**
   * Mark message as received and delete from server
   */
  async deleteMessage(messageId: string): Promise<void> {
    await this.request('DELETE', `/api/messages/${encodeURIComponent(messageId)}`);
  }

  /**
   * Batch delete messages
   */
  async batchDeleteMessages(messageIds: string[]): Promise<void> {
    await this.request('POST', '/api/messages/batch-delete', {
      messageIds,
    });
  }

  /**
   * Get message statistics
   */
  async getMessageStats(): Promise<{ totalMessages: number; pendingCount: number }> {
    const response = await this.request<{
      data: { totalMessages: number; pendingCount: number };
    }>('GET', '/api/messages/stats');
    return response.data;
  }

  // ========== GROUPS ==========

  /**
   * Create a new group
   */
  async createGroup(name: string, memberPhoneHashes: string[]): Promise<{ id: string }> {
    const response = await this.request<{ data: { id: string } }>('POST', '/api/groups/create', {
      name,
      memberPhoneHashes,
    });
    return response.data;
  }

  /**
   * Get list of user's groups
   */
  async listGroups(): Promise<any[]> {
    const response = await this.request<{ data: any[] }>('GET', '/api/groups/list');
    return response.data;
  }

  /**
   * Get group details
   */
  async getGroupDetails(groupId: string): Promise<any> {
    const response = await this.request<{ data: any }>('GET', `/api/groups/${encodeURIComponent(groupId)}`);
    return response.data;
  }

  /**
   * Add member to group
   */
  async addGroupMember(groupId: string, phoneHash: string): Promise<void> {
    await this.request('POST', `/api/groups/${encodeURIComponent(groupId)}/add-member`, {
      phoneHash,
    });
  }

  /**
   * Leave group
   */
  async leaveGroup(groupId: string): Promise<void> {
    await this.request('POST', `/api/groups/${encodeURIComponent(groupId)}/leave`, {});
  }

  /**
   * Delete group (only creator)
   */
  async deleteGroup(groupId: string): Promise<void> {
    await this.request('DELETE', `/api/groups/${encodeURIComponent(groupId)}`);
  }

  // ========== HEALTH ==========

  /**
   * Check if server is alive
   */
  async healthCheck(): Promise<{ status: string; version: string }> {
    try {
      const response = await this.request<{ data: { status: string; version: string } }>(
        'GET',
        '/api/health'
      );
      return response.data;
    } catch (error) {
      throw new Error('Server health check failed');
    }
  }

  /**
   * Get current access token
   */
  getAccessToken(): string | null {
    return this.accessToken;
  }

  /**
   * Check if authenticated
   */
  isAuthenticated(): boolean {
    return this.accessToken !== null;
  }
}

export default ApiClient;
