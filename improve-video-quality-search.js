// ==UserScript==
// @name Improve Video Quality Search
// @version 0.2
// @downloadURL https://userscripts.codonaft.com/improve-video-quality-search.js
// @exclude-match https://spankbang.com/*/video/*
// @match https://spankbang.com/*
// @match https://www.pornhub.com/categories/*
// @match https://www.pornhub.com/video
// @match https://www.pornhub.com/video/search
// @match https://www.xvideos.com/
// @match https://www.xvideos.com/c/*
// @match https://xhamster.com/
// @match https://xhamster.com/categories/*
// @match https://xhamster.com/channels/*
// @match https://xhamster.com/search/*
// ==/UserScript==

(function() {
  'use strict';

   const url = new URL(window.location.href);
   const p = url.pathname;
   let newUrl = undefined;

   if (url.host === 'xhamster.com') {
     if (p.startsWith('/search/')) {
       if (url.searchParams.get('length') !== 'full') {
         url.searchParams.set('quality', '1080p');
         url.searchParams.set('length', 'full');
         newUrl = url.toString();
       }
     } else if (p.startsWith('/categories/') || p.startsWith('/channels/')) {
       if (!p.includes('/hd/')) {
         newUrl = url.toString() + '/hd/full-length/best?quality=1080p';
       }
     } else if (p === '/') {
       newUrl = url.toString() + '/hd/full-length/best/monthly?quality=1080p';
     }
   } else if (url.host === 'www.pornhub.com' && url.searchParams.get('hd') !== '1' && (p.startsWith('/categories/') || p.startsWith('/video') || p.startsWith('/search'))) {
     url.searchParams.set('min_duration', 20);
     url.searchParams.set('hd', 1);
     newUrl = url.toString();
   } else if (url.host === 'www.xvideos.com') {
     if (p === '/' && url.searchParams.has('k') && !url.searchParams.has('quality')) {
       url.searchParams.set('sort', 'rating');
       url.searchParams.set('durf', '20min_more');
       url.searchParams.set('quality', '1080P');
       newUrl = url.toString();
     } else if (p.startsWith('/c/') && !p.includes('q:1080P')) {
       const ps = p.split('/');
       if (ps.length >= 3) {
         url.pathname = ps[1] + '/s:rating/d:20min_more/q:1080P/' + ps[2];
         newUrl = url.toString();
       }
     }
   } else if (url.host === 'spankbang.com' && !(url.searchParams.has('q') && url.searchParams.has('d'))) {
     url.searchParams.set('q', 'fhd');
     url.searchParams.set('d', '20');
     newUrl = url.toString();
   }

   if (newUrl) {
     window.stop();
     window.location.href = newUrl;
   }
})()
