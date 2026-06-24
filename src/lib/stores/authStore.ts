/**
 * Auth Store
 * Zustand store for authentication state
 */

import * as SecureStore from 'expo-secure-store';
import { create } from 'zustand';
import * as authApi from '@/lib/api/auth';
import { apiClient } from '@/lib/api/client';

export interface User {
  id: string;
  name: string;
  email: string;
  imageUri?: string | null;
  sports?: string[];
  subscription?: {
    status: 'free' | 'active' | 'canceled' | 'past_due';
    plan: 'free' | 'premium';
  };
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
    avatarIcon?: { id: string; emoji: string; bg: string };
    stance?: string;
    homeSpot?: string;
    bio?: string;
  };
  role?: string;
  network?: boolean;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  error: string | null;

  // Actions
  setUser: (user: User | null) => void;
  setToken: (token: string | null) => void;
  setLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;
  login: (email: string, password: string) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => Promise<void>;
  loadStoredAuth: () => Promise<void>;
  refreshUser: () => Promise<void>;
  updateUser: (updates: Partial<User>) => void;
}

export interface RegisterData {
  name: string;
  email: string;
  password: string;
  sports: string[];
  riderProfile?: Record<string, any>;
}

const TOKEN_KEY = 'auth_token';
const USER_KEY = 'auth_user';

// Use AFTER_FIRST_UNLOCK so credentials survive cold starts and background launches
const SECURE_STORE_OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
};

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: null,
  isLoading: true,
  isAuthenticated: false,
  error: null,

  setUser: (user) => set({ user, isAuthenticated: !!user }),
  setToken: (token) => set({ token }),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),

  login: async (email: string, password: string) => {
    set({ isLoading: true, error: null });
    try {
      // Call the real login API
      const { token, user } = await authApi.login(email, password);

      // Store token in secure storage for session persistence
      await apiClient.setToken(token);

      // Store user data locally for offline access
      await SecureStore.setItemAsync(USER_KEY, JSON.stringify(user), SECURE_STORE_OPTIONS);

      set({
        user,
        token,
        isAuthenticated: true,
        error: null,
      });
    } catch (error: any) {
      const errorMessage = error?.message || 'Login failed. Please try again.';
      set({ error: errorMessage });
      throw new Error(errorMessage);
    } finally {
      set({ isLoading: false });
    }
  },

  register: async (data: RegisterData) => {
    set({ isLoading: true, error: null });
    try {
      // Register the user
      const _registeredUser = await authApi.register(data);

      // After registration, automatically log them in
      const { token, user } = await authApi.login(data.email, data.password);

      // Store token in secure storage for session persistence
      await apiClient.setToken(token);

      // Store user data
      await SecureStore.setItemAsync(USER_KEY, JSON.stringify(user), SECURE_STORE_OPTIONS);

      set({
        user,
        token,
        isAuthenticated: true,
        error: null,
      });
    } catch (error: any) {
      const errorMessage = error?.message || 'Registration failed. Please try again.';
      set({ error: errorMessage });
      throw new Error(errorMessage);
    } finally {
      set({ isLoading: false });
    }
  },

  logout: async () => {
    try {
      // Unregister this device's push token BEFORE clearing the auth token —
      // the DELETE call needs the JWT to identify the user. Also wipe any
      // locally-scheduled reminder notifications so a future user on this
      // device doesn't get the previous account's reminders.
      try {
        const { unregisterThisDeviceToken, clearAllLocalReminders } = await import(
          '@/lib/notifications'
        );
        await unregisterThisDeviceToken();
        await clearAllLocalReminders();
      } catch (_e) {
        // Non-fatal: continue with logout even if cleanup fails.
      }

      // Clear API token
      await authApi.logout();

      // Clear local storage
      await SecureStore.deleteItemAsync(TOKEN_KEY, SECURE_STORE_OPTIONS);
      await SecureStore.deleteItemAsync(USER_KEY, SECURE_STORE_OPTIONS);

      set({
        user: null,
        token: null,
        isAuthenticated: false,
        error: null,
      });
    } catch (_error) {
      // Still clear local state even if API fails
      set({
        user: null,
        token: null,
        isAuthenticated: false,
      });
    }
  },

  loadStoredAuth: async () => {
    // If already authenticated in memory, just do a background refresh
    if (get().isAuthenticated && get().token) {
      get()
        .refreshUser()
        .catch(() => {});
      return;
    }

    set({ isLoading: true });
    try {
      // Check for stored token
      const token = await apiClient.getToken();

      if (!token) {
        set({ isLoading: false });
        return;
      }

      const userJson = await SecureStore.getItemAsync(USER_KEY, SECURE_STORE_OPTIONS);

      if (userJson) {
        let user: User | undefined;
        try {
          user = JSON.parse(userJson) as User;
        } catch (_parseError) {
          // JSON corrupted — clear user data but keep token, fetch fresh below
          await SecureStore.deleteItemAsync(USER_KEY, SECURE_STORE_OPTIONS);
        }

        if (user) {
          set({ user, token, isAuthenticated: true });

          // Refresh user data in background — don't let failures affect auth state
          get()
            .refreshUser()
            .catch(() => {});
          return;
        }
      }

      // We have a token but no user data — try to fetch the user from the server
      // This recovers sessions where SecureStore lost the user JSON but kept the token
      try {
        const freshUser = await authApi.getCurrentUser();
        await SecureStore.setItemAsync(USER_KEY, JSON.stringify(freshUser), SECURE_STORE_OPTIONS);
        set({ user: freshUser, token, isAuthenticated: true });
      } catch (_fetchError) {
        // Token might be invalid — but don't wipe it, let the user try again
      }
    } catch (_error) {
      // SecureStore read failed (transient iOS Keychain error) —
      // do NOT wipe credentials, just proceed as unauthenticated for this session
    } finally {
      set({ isLoading: false });
    }
  },

  refreshUser: async () => {
    try {
      const token = await apiClient.getToken();
      if (!token) return;

      // Fetch fresh user data from server
      const user = await authApi.getCurrentUser();

      // Update local storage
      await SecureStore.setItemAsync(USER_KEY, JSON.stringify(user), SECURE_STORE_OPTIONS);

      set({ user });
    } catch (error: any) {
      // Only logout on 403 (forbidden) — a clear signal the account is blocked/deleted.
      // Don't logout on 401 because transient token read failures or network issues
      // can cause false 401s, permanently locking the user out.
      if (error?.status === 403) {
        get().logout();
      }
    }
  },

  updateUser: (updates) => {
    const currentUser = get().user;
    if (currentUser) {
      const updatedUser = { ...currentUser, ...updates };
      set({ user: updatedUser });
      SecureStore.setItemAsync(USER_KEY, JSON.stringify(updatedUser), SECURE_STORE_OPTIONS);
    }
  },
}));

export default useAuthStore;
