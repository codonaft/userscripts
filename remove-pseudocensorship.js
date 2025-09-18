// ==UserScript==
// @name Remove Pseudocensorship
// @version 0.1
// @downloadURL https://userscripts.codonaft.com/remove-pseudocensorship.js
// ==/UserScript==

(function() {
  'use strict';

  const process = node => {
    if (node.nodeType !== 1) return;

    if (node.tagName === 'P' && node.innerText.includes('НАСТОЯЩИЙ МАТЕРИАЛ (ИНФОРМАЦИЯ)')) {
      node.style.display = 'none';
      return;
    }

    node.childNodes.forEach(process);
  };

  const subscribeOnChanges = (node, f) => {
    f(node);
    new MutationObserver(mutations => mutations.forEach(m => m.addedNodes.forEach(process)))
      .observe(node, { childList: true, subtree: true });
  };

  subscribeOnChanges(document.body, process);
})();
