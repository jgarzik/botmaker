import { useState, useCallback } from 'react';
import './TokenDisplay.css';

interface TokenDisplayProps {
  token: string;
  label?: string;
}

/**
 * Copy text to clipboard using the modern Clipboard API.
 * Requires secure context (HTTPS or localhost).
 */
async function copyToClipboard(text: string): Promise<boolean> {
  // Try modern Clipboard API
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function TokenDisplay({ token, label = 'Access Token' }: TokenDisplayProps) {
  const [copied, setCopied] = useState(false);
  const [revealed, setRevealed] = useState(false);

  const handleCopy = useCallback(() => {
    void copyToClipboard(token).then((success) => {
      if (success) {
        setCopied(true);
        setTimeout(() => { setCopied(false); }, 2000);
      }
    });
  }, [token]);

  const maskedToken = token.slice(0, 8) + '••••••••' + token.slice(-8);

  return (
    <div className="token-display">
      <div className="token-display-label">{label}</div>
      <div className="token-display-row">
        <button
          className="token-display-reveal"
          onClick={() => { setRevealed(!revealed); }}
          title={revealed ? 'Hide token' : 'Reveal token'}
        >
          <span className="token-display-icon">
            {revealed ? '◉' : '◎'}
          </span>
        </button>
        <code className="token-display-value">
          {revealed ? token : maskedToken}
        </code>
        <button
          className={`token-display-copy ${copied ? 'copied' : ''}`}
          onClick={handleCopy}
          title="Copy to clipboard"
        >
          <span className="token-display-copy-icon">
            {copied ? '✓' : '⧉'}
          </span>
        </button>
      </div>
    </div>
  );
}
