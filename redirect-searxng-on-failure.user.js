// ==UserScript==
// @name Redirect SearXNG On Failure
// @description Redirect to a random SearXNG instance in case of error and empty result
// @icon https://www.google.com/s2/favicons?sz=64&domain=searx.space
// @version 0.4
// @downloadURL https://userscripts.codonaft.com/redirect-searxng-on-failure.user.js
// ==/UserScript==

'use strict';

if (performance.getEntriesByType('navigation')[0]?.responseStatus !== 200) return;
const b = document.body;
if (!b) return;
if (!document.head?.querySelector('link[type="application/opensearchdescription+xml"]')?.title?.toLowerCase().includes('searx') && ![...b.querySelectorAll('a[href="https://searx.space"]')].find(i => i.textContent?.includes('Public instances'))) return;

const hasResults = (b.querySelector('td.response-time') || !b.querySelector('td.response-error')) && !b.querySelector('div.dialog-error-block')?.innerText.includes('No results were found');
if (hasResults) return;

console.log('no SearXNG results');
const url = new URL(window.location.href);
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
  const query = b.querySelector('input#q')?.value;
  if (!query) {
    console.log('no query found');
    return;
  }
  url.searchParams.set('q', query);

  const categories = [...b.querySelectorAll('div#categories button.selected')];
  if (categories.length > 0) {
    url.searchParams.set('categories', categories
      .map(i => i.name.split('_')[1])
      .filter(i => i)
      .join(',')
    );
  }
}

const params = url.searchParams.toString();
url.search = '';
window.location.replace(`${url.toString()}#${params}`);
