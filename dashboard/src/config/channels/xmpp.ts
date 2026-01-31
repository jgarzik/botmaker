import type { ChannelDefinition } from './types';

export const xmpp: ChannelDefinition = {
  id: 'xmpp',
  label: 'XMPP/Jabber',
  icon: 'XM',
  popular: false,
  tokenHint: 'XMPP password for bot account',
  tokenPlaceholder: 'Password...',
};
