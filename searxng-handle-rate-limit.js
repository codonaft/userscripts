// ==UserScript==
// @name SearXNG Handle Rate Limit
// @version 0.1
// @downloadURL https://userscripts.codonaft.com/searxng-handle-rate-limit.js
// ==/UserScript==

(() => {
  'use strict';

  if (performance.getEntriesByType('navigation')[0]?.responseStatus !== 200) return;
  if (!document.head.querySelector('link[title="SearXNG"][type="application/opensearchdescription+xml"]')) return;

  if (document.querySelector('td.response-error')) {
    const url = new URL(window.location.href);
    url.host = url.host.endsWith('.onion') ? 'codonaftbvv4j5k7nsrdivbdblycqrng5ls2qkng6lm77svepqjyxgid.onion' : 'codonaft.com';
    url.pathname = '/searxng';
    url.searchParams.set('fast', '0');
    window.location.replace(url.toString());
  }
})()
