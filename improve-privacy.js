// ==UserScript==
// @name Improve Privacy
// @version 0.3
// @downloadURL https://userscripts.codonaft.com/improve-privacy.js
// ==/UserScript==

(() => {
  'use strict';

  const cleanup = node => {
    if (node.tagName !== 'A') return;

    const href = node.href;
    const youtube = href.startsWith('https://www.youtube.com/watch?') || href.startsWith('https://youtu.be/');
    const other = href.startsWith('https://maps.app.goo.gl/');
    if (!youtube && !other) return;

    const url = new URL(href);
    [...url.searchParams.keys()]
      .filter(k => other || k !== 'v')
      .forEach(k => url.searchParams.delete(k));

    const newHref = url.toString();
    if (newHref !== href) {
      node.href = newHref;
      if (node.innerText.trim() === href) {
        node.innerText = newHref;
      }
    }
  };

  const process = node => {
    if (node.nodeType !== 1) return;

    if (node.matches?.('span.style-scope.ytd-topbar-logo-renderer')) {
      node.style.display = 'none';
      return;
    }

    if (node.tagName === 'A') {
      cleanup(node);
    }
    node.childNodes.forEach(process);
  };

  const subscribeOnChanges = (node, f) => {
    f(node);
    new MutationObserver(mutations => mutations.forEach(m => m.addedNodes.forEach(process)))
      .observe(node, { childList: true, subtree: true });
  };

  subscribeOnChanges(document.body, process);
})();
