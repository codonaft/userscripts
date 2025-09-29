// ==UserScript==
// @name Disable YouTube Channel Intro
// @icon https://www.google.com/s2/favicons?sz=64&domain=youtube.com
// @version 0.4
// @downloadURL https://userscripts.codonaft.com/disable-youtube-channel-intro.js
// @match https://www.youtube.com/@*
// @match https://www.youtube.com/channel/*
// ==/UserScript==

(_ => {
  'use strict';

  if (performance.getEntriesByType('navigation')[0]?.responseStatus !== 200) return;

  const process = (node, observer) => {
    if (node.nodeType !== 1 || node.tagName !== 'BUTTON' || !node.classList.contains('ytp-play-button') || node.getAttribute('data-title-no-tooltip') === 'Play') return;

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
  };

  const subscribeOnChanges = (node, f) => {
    const observer = new MutationObserver(mutations => mutations.forEach(m => m.addedNodes.forEach(n => process(n, observer))));
    observer.observe(node, { childList: true, subtree: true });
    f(node, observer);
  };

  subscribeOnChanges(document.body, process);
})();
