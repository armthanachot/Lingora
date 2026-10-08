import { useEffect, useRef } from 'react';
import type { User } from '../users';
import { getGoogleClientId, googleAuthApi, loadGoogleIdentityServices } from './google';

type GoogleSignInButtonProps = {
  onSignedIn: (user: User) => void;
  onError: (message: string) => void;
  appearance?: 'light' | 'dark';
};

export function GoogleSignInButton({ onSignedIn, onError, appearance = 'light' }: GoogleSignInButtonProps) {
  const buttonRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;

    void loadGoogleIdentityServices()
      .then(() => {
        if (cancelled || !buttonRef.current || !window.google?.accounts.id) return;

        const clientId = getGoogleClientId();
        window.google.accounts.id.initialize({
          client_id: clientId,
          auto_select: false,
          callback: (response) => {
            void googleAuthApi
              .signIn(response.credential)
              .then(({ user }) => {
                if (!cancelled) onSignedIn(user);
              })
              .catch((error: unknown) => {
                if (!cancelled) onError(error instanceof Error ? error.message : String(error));
              });
          },
        });

        buttonRef.current.replaceChildren();
        window.google.accounts.id.renderButton(buttonRef.current, {
          type: 'standard',
          theme: appearance === 'dark' ? 'filled_black' : 'outline',
          size: 'large',
          text: 'signin_with',
          shape: 'pill',
          width: 280,
        });
      })
      .catch((error: unknown) => {
        if (!cancelled) onError(error instanceof Error ? error.message : String(error));
      });

    return () => {
      cancelled = true;
    };
  }, [appearance, onError, onSignedIn]);

  return <div ref={buttonRef} aria-label="Sign in with Google" />;
}
