// ==UserScript==
// @name Force SearXNG Parameters
// @icon https://www.google.com/s2/favicons?sz=64&domain=searx.space
// @version 0.4
// @downloadURL https://userscripts.codonaft.com/force-searxng-parameters.user.js
// ==/UserScript==

(_ => {
  'use strict';

  if (performance.getEntriesByType('navigation')[0]?.responseStatus !== 200) return;
  const b = document.body;
  if (!b) return;
  if (!document.head?.querySelector('link[type="application/opensearchdescription+xml"]')?.title?.toLowerCase().includes('searx') && ![...b.querySelectorAll('a[href="https://searx.space"]')].find(i => i.textContent?.includes('Public instances'))) return;

  // https://docs.searxng.org/dev/search_api.html
  const params = {
    'categories': 'general,images,videos,news,it,science,files,social_media',
    'autocomplete': '',
    'image_proxy': 'True',
    'safesearch': 0,
  };

  const cookies = {
    'autocomplete': params.autocomplete,
    'enabled_plugins': 'calculator',
    'favicon_resolver': '',
    'hotkeys': 'vim',
    'image_proxy': +(params.image_proxy === 'True'),
    'infinite_scroll': 1,
    'locale': 'en',
    'method': 'POST',
    'safesearch': params.safesearch || 0,
  };

  const form = b.querySelector('form#search');
  if (form) {
    Object.entries(params).forEach(([k, v]) => {
      const input = document.createElement('input');
      input.type = 'hidden';
      input.name = k;
      input.value = v;
      form.appendChild(input);
    });
  }

  Object.entries(params).forEach(([k, v]) => document.cookie = `${k}=${v}`);
})();
