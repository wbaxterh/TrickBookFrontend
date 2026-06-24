/**
 * HTTP Client
 * Wrapper around fetch with auth token handling and error management
 */

import * as SecureStore from 'expo-secure-store';
import { API_CONFIG } from '@/constants/api';

const TOKEN_KEY = 'auth_token';

// Use AFTER_FIRST_UNLOCK so the token is readable on cold starts
// (before the user unlocks the device for the current session)
const SECURE_STORE_OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
};

interface RequestOptions extends RequestInit {
  timeout?: number;
  skipAuth?: boolean;
}

interface ApiError {
  message: string;
  status: number;
  data?: any;
}

class ApiClient {
  private baseUrl: string;

  constructor() {
    this.baseUrl = API_CONFIG.baseUrl;
  }

  /**
   * Get the stored auth token
   */
  async getToken(): Promise<string | null> {
    try {
      return await SecureStore.getItemAsync(TOKEN_KEY, SECURE_STORE_OPTIONS);
    } catch {
      return null;
    }
  }

  /**
   * Set the auth token
   */
  async setToken(token: string): Promise<void> {
    await SecureStore.setItemAsync(TOKEN_KEY, token, SECURE_STORE_OPTIONS);
  }

  /**
   * Clear the auth token
   */
  async clearToken(): Promise<void> {
    await SecureStore.deleteItemAsync(TOKEN_KEY, SECURE_STORE_OPTIONS);
  }

  /**
   * Make an API request
   */
  async request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
    const {
      timeout = API_CONFIG.timeout,
      skipAuth = false,
      headers: customHeaders = {},
      ...fetchOptions
    } = options;

    // Build headers
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(customHeaders as Record<string, string>),
    };

    // Add auth token if available and not skipped
    // Backend expects x-auth-token header (not Authorization: Bearer)
    if (!skipAuth) {
      const token = await this.getToken();
      if (token) {
        headers['x-auth-token'] = token;
      }
    }

    // Create abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const url = endpoint.startsWith('http') ? endpoint : `${this.baseUrl}${endpoint}`;

      const response = await fetch(url, {
        ...fetchOptions,
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Parse response
      let data: any;
      const contentType = response.headers.get('content-type');
      if (contentType?.includes('application/json')) {
        data = await response.json();
      } else {
        data = await response.text();
      }

      // Handle errors
      if (!response.ok) {
        const error: ApiError = {
          message: data?.error || data?.message || 'Request failed',
          status: response.status,
          data,
        };
        throw error;
      }

      return data as T;
    } catch (error: any) {
      clearTimeout(timeoutId);

      // Handle abort (timeout)
      if (error.name === 'AbortError') {
        throw {
          message: 'Request timed out',
          status: 408,
        } as ApiError;
      }

      // Handle network errors
      if (error.message === 'Network request failed') {
        throw {
          message: 'Unable to connect to server. Please check your internet connection.',
          status: 0,
        } as ApiError;
      }

      // Re-throw API errors
      if (error.status) {
        throw error;
      }

      // Unknown error
      throw {
        message: error.message || 'An unexpected error occurred',
        status: 500,
      } as ApiError;
    }
  }

  /**
   * GET request
   */
  async get<T>(endpoint: string, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'GET' });
  }

  /**
   * POST request
   */
  async post<T>(endpoint: string, data?: any, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  /**
   * PUT request
   */
  async put<T>(endpoint: string, data?: any, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  /**
   * PATCH request
   */
  async patch<T>(endpoint: string, data?: any, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'PATCH',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  /**
   * DELETE request
   */
  async delete<T>(endpoint: string, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'DELETE' });
  }
}

// Export singleton instance
export const apiClient = new ApiClient();
export default apiClient;
