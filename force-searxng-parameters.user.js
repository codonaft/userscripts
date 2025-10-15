// ==UserScript==
// @name Force SearXNG Parameters
// @icon https://external-content.duckduckgo.com/ip3/searx.space.ico
// @version 0.17
// @downloadURL https://userscripts.codonaft.com/force-searxng-parameters.user.js
// ==/UserScript==

(_ => {
'use strict';

if (performance.getEntriesByType('navigation')[0]?.responseStatus !== 200) return;
const b = document.body;
if (!b) return;
if (!document.head?.querySelector('link[type="application/opensearchdescription+xml"]')?.title?.toLowerCase().includes('searx') && ![...b.querySelectorAll('a[href="https://searx.space"]')].find(i => i.textContent?.includes('Public instances'))) return;
const loc = window.location;
if (loc.pathname === '/preferences' || ['/info/', '/stats', '/about'].find(i => loc.pathname.startsWith(i))) return;

const CATEGORIES = ['general'];

// NOTE: overwritten by DISABLED_ENGINES
const ENABLED_ENGINES = {
  'files': ['piratebay', 'solidtorrents', 'z-library'],
  'general': ['brave', 'duckduckgo', 'google', 'mozhi', 'openlibrary', 'qwant', 'startpage', 'wikipedia', 'wolframalpha', 'yahoo'],
  'images': ['brave.images', 'duckduckgo images', 'google images', 'mojeek images', 'presearch images', 'qwant images', 'startpage images'],
  'it': ['askubuntu', 'bitbucket', 'codeberg', 'crates.io', 'docker hub', 'gitea.com', 'gitlab', 'habrahabr', 'hackernews', 'lib.rs', 'lobste.rs', 'sourcehut', 'stackoverflow', 'superuser'],
  'music': ['bandcamp', 'genius', 'mixcloud', 'radio browser', 'soundcloud', 'youtube'],
  'other': ['github code', 'erowid', 'duckduckgo weather', 'goodreads'],
  'science': ['arxiv', 'google scholar', 'pubmed', 'semantic scholar'],
  'social media': ['reddit'],
  'videos': ['odysee', 'peertube','sepiasearch', 'vimeo', 'youtube'],
  'onions': ['ahmia', 'torch'],
};

const DISALBED_ENGINES = {
  'general': ['360search', 'baidu', 'bing', 'bpb', 'quark', 'mozhi', 'openlibrary', 'sogou', 'tagesschau', 'wikimini', 'wolframalpha'],
  'it': ['codeberg'],
};

const ENABLED_PLUGINS = ['calculator', 'oa_doi_rewrite', 'tracker_url_remover', 'Vim-like_hotkeys'];

const METHOD = 'POST';

const disabledEnginesFlat = Object.values(DISALBED_ENGINES).flat();
const disabledEnginesSet = new Set(disabledEnginesFlat);

const hashParams = new URLSearchParams(loc.href.split('#')[1] || '');

// https://docs.searxng.org/dev/search_api.html
const params = {
  'autocomplete': '',
  'categories': CATEGORIES.join(','),
  'disabled_engines': disabledEnginesFlat.join(','),
  'enabled_engines': Object.values(ENABLED_ENGINES).flat().filter(i => !disabledEnginesSet.has(i)).join(','),
  'enabled_plugins': ENABLED_PLUGINS.join(','),
  'image_proxy': 'True',
  'safesearch': 0,
  ...Object.fromEntries(Array.from(hashParams.entries())), // NOTE: fails on Firefox without Array.from
};

const random = (min, max) => Math.floor(Math.random() * (max - min + 1) + min);
const pickRandom = xs => xs[random(0, xs.length - 1)];
const enginesCookie = (engines, excluded) => Object
  .entries(engines)
  .flatMap(([category, v]) => v.filter(i => !excluded.includes(i))
  .map(engine => `${engine}__${category}`)).join(',');

const cookies = {
  'advanced_search': 1,
  'autocomplete': params.autocomplete || '',
  'categories': params.categories || '',
  'disabled_engines': enginesCookie(DISALBED_ENGINES, []),
  'doi_resolver': pickRandom(['sci-hub.se', 'sci-hub.st', 'sci-hub.ru']),
  'enabled_engines': enginesCookie(ENABLED_ENGINES, disabledEnginesFlat),
  'enabled_plugins': ENABLED_PLUGINS.join(','),
  'favicon_resolver': '',
  'hotkeys': 'vim',
  'image_proxy': +(params.image_proxy === 'True'),
  'infinite_scroll': 1,
  'locale': 'en',
  'method': METHOD,
  'query_in_title': 0,
  'safesearch': params.safesearch || 0,
  'search_on_category_select': 1,
};

const form = b.querySelector('form#search');
const queryInput = b.querySelector('input#q[type="text"]');
if (form && queryInput) {
  try {
    form.method = METHOD;

    const action = form.action.split('#')[0];
    queryInput.addEventListener('input', _ => {
      console.log('query', queryInput.value);
      const newParams = new URLSearchParams({ ...params, q: queryInput.value });
      form.action = `${action}#${newParams}`;
      if (!params.autocomplete) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    }, true);

    if (!params.autocomplete) {
      ['click', 'mousedown', 'keyup', 'Tab', 'Enter'].forEach(i => queryInput.addEventListener(i, event => {
        event.preventDefault();
        event.stopImmediatePropagation();
      }));
    }

    Object.entries(params).forEach(([k, v]) => {
      if (k === 'q') return;
      const input = document.createElement('input');
      input.type = 'hidden';
      input.name = k;
      input.value = v;
      form.appendChild(input);
    });
  } catch (e) {
    console.error(e);
  }
}

Object.entries(cookies).forEach(([k, v]) => document.cookie = `${k}=${v}`);

/*const subscribeOnChanges = (node, selector, f) => {
  const apply = (node, observer) => {
    if (node?.nodeType !== 1) return;

    let observeChildren = true;
    if (node?.matches?.(selector)) {
      try {
        observeChildren = f(node, observer);
      } catch (e) {
        err(e, node);
        if (e.name === 'SecurityError') {
          observer.disconnect();
          return;
        }
      }
    }

    if (observeChildren) {
      const children = node?.childNodes || [];
      children.forEach(i => apply(i, observer));
    }
  };

  const observer = new MutationObserver(mutations => mutations.forEach(m => m.addedNodes.forEach(i => apply(i, observer))));
  observer.observe(node, { childList: true, subtree: true });
  apply(node, observer);
};

subscribeOnChanges(b, 'div#results div.engines span', (node, observer) => {
  if (disabledEnginesSet.has(node.textContent)) {
    console.warn('unexpected engine, press the search button to retry');
    observer.disconnect();
    form?.submit();
    return false;
  }
  return true;
});

const err = (e, node) => {
  console.log(node);
  console.error(e);
};*/
})();
