// ==UserScript==
// @name Fallback for the cute metasearch engine https://github.com/mat-1/metasearch2
// @description Uses Minimalist SearXNG Redirector on failure
// @version 0.2
// @downloadURL https://userscripts.codonaft.com/redirect-metasearch-on-failure.user.js
// ==/UserScript==

(_ => {
'use strict';

if (performance.getEntriesByType('navigation')[0]?.responseStatus !== 200) return;
if (document.head?.querySelector('link[type="application/opensearchdescription+xml"]')?.title !== 'metasearch') return;

const q = new URLSearchParams(window.location.search).get('q');
if (q && !document.querySelector('div.search-result, div.image-result')) {
  const params = new URLSearchParams({ q });
  window.location.replace(`https://codonaft.com/searxng#${params}`);
}
})();
