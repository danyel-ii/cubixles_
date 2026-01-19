export type MintAuditStep = {
  title: string;
  detail: string;
};

export type MintAuditMapping = {
  label: string;
  detail: string;
};

export type MintAuditReference = {
  label: string;
  url: string;
};

export type MintAuditHighlight = {
  label: string;
  value: string;
};

export const MINT_AUDIT = {
  tokenId: "68856407996780796028956744786520837137006152108154744843335376429330318427953",
  title: "cubixles_ #68856407996780796028956744786520837137006152108154744843335376429330318427953",
  tagline: "cubixles_ and curtains · remixed and cubed NFT mints",
  summary:
    "This mint pairs a p5.js cube viewer with a palette thumbnail and embeds citations from 1–6 NFTs you already own.",
  auditSteps: [
    {
      title: "Connect wallet",
      detail: "The mint UI reads your wallet to list the NFTs available for the cube.",
    },
    {
      title: "Select 1–6 NFTs",
      detail: "Each selected NFT becomes a face reference, grounding the new cube in existing provenance.",
    },
    {
      title: "Snapshot metadata & floors",
      detail: "Key metadata (and floor prices when available) are captured to become part of the cube's story; missing floors default to zero.",
    },
    {
      title: "Publish to IPFS",
      detail: "The interactive artwork and metadata are uploaded to IPFS so the token can reference a hosted experience.",
    },
    {
      title: "Sign the mint",
      detail: "You sign a direct ERC-721 mint on the chosen network; the metadata includes an external_url pointing to the cube.",
    },
  ] as MintAuditStep[],
  metadataHighlights: [
    {
      label: "Token narrative",
      value: "cubixles_ and curtains",
    },
    {
      label: "Description",
      value: "Mint cubixles_: NFTs linked to interactive p5.js artwork whose provenance is tethered to NFTs you already own.",
    },
  ] as MintAuditHighlight[],
  fees: "Mint: dynamic (base 0.0015 ETH) · Resale royalty: 5% (ERC-2981)",
  notes: "If floor data is unavailable we display 0; your NFT selection is embedded as provenance.",
  priceMechanic: "Mint cost rises as $LESS supply drops (read the economics at less.ripe.wtf/about).",
  externalUrl:
    "https://www.cubixles.xyz/m/68856407996780796028956744786520837137006152108154744843335376429330318427953",
  mappings: [
    {
      label: "Selection",
      detail: "1–6 NFTs from your wallet feed the cube faces, keeping the minted narrative tied to concrete citations.",
    },
    {
      label: "Snapshot",
      detail: "Metadata plus any available floor data snapshot is recorded before minting to capture provenance context.",
    },
    {
      label: "Composition",
      detail: "The cube viewer and palette thumbnail display the selected NFTs as a single material construct.",
    },
    {
      label: "Hosting",
      detail: "The minted metadata’s external_url points to the IPFS-hosted cube experience for future reference.",
    },
    {
      label: "On-chain",
      detail: "The ERC-721 includes the cube, the references, and a 5% resale royalty via ERC-2981.",
    },
  ] as MintAuditMapping[],
  references: [
    {
      label: "Full minting experience",
      url: "https://www.cubixles.xyz",
    },
    {
      label: "$LESS supply mechanics",
      url: "https://less.ripe.wtf/about",
    },
    {
      label: "Provenance spec",
      url: "https://github.com/danyel-ii/cubixles_-miniapp/blob/main/MASTER.md",
    },
  ] as MintAuditReference[],
} as const;
