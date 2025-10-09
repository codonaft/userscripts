// ==UserScript==
// @name Remove Pseudocensorship
// @version 0.5
// @downloadURL https://userscripts.codonaft.com/remove-pseudocensorship.user.js
// ==/UserScript==

'use strict';

const subscribeOnChanges = (node, selector, f) => {
  const apply = (node, observer) => {
    if (node?.nodeType !== 1) return;

    let observeChildren = true;
    if (node?.matches?.(selector)) {
      try {
        observeChildren = f(node, observer);
      } catch (e) {
        err(e, node);
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

subscribeOnChanges(document.body, 'p', (node, _observer) => {
  if (node.textContent.includes('НАСТОЯЩИЙ МАТЕРИАЛ (ИНФОРМАЦИЯ)')) {
    node.style.display = 'none';
  }
  return true;
});
