let currentVideo = null;
let lastChannel = null;

/* ========= ユーティリティ ========= */

function getChannelName() {
  const match = location.pathname.match(/^\/([^/?]+)/);
  if (!match) return null;

  const channel = match[1].toLowerCase();

  // Twitchの非チャンネルURL除外
  if (["directory", "videos", "clips"].includes(channel)) {
    return null;
  }

  return channel;
}

function findTwitchVideo() {
  return document.querySelector("video");
}

function findVolumeSlider() {
  return document.querySelector(
    '[data-a-target="player-volume-slider"]'
  );
}

function setVolumeViaUI(volume) {
  const slider = findVolumeSlider();
  if (!slider) return false;

  slider.value = volume;

  slider.dispatchEvent(new Event("input", { bubbles: true }));
  slider.dispatchEvent(new Event("change", { bubbles: true }));

  console.log("volume set :%f", volume);
  return true;
}

function findMuteButton() {
  return document.querySelector(
    '[data-a-target="player-mute-unmute-button"]'
  );
}

function setMutedViaUI(muted) {
  const button = findMuteButton();
  if (!button) return false;

  const isMuted = button.getAttribute("aria-label")?.includes("ミュート解除")
                || button.getAttribute("aria-label")?.includes("Unmute");

  if (muted !== isMuted) {
    button.click();
  }

  return true;
}

/* ========= 保存 ========= */

function saveVolume(video) {
  const channel = getChannelName();
  if (!channel) return;

  browser.runtime.sendMessage({
    type: "SAVE_VOLUME",
    channel,
    volume: video.volume,
    muted: video.muted
  });
  console.log("volume Saved! channel:%s volume;%f", channel, video.volume);
}

/* ========= 復元 ========= */

async function restoreVolume(video) {
  const channel = getChannelName();
  if (!channel) return;

  const result = await browser.storage.local.get(channel);
  const saved = result?.[channel];
  if (!saved) return;

  // UI経由で反映（成功すればvideo操作は不要）
  const uiVolumeApplied = setVolumeViaUI(saved.volume);
  const uiMuteApplied   = setMutedViaUI(saved.muted);

  // フォールバック（UIがまだ無い場合）
  if (!uiVolumeApplied) {
    console.log("fallback volume set :%f", saved.volume);
    video.volume = saved.volume;
  }
  if (!uiMuteApplied) {
    video.muted = saved.muted;
  }
}


/* ========= イベント登録 ========= */

function attachVideoListeners(video) {
  const channel = getChannelName();
  if (!channel) return;

  if (video.__twitchVolumeHandledFor === channel) {
    return;
  }

  video.__twitchVolumeHandledFor = channel;

  restoreVolume(video);

  if (!video.__twitchVolumeListenerAttached) {
    video.__twitchVolumeListenerAttached = true;

    video.addEventListener("volumechange", () => {
      saveVolume(video);
    });
  }
}

/* ========= video差し替え & SPA対応 ========= */

function checkVideoChanged() {
  const channel = getChannelName();
  const video = findTwitchVideo();

  if (!video || !channel) return;

  if (video !== currentVideo || channel !== lastChannel) {
    currentVideo = video;
    lastChannel = channel;
    attachVideoListeners(video);
  }
}

/* ========= MutationObserver ========= */

const observer = new MutationObserver(() => {
  checkVideoChanged();
});

observer.observe(document.body, {
  childList: true,
  subtree: true
});

/* ========= URL変更検知 ========= */

let lastUrl = location.href;
setInterval(() => {
  if (location.href !== lastUrl) {
    lastUrl = location.href;
    currentVideo = null;
    lastChannel = null;
    checkVideoChanged();
  }
}, 500);

/* ========= 初回実行 ========= */

checkVideoChanged();
