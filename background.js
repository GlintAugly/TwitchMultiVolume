browser.runtime.onMessage.addListener((msg) => {
  if (msg.type === "SAVE_VOLUME") {
    browser.storage.local.set({
      [msg.channel]: {
        volume: msg.volume,
        muted: msg.muted
      }
    });
  }
});
