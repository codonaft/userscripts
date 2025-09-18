// ==UserScript==
// @name Remove YouTube Popups
// @icon https://www.google.com/s2/favicons?sz=64&domain=youtube.com
// @version 0.1
// @downloadURL https://userscripts.codonaft.com/remove-youtube-popups.js
// @match https://www.youtube.com/*
// ==/UserScript==

(function() {
  'use strict';

  function randomPause() {
    const min = 3000;
    const max = 5000;
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  const process = (node, observer) => {
    if (node.nodeType !== 1) return;

    if (node.classList.contains('yt-spec-button-shape-next')) {
      setTimeout(function() {
        if (node.getAttribute('aria-label')?.includes('No thanks')) {
          node.click();
        }
      }, randomPause());
      observer.disconnect();
      return;
    } else if (node.classList.contains('ytd-single-option-survey-renderer')) {
      setTimeout(function() {
        if (node.getAttribute('icon')?.includes('yt-icons:close')) {
          node.click();
        }
      }, randomPause());
      return;
    } else if (node.tagName === 'DIV' && node.textContent.includes('My Ad Center')) {
      setTimeout(function() {
        node.querySelectorAll('button').forEach(i => {
          if (i.getAttribute('aria-label')?.includes('Close')) {
            i.click();
          }
        });
      }, randomPause());
      observer.disconnect();
      return;
    }

    node.childNodes.forEach(n => process(n, observer));
  };

  const subscribeOnChanges = (node, f) => {
    const observer = new MutationObserver(mutations => mutations.forEach(m => m.addedNodes.forEach(n => process(n, observer))));
    observer.observe(node, { childList: true, subtree: true });
    f(node, observer);
  };

  subscribeOnChanges(document.body, process);
})();
