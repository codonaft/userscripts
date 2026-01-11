// ==UserScript==
// @name Disable Embedded YouTube Videos
// @icon https://external-content.duckduckgo.com/ip3/youtube.com.ico
// @version 0.1
// @downloadURL https://userscripts.codonaft.com/disable-embedded-youtube-videos.user.js
// ==/UserScript==

(_ => {
'use strict';

const PROXY = 'https://wsrv.nl/?url=';
// const PROXY = 'https://imgproxy.nosotros.app/_/feed_img/plain/';

if (performance.getEntriesByType('navigation')[0]?.responseStatus !== 200) return;

const imageURL = url => {
  if (!PROXY) return url;
  return `${PROXY}${encodeURIComponent(url)}`;
};

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
  node.querySelectorAll(selector).forEach(i => apply(i, observer));
};

subscribeOnChanges(document.body, 'iframe[src^="https://www.youtube.com/"], iframe[src^="https://www.youtube-nocookie.com/embed/"]', node => {
  const src = node.getAttribute('src');
  const videoId = src.split('?v=')[1] || src.split('/embed/')[1];
  if (videoId) {
    const image = document.createElement('img');
    image.src = imageURL(`https://i.ytimg.com/vi_webp/${videoId}/maxresdefault.webp`);
    image.style.width = '100%';
    image.style.height = 'auto';
    image.style.display = 'block';

    const link = document.createElement('a');
    link.href = `https://www.youtube.com/watch?v=${videoId}`;
    link.appendChild(image);

    node.parentNode.replaceChild(link, node);
  }

  return false;
});

const err = (e, node) => {
  console.log(node);
  console.error(e);
};
})();
