// ==UserScript==
// @name Remove Various Popups
// @version 0.1
// @downloadURL https://userscripts.codonaft.com/remove-various-popups.js
// @match https://*.archive.org/*
// @match https://chat.qwen.ai/*
// @match https://chatgpt.com/*
// @match https://pmvhaven.com/*
// @match https://www.cvedetails.com/*
// ==/UserScript==

(function() {
  'use strict';

  function randomPause() {
    const min = 1000;
    const max = 1500;
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  const process = (node, observer) => {
    if (node.nodeType !== 1) return;

    if (node.matches?.('div[role=dialog]')) {
      setTimeout(function() {
        node.querySelectorAll('button[aria-label="close"]').forEach(i => i.click());
        node.querySelectorAll('button.btn').forEach(i => {
          if (i.innerText.includes('Not now')) {
            i.click();
          }
        });
      }, randomPause());
      observer.disconnect();
      return;
    } else if (['A', 'BUTTON'].includes(node.tagName) && node.innerText.includes('Stay logged out')) {
      node.click();
      return;
    } else if (node.tagName === 'SPAN' && node.parentElement?.tagName === 'BUTTON' && node.textContent.includes('Continue without disabling')) {
      observer.disconnect();
      node.parentElement.click();
      return;
    } else if (node.matches?.('#cookieconsentwarningcontainer, #donate_banner')) {
      observer.disconnect();
      node.parentNode?.removeChild(node);
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
