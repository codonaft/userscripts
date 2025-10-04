// ==UserScript==
// @name Bypass Various Popups
// @version 0.9
// @downloadURL https://userscripts.codonaft.com/bypass-various-popups.js
// @match https://*.archive.org/*
// @match https://chat.deepseek.com/*
// @match https://chat.qwen.ai/*
// @match https://chatgpt.com/*
// @match https://hqporner.com/*
// @match https://pmvhaven.com/*
// @match https://www.cvedetails.com/*
// @match https://www.pornhub.com/*
// @match https://www.xvideos.com/*
// @match https://xhamster.com/*
// ==/UserScript==

(_ => {
  'use strict';

  if (performance.getEntriesByType('navigation')[0]?.responseStatus !== 200) return;

  const randomPause = (min, max) => Math.floor(Math.random() * (max - min + 1) + min);

  const process = (node, observer) => {
    if (node.nodeType !== 1) return;

    if (node.matches?.('div[role=dialog]')) {
      setTimeout(_ => {
        node.querySelectorAll('button[aria-label="close"]').forEach(i => i.click());
        node.querySelectorAll('button.btn').forEach(i => {
          if (i.textContent.includes('Not now')) {
            i.click();
          }
        });
        node.querySelectorAll('a').forEach(i => {
          if (i.textContent.includes('Stay logged out')) {
            i.click();
          }
        });
      }, randomPause(1000, 1500));
      observer.disconnect();
      return;
    }

    if (node.matches?.('div.age-popup-btns > #okButton') && node.textContent.includes('18 or older')) {
      observer.disconnect();
      node.click();
      return;
    }

    if (node.tagName === 'SPAN' && node.parentElement?.tagName === 'BUTTON' && node.textContent.includes('Continue without disabling')) {
      observer.disconnect();
      node.parentElement.click();
      return;
    }

    if (node.matches?.('div#credential_picker_container')) {
      node.style.display = 'none';
      return;
    }

    if (node.tagName === 'BUTTON' && (node.getAttribute('data-role') === 'parental-control-confirm-button' || node.textContent.includes('Stay logged out'))) {
      setTimeout(_ => node.click(), randomPause(1000, 1500));
      return;
    }

    if (node.matches?.('div#cookie-banner')) {
      observer.disconnect();
      node.querySelector('a#accept-essential')?.click();
      return;
    }

    if (node.matches?.('button[role="button"] > span') && node.textContent === 'Continue') {
      node.closest('button')?.click();
      return;
    }

    if (node.matches?.('#cookieconsentwarningcontainer, #donate_banner')) {
      observer.disconnect();
      node.parentNode?.removeChild(node);
      return;
    }

    if (node.matches?.('#modalWrapMTubes')) {
      observer.disconnect();
      setTimeout(
        _ => node.querySelectorAll('div > div > button').forEach(i => i.click()),
        randomPause(100, 400)
      );
      return;
    }

    if (node.matches?.('div.disclaimer_message')) {
      observer.disconnect();
      node.querySelectorAll('span').forEach(i => {
        if (i.textContent.includes('I am 18 years')) {
          i?.closest('button').click();
        }
      });
      return;
    }

    node.childNodes.forEach(n => process(n, observer));
  };

  const subscribeOnChanges = (node, f) => {
    const observer = new MutationObserver(mutations => mutations.forEach(m => m.addedNodes.forEach(n => f(n, observer))));
    observer.observe(node, { childList: true, subtree: true });
    f(node, observer);
  };

  subscribeOnChanges(document.body, process);
})();
