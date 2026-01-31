import { useState, useCallback } from 'react';
import './TokenDisplay.css';

interface TokenDisplayProps {
  token: string;
  label?: string;
}

/**
 * Copy text to clipboard with fallback for non-HTTPS contexts.
 * The Clipboard API requires secure context (HTTPS or localhost).
 */
function copyToClipboard(text: string): boolean {
  // Try modern Clipboard API first (works on HTTPS/localhost)
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(text);
    return true;
  }

  // Fallback: create temporary textarea and use execCommand
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.left = '-9999px';
  textarea.style.top = '-9999px';
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();

  try {
    document.execCommand('copy');
    return true;
  } catch {
    return false;
  } finally {
    document.body.removeChild(textarea);
  }
}

export function TokenDisplay({ token, label = 'Access Token' }: TokenDisplayProps) {
  const [copied, setCopied] = useState(false);
  const [revealed, setRevealed] = useState(false);

  const handleCopy = useCallback(() => {
    const success = copyToClipboard(token);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [token]);

  const maskedToken = token.slice(0, 8) + '••••••••' + token.slice(-8);

  return (
    <div className="token-display">
      <div className="token-display-label">{label}</div>
      <div className="token-display-row">
        <button
          className="token-display-reveal"
          onClick={() => setRevealed(!revealed)}
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
