/**
 * Auth API Functions
 * Login, Register, and User Authentication
 */

import { ENDPOINTS } from '@/constants/api';
import { apiClient } from './client';

// Types
export interface LoginResponse {
  token: string;
}

export interface RegisterData {
  name: string;
  email: string;
  password: string;
  sports?: string[];
  riderProfile?: Record<string, any>;
}

export interface RegisterResponse {
  _id: string;
  name: string;
  email: string;
  sports: string[];
  riderProfile: Record<string, any>;
  network: boolean;
  createdAt: string;
}

export interface User {
  id: string;
  _id?: string;
  name: string;
  email: string;
  imageUri?: string | null;
  role?: string;
  sports?: string[];
  riderProfile?: {
    nickname?: string;
    age?: string;
    nationality?: string;
    riderStyle?: string;
    motto?: string;
    sickestTrick?: string;
    alternateSport?: string;
    greatestStrength?: string;
    greatestWeakness?: string;
    dreamDate?: string;
    favoriteMovie?: string;
    favoriteMusic?: string;
    favoriteReading?: string;
    favoriteCourse?: string;
    otherHobbies?: string;
    avatarType?: 'icon' | 'upload';
    avatarIcon?: { id: string; emoji: string; bg: string } | null;
    stance?: string;
    homeSpot?: string;
    bio?: string;
  };
  network?: boolean;
  subscription?: {
    status: 'free' | 'active' | 'canceled' | 'past_due';
    plan: 'free' | 'premium';
  };
}

/**
 * Login with email and password
 */
export async function login(
  email: string,
  password: string,
): Promise<{ token: string; user: User }> {
  // Login returns only token, we need to decode JWT or fetch user after
  const response = await apiClient.post<LoginResponse>(
    ENDPOINTS.auth.login,
    { email, password },
    { skipAuth: true },
  );

  if (!response.token) {
    throw new Error('No token received from server');
  }

  // Store the token
  await apiClient.setToken(response.token);

  // Decode JWT to get user info (basic info is in the token)
  const tokenPayload = decodeJWT(response.token);

  const user: User = {
    id: tokenPayload.userId,
    name: tokenPayload.name,
    email: tokenPayload.email,
    imageUri: tokenPayload.imageUri,
    role: tokenPayload.role,
  };

  return { token: response.token, user };
}

/**
 * Register a new user
 */
export async function register(data: RegisterData): Promise<RegisterResponse> {
  const response = await apiClient.post<RegisterResponse>(ENDPOINTS.auth.register, data, {
    skipAuth: true,
  });

  return response;
}

/**
 * Get current authenticated user
 */
export async function getCurrentUser(): Promise<User> {
  const response = await apiClient.get<User>(ENDPOINTS.user.me);

  return {
    ...response,
    id: response.id || response._id || '',
  };
}

/**
 * Logout - clear token
 */
export async function logout(): Promise<void> {
  await apiClient.clearToken();
}

/**
 * Sign in with Google
 * Sends the Google ID token to the backend for verification
 */
export async function googleSignIn(tokenId: string): Promise<{ token: string; user: User }> {
  const response = await apiClient.post<{ token: string }>(
    ENDPOINTS.auth.googleAuth,
    { tokenId },
    { skipAuth: true },
  );

  if (!response.token) {
    throw new Error('No token received from server');
  }

  // Store the token
  await apiClient.setToken(response.token);

  // Decode JWT to get user info
  const tokenPayload = decodeJWT(response.token);

  const user: User = {
    id: tokenPayload.userId,
    name: tokenPayload.name,
    email: tokenPayload.email,
    imageUri: tokenPayload.imageUri,
    role: tokenPayload.role,
  };

  return { token: response.token, user };
}

/**
 * Sign in with Apple
 * Sends the Apple identity token to the backend for verification
 */
export async function appleSignIn(
  identityToken: string,
  fullName?: { givenName?: string | null; familyName?: string | null } | null,
  email?: string | null,
): Promise<{ token: string; user: User }> {
  const response = await apiClient.post<{ token: string }>(
    ENDPOINTS.auth.appleAuth,
    {
      identityToken,
      fullName: fullName ? `${fullName.givenName || ''} ${fullName.familyName || ''}`.trim() : null,
      email,
    },
    { skipAuth: true },
  );

  if (!response.token) {
    throw new Error('No token received from server');
  }

  // Store the token
  await apiClient.setToken(response.token);

  // Decode JWT to get user info
  const tokenPayload = decodeJWT(response.token);

  const user: User = {
    id: tokenPayload.userId,
    name: tokenPayload.name,
    email: tokenPayload.email,
    imageUri: tokenPayload.imageUri,
    role: tokenPayload.role,
  };

  return { token: response.token, user };
}

/**
 * Request password reset
 */
export async function forgotPassword(email: string): Promise<{ message: string }> {
  return apiClient.post(ENDPOINTS.auth.forgotPassword, { email }, { skipAuth: true });
}

/**
 * Reset password with token
 */
export async function resetPassword(
  token: string,
  newPassword: string,
): Promise<{ message: string }> {
  return apiClient.post(ENDPOINTS.auth.resetPassword, { token, newPassword }, { skipAuth: true });
}

/**
 * Decode JWT token to extract payload
 */
function decodeJWT(token: string): any {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new Error('Invalid token format');
    }

    const payload = parts[1];
    // Base64 decode (handle URL-safe base64)
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => `%${(`00${c.charCodeAt(0).toString(16)}`).slice(-2)}`)
        .join(''),
    );

    return JSON.parse(jsonPayload);
  } catch (_error) {
    return {};
  }
}
