import type { ChannelDefinition } from './types';
import { telegram } from './telegram';
import { discord } from './discord';
import { slack } from './slack';
import { signal } from './signal';
import { whatsapp } from './whatsapp';
import { matrix } from './matrix';
import { nostr } from './nostr';
import { twitter } from './twitter';
import { facebook } from './facebook';
import { instagram } from './instagram';
import { teams } from './teams';
import { line } from './line';
import { wechat } from './wechat';
import { viber } from './viber';
import { kik } from './kik';
import { twitch } from './twitch';
import { reddit } from './reddit';
import { mastodon } from './mastodon';
import { bluesky } from './bluesky';
import { rocketchat } from './rocketchat';
import { mattermost } from './mattermost';
import { zulip } from './zulip';
import { irc } from './irc';
import { xmpp } from './xmpp';
import { sms } from './sms';
import { email } from './email';
import { googlechat } from './googlechat';
import { webex } from './webex';
import { web } from './web';
import { webhook } from './webhook';

export type { ChannelDefinition };

export const CHANNELS: ChannelDefinition[] = [
  telegram,
  discord,
  slack,
  signal,
  whatsapp,
  matrix,
  nostr,
  twitter,
  facebook,
  instagram,
  teams,
  line,
  wechat,
  viber,
  kik,
  twitch,
  reddit,
  mastodon,
  bluesky,
  rocketchat,
  mattermost,
  zulip,
  irc,
  xmpp,
  sms,
  email,
  googlechat,
  webex,
  web,
  webhook,
];

export const POPULAR_CHANNELS = CHANNELS.filter((c) => c.popular);
export const OTHER_CHANNELS = CHANNELS.filter((c) => !c.popular);

export function getChannel(id: string): ChannelDefinition | undefined {
  return CHANNELS.find((c) => c.id === id);
}
