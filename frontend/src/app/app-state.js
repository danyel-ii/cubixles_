import { config } from "./app-config.js";

export const state = {
  defaultTextures: [],
  faceTextures: [],
  isLoadingLocal: false,
  selectedDataUrls: [],
  frostedTexture: null,
  textureCache: new Map(),
  nftInventory: [],
  nftSelection: [],
  nftStatus: "idle",
  nftError: null,
  bgImage: null,
  bgImageDataUrl: null,
  rotX: -0.35,
  rotY: 0.65,
  zoom: config.zoom.initial,
  backdrop: null,
  edgePasses: [],
  lastMouse: null,
  pinchStartDist: null,
  pinchStartZoom: null,
};
