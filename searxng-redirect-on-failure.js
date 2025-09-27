// ==UserScript==
// @name SearXNG Redirect On Failure
// @description Redirect to a random SearXNG instance in case of error and empty result
// @version 0.1
// @downloadURL https://userscripts.codonaft.com/searxng-redirect-on-failure.js
// ==/UserScript==

(() => {
  'use strict';

  if (performance.getEntriesByType('navigation')[0]?.responseStatus !== 200) return;
  if (!document.head.querySelector('link[title="SearXNG"][type="application/opensearchdescription+xml"]')) return;

  if (!document.querySelector('td.response-time') && document.querySelector('td.response-error')) {
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
    window.location.replace(url.toString());
  }
})()
