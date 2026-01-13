export type ResolvedUri = {
  original: string;
  resolved: string;
};

export type NftItem = {
  chainId: number;
  contractAddress: string;
  tokenId: string;
  name: string | null;
  collectionName: string | null;
  tokenUri: ResolvedUri | null;
  image: ResolvedUri | null;
  metadataAvailable: boolean;
  source: "alchemy";
  collectionFloorEth?: number;
  collectionFloorRetrievedAt?: string | null;
};

export type ProvenanceNft = {
  chainId: number;
  contractAddress: string;
  tokenId: string;
  tokenUri: ResolvedUri | null;
  image: ResolvedUri | null;
  sourceMetadata: {
    raw: Record<string, unknown> | null;
  };
  retrievedVia: "alchemy";
  retrievedAt: string;
  collectionFloorEth?: number;
  collectionFloorRetrievedAt?: string | null;
};

export type ProvenanceBundle = {
  chainId: number;
  selectedBy: string;
  retrievedAt: string;
  nfts: ProvenanceNft[];
  floorSummary?: {
    sumFloorEth: number;
  };
};
