export {};

declare global {
  interface Window {
    __CUBIXLES_P5__?: any;
    __CUBIXLES_P5_PROMISE__?: Promise<any>;
    __CUBIXLES_P5_INIT__?: boolean;
    __CUBIXLES_P5_LOADING__?: boolean;
    __CUBIXLES_P5_INSTANCE__?: any;
    __CUBIXLES_P5_SCRIPT__?: HTMLScriptElement;
    __CUBIXLES_TEST_HOOKS__?: boolean;
  }
}
