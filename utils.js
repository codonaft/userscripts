// ==UserScript==
// @name Userscripts Utilities
// @version 0.1
// @downloadURL https://userscripts.codonaft.com/utils.js
// ==/UserScript==

const err = (e, node) => {
  console.log(node);
  console.error(e);
};

// biome-ignore lint/correctness/noUnusedVariables: see @require
const subscribeOnChanges = (node, selector, f) => {
  const apply = (node, observer) => {
    if (node?.nodeType !== 1) return;

    let observeChildren = true;
    if (node?.matches?.(selector)) {
      try {
        observeChildren = f(node, observer);
      } catch (e) {
        err(e, node);
        if (e.name === 'SecurityError') {
          observer.disconnect();
          return;
        }
      }
    }

    if (observeChildren) {
      const children = node?.childNodes || [];
      children.forEach(i => apply(i, observer));
    }
  };

  const observer = new MutationObserver(mutations => mutations.forEach(m => m.addedNodes.forEach(i => apply(i, observer))));
  observer.observe(node, { childList: true, subtree: true });
  node.querySelectorAll(selector).forEach(i => apply(i, observer));
};

const random = (min, max) => Math.floor(Math.random() * (max - min + 1) + min);

// biome-ignore lint/correctness/noUnusedVariables: see @require
const pickRandom = xs => xs[random(0, xs.length - 1)];
