// ==UserScript==
// @name Remove Various Popups
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

  const closeBanner = setInterval(function() {
    if (document.querySelectorAll('div[role=dialog]').length > 0) {
      setTimeout(function() {
        document.querySelectorAll('button[aria-label="close"]').forEach(i => i.click());
        document.querySelectorAll('button.btn').forEach(i => {
          if (i.innerText.includes('Not now')) {
            i.click();
          }
        });
        clearInterval(closeBanner);
      }, randomPause());
    }

    ['a', 'button'].flatMap(i => [...document.querySelectorAll(i)]).forEach(i => {
      if (i.innerText.includes('Stay logged out')) {
        i.click();
        clearInterval(closeBanner);
      }
    });

    [
      ...document.querySelectorAll('#cookieconsentwarningcontainer'),
      ...document.querySelectorAll('#donate_banner'),
    ].forEach(i => {
      i.parentNode.removeChild(i);
      clearInterval(closeBanner);
    });

    {
      const span = [...document.querySelectorAll('span')].find(span => span.textContent.includes('Continue without disabling'));
      if (span && span.parentElement && span.parentElement.tagName.toLowerCase() === 'button') {
        span.parentElement.click();
        clearInterval(closeBanner);
      }
    }
  }, 300);
})();
