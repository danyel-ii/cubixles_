import { sdk } from "@farcaster/miniapp-sdk";

export async function notifyFarcasterReady() {
  if (!sdk?.isInMiniApp) {
    return;
  }
  const inMiniApp = await sdk.isInMiniApp().catch(() => false);
  if (!inMiniApp) {
    return;
  }
  if (sdk.actions?.ready) {
    try {
      await sdk.actions.ready();
    } catch (error) {
      void error;
    }
  }
}
