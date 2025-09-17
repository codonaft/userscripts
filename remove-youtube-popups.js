// ==UserScript==
// @name Remove YouTube Popups
// @match https://www.youtube.com/*
// @icon https://www.google.com/s2/favicons?sz=64&domain=youtube.com
// ==/UserScript==

(function() {
  'use strict';

  function randomPause() {
    const min = 3000;
    const max = 5000;
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  const closeBanner = setInterval(function() {
    if (document.getElementsByClassName('yt-spec-button-shape-next').length > 0) {
      setTimeout(function() {
        [...document.getElementsByClassName('yt-spec-button-shape-next')].forEach(i => {
          const label = i.getAttribute('aria-label');
          if (label && label.includes('No thanks')) {
            i.click();
          }
        });
        clearInterval(closeBanner);
      }, randomPause());
    } else if ([...document.querySelectorAll('div')].filter(i => i.textContent.includes('My Ad Center')).length > 0) {
      setTimeout(function() {
        document.querySelectorAll('button').forEach(i => {
          const label = i.getAttribute('aria-label');
          if (label && label.includes('Close')) {
            i.click();
          }
        });
        clearInterval(closeBanner);
      }, randomPause());
    } else if (document.getElementsByClassName('ytd-single-option-survey-renderer').length > 0) {
      setTimeout(function() {
        [...document.getElementsByClassName('ytd-single-option-survey-renderer')].forEach(i => {
          const label = i.getAttribute('icon');
          if (label && label.includes('yt-icons:close')) {
            i.click();
          }
        })
        clearInterval(closeBanner);
      }, randomPause());
    }
  }, 300);
})();
