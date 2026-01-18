// ==UserScript==
// @name Remove Pseudocensorship
// @version 0.11
// @downloadURL https://userscripts.codonaft.com/remove-pseudocensorship.user.js
// @require https://userscripts.codonaft.com/utils.js
// ==/UserScript==

(_ => {
'use strict';

subscribeOnChanges(document.body, 'p', (node, _observer) => {
  if (node.textContent?.includes('НАСТОЯЩИЙ МАТЕРИАЛ (ИНФОРМАЦИЯ)')) {
    node.style.display = 'none';
  }
  return true;
});
})();
