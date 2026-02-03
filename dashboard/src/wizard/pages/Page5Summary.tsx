import { useWizard } from '../context/WizardContext';
import { getProvider } from '../../config/providers';
import { getChannel } from '../../config/channels';
import { CollapsibleSection } from '../components';
import './Page5Summary.css';

function maskToken(token: string): string {
  if (token.length <= 4) return '****';
  return '****' + token.slice(-4);
}

export function Page5Summary() {
  const { state } = useWizard();

  return (
    <div className="page5-summary">
      <div className="page5-header">
        <h3 className="page5-title">Review Your Bot</h3>
        <p className="page5-subtitle">Verify everything looks correct before creating</p>
      </div>

      <CollapsibleSection title="Persona" defaultOpen={true}>
        <div className="page5-persona">
          <div className="page5-avatar">
            {state.avatarPreviewUrl ? (
              <img src={state.avatarPreviewUrl} alt="Avatar" className="page5-avatar-image" />
            ) : (
              <span className="page5-avatar-emoji">{state.emoji}</span>
            )}
          </div>
          <div className="page5-persona-details">
            <div className="page5-field">
              <span className="page5-label">Name</span>
              <span className="page5-value">{state.botName || '(not set)'}</span>
            </div>
            <div className="page5-field">
              <span className="page5-label">Emoji</span>
              <span className="page5-value">{state.emoji}</span>
            </div>
          </div>
        </div>
        {state.soulMarkdown && (
          <div className="page5-soul-preview">
            <span className="page5-label">SOUL.md Preview</span>
            <pre className="page5-soul-content">
              {state.soulMarkdown.slice(0, 300)}
              {state.soulMarkdown.length > 300 && '...'}
            </pre>
          </div>
        )}
      </CollapsibleSection>

      <CollapsibleSection title="Providers" defaultOpen={true}>
        {state.enabledProviders.length === 0 ? (
          <span className="page5-empty">No providers selected</span>
        ) : (
          <div className="page5-list">
            {state.enabledProviders.map((providerId) => {
              const provider = getProvider(providerId);
              const config = state.providerConfigs[providerId];
              return (
                <div key={providerId} className="page5-list-item">
                  <span className="page5-list-icon">{provider?.label.charAt(0) ?? ''}</span>
                  <div className="page5-list-content">
                    <span className="page5-list-title">{provider?.label ?? providerId}</span>
                    <span className="page5-list-subtitle">
                      Model: {config?.model ?? 'default'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CollapsibleSection>

      <CollapsibleSection title="Channels" defaultOpen={true}>
        {state.enabledChannels.length === 0 ? (
          <span className="page5-empty">No channels selected</span>
        ) : (
          <div className="page5-list">
            {state.enabledChannels.map((channelId) => {
              const channel = getChannel(channelId);
              const config = state.channelConfigs[channelId];
              return (
                <div key={channelId} className="page5-list-item">
                  <span className="page5-list-icon">{channel?.icon}</span>
                  <div className="page5-list-content">
                    <span className="page5-list-title">{channel?.label ?? channelId}</span>
                    <span className="page5-list-subtitle">
                      Token: {maskToken(config?.token ?? '')}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CollapsibleSection>

      <CollapsibleSection title="Features" defaultOpen={true}>
        <div className="page5-features">
          <div className="page5-feature">
            <span className={`page5-feature-status ${state.features.commands ? 'page5-feature-status--on' : ''}`} />
            <span>Commands</span>
          </div>
          <div className="page5-feature">
            <span className={`page5-feature-status ${state.features.tts ? 'page5-feature-status--on' : ''}`} />
            <span>TTS{state.features.tts && ` (${state.features.ttsVoice})`}</span>
          </div>
          <div className="page5-feature">
            <span className={`page5-feature-status ${state.features.sandbox ? 'page5-feature-status--on' : ''}`} />
            <span>Sandbox{state.features.sandbox && ` (${state.features.sandboxTimeout}s)`}</span>
          </div>
          <div className="page5-field page5-field--inline">
            <span className="page5-label">Session Scope</span>
            <span className="page5-value">{state.features.sessionScope}</span>
          </div>
          {state.routingTags.length > 0 && (
            <div className="page5-field page5-field--inline">
              <span className="page5-label">Routing Tags</span>
              <div className="page5-tags">
                {state.routingTags.map((tag) => (
                  <span key={tag} className="page5-tag">{tag}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      </CollapsibleSection>
    </div>
  );
}
