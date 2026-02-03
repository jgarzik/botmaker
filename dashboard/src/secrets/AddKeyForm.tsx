import { useState } from 'react';
import type { AddKeyInput } from '../types';
import { PROVIDERS } from '../config/providers';
import './AddKeyForm.css';

interface AddKeyFormProps {
  onSubmit: (input: AddKeyInput) => Promise<void>;
  onCancel: () => void;
  loading: boolean;
}

export function AddKeyForm({ onSubmit, onCancel, loading }: AddKeyFormProps) {
  const [vendor, setVendor] = useState('openai');
  const [secret, setSecret] = useState('');
  const [label, setLabel] = useState('');
  const [tag, setTag] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!secret.trim()) {
      setError('API key is required');
      return;
    }

    try {
      await onSubmit({
        vendor,
        secret: secret.trim(),
        label: label.trim() || undefined,
        tag: tag.trim() || undefined,
      });

      // Clear form on success
      setSecret('');
      setLabel('');
      setTag('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add key');
    }
  };

  return (
    <form className="add-key-form" onSubmit={(e) => { void handleSubmit(e); }}>
      {error && (
        <div className="add-key-error">
          {error}
        </div>
      )}

      <div className="add-key-field">
        <label htmlFor="vendor">Provider</label>
        <select
          id="vendor"
          value={vendor}
          onChange={(e) => { setVendor(e.target.value); }}
          disabled={loading}
        >
          {PROVIDERS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
      </div>

      <div className="add-key-field">
        <label htmlFor="secret">API Key *</label>
        <input
          id="secret"
          type="password"
          value={secret}
          onChange={(e) => { setSecret(e.target.value); }}
          placeholder="sk-..."
          disabled={loading}
          autoComplete="off"
        />
      </div>

      <div className="add-key-field">
        <label htmlFor="label">Label</label>
        <input
          id="label"
          type="text"
          value={label}
          onChange={(e) => { setLabel(e.target.value); }}
          placeholder="Production key"
          disabled={loading}
        />
        <span className="add-key-hint">Optional name to identify this key</span>
      </div>

      <div className="add-key-field">
        <label htmlFor="tag">Tag</label>
        <input
          id="tag"
          type="text"
          value={tag}
          onChange={(e) => { setTag(e.target.value); }}
          placeholder="prod"
          disabled={loading}
        />
        <span className="add-key-hint">
          Optional. Bots with matching tags will use this key. Leave empty for default.
        </span>
      </div>

      <div className="add-key-actions">
        <button
          type="button"
          className="btn btn--md btn--ghost"
          onClick={onCancel}
          disabled={loading}
        >
          Cancel
        </button>
        <button
          type="submit"
          className="btn btn--md btn--primary"
          disabled={loading || !secret.trim()}
        >
          {loading ? (
            <>
              <span className="btn-spinner" />
              Adding...
            </>
          ) : (
            'Add Key'
          )}
        </button>
      </div>
    </form>
  );
}
