// ==UserScript==
// @name Clean Jitsi in Tile Mode for Podcasting
// @icon https://external-content.duckduckgo.com/ip3/jitsi.org.ico
// @version 0.14
// @downloadURL https://userscripts.codonaft.com/jitsi-podcaster.user.js
// ==/UserScript==

(_ => {
'use strict';

if (performance.getEntriesByType('navigation')[0]?.responseStatus !== 200) return;
if (!document.head?.querySelector('meta[itemprop="name"][content="Jitsi Meet"]')) return;
const b = document.body;
if (!b) return;

const hiddenNodes = 'a.watermark.leftwatermark[href="https://jitsi.org"], div.audioindicator-container, div.bottom-indicators, div.details-container';
const someHiddenNodes = 'span.videocontainer';

const hide = node => node.style.display = 'none';

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

const err = (e, node) => {
  console.log(node);
  console.error(e);
};

subscribeOnChanges(b, `${hiddenNodes}, ${someHiddenNodes}`, (node, _observer) => {
  if (node.matches(hiddenNodes)) {
    hide(node);
    return false;
  }

  if (node.matches(someHiddenNodes)) {
    if (node.classList.contains('display-video') && node.children.length >= 5) {
      [3, 4].forEach(i => hide(node.children[i]));
    }

    const classList = node.classList || [];
    const activeSpeaker = [...classList].find(i => i.endsWith('-activeSpeaker'));
    if (activeSpeaker) {
      node.classList.remove(activeSpeaker);
    }

    return false;
  }

  return true;
});
})();
