// ==UserScript==
// @name Force SearXNG Parameters
// @icon https://www.google.com/s2/favicons?sz=64&domain=searx.space
// @version 0.3
// @downloadURL https://userscripts.codonaft.com/force-searxng-parameters.js
// ==/UserScript==

(_ => {
  'use strict';

  if (performance.getEntriesByType('navigation')[0]?.responseStatus !== 200) return;
  const b = document.body;
  if (!b) return;
  if (!document.head?.querySelector('link[type="application/opensearchdescription+xml"]')?.title?.toLowerCase().includes('searx') && ![...b.querySelectorAll('a[href="https://searx.space"]')].find(i => i.textContent?.includes('Public instances'))) return;

  const form = b.querySelector('form#search');
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
})();
