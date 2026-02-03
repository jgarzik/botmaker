import { useState, useEffect, useCallback } from 'react';
import { fetchProxyKeys, fetchProxyHealth, addProxyKey, deleteProxyKey } from '../api';
import type { ProxyKey, AddKeyInput, ProxyHealthResponse } from '../types';
import { KeysTable } from './KeysTable';
import { AddKeyModal } from './AddKeyModal';
import { DeleteKeyModal } from './DeleteKeyModal';
import './SecretsTab.css';

export function SecretsTab() {
  const [keys, setKeys] = useState<ProxyKey[]>([]);
  const [health, setHealth] = useState<ProxyHealthResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [addingKey, setAddingKey] = useState(false);
  const [newKeySecret, setNewKeySecret] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [keyToDelete, setKeyToDelete] = useState<ProxyKey | null>(null);

  const loadData = useCallback(async () => {
    try {
      setError(null);
      const [keysData, healthData] = await Promise.all([
        fetchProxyKeys().catch(() => []),
        fetchProxyHealth().catch(() => ({ configured: false } as ProxyHealthResponse)),
      ]);
      setKeys(keysData);
      setHealth(healthData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleAddKey = async (input: AddKeyInput) => {
    setAddingKey(true);
    try {
      await addProxyKey(input);
      setNewKeySecret(input.secret);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add key');
      throw err;
    } finally {
      setAddingKey(false);
    }
  };

  const handleDeleteKey = async () => {
    if (!keyToDelete) return;
    try {
      await deleteProxyKey(keyToDelete.id);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete key');
    }
  };

  const dismissNewKeySecret = () => {
    setNewKeySecret(null);
  };

  if (!health?.configured) {
    return (
      <div className="secrets-tab" role="tabpanel" id="secrets-panel">
        <div className="secrets-not-configured">
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="9" y="21" width="30" height="24" rx="3" />
            <path d="M15 21V15a9 9 0 1118 0v6" />
            <circle cx="24" cy="33" r="3" fill="currentColor" />
          </svg>
          <h2>Keyring Proxy Not Configured</h2>
          <p>
            The keyring proxy is not configured. Set <code>PROXY_ADMIN_URL</code> and{' '}
            <code>PROXY_ADMIN_TOKEN</code> environment variables to enable centralized API key management.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="secrets-tab" role="tabpanel" id="secrets-panel">
      {error && (
        <div className="secrets-error">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 1a7 7 0 100 14A7 7 0 008 1zM7 4h2v5H7V4zm0 6h2v2H7v-2z" />
          </svg>
          <span>{error}</span>
          <button className="secrets-error-dismiss" onClick={() => { setError(null); }}>
            Dismiss
          </button>
        </div>
      )}

      {newKeySecret && (
        <div className="secrets-new-key-banner">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 1a7 7 0 100 14A7 7 0 008 1zm1 10H7V7h2v4zm0-6H7V3h2v2z" />
          </svg>
          <span>Key added successfully!</span>
          <button className="btn btn--sm btn--primary" onClick={dismissNewKeySecret}>
            Dismiss
          </button>
        </div>
      )}

      <header className="secrets-header">
        <h2 className="secrets-title">API Keys ({keys.length})</h2>
        <button
          className="btn btn--md btn--primary"
          onClick={() => { setShowAddModal(true); }}
        >
          Add Key
        </button>
      </header>

      <div className="secrets-panel panel">
        {loading ? (
          <div className="secrets-loading">
            <div className="secrets-spinner" />
            <span>Loading keys...</span>
          </div>
        ) : (
          <KeysTable keys={keys} onDelete={setKeyToDelete} />
        )}
      </div>

      <AddKeyModal
        isOpen={showAddModal}
        onClose={() => { setShowAddModal(false); }}
        onSubmit={handleAddKey}
        loading={addingKey}
      />

      <DeleteKeyModal
        isOpen={keyToDelete !== null}
        onClose={() => { setKeyToDelete(null); }}
        onConfirm={handleDeleteKey}
        keyToDelete={keyToDelete}
      />
    </div>
  );
}
