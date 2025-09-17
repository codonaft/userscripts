// ==UserScript==
// @name Remove Pseudocensorship
// ==/UserScript==

(function() {
  'use strict';

  setInterval(function() {
    document.querySelectorAll('p')
      .forEach(i => {
        if (i.innerText.includes('НАСТОЯЩИЙ МАТЕРИАЛ (ИНФОРМАЦИЯ)')) {
          i.style.display = 'none'
        }
      });
  }, 300);
})();
