export type MessageDictionary = { [key: string]: string | MessageDictionary };

export function mergeMessages(base: MessageDictionary, overrides: MessageDictionary): MessageDictionary {
  const merged = { ...base };
  for (const [key, value] of Object.entries(overrides)) {
    const inherited = base[key];
    merged[key] = typeof value === "string"
      ? value
      : mergeMessages(typeof inherited === "object" ? inherited : {}, value);
  }
  return merged;
}
