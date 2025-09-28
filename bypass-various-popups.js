// ==UserScript==
// @name Bypass Various Popups
// @version 0.1
// @downloadURL https://userscripts.codonaft.com/bypass-various-popups.js
// @match https://*.archive.org/*
// @match https://chat.qwen.ai/*
// @match https://chatgpt.com/*
// @match https://pmvhaven.com/*
// @match https://www.cvedetails.com/*
// @match https://www.pornhub.com/*
// @match https://xhamster.com/*
// ==/UserScript==

(() => {
  'use strict';

  if (performance.getEntriesByType('navigation')[0]?.responseStatus !== 200) return;

  const randomPause = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

  const process = (node, observer) => {
    if (node.nodeType !== 1) return;

    if (['A', 'BUTTON'].includes(node.tagName) && node.innerText.includes('Stay logged out')) {
      setTimeout(() => node.click(), randomPause(1000, 1500));
      return;
    }

    if (node.matches?.('div[role=dialog]')) {
      setTimeout(() => {
        node.querySelectorAll('button[aria-label="close"]').forEach(i => i.click());
        node.querySelectorAll('button.btn').forEach(i => {
          if (i.innerText.includes('Not now')) {
            i.click();
          }
        });
      }, randomPause(1000, 1500));
      observer.disconnect();
      return;
    }

    if (node.tagName === 'SPAN' && node.parentElement?.tagName === 'BUTTON' && node.textContent.includes('Continue without disabling')) {
      observer.disconnect();
      node.parentElement.click();
      return;
    }

    if (node.matches?.('div#credential_picker_container')) {
      node.style.display = 'none'
      return;
    }

    if (node.tagName === 'BUTTON' && node.getAttribute('data-role') === 'parental-control-confirm-button') {
      node.click();
      return;
    }

    if (node.matches?.('#cookieconsentwarningcontainer, #donate_banner')) {
      observer.disconnect();
      node.parentNode?.removeChild(node);
      return;
    }

    if (node.matches?.('#modalWrapMTubes')) {
      observer.disconnect();
      document.body.querySelectorAll('#modalWrapMTubes > div > div > button').forEach(i => i.click());
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
