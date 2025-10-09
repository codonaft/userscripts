// ==UserScript==
// @name Improve Privacy
// @version 0.10
// @downloadURL https://userscripts.codonaft.com/improve-privacy.user.js
// ==/UserScript==

(_ => {
  'use strict';

  const cleanup = node => {
    try {
      if (node.data?.clickTrackingParams?.length > 0) {
        node.data.clickTrackingParams = '';
      }
    } catch (e) {
      err(e, node);
    }

    try {
      if (!node.matches('[href]')) return;
      const href = node.href;
      if (!href) return;

      const youtube = href.startsWith('https://www.youtube.com/watch?') || href.startsWith('https://youtu.be/');
      const other = href.startsWith('https://maps.app.goo.gl/');
      if (!youtube && !other) return;

      const url = new URL(href);
      [...url.searchParams.keys()]
        .filter(k => other || !['index', 'list', 't', 'v'].includes(k))
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
  };

  const process = node => {
    if (node?.nodeType !== 1) return;

    try {
      const h = window.location.hostname;
      if (['youtube.com', 'youtu.be', 'google.com'].find(i => h.endsWith(i)) && node.matches?.('span.style-scope.ytd-topbar-logo-renderer, div[role="contentinfo"], div#gws-output-pages-elements-homepage_additional_languages__als')) {
        node.style.display = 'none';
        return;
      }
    } catch (e) {
      err(e, node);
    }

    cleanup(node);
    node.childNodes.forEach(process);
  };

  const err = (e, node) => {
    console.log(node);
    console.error(e);
  };

  const subscribeOnChanges = (node, f) => {
    f(node);
    new MutationObserver(mutations => mutations.forEach(m => m.addedNodes.forEach(f)))
      .observe(node, { childList: true, subtree: true });
  };

  subscribeOnChanges(document.body, process);
})();
