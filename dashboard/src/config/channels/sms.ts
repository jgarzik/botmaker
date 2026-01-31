import type { ChannelDefinition } from './types';

export const sms: ChannelDefinition = {
  id: 'sms',
  label: 'SMS (Twilio)',
  icon: 'SM',
  popular: false,
  tokenHint: 'Twilio Auth Token',
  tokenPlaceholder: 'Auth token...',
};
