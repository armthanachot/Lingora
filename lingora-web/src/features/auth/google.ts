import { apiRequest } from '../../api/client';
import type { User } from '../users';

export type GoogleCredentialResponse = {
  credential: string;
  select_by?: string;
};

type GoogleAccountsId = {
  initialize: (options: {
    client_id: string;
    callback: (response: GoogleCredentialResponse) => void;
    auto_select?: boolean;
    cancel_on_tap_outside?: boolean;
  }) => void;
  renderButton: (
    parent: HTMLElement,
    options: {
      type?: 'standard' | 'icon';
      theme?: 'outline' | 'filled_blue' | 'filled_black';
      size?: 'large' | 'medium' | 'small';
      text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin';
      shape?: 'rectangular' | 'pill' | 'circle' | 'square';
      width?: number;
    },
  ) => void;
  disableAutoSelect: () => void;
};

declare global {
  interface Window {
    google?: {
      accounts: {
        id: GoogleAccountsId;
      };
    };
  }
}

let googleScriptPromise: Promise<void> | null = null;

export function getGoogleClientId(): string {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim();
  if (!clientId || clientId.startsWith('your-google-client-id')) {
    throw new Error('VITE_GOOGLE_CLIENT_ID is not configured. See docs/google.txt.');
  }
  return clientId;
}

export function loadGoogleIdentityServices(): Promise<void> {
  if (window.google?.accounts?.id) return Promise.resolve();
  if (googleScriptPromise) return googleScriptPromise;

  googleScriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      'script[src="https://accounts.google.com/gsi/client"]',
    );

    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('Failed to load Google Identity Services.')), {
        once: true,
      });
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Google Identity Services.'));
    document.head.appendChild(script);
  });

  return googleScriptPromise;
}

export const googleAuthApi = {
  signIn: (credential: string) =>
    apiRequest<{ user: User }>('/auth/google', {
      method: 'POST',
      body: JSON.stringify({ credential }),
    }),
};

export const authApi = {
  me: () => apiRequest<{ user: User }>('/auth/me'),
  updateProfile: (displayName: string) =>
    apiRequest<{ user: User }>('/auth/profile', {
      method: 'PATCH',
      body: JSON.stringify({ displayName }),
    }),
  signOut: () => apiRequest<{ signedOut: boolean }>('/auth/signout', { method: 'POST' }),
};
