import { useWizard } from '../context/WizardContext';
import { getProvider, getModels } from '../../config/providers';
import { getChannel } from '../../config/channels';
import { ConfigSection } from '../components';
import './Page4Config.css';

const TTS_VOICES = [
  { id: 'alloy', label: 'Alloy' },
  { id: 'echo', label: 'Echo' },
  { id: 'fable', label: 'Fable' },
  { id: 'onyx', label: 'Onyx' },
  { id: 'nova', label: 'Nova' },
  { id: 'shimmer', label: 'Shimmer' },
];

export function Page4Config() {
  const { state, dispatch } = useWizard();

  const handleModelChange = (providerId: string, model: string) => {
    dispatch({ type: 'SET_PROVIDER_CONFIG', providerId, config: { model } });
  };

  const handleTokenChange = (channelId: string, token: string) => {
    dispatch({ type: 'SET_CHANNEL_CONFIG', channelId, config: { token } });
  };

  const handleTtsVoiceChange = (voice: string) => {
    dispatch({ type: 'SET_FEATURE', feature: 'ttsVoice', value: voice });
  };

  const handleSandboxTimeoutChange = (timeout: number) => {
    dispatch({ type: 'SET_FEATURE', feature: 'sandboxTimeout', value: timeout });
  };

  return (
    <div className="page4-config">
      {state.enabledProviders.length > 0 && (
        <section className="page4-section">
          <h4 className="page4-section-title">LLM Provider Configuration</h4>
          {state.enabledProviders.map((providerId) => {
            const provider = getProvider(providerId);
            const models = getModels(providerId);
            const config = state.providerConfigs[providerId] ?? { model: '' };

            return (
              <ConfigSection
                key={providerId}
                icon={provider?.label.charAt(0) ?? '?'}
                title={provider?.label ?? providerId}
                hint={provider?.baseUrl}
              >
                <div className="wizard-form-group">
                  <label className="wizard-label">Model</label>
                  <select
                    className="wizard-select"
                    value={config.model}
                    onChange={(e) => { handleModelChange(providerId, e.target.value); }}
                  >
                    {models.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.label ?? m.id}
                      </option>
                    ))}
                  </select>
                </div>
              </ConfigSection>
            );
          })}
        </section>
      )}

      {state.enabledChannels.length > 0 && (
        <section className="page4-section">
          <h4 className="page4-section-title">Channel Configuration</h4>
          {state.enabledChannels.map((channelId) => {
            const channel = getChannel(channelId);
            const config = state.channelConfigs[channelId] ?? { token: '' };

            return (
              <ConfigSection
                key={channelId}
                icon={channel?.icon ?? '?'}
                title={channel?.label ?? channelId}
                hint={channel?.tokenHint}
              >
                <div className="wizard-form-group">
                  <label className="wizard-label">Bot Token</label>
                  <input
                    type="password"
                    className="wizard-input"
                    value={config.token}
                    onChange={(e) => { handleTokenChange(channelId, e.target.value); }}
                    placeholder={channel?.tokenPlaceholder ?? 'Token...'}
                  />
                </div>
              </ConfigSection>
            );
          })}
        </section>
      )}

      {(state.features.tts || state.features.sandbox) && (
        <section className="page4-section">
          <h4 className="page4-section-title">Feature Settings</h4>

          {state.features.tts && (
            <ConfigSection icon="🔊" title="Text-to-Speech">
              <div className="wizard-form-group">
                <label className="wizard-label">Voice</label>
                <select
                  className="wizard-select"
                  value={state.features.ttsVoice}
                  onChange={(e) => { handleTtsVoiceChange(e.target.value); }}
                >
                  {TTS_VOICES.map((voice) => (
                    <option key={voice.id} value={voice.id}>
                      {voice.label}
                    </option>
                  ))}
                </select>
              </div>
            </ConfigSection>
          )}

          {state.features.sandbox && (
            <ConfigSection icon="📦" title="Sandbox Mode">
              <div className="wizard-form-group">
                <label className="wizard-label">Timeout (seconds)</label>
                <input
                  type="number"
                  className="wizard-input"
                  value={state.features.sandboxTimeout}
                  onChange={(e) => { handleSandboxTimeoutChange(parseInt(e.target.value) || 30); }}
                  min={5}
                  max={300}
                />
              </div>
            </ConfigSection>
          )}
        </section>
      )}

      {state.enabledProviders.length === 0 && state.enabledChannels.length === 0 && (
        <div className="page4-empty">
          <p>No providers or channels selected.</p>
          <p>Go back to enable at least one of each.</p>
        </div>
      )}
    </div>
  );
}
