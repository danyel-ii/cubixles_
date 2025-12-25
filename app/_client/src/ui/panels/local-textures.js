import { state } from "../../app/app-state.js";
import { fillFaceTextures } from "../../app/app-utils.js";

export function initLocalTextureUi() {
  const input = document.getElementById("image-input");
  if (!input) {
    return;
  }
  input.addEventListener("change", (event) => {
    const files = Array.from(event.target.files || []).slice(0, 6);
    if (files.length === 0) {
      state.faceTextures = fillFaceTextures(state.defaultTextures);
      state.selectedDataUrls = [];
      return;
    }
    loadLocalTextures(files);
  });
}

function loadLocalTextures(files) {
  state.isLoadingLocal = true;
  const promises = files.map((file) =>
    readFileAsDataUrl(file).then((dataUrl) => {
      if (!dataUrl) {
        return { img: null, dataUrl: null };
      }
      return new Promise((resolve) => {
        loadImage(
          dataUrl,
          (img) => resolve({ img, dataUrl }),
          () => resolve({ img: null, dataUrl: null })
        );
      });
    })
  );

  Promise.all(promises).then((results) => {
    const filtered = results.filter((result) => result.img);
    if (filtered.length > 0) {
      state.faceTextures = fillFaceTextures(filtered.map((result) => result.img));
      state.selectedDataUrls = filtered.map((result) => result.dataUrl);
    } else {
      state.faceTextures = fillFaceTextures(state.defaultTextures);
      state.selectedDataUrls = [];
    }
    state.isLoadingLocal = false;
  });
}

function readFileAsDataUrl(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(file);
  });
}
