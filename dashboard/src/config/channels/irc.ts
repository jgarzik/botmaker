import type { ChannelDefinition } from './types';

export const irc: ChannelDefinition = {
  id: 'irc',
  label: 'IRC',
  icon: 'IR',
  popular: false,
  tokenHint: 'IRC server password (optional)',
  tokenPlaceholder: 'Password (optional)...',
};
