import type { ChannelDefinition } from './types';

export const mastodon: ChannelDefinition = {
  id: 'mastodon',
  label: 'Mastodon',
  icon: 'MD',
  popular: false,
  tokenHint: 'Mastodon access token from your instance',
  tokenPlaceholder: 'Access token...',
};
