import type { ChannelDefinition } from './types';

export const webhook: ChannelDefinition = {
  id: 'webhook',
  label: 'Webhook',
  icon: 'WH',
  popular: false,
  tokenHint: 'Webhook secret for request validation',
  tokenPlaceholder: 'Secret...',
};
