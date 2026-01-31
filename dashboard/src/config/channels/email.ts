import type { ChannelDefinition } from './types';

export const email: ChannelDefinition = {
  id: 'email',
  label: 'Email',
  icon: 'EM',
  popular: false,
  tokenHint: 'SMTP/IMAP credentials',
  tokenPlaceholder: 'Password...',
};
