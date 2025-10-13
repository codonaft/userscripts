// ==UserScript==
// @name Disable YouTube Channel Intro
// @icon https://external-content.duckduckgo.com/ip3/youtube.com.ico
// @version 0.9
// @downloadURL https://userscripts.codonaft.com/disable-youtube-channel-intro.user.js
// @match https://www.youtube.com/@*
// @match https://www.youtube.com/channel/*
// ==/UserScript==

(_ => {
'use strict';

if (performance.getEntriesByType('navigation')[0]?.responseStatus !== 200) return;

const subscribeOnChanges = (node, selector, f) => {
  const apply = (node, observer) => {
    if (node?.nodeType !== 1) return;

    let observeChildren = true;
    if (node?.matches?.(selector)) {
      try {
        observeChildren = f(node, observer);
      } catch (e) {
        err(e, node);
        if (e.name === 'SecurityError') {
          console.log('disconnect observer');
          observer.disconnect();
          return;
        }
      }
    }

    if (observeChildren) {
      const children = node?.childNodes || [];
      children.forEach(i => apply(i, observer));
    }
  };

  const observer = new MutationObserver(mutations => mutations.forEach(m => m.addedNodes.forEach(i => apply(i, observer))));
  observer.observe(node, { childList: true, subtree: true });
  apply(node, observer);
};

subscribeOnChanges(document.body, 'button.ytp-play-button[data-title-no-tooltip="Pause"]', (node, observer) => {
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

    div?.parentNode.replaceChild(link, div);
  }

  return false;
});

const err = (e, node) => {
  console.log(node);
  console.error(e);
};
})();
