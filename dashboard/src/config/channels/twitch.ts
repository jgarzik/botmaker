import type { ChannelDefinition } from './types';

export const twitch: ChannelDefinition = {
  id: 'twitch',
  label: 'Twitch',
  icon: 'TW',
  popular: false,
  tokenHint: 'Twitch OAuth token from Developer Console',
  tokenPlaceholder: 'oauth:...',
};
