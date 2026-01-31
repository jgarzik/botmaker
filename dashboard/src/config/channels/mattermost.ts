import type { ChannelDefinition } from './types';

export const mattermost: ChannelDefinition = {
  id: 'mattermost',
  label: 'Mattermost',
  icon: 'MM',
  popular: false,
  tokenHint: 'Mattermost Bot Access Token',
  tokenPlaceholder: 'Bot token...',
};
