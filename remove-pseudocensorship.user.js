// ==UserScript==
// @name Remove Pseudocensorship
// @version 0.4
// @downloadURL https://userscripts.codonaft.com/remove-pseudocensorship.user.js
// ==/UserScript==

(_ => {
  'use strict';

  const process = node => {
    if (node.nodeType !== 1) return;

    if (node.tagName === 'P' && node.textContent.includes('НАСТОЯЩИЙ МАТЕРИАЛ (ИНФОРМАЦИЯ)')) {
      node.style.display = 'none';
      return;
    }

    node.childNodes.forEach(process);
  };

  const subscribeOnChanges = (node, f) => {
    f(node);
    new MutationObserver(mutations => mutations.forEach(m => m.addedNodes.forEach(f)))
      .observe(node, { childList: true, subtree: true });
  };

  subscribeOnChanges(document.body, process);
})();
