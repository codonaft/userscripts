// ==UserScript==
// @name Bypass YouTube Popups
// @icon https://external-content.duckduckgo.com/ip3/youtube.com.ico
// @version 0.7
// @downloadURL https://userscripts.codonaft.com/bypass-youtube-popups.user.js
// @match https://www.youtube.com/*
// ==/UserScript==

(_ => {
'use strict';

if (performance.getEntriesByType('navigation')[0]?.responseStatus !== 200) return;

const randomPause = _ => {
  const min = 3000;
  const max = 5000;
  return Math.floor(Math.random() * (max - min + 1) + min);
};

const process = (node, observer) => {
  if (node.classList.contains('yt-spec-button-shape-next')) {
    setTimeout(_ => {
      if (node.getAttribute('aria-label')?.includes('No thanks')) {
        node.click();
      }
    }, randomPause());
    observer.disconnect();
    return false;
  } else if (node.classList.contains('ytd-single-option-survey-renderer')) {
    setTimeout(_ => {
      if (node.getAttribute('icon')?.includes('yt-icons:close')) {
        node.click();
      }
    }, randomPause());
    return false;
  } else if (node.tagName === 'DIV' && node.textContent?.includes('My Ad Center')) {
    setTimeout(_ => {
      node.querySelectorAll('button').forEach(i => {
        if (i.getAttribute('aria-label')?.includes('Close')) {
          i.click();
        }
      });
    }, randomPause());
    observer.disconnect();
    return false;
  }

  return true;
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
  apply(node, observer);
};

const err = (e, node) => {
  console.log(node);
  console.error(e);
};

subscribeOnChanges(document.body, 'button, div, span', process);
})();
