export type FaceId = "+X" | "-X" | "+Y" | "-Y" | "+Z" | "-Z";

export type FaceDefinition = {
  id: FaceId;
  title: string;
  hash: string;
  description: string;
  palette: {
    fill: string;
    border: string;
    accent: string;
  };
};

export const FACE_REGISTRY: FaceDefinition[] = [
  {
    id: "+Z",
    title: "Reference A · Prism Block",
    hash: "f3a9d2c1",
    description: "a twilight collage of mid-century motion studies and low-res light leaks.",
    palette: {
      fill: "#0f1115",
      border: "#c8c6ff",
      accent: "#ff95d6",
    },
  },
  {
    id: "+X",
    title: "Reference B · Argenta Steps",
    hash: "b7f1a0e4",
    description: "glitched type studies that once drifted through early NFT zines.",
    palette: {
      fill: "#11131a",
      border: "#7ef1ff",
      accent: "#ffde5b",
    },
  },
  {
    id: "-X",
    title: "Reference C · Loom Coil",
    hash: "d4e63f02",
    description: "archival weaves that honor the markets feeding every assembly.",
    palette: {
      fill: "#0b0d11",
      border: "#ffb56c",
      accent: "#9af4ff",
    },
  },
  {
    id: "+Y",
    title: "Reference D · Lightgrid",
    hash: "e5a04a77",
    description: "the palette of luminous minted glyphs that keep echoing across faces.",
    palette: {
      fill: "#14161f",
      border: "#ff9ac8",
      accent: "#a7ffbd",
    },
  },
  {
    id: "-Y",
    title: "Reference E · Ground",
    hash: "f0b2d5c8",
    description: "canonical metadata that refuses to abstract the pieces it borrows.",
    palette: {
      fill: "#060708",
      border: "#9af4ff",
      accent: "#ffbd6d",
    },
  },
  {
    id: "-Z",
    title: "Reference F · Echo Mask",
    hash: "c1d9b3e5",
    description: "whispered provenance that insists its sources remain visible.",
    palette: {
      fill: "#0f1013",
      border: "#ffed93",
      accent: "#7fffdc",
    },
  },
];

export const CANONICAL_FACE_ORDER: FaceId[] = ["+X", "-X", "+Y", "-Y", "+Z", "-Z"];

export const CANONICAL_OWNERSHIP_HISTORY = [
  "0x4fea -> 0x2d5b",
  "0x2d5b -> 0x9b7c",
  "0x9b7c -> 0xef12",
];

export const CANONICAL_OWNERSHIP_NOTE =
  "Custody history is tidy, but it only records who signed what; it does not encode why.";
