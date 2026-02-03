import type { ProxyKey } from '../types';
import './KeysTable.css';

const VENDOR_COLORS: Record<string, string> = {
  openai: '#10a37f',
  anthropic: '#d4a574',
  venice: '#6366f1',
  google: '#4285f4',
};

const VENDOR_NAMES: Record<string, string> = {
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  venice: 'Venice',
  google: 'Google',
};

interface KeysTableProps {
  keys: ProxyKey[];
  onDelete: (key: ProxyKey) => void;
}

function formatDate(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function KeysTable({ keys, onDelete }: KeysTableProps) {
  // Sort by created_at descending (newest first)
  const sortedKeys = [...keys].sort((a, b) => b.created_at - a.created_at);

  if (sortedKeys.length === 0) {
    return (
      <div className="keys-table-empty">
        <svg width="32" height="32" viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="6" y="14" width="20" height="16" rx="2" />
          <path d="M10 14V10a6 6 0 1112 0v4" />
          <circle cx="16" cy="22" r="2" fill="currentColor" />
        </svg>
        <span>No API keys configured</span>
      </div>
    );
  }

  return (
    <table className="keys-table">
      <thead>
        <tr>
          <th>Vendor</th>
          <th>Label</th>
          <th>Tag</th>
          <th>Created</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        {sortedKeys.map((key) => (
          <tr key={key.id}>
            <td>
              <span
                className="keys-table-vendor"
                style={{ color: VENDOR_COLORS[key.vendor] || '#6b7280' }}
              >
                {VENDOR_NAMES[key.vendor] || key.vendor}
              </span>
            </td>
            <td className="keys-table-label">{key.label ?? '—'}</td>
            <td>
              {key.tag ? (
                <span className="keys-table-tag">{key.tag}</span>
              ) : (
                <span className="keys-table-tag keys-table-tag--default">default</span>
              )}
            </td>
            <td className="keys-table-date">{formatDate(key.created_at)}</td>
            <td>
              <button
                className="keys-table-delete"
                onClick={() => { onDelete(key); }}
                title="Delete key"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M2 4h10M5 4V3a1 1 0 011-1h2a1 1 0 011 1v1M11 4v7a2 2 0 01-2 2H5a2 2 0 01-2-2V4" />
                  <path d="M6 7v3M8 7v3" />
                </svg>
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
