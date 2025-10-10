// ==UserScript==
// @name Redirect SearXNG On Failure
// @description Redirect to a random SearXNG instance in case of error and empty result
// @icon https://external-content.duckduckgo.com/ip3/searx.space.ico
// @version 0.9
// @downloadURL https://userscripts.codonaft.com/redirect-searxng-on-failure.user.js
// ==/UserScript==

(_ => {
'use strict';

if (performance.getEntriesByType('navigation')[0]?.responseStatus !== 200) return;
const b = document.body;
if (!b) return;
if (!document.head?.querySelector('link[type="application/opensearchdescription+xml"]')?.title?.toLowerCase().includes('searx') && ![...b.querySelectorAll('a[href="https://searx.space"]')].find(i => i.textContent?.includes('Public instances'))) return;
const loc = window.location;
if (loc.pathname === '/preferences' || ['/info/', '/stats', '/about'].filter(i => loc.pathname.startsWith(i)).length > 0) return;

const queryFromInput = b.querySelector('input#q')?.value || '';
const hasResults = queryFromInput.length > 0 && (b.querySelector('td.response-time') || !b.querySelector('td.response-error')) && !b.querySelector('div.dialog-error-block')?.innerText.includes('No results were found');
if (hasResults) return;

console.log('no SearXNG results');
const url = new URL(loc.href);
if (url.hostname.endsWith('.onion')) {
  url.host = 'codonaftbvv4j5k7nsrdivbdblycqrng5ls2qkng6lm77svepqjyxgid.onion';
  url.protocol = 'http:';
} else if (url.hostname.endsWith('.i2p')) {
  url.host = 'codonftbnpdkjwyflssto3iklawhuthbe37l6swigegqkyyfmiqa.b32.i2p';
  url.protocol = 'http:';
} else {
  url.host = 'codonaft.com';
  url.protocol = 'https:';
}
url.pathname = '/searxng';
url.searchParams.set('fast', '0');

const postRequest = !url.searchParams.has('q');
if (postRequest) {
  console.log('post request');
  if (url.hash.length > 1) {
    new URLSearchParams(url.hash.split('#')[1])
      .entries()
      .forEach(([k, v]) => url.searchParams.set(k, v));
  } else {
    if (queryFromInput.length === 0) {
      console.log('no query found');
      return;
    }
    url.searchParams.set('q', queryFromInput);

    const categories = [...b.querySelectorAll('div#categories button.selected')];
    if (categories.length > 0) {
      url.searchParams.set('categories', categories
        .map(i => i.name.split('_')[1])
        .filter(i => i)
        .join(',')
      );
    }

    const language = b.querySelector('select.language')?.value || 'all';
    url.searchParams.set('language', language);
  }
}

const params = url.searchParams.toString();
url.search = '';
window.location.replace(`${url.toString()}#${params}`);
})();
