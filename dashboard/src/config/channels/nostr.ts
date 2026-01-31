import type { ChannelDefinition } from './types';

export const nostr: ChannelDefinition = {
  id: 'nostr',
  label: 'Nostr',
  icon: 'NS',
  popular: false,
  tokenHint: 'Nostr private key (nsec)',
  tokenPlaceholder: 'nsec1...',
};
