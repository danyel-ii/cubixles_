import { Buffer } from "buffer";
import { registerAppLifecycle } from "./app/app-lifecycle.js";

if (!globalThis.Buffer) {
  globalThis.Buffer = Buffer;
}

registerAppLifecycle();
