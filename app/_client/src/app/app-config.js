import { DEFAULT_IPFS_GATEWAY } from "src/shared/uri-policy.js";

const DEFAULT_CUBE_TEXTURE = "/assets/default-cube.svg";

export const config = {
  sourceUrls: [DEFAULT_CUBE_TEXTURE],
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
