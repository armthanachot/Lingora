import { useState, type FormEvent } from 'react';
import { authApi } from './google';
import type { User } from '../users';

type ProfileCompletionModalProps = {
  user: User;
  onCompleted: (user: User) => void;
};

export function ProfileCompletionModal({ user, onCompleted }: ProfileCompletionModalProps) {
  const [displayName, setDisplayName] = useState(user.displayName ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: FormEvent) {
    event.preventDefault();
    const normalized = displayName.trim();
    if (normalized.length < 2) {
      setError('Display name must be at least 2 characters.');
      return;
    }

    setSaving(true);
    setError('');
    try {
      const { user: updatedUser } = await authApi.updateProfile(normalized);
      onCompleted(updatedUser);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : String(requestError));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="profile-modal-backdrop" role="presentation">
      <section className="profile-modal" role="dialog" aria-modal="true" aria-labelledby="profile-modal-title">
        <div className="profile-modal-icon" aria-hidden="true">✦</div>
        <span className="auth-eyebrow">One quick step</span>
        <h2 id="profile-modal-title">Choose your display name</h2>
        <p>This is the name other parts of Lingora will use for your account.</p>

        <form onSubmit={submit}>
          <label htmlFor="display-name">Display name</label>
          <input
            id="display-name"
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            placeholder="e.g. Thanachot"
            maxLength={160}
            autoFocus
          />
          {error && <p className="profile-modal-error" role="alert">{error}</p>}
          <button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Continue to Lingora'}</button>
        </form>
      </section>
    </div>
  );
}
