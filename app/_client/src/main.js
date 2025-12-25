import { Buffer } from "buffer";
import { registerAppLifecycle } from "./app/app-lifecycle.js";
import { initTokenViewRoute } from "./routes/token-view.js";

if (!globalThis.Buffer) {
  globalThis.Buffer = Buffer;
}

registerAppLifecycle();
initTokenViewRoute();
