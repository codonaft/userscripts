// ==UserScript==
// @name Clean UI
// @version 0.1
// @downloadURL https://userscripts.codonaft.com/clean-ui.user.js
// @require https://userscripts.codonaft.com/utils.js
// @match https://*.youtube.com/*
// @match https://*.telegram.org/*
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

if (h.endsWith('youtube.com')) {
  subscribeOnChanges(document.body, 'img.ytd-yoodle-renderer', (node, observer) => {
    observer.disconnect();
    hide(node);
    return false;
  });
}
})();
