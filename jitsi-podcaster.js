// ==UserScript==
// @name Clean Jitsi in Tile Mode for Podcasting
// @icon https://www.google.com/s2/favicons?sz=64&domain=jitsi.org
// @version 0.6
// @downloadURL https://userscripts.codonaft.com/jitsi-podcaster.js
// ==/UserScript==

(_ => {
  'use strict';

  if (performance.getEntriesByType('navigation')[0]?.responseStatus !== 200) return;
  if (!document.head.querySelector('meta[itemprop="name"][content="Jitsi Meet"]')) return;

  const hide = node => node.style.display = 'none';

  const process = node => {
    if (node.nodeType !== 1) return;

    if (node.matches?.('div.details-container, div.bottom-indicators, a.watermark.leftwatermark[href="https://jitsi.org"]')) {
      hide(node);
      return;
    }

    if (node.matches?.('span.videocontainer.display-video')) {
      if (node.children.length >= 5) {
        [3, 4].forEach(i => hide(node.children[i]));
      }
      return;
    }

    node.childNodes.forEach(process);
  };

  const subscribeOnChanges = (node, f) => {
    f(node);
    new MutationObserver(mutations => mutations.forEach(m => m.addedNodes.forEach(f)))
      .observe(node, { childList: true, subtree: true });
  };

  subscribeOnChanges(document.body, process);
})();
