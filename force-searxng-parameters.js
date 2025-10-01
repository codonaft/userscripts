// ==UserScript==
// @name Force SearXNG Parameters
// @icon https://www.google.com/s2/favicons?sz=64&domain=searx.space
// @version 0.1
// @downloadURL https://userscripts.codonaft.com/force-searxng-parameters.js
// ==/UserScript==

(_ => {
  'use strict';

  if (performance.getEntriesByType('navigation')[0]?.responseStatus !== 200) return;
  if (!document.head.querySelector('link[type="application/opensearchdescription+xml"]')?.title?.includes('SearXNG') && !document.body.querySelector('a[href="https://searx.space"]')?.textContent?.includes('Public instances')) return;

  const form = document.body.querySelector('form#search');
  if (!form) return;

  // https://docs.searxng.org/dev/search_api.html
  const params = {
    'image_proxy': 'True',
    'safesearch': '0',
  };

  Object.entries(params).forEach(([k, v]) => {
    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = k;
    input.value = v;
    form.appendChild(input);
  });
})()
