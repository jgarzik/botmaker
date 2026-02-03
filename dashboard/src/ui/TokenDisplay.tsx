import { useState, useCallback } from 'react';
import './TokenDisplay.css';

interface TokenDisplayProps {
  token: string;
  label?: string;
}

/**
 * Copy text to clipboard using the modern Clipboard API with fallback.
 * Requires secure context (HTTPS or localhost) for Clipboard API.
 */
async function copyToClipboard(text: string): Promise<boolean> {
  // Try modern Clipboard API first
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (err) {
    console.warn('Clipboard API failed, trying fallback:', err);
  }

  // Fallback: hidden textarea + execCommand
  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    // eslint-disable-next-line @typescript-eslint/no-deprecated -- Intentional fallback for older browsers
    const success = document.execCommand('copy');
    document.body.removeChild(textarea);
    return success;
  } catch (err) {
    console.warn('Fallback copy failed:', err);
    return false;
  }
}

export function TokenDisplay({ token, label = 'Access Token' }: TokenDisplayProps) {
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  const [revealed, setRevealed] = useState(false);

  const handleCopy = useCallback(() => {
    setCopyFailed(false);
    void copyToClipboard(token).then((success) => {
      if (success) {
        setCopied(true);
        setTimeout(() => { setCopied(false); }, 2000);
      } else {
        setCopyFailed(true);
        setTimeout(() => { setCopyFailed(false); }, 2000);
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
          className={`token-display-copy ${copied ? 'copied' : ''} ${copyFailed ? 'failed' : ''}`}
          onClick={handleCopy}
          title="Copy to clipboard"
        >
          <span className="token-display-copy-icon">
            {copied ? '✓' : copyFailed ? '✗' : '⧉'}
          </span>
        </button>
      </div>
    </div>
  );
}
