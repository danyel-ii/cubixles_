export type ResolvedUri = {
  original: string;
  resolved: string;
};

export type NftItem = {
  chainId: 11155111;
  contractAddress: string;
  tokenId: string;
  name: string | null;
  collectionName: string | null;
  tokenUri: ResolvedUri | null;
  image: ResolvedUri | null;
  source: "alchemy";
  collectionFloorEth?: number;
  collectionFloorRetrievedAt?: string | null;
};

export type ProvenanceNft = {
  chainId: 11155111;
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
  chainId: 11155111;
  selectedBy: string;
  retrievedAt: string;
  nfts: ProvenanceNft[];
  floorSummary?: {
    sumFloorEth: number;
  };
};
