// ==UserScript==
// @name Disable YouTube Channel Intro
// @icon https://external-content.duckduckgo.com/ip3/youtube.com.ico
// @version 0.13
// @downloadURL https://userscripts.codonaft.com/disable-youtube-channel-intro.user.js
// @require https://userscripts.codonaft.com/utils.js
// @exclude https://www.youtube.com/watch?*
// @match https://www.youtube.com/*
// ==/UserScript==

(_ => {
'use strict';

if (performance.getEntriesByType('navigation')[0]?.responseStatus !== 200) return;

subscribeOnChanges(document.body, 'div#c4-player video, button.ytp-play-button[data-title-no-tooltip="Pause"]', (node, observer) => {
  observer.disconnect();
  node.click();

  const div = node.closest('div.html5-video-player');
  const videoId = div?.querySelector('a.ytp-title-link')?.getAttribute('href')?.split('?v=')[1];
  if (videoId) {
    const image = document.createElement('img');
    image.src = `https://i.ytimg.com/vi_webp/${videoId}/maxresdefault.webp`;
    image.style.width = '100%';
    image.style.height = 'auto';
    image.style.display = 'block';

    const link = document.createElement('a');
    link.href = `https://www.youtube.com/watch?v=${videoId}`;
    link.appendChild(image);

    div?.parentNode?.replaceChild(link, div);
  }

  return false;
});
})();
