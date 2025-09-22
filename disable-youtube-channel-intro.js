// ==UserScript==
// @name Disable YouTube Channel Intro
// @icon https://www.google.com/s2/favicons?sz=64&domain=youtube.com
// @version 0.1
// @downloadURL https://userscripts.codonaft.com/disable-youtube-channel-intro.js
// @match https://www.youtube.com/@*
// @match https://www.youtube.com/channel/*
// ==/UserScript==

(function() {
  'use strict';

  const process = (node, observer) => {
    if (node.nodeType !== 1 || node.tagName !== 'BUTTON' || !node.classList.contains('ytp-play-button') || node.getAttribute('data-title-no-tooltip') === 'Play') return;

    node.click();
    observer.disconnect();
  };

  const subscribeOnChanges = (node, f) => {
    const observer = new MutationObserver(mutations => mutations.forEach(m => m.addedNodes.forEach(n => process(n, observer))));
    observer.observe(node, { childList: true, subtree: true });
    f(node, observer);
  };

  subscribeOnChanges(document.body, process);
})();
