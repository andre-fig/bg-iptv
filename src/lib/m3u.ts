export type Channel = {
  id: string;
  name: string;
  logo?: string;
  group?: string;
  url: string;
  tvgId?: string;
  country?: string;
  language?: string;
};

/** Parse an M3U / M3U8 playlist string into Channel objects. */
export function parseM3U(text: string): Channel[] {
  const lines = text.split(/\r?\n/);
  const channels: Channel[] = [];
  let current: Partial<Channel> | null = null;
  let idx = 0;

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;

    if (line.startsWith("#EXTINF")) {
      const commaIdx = line.indexOf(",");
      const attrPart = commaIdx >= 0 ? line.slice(0, commaIdx) : line;
      const name = commaIdx >= 0 ? line.slice(commaIdx + 1).trim() : "Unknown";

      const getAttr = (key: string) => {
        const m = attrPart.match(new RegExp(`${key}="([^"]*)"`, "i"));
        return m?.[1];
      };

      current = {
        name,
        logo: getAttr("tvg-logo"),
        group: getAttr("group-title") || "Sem categoria",
        tvgId: getAttr("tvg-id"),
        country: getAttr("tvg-country"),
        language: getAttr("tvg-language"),
      };
    } else if (!line.startsWith("#") && current) {
      channels.push({
        id: `${idx++}-${current.tvgId || current.name}`,
        name: current.name || "Unknown",
        logo: current.logo,
        group: current.group,
        url: line,
        tvgId: current.tvgId,
        country: current.country,
        language: current.language,
      });
      current = null;
    }
  }
  return channels;
}
