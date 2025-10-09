// ==UserScript==
// @name Clean Jitsi in Tile Mode for Podcasting
// @icon https://www.google.com/s2/favicons?sz=64&domain=jitsi.org
// @version 0.8
// @downloadURL https://userscripts.codonaft.com/jitsi-podcaster.user.js
// ==/UserScript==

// TODO: remove frame and mic animation dots

'use strict';

if (performance.getEntriesByType('navigation')[0]?.responseStatus !== 200) return;
if (!document.head?.querySelector('meta[itemprop="name"][content="Jitsi Meet"]')) return;
const b = document.body;
if (!b) return;

const hiddenNodes = 'div.details-container, div.bottom-indicators, a.watermark.leftwatermark[href="https://jitsi.org"]';
const someHiddenNodes = 'span.videocontainer.display-video';

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

const err = (e, node) => {
  console.log(node);
  console.error(e);
};

subscribeOnChanges(document.body, `${hiddenNodes}, ${someHiddenNodes}`, (node, _observer) => {
  if (node.matches(hiddenNodes)) {
    hide(node);
    return false;
  }

  if (node.matches(someHiddenNodes)) {
    if (node.children.length >= 5) {
      [3, 4].forEach(i => hide(node.children[i]));
    }
    return false;
  }

  return true;
});
