// ==UserScript==
// @name Redirect SearXNG On Failure
// @description Redirect to a random SearXNG instance in case of error and empty result, improve instance selection with local statistics
// @icon https://external-content.duckduckgo.com/ip3/searx.space.ico
// @version 0.18
// @downloadURL https://userscripts.codonaft.com/redirect-searxng-on-failure.user.js
// @grant GM.getValue
// @grant GM_setValue
// ==/UserScript==

(async _ => {
'use strict';

const STATS_KEY = 'searxngRedirectorStats';

const currentTime = _ => Math.round(Date.now() / 1000);
const searxngRedirectorStats = await GM.getValue(STATS_KEY, {});
if (document.head?.querySelector('title')?.textContent === 'Minimalist SearXNG Redirector') {
  const json = JSON.stringify(searxngRedirectorStats);
  if (localStorage.getItem(STATS_KEY) !== json) {
    localStorage.setItem(STATS_KEY, json);
  }
}

const httpOk = performance.getEntriesByType('navigation')[0]?.responseStatus === 200;
const b = document.body;
const loc = window.location;
const url = new URL(loc.href);
const hashParams = new URLSearchParams(url.hash.split('#')[1] || '');
if (httpOk) {
  if (!document.head?.querySelector('link[type="application/opensearchdescription+xml"]')?.title?.toLowerCase().includes('searx') && ![...b.querySelectorAll('a[href="https://searx.space"]')].find(i => i.textContent?.includes('Public instances'))) {
    console.log('NOT searxng');
    return;
  }
  if (loc.pathname === '/preferences' || ['/info/', '/stats', '/about'].find(i => loc.pathname.startsWith(i))) {
    console.log('ignoring by pathname');
    return;
  }
} else if (hashParams.size === 0) {
  return;
}

const queryInput = b.querySelector('input#q[type="text"]');
const queryFromInput = queryInput?.value || '';

const responseError = !!b.querySelector('td.response-error');
const resultsError = !!b.querySelector('div.dialog-error-block')?.innerText.includes('No results were found');
const hasResults = !!(queryFromInput.length > 0 && (b.querySelector('td.response-time') || !responseError) && !resultsError);

if (queryFromInput.length > 0) {
  try {
    if (!searxngRedirectorStats[loc.hostname]) {
      searxngRedirectorStats[loc.hostname] = { ok: { count: 0, updated: 0 }, failure: { count: 0, updated: 0 } };
    }
    const stats = searxngRedirectorStats[loc.hostname];
    const hasError = responseError || resultsError;
    const updated = currentTime();
    if (hasError) {
      stats.ok.count++;
      stats.ok.updated = updated;
    }
    if (hasResults) {
      stats.failure.count++;
      stats.failure.updated = updated;
    }
    GM_setValue(STATS_KEY, searxngRedirectorStats);
    console.log('update redirector stats', JSON.stringify(searxngRedirectorStats));
  } catch (e) {
    console.error(e);
  }
}

if (hasResults) {
  console.log('there are SearXNG results');
  return;
}

console.warn('no SearXNG results');

const postRequest = !url.searchParams.has('q');
if (postRequest) {
  console.log('post request');
  if (hashParams.size > 0) {
    hashParams.forEach((v, k) => url.searchParams.set(k, v));
  } else {
    if (queryFromInput.length === 0) {
      console.warn('no query found');
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

const form = b.querySelector('form#search');
if (queryFromInput.length === 0 && form && queryInput) {
  try {
    queryInput.value = url.searchParams.get('q') || '';
    url.searchParams.forEach((v, k) => {
      if (k === 'q') return;
      const input = document.createElement('input');
      input.type = 'hidden';
      input.name = k;
      input.value = v;
      form.appendChild(input);
    });
    form.submit();
    return;
  } catch (e) {
    console.error(e);
  }
} else {
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
  if (queryFromInput.length > 0 && !url.searchParams.has('q')) {
    url.searchParams.set('q', queryFromInput);
  }

  const params = url.searchParams.toString();
  url.search = '';
  url.hash = params;
  window.location.replace(url);
}
})();
