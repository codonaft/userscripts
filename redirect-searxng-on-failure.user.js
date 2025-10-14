// ==UserScript==
// @name Redirect SearXNG On Failure
// @description Redirect to a random SearXNG instance in case of error and empty result, improve instance selection with local statistics
// @icon https://external-content.duckduckgo.com/ip3/searx.space.ico
// @version 0.13
// @downloadURL https://userscripts.codonaft.com/redirect-searxng-on-failure.user.js
// @grant GM.getValue
// @grant GM_setValue
// ==/UserScript==

(async _ => {
'use strict';

const STATS_KEY = 'searxngRedirectorStats';
const STATS_TTL_SECS = 60 * 60;

const currentTime = _ => Math.round(Date.now() / 1000);
const searxngRedirectorStats = Object.fromEntries(Object.entries(await GM.getValue(STATS_KEY, {}))
  .filter(([_k, v]) => v.ttl > currentTime()));
if (document.head?.querySelector('title')?.textContent === 'Minimalist SearXNG Redirector') {
  const json = JSON.stringify(searxngRedirectorStats);
  if (localStorage.getItem(STATS_KEY) !== json) {
    localStorage.setItem(STATS_KEY, json);
  }
}

let hasResults = true;
const httpOk = performance.getEntriesByType('navigation')[0]?.responseStatus === 200;
const b = document.body;
const loc = window.location;
if (httpOk) {
  if (!document.head?.querySelector('link[type="application/opensearchdescription+xml"]')?.title?.toLowerCase().includes('searx') && ![...b.querySelectorAll('a[href="https://searx.space"]')].find(i => i.textContent?.includes('Public instances'))) {
    console.log('NOT searxng');
    return;
  }
  if (loc.pathname === '/preferences' || ['/info/', '/stats', '/about'].find(i => loc.pathname.startsWith(i))) {
    console.log('ignoring by pathname');
    return;
  }
}

const queryInput = b.querySelector('input#q[type="text"]');
if (!queryInput) {
  console.warn('no query input found');
  return;
}

const queryFromInput = queryInput.value || '';
hasResults = queryFromInput.length > 0 && (b.querySelector('td.response-time') || !b.querySelector('td.response-error')) && !b.querySelector('div.dialog-error-block')?.innerText.includes('No results were found');
hasResults = !!hasResults;

try {
  if (!searxngRedirectorStats[loc.hostname]) {
    searxngRedirectorStats[loc.hostname] = { ok: 0, failures: 0, ttl: 0 };
  }
  const stats = searxngRedirectorStats[loc.hostname];
  stats.ok += +hasResults;
  stats.failures += +!hasResults;
  stats.ttl = currentTime() + STATS_TTL_SECS;
  GM_setValue(STATS_KEY, searxngRedirectorStats);
  console.log('update redirector stats', JSON.stringify(searxngRedirectorStats));
} catch (e) {
  console.error(e);
}

if (hasResults) {
  console.log('there are SearXNG results');
  return;
}

console.warn('no SearXNG results');
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
      console.error('no query found');
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
url.hash = params;
window.location.replace(url);
})();
