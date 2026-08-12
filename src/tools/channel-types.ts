/** Discord channel type numeric codes, keyed by friendly name. */
export const CHANNEL_TYPE_CODES = {
  text: 0,
  dm: 1,
  voice: 2,
  groupDm: 3,
  category: 4,
  announcement: 5,
  announcementThread: 10,
  publicThread: 11,
  privateThread: 12,
  stageVoice: 13,
  directory: 14,
  forum: 15,
  media: 16,
} as const;

export type ChannelType = keyof typeof CHANNEL_TYPE_CODES;

const BY_CODE = new Map<number, ChannelType>(
  (Object.entries(CHANNEL_TYPE_CODES) as [ChannelType, number][]).map(([name, code]) => [code, name]),
);

/** Friendly name for a numeric channel type, if known. */
export const channelTypeName = (code: number): ChannelType | undefined => BY_CODE.get(code);
