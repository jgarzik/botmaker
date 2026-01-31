import type { ChannelDefinition } from './types';

export const slack: ChannelDefinition = {
  id: 'slack',
  label: 'Slack',
  icon: 'SL',
  popular: false,
  tokenHint: 'Bot User OAuth Token from Slack App settings',
  tokenPlaceholder: 'xoxb-...',
};
