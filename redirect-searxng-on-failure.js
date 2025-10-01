// ==UserScript==
// @name Redirect SearXNG On Failure
// @description Redirect to a random SearXNG instance in case of error and empty result
// @icon https://www.google.com/s2/favicons?sz=64&domain=searx.space
// @version 0.1
// @downloadURL https://userscripts.codonaft.com/redirect-searxng-on-failure.js
// ==/UserScript==

(_ => {
  'use strict';

  if (performance.getEntriesByType('navigation')[0]?.responseStatus !== 200) return;
  const b = document.body;
  if (!document.head.querySelector('link[type="application/opensearchdescription+xml"]')?.title?.includes('SearXNG') && !b.querySelector('a[href="https://searx.space"]')?.textContent?.includes('Public instances')) return;

  const hasResults = (b.querySelector('td.response-time') || !b.querySelector('td.response-error')) && !b.querySelector('div.dialog-error-block')?.innerText.includes('No results were found');
  if (hasResults) return;

  console.log('SearXNG: no results');
  const url = new URL(window.location.href);
  if (url.host.endsWith('.onion')) {
    url.host = 'codonaftbvv4j5k7nsrdivbdblycqrng5ls2qkng6lm77svepqjyxgid.onion';
  } else if (url.host.endsWith('.i2p')) {
    url.host = 'codonftbnpdkjwyflssto3iklawhuthbe37l6swigegqkyyfmiqa.b32.i2p';
  } else {
    url.host = 'codonaft.com';
  }
  url.pathname = '/searxng';
  url.searchParams.set('fast', '0');
  const params = url.searchParams.toString();
  url.searchParams.forEach((_, i) => url.searchParams.delete(i));
  window.location.replace(`${url.toString()}#${params}`);
})()
