// ==UserScript==
// @name Improve Privacy
// @version 0.14
// @downloadURL https://userscripts.codonaft.com/improve-privacy.user.js
// ==/UserScript==

(_ => {
'use strict';

const hiddenNodes = 'div[role="contentinfo"], div#gws-output-pages-elements-homepage_additional_languages__als, div#voice-search-button, span.style-scope.ytd-topbar-logo-renderer';
const links = '[href]';

const cleanup = node => {
  try {
    if (node.data?.clickTrackingParams?.length > 0) {
      node.data.clickTrackingParams = '';
    }
  } catch (e) {
    err(e, node);
  }

  try {
    if (!node.matches(links)) return true;
    const href = node.href;
    if (!href) return true;

    const youtube = href.startsWith('https://www.youtube.com/watch?') || href.startsWith('https://youtu.be/');
    const maps = href.startsWith('https://maps.app.goo.gl/');
    if (!youtube && !maps) return true;

    const url = new URL(href);
    [...url.searchParams.keys()]
      .filter(k => maps || !['index', 'list', 't', 'v'].includes(k))
      .forEach(k => url.searchParams.delete(k));

    const newHref = url.toString();
    if (newHref !== href) {
      node.href = newHref;
      if (node.textContent.trim() === href) {
        node.innerHTML = newHref;
      }
    }
  } catch (e) {
    err(e, node);
  }
  return true;
};

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
  apply(node, observer);
};

subscribeOnChanges(document.body, `${links}, ${hiddenNodes}`, (node, _observer) => {
  try {
    const h = window.location.hostname;
    if (['youtube.com', 'youtu.be', 'google.com'].find(i => h.endsWith(i)) && node.matches(hiddenNodes)) {
      node.style.display = 'none';
      return false;
    }
  } catch (e) {
    err(e, node);
  }

  return cleanup(node);
});

const err = (e, node) => {
  console.log(node);
  console.error(e);
};
})();
