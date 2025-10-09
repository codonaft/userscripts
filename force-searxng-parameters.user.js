// ==UserScript==
// @name Force SearXNG Parameters
// @icon https://www.google.com/s2/favicons?sz=64&domain=searx.space
// @version 0.5
// @downloadURL https://userscripts.codonaft.com/force-searxng-parameters.user.js
// ==/UserScript==

'use strict';

if (performance.getEntriesByType('navigation')[0]?.responseStatus !== 200) return;
const b = document.body;
if (!b) return;
if (!document.head?.querySelector('link[type="application/opensearchdescription+xml"]')?.title?.toLowerCase().includes('searx') && ![...b.querySelectorAll('a[href="https://searx.space"]')].find(i => i.textContent?.includes('Public instances'))) return;

const disabledEngines = {
  'general': ['360search', 'baidu', 'bing', 'bpb', 'quark', 'sogou', 'tagesschau', 'wikimini'],
};

const enabledEngines = {
  'files': ['piratebay', 'solidtorrents', 'z-library'],
  'general': ['duckduckgo', 'google', 'mozhi', 'openlibrary', 'wikipedia', 'wolframalpha'],
  'images': ['brave.images', 'duckduckgo images', 'google images', 'mojeek images', 'presearch images', 'qwant images', 'startpage images'],
  'it': ['askubuntu', 'bitbucket', 'codeberg', 'crates.io', 'docker hub', 'gitea.com', 'gitlab', 'habrahabr', 'hackernews', 'lib.rs', 'lobste.rs', 'sourcehut', 'stackoverflow', 'superuser'],
  'music': ['bandcamp', 'genius', 'mixcloud', 'radio browser', 'soundcloud', 'youtube'],
  'other': ['github code', 'erowid', 'duckduckgo weather', 'goodreads'],
  'science': ['arxiv', 'google scholar', 'pubmed', 'semantic scholar'],
  'social media': ['reddit'],
  'videos': ['odysee', 'peertube','sepiasearch', 'vimeo', 'youtube'],
  'onions': ['ahmia', 'torch'],
};

const enabledPlugins = ['calculator', 'oa_doi_rewrite', 'tracker_url_remover', 'Vim-like_hotkeys'];

// https://docs.searxng.org/dev/search_api.html
const params = {
  'autocomplete': '',
  'categories': ['general', 'it'].join(','),
  'disabled_engines': Object.values(disabledEngines).flatMap(i => i).join(','),
  'enabled_engines': Object.values(enabledEngines).flatMap(i => i).filter(i => !Object.values(disabledEngines).flatMap(i => i).includes(i)).join(','),
  'enabled_plugins': enabledPlugins.join(','),
  'image_proxy': 'True',
  'safesearch': 0,
};

const cookies = {
  'advanced_search': 1,
  'autocomplete': params.autocomplete || '',
  'categories': params.categories || 'general',
  'disabled_engines': 'bing__general',
  'doi_resolver': 'sci-hub.se',
  'enabled_engines': Object.entries(enabledEngines).flatMap(([category, v]) => v.map(engine => `${engine}__${category}`)).join(','),
  'enabled_plugins': enabledPlugins.join(','),
  'favicon_resolver': '',
  'hotkeys': 'vim',
  'image_proxy': +(params.image_proxy === 'True'),
  'infinite_scroll': 1,
  'locale': 'en',
  'method': 'POST',
  'query_in_title': 0,
  'safesearch': params.safesearch || 0,
  'search_on_category_select': 1,
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

Object.entries(cookies).forEach(([k, v]) => document.cookie = `${k}=${v}`);

if (!params.autocomplete) {
  const style = document.createElement('style');
  style.innerHTML = 'div.autocomplete { display: none !important }';
  b.appendChild(style);
}
