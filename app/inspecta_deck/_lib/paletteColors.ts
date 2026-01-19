export type PaletteManifestEntry = {
  hex_colors?: string[];
  used_hex_colors?: string[];
};

const IGNORED_HEX = new Set(["#000000"]);

export function extractPaletteColors(entries: PaletteManifestEntry[] | null) {
  const colors = new Set<string>();
  if (!entries) {
    return [];
  }

  entries.forEach((entry) => {
    const list = [
      ...(entry.hex_colors ?? []),
      ...(entry.used_hex_colors ?? []),
    ];
    list.forEach((value) => {
      if (!value) {
        return;
      }
      const normalized = value.toUpperCase();
      if (IGNORED_HEX.has(normalized)) {
        return;
      }
      colors.add(normalized);
    });
  });

  return Array.from(colors);
}
