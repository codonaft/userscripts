// ==UserScript==
// @name Bypass YouTube Popups
// @icon https://external-content.duckduckgo.com/ip3/youtube.com.ico
// @version 0.9
// @downloadURL https://userscripts.codonaft.com/bypass-youtube-popups.user.js
// @require https://userscripts.codonaft.com/utils.js
// @match https://www.youtube.com/*
// ==/UserScript==

(_ => {
'use strict';

if (performance.getEntriesByType('navigation')[0]?.responseStatus !== 200) return;

const randomPause = _ => random(3000, 5000);

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

subscribeOnChanges(document.body, 'button, div, span', process);
})();
