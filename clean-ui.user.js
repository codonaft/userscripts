// ==UserScript==
// @name Clean UI
// @version 0.4
// @downloadURL https://userscripts.codonaft.com/clean-ui.user.js
// @require https://userscripts.codonaft.com/utils.js
// ==/UserScript==

(_ => {
'use strict';

if (performance.getEntriesByType('navigation')[0]?.responseStatus !== 200) return;

const h = window.location.hostname;

const hide = node => node.style.display = 'none';

if (h.endsWith('telegram.org')) {
  subscribeOnChanges(document.body, 'div.badge-gray', (node, _observer) => {
    hide(node);
    return false;
  });
}

if (h.endsWith('yakihonne.com')) {
  subscribeOnChanges(document.body, 'button.btn', (node, _observer) => {
    if (node.textContent.includes('Share profile')) {
      const p = node.closest('div.fit-container');
      if (p) {
        hide(p);
      }
    }
    return false;
  });
}

if (h.endsWith('youtube.com')) {
  subscribeOnChanges(document.body, 'img.ytd-yoodle-renderer', (node, observer) => {
    observer.disconnect();
    hide(node);
    return false;
  });
}

if (document.head.querySelector('link[title="Invidious"]')) {
  subscribeOnChanges(document.body, 'div.h-box', (node, observer) => {
    if (node.textContent?.includes?.('Play next by default')) {
      observer.disconnect();
      hide(node);
    }
    return false;
  });
}
})();
