import { useWizard } from '../context/WizardContext';
import { EmojiPicker, MarkdownEditor, AvatarUpload } from '../components';
import './Page2Personality.css';

/**
 * Derive hostname from display name.
 * Converts to lowercase, replaces non-alphanumeric chars with hyphens, trims to 64 chars.
 */
function deriveHostname(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 64);
}

export function Page2Personality() {
  const { state, dispatch } = useWizard();

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const name = e.target.value;
    dispatch({ type: 'SET_BOT_NAME', name });
    // Auto-derive hostname from name (user can override)
    const derivedHostname = deriveHostname(name);
    dispatch({ type: 'SET_HOSTNAME', hostname: derivedHostname });
  };

  const handleHostnameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '');
    dispatch({ type: 'SET_HOSTNAME', hostname: value.slice(0, 64) });
  };

  const handleEmojiChange = (emoji: string) => {
    dispatch({ type: 'SET_EMOJI', emoji });
  };

  const handleAvatarUpload = (file: File, previewUrl: string) => {
    dispatch({ type: 'SET_AVATAR', file, previewUrl });
  };

  const handleAvatarClear = () => {
    dispatch({ type: 'SET_AVATAR', file: null, previewUrl: '' });
  };

  const handleSoulChange = (markdown: string) => {
    dispatch({ type: 'SET_SOUL_MARKDOWN', markdown });
  };

  return (
    <div className="page2-personality">
      <div className="page2-identity-section">
        <div className="page2-avatar-column">
          <label className="wizard-label">Avatar</label>
          <AvatarUpload
            previewUrl={state.avatarPreviewUrl}
            emoji={state.emoji}
            onUpload={handleAvatarUpload}
            onClear={handleAvatarClear}
          />
        </div>

        <div className="page2-fields-column">
          <div className="wizard-form-group">
            <label className="wizard-label" htmlFor="bot-name">Bot Name</label>
            <input
              type="text"
              id="bot-name"
              className="wizard-input"
              value={state.botName}
              onChange={handleNameChange}
              placeholder="My Awesome Bot"
              autoFocus
            />
            <span className="wizard-hint">Display name for your bot</span>
          </div>

          <div className="wizard-form-group">
            <label className="wizard-label" htmlFor="hostname">Hostname</label>
            <input
              type="text"
              id="hostname"
              className="wizard-input"
              value={state.hostname}
              onChange={handleHostnameChange}
              placeholder="my-awesome-bot"
            />
            <span className="wizard-hint">Used for container name and API access (max 64 chars)</span>
          </div>

          <div className="wizard-form-group">
            <label className="wizard-label">Emoji</label>
            <EmojiPicker
              value={state.emoji}
              onChange={handleEmojiChange}
            />
          </div>
        </div>
      </div>

      <div className="wizard-form-group">
        <MarkdownEditor
          value={state.soulMarkdown}
          onChange={handleSoulChange}
        />
      </div>
    </div>
  );
}
