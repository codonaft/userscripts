// ==UserScript==
// @name Improve Privacy
// @version 0.22
// @downloadURL https://userscripts.codonaft.com/improve-privacy.user.js
// @require https://userscripts.codonaft.com/utils.js
// ==/UserScript==

// TODO: https://github.com/f321x/nostr-tracking-token-remover/tree/main/nostr_tracking_token_remover/rulesets

(_ => {
'use strict';

const h = window.location.hostname;
const hiddenNodes = 'div[class^="langGeoPickerIcons"] use, div[role="contentinfo"], div#gws-output-pages-elements-homepage_additional_languages__als, div#voice-search-button, span.preference-hint, span.style-scope.ytd-topbar-logo-renderer';
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

    const url = new URL(href);
    [...url.searchParams.keys()]
      .filter(k => k.startsWith('utm_'))
      .forEach(k => url.searchParams.delete(k));
    maybeUpdateUrl(node, url, href);

    if (h === 'tagpacker.com' && !node.closest?.('ul.nav')) {
      node.addEventListener('click', _ => {
        if (!event.isTrusted) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        window.location = href;
      }, true);
      return;
    }

    const youtube = href.startsWith?.('https://www.youtube.com/watch?') || href.startsWith?.('https://youtu.be/');
    const maps = href.startsWith?.('https://maps.app.goo.gl/');
    if (!youtube && !maps) return true;

    [...url.searchParams.keys()]
      .filter(k => maps || !['index', 'list', 't', 'v'].includes(k))
      .forEach(k => url.searchParams.delete(k));

    maybeUpdateUrl(node, url, href);
  } catch (e) {
    err(e, node);
  }
  return true;
};

const maybeUpdateUrl = (node, url, href) => {
  const newHref = url.toString();
  if (newHref !== href) {
    node.href = newHref;
    if (node.textContent?.trim() === href) {
      node.innerHTML = newHref;
    }
  }
};

subscribeOnChanges(document.body, `${links}, ${hiddenNodes}`, (node, _observer) => {
  try {
    if (['youtube.com', 'youtu.be', 'google.com', 'xhamster.com'].find(i => h.endsWith(i)) && node.matches(hiddenNodes)) {
      node.style.display = 'none';
      return false;
    }
  } catch (e) {
    err(e, node);
  }

  return cleanup(node);
});
})();
