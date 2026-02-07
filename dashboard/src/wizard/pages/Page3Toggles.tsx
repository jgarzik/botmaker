import { useState } from 'react';
import { useWizard } from '../context/WizardContext';
import { PROVIDERS } from '../../config/providers';
import { POPULAR_CHANNELS, OTHER_CHANNELS } from '../../config/channels';
import { FeatureCheckbox } from '../components';
import type { SessionScope } from '../../types';
import './Page3Toggles.css';

const POPULAR_PROVIDERS = ['openai', 'anthropic', 'venice', 'ollama'];

export function Page3Toggles() {
  const { state, dispatch } = useWizard();
  const [showAllProviders, setShowAllProviders] = useState(false);
  const [showAllChannels, setShowAllChannels] = useState(false);

  const popularProviders = PROVIDERS.filter((p) => POPULAR_PROVIDERS.includes(p.id));
  const otherProviders = PROVIDERS.filter((p) => !POPULAR_PROVIDERS.includes(p.id));

  const handleProviderToggle = (providerId: string) => {
    dispatch({ type: 'TOGGLE_PROVIDER', providerId });
  };

  const handleChannelToggle = (channelId: string) => {
    dispatch({ type: 'TOGGLE_CHANNEL', channelId });
  };

  const handleFeatureChange = (feature: 'commands' | 'tts' | 'sandbox', value: boolean) => {
    dispatch({ type: 'SET_FEATURE', feature, value });
  };

  const handleSessionScopeChange = (scope: SessionScope) => {
    dispatch({ type: 'SET_FEATURE', feature: 'sessionScope', value: scope });
  };

  const handleTagsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    // Parse comma-separated tags, trim whitespace
    const tags = value
      .split(',')
      .map((t) => t.trim().toLowerCase())
      .filter((t) => t.length > 0 && /^[a-z0-9-]+$/.test(t));
    dispatch({ type: 'SET_ROUTING_TAGS', tags });
  };

  return (
    <div className="page3-toggles">
      <section className="page3-section">
        <h4 className="page3-section-title">LLM Providers</h4>
        <div className="page3-checkbox-grid">
          {popularProviders.map((provider) => (
            <FeatureCheckbox
              key={provider.id}
              id={`provider-${provider.id}`}
              label={provider.label}
              checked={state.enabledProviders.includes(provider.id)}
              onChange={() => { handleProviderToggle(provider.id); }}
            />
          ))}
        </div>
        {otherProviders.length > 0 && (
          <>
            <button
              type="button"
              className="page3-show-more"
              onClick={() => { setShowAllProviders(!showAllProviders); }}
            >
              {showAllProviders ? 'Show less' : `Show all (${otherProviders.length} more)`}
            </button>
            {showAllProviders && (
              <div className="page3-checkbox-grid">
                {otherProviders.map((provider) => (
                  <FeatureCheckbox
                    key={provider.id}
                    id={`provider-${provider.id}`}
                    label={provider.label}
                    checked={state.enabledProviders.includes(provider.id)}
                    onChange={() => { handleProviderToggle(provider.id); }}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </section>

      <section className="page3-section">
        <h4 className="page3-section-title">Channels</h4>
        <div className="page3-checkbox-grid">
          {POPULAR_CHANNELS.map((channel) => (
            <FeatureCheckbox
              key={channel.id}
              id={`channel-${channel.id}`}
              icon={channel.icon}
              label={channel.label}
              checked={state.enabledChannels.includes(channel.id)}
              onChange={() => { handleChannelToggle(channel.id); }}
            />
          ))}
        </div>
        {OTHER_CHANNELS.length > 0 && (
          <>
            <button
              type="button"
              className="page3-show-more"
              onClick={() => { setShowAllChannels(!showAllChannels); }}
            >
              {showAllChannels ? 'Show less' : `Show all (${OTHER_CHANNELS.length} more)`}
            </button>
            {showAllChannels && (
              <div className="page3-checkbox-grid page3-checkbox-grid--dense">
                {OTHER_CHANNELS.map((channel) => (
                  <FeatureCheckbox
                    key={channel.id}
                    id={`channel-${channel.id}`}
                    icon={channel.icon}
                    label={channel.label}
                    checked={state.enabledChannels.includes(channel.id)}
                    onChange={() => { handleChannelToggle(channel.id); }}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </section>

      <section className="page3-section">
        <h4 className="page3-section-title">Features</h4>
        <div className="page3-checkbox-grid">
          <FeatureCheckbox
            id="feature-commands"
            label="Commands enabled"
            hint="Allow /commands in chat"
            checked={state.features.commands}
            onChange={(checked) => { handleFeatureChange('commands', checked); }}
          />
          <FeatureCheckbox
            id="feature-tts"
            label="Text-to-Speech"
            hint="Voice responses (requires provider support)"
            checked={state.features.tts}
            onChange={(checked) => { handleFeatureChange('tts', checked); }}
          />
          <FeatureCheckbox
            id="feature-sandbox"
            label="Sandbox mode"
            hint="Isolated environment for testing"
            checked={state.features.sandbox}
            onChange={(checked) => { handleFeatureChange('sandbox', checked); }}
          />
        </div>

        <div className="page3-radio-group">
          <span className="page3-radio-label">Session Scope</span>
          <div className="page3-radio-options">
            {(['user', 'channel', 'global'] as SessionScope[]).map((scope) => (
              <label key={scope} className="page3-radio-option">
                <input
                  type="radio"
                  name="sessionScope"
                  value={scope}
                  checked={state.features.sessionScope === scope}
                  onChange={() => { handleSessionScopeChange(scope); }}
                />
                <span className="page3-radio-box" />
                <span className="page3-radio-text">{scope}</span>
              </label>
            ))}
          </div>
        </div>
      </section>

      <section className="page3-section">
        <h4 className="page3-section-title">API Routing Tags</h4>
        <div className="page3-tags-field">
          <input
            type="text"
            className="wizard-input"
            placeholder="prod, high-priority"
            defaultValue={state.routingTags.join(', ')}
            onChange={handleTagsChange}
          />
          <span className="page3-tags-hint">
            Comma-separated tags for API key routing. Keys with matching tags will be used first.
            Leave empty to use default keys.
          </span>
          {state.routingTags.length > 0 && (
            <div className="page3-tags-preview">
              {state.routingTags.map((tag) => (
                <span key={tag} className="page3-tag-badge">{tag}</span>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
