import type { ChannelDefinition } from './types';

export const telegram: ChannelDefinition = {
  id: 'telegram',
  label: 'Telegram',
  icon: 'TG',
  popular: true,
  tokenHint: 'Get this from @BotFather on Telegram',
  tokenPlaceholder: '123456:ABC-DEF...',
};
