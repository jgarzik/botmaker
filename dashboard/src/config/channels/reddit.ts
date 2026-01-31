import type { ChannelDefinition } from './types';

export const reddit: ChannelDefinition = {
  id: 'reddit',
  label: 'Reddit',
  icon: 'RD',
  popular: false,
  tokenHint: 'Reddit API credentials (client_id:secret)',
  tokenPlaceholder: 'client_id:client_secret',
};
