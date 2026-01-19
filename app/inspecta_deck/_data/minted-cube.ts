import type { FaceId } from "./landing-provenance";
import { MINT_AUDIT } from "./mint-audit";

export type NftMedia = {
  image: string | null;
  animation: string | null;
  imageCandidates: string[];
  animationCandidates: string[];
};

export type CubeProvenanceNFT = {
  faceId: FaceId;
  title: string;
  collection: string;
  tokenId: string;
  contractAddress?: string;
  chainId?: number;
  ownerNote: string;
  description: string;
  explorerUrl: string;
  metadataUrl?: string;
  media?: NftMedia;
};

export type MintedCube = {
  tokenId: string;
  tokenViewUrl: string;
  mintedAt: string;
  mintedBy: string;
  network: string;
  description: string;
  provenanceNote: string;
  references: { label: string; url: string }[];
  provenanceNFTs: CubeProvenanceNFT[];
  provenanceTrail: {
    title: string;
    detail: string;
    reference?: { label: string; url: string };
  }[];
  media?: NftMedia;
};

export const CUBIXLES_MINTED_CUBES: Record<string, MintedCube> = {
  [MINT_AUDIT.tokenId]: {
    tokenId: MINT_AUDIT.tokenId,
    tokenViewUrl:
      "https://www.cubixles.xyz/m/68856407996780796028956744786520837137006152108154744843335376429330318427953",
    mintedAt: "2024-11-14",
    mintedBy: "cubixles_ + curtains",
    network: "Ethereum Mainnet",
    description:
      "The cube pairs the new mint with six curated NFT faces, each contributing a specific palette, lineage, and citation to the cubixles_ provenance narrative.",
    provenanceNote:
      "Each face is drawn from the cubixles_ reference registry and pinned to on-chain artifacts so the cube can be rehydrated with precise citations.",
    references: [
      {
        label: "Token view on cubixles.xyz",
        url: "https://www.cubixles.xyz/m/68856407996780796028956744786520837137006152108154744843335376429330318427953",
      },
      {
        label: "Spec + provenance journal",
        url: "https://github.com/danyel-ii/cubixles_-miniapp/blob/main/MASTER.md",
      },
      {
        label: "Ping metadata snapshot",
        url: "https://ipfs.io/ipfs/QmPrismCubeSnapshot68856407996780796028956744786520837137006152108154744843335376429330318427953",
      },
    ],
    provenanceNFTs: [
      {
        faceId: "+Z",
        title: "Reference A · Prism Block",
        collection: "Prism Block Archive",
        tokenId: "1122",
        ownerNote: "Captured from @archaicgrid (0x5fea) → cubixles_ (0x4fea)",
        description:
          "A twilight collage of motion studies lifted from 1970s design labs and reinforced with analog light leaks.",
        explorerUrl: "https://opensea.io/assets/ethereum/0xae12bedfef/1122",
        metadataUrl: "https://ipfs.io/ipfs/QmPrismBlock1122",
      },
      {
        faceId: "+X",
        title: "Reference B · Argenta Steps",
        collection: "Argenta Steps Series",
        tokenId: "8472",
        ownerNote: "Minted to 0x2d5b during the Neon Stair drop",
        description:
          "Glitched type studies from domestic zines, now preserved in a mirrored palette for pegging new cube faces.",
        explorerUrl: "https://opensea.io/assets/ethereum/0xfed4a339/8472",
        metadataUrl: "https://ipfs.io/ipfs/QmArgenta8472",
      },
      {
        faceId: "-X",
        title: "Reference C · Loom Coil",
        collection: "Loom Coil Loomworks",
        tokenId: "1934",
        ownerNote: "Current holder 0x9b7c supplied the reference metadata",
        description:
          "Archival weaves that honor the markets feeding every assembly, rendered for the cube’s depth axis.",
        explorerUrl: "https://opensea.io/assets/ethereum/0xabcd3210/1934",
        metadataUrl: "https://ipfs.io/ipfs/QmLoomCoil1934",
      },
      {
        faceId: "+Y",
        title: "Reference D · Lightgrid",
        collection: "Lightgrid Lumens",
        tokenId: "5601",
        ownerNote: "Signed by the Lightgrid guild (0xef12) before the cube balance test",
        description:
          "Luminous glyphs from the Lightgrid drop, now composited to outline the cube’s vertical axis.",
        explorerUrl: "https://opensea.io/assets/ethereum/0xfedcba98/5601",
        metadataUrl: "https://ipfs.io/ipfs/QmLightgrid5601",
      },
      {
        faceId: "-Y",
        title: "Reference E · Ground",
        collection: "Groundfloor Bloc",
        tokenId: "753",
        ownerNote: "Gifted by 0x7a9f after the Groundfloor residency",
        description:
          "Canonical metadata published with the cube contrasts the low-res surface with solid earth tones.",
        explorerUrl: "https://opensea.io/assets/ethereum/0xfedc0ffe/753",
        metadataUrl: "https://ipfs.io/ipfs/QmGround753",
      },
      {
        faceId: "-Z",
        title: "Reference F · Echo Mask",
        collection: "Echo Mask Rituals",
        tokenId: "4410",
        ownerNote: "Looped through the Echo Mask ritual before merging with the cube",
        description:
          "Whispered provenance that insists its sources remain visible, now layered as the cube’s back face.",
        explorerUrl: "https://opensea.io/assets/ethereum/0xdecafbad/4410",
        metadataUrl: "https://ipfs.io/ipfs/QmEchoMask4410",
      },
    ],
    provenanceTrail: [
      {
        title: "Selection & citation",
        detail:
          "1–6 NFTs from the wallet become references, each assigned to a cube face according to the lumens and citations they provide.",
        reference: {
          label: "Mint spec",
          url: "https://github.com/danyel-ii/cubixles_-miniapp/blob/main/MASTER.md",
        },
      },
      {
        title: "Snapshot lineage",
        detail:
          "Metadata and floor data snapshot actions log both the creative lineage and the signed activity that formed the cube’s composition.",
        reference: {
          label: "Metadata snapshot",
          url: "https://ipfs.io/ipfs/QmPrismCubeSnapshot68856407996780796028956744786520837137006152108154744843335376429330318427953",
        },
      },
      {
        title: "Composition & publishing",
        detail:
          "The cube viewer reels the six faces back into a single proof-of-work, then pins the experience to IPFS before minting.",
        reference: {
          label: "Gallery link",
          url: "https://www.cubixles.xyz/m/68856407996780796028956744786520837137006152108154744843335376429330318427953",
        },
      },
      {
        title: "On-chain sealing",
        detail:
          "An ERC-721 mint includes the cube snapshot, references, and a 5% resale royalty with ERC-2981 so secondary trades continue to document provenance.",
      },
    ],
  },
};

export const CUBIXLES_MINTED_TOKEN_ALIASES: Record<string, string> = {
  "1": MINT_AUDIT.tokenId,
};

export function getMintedCube(tokenId?: string) {
  if (!tokenId) {
    return null;
  }
  const canonicalId = CUBIXLES_MINTED_TOKEN_ALIASES[tokenId] ?? tokenId;
  return CUBIXLES_MINTED_CUBES[canonicalId] ?? null;
}

export function getAllMintedCubes() {
  return Object.values(CUBIXLES_MINTED_CUBES);
}
