import { DEFAULT_IPFS_GATEWAY } from "src/shared/uri-policy.js";

export const config = {
  sourceUrls: [
    "https://arweave.net/whvEaj6v8B1jyR0jXzmtGyHxKm55GdienjjWlx38bpk",
    "ipfs://bafybeifn4fxn52lupflqnbkknv3koztzmmkm4ycfnaxezfevgh3nkvynl4",
    "ipfs://bafybeifn4fxn52lupflqnbkknv3koztzmmkm4ycfnaxezfevgh3nkvynl4",
    "ipfs://bafybeifn4fxn52lupflqnbkknv3koztzmmkm4ycfnaxezfevgh3nkvynl4",
    "ipfs://bafybeifn4fxn52lupflqnbkknv3koztzmmkm4ycfnaxezfevgh3nkvynl4",
    "ipfs://bafybeifn4fxn52lupflqnbkknv3koztzmmkm4ycfnaxezfevgh3nkvynl4",
  ],
  ipfsGateway: DEFAULT_IPFS_GATEWAY,
  backgroundUrl: "/assets/bg_1.png",
  cubeSize: 220,
  zoom: {
    initial: 520,
    min: 260,
    max: 900,
  },
  textureMaxSize: {
    desktop: 1024,
    mobile: 768,
  },
};
