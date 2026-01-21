(() => {
  const viewer = document.querySelector(".paper-viewer");
  const cubeLink = document.querySelector(".paper-cube-link");
  if (!viewer || !cubeLink) {
    return;
  }
  let active = false;
  let startX = 0;
  let startY = 0;
  let startRotX = 0;
  let startRotY = 0;
  let rotX = Number.parseFloat(viewer.dataset.rotX || "0");
  let rotY = Number.parseFloat(viewer.dataset.rotY || "0");
  if (!Number.isFinite(rotX)) {
    rotX = 0;
  }
  if (!Number.isFinite(rotY)) {
    rotY = 0;
  }
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const updateVars = () => {
    viewer.style.setProperty("--cube-user-x", `${rotX}deg`);
    viewer.style.setProperty("--cube-user-y", `${rotY}deg`);
  };
  const onMove = (event) => {
    if (!active) {
      return;
    }
    const dx = event.clientX - startX;
    const dy = event.clientY - startY;
    rotX = clamp(startRotX + dy * 0.35, -80, 80);
    rotY = startRotY + dx * 0.45;
    updateVars();
  };
  cubeLink.addEventListener("pointerdown", (event) => {
    active = true;
    startX = event.clientX;
    startY = event.clientY;
    startRotX = rotX;
    startRotY = rotY;
    if (cubeLink.setPointerCapture) {
      cubeLink.setPointerCapture(event.pointerId);
    }
  });
  window.addEventListener("pointermove", onMove, { passive: true });
  window.addEventListener("pointerup", () => {
    active = false;
  });
  window.addEventListener("pointercancel", () => {
    active = false;
  });
  updateVars();
})();
