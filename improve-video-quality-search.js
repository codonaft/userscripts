// ==UserScript==
// @name Improve Video Quality Search
// @match https://xhamster.com/
// @match https://xhamster.com/search/*
// @match https://xhamster.com/categories/*
// @match https://www.pornhub.com/video
// @match https://www.pornhub.com/categories/*
// @match https://www.pornhub.com/video/search
// @match https://www.xvideos.com/*
// ==/UserScript==

(function() {
  'use strict';

   const url = new URL(window.location.href);
   const p = url.pathname;
   let newUrl = undefined;

   if (url.host === 'xhamster.com' || url.host === 'creditxh.world') {
     if (p.startsWith('/search/')) {
       if (url.searchParams.get('length') !== 'full') {
         window.stop();
         url.searchParams.set('quality', '1080p');
         url.searchParams.set('length', 'full');
         newUrl = url.toString();
       }
     } else if (p.startsWith('/categories/') || p.startsWith('/channels/')) {
       if (!p.includes('/hd/')) {
         window.stop();
         newUrl = url.toString() + '/hd/full-length/best?quality=1080p';
       }
     } else if (p === '/') {
       window.stop();
       newUrl = url.toString() + '/hd/full-length/best/monthly?quality=1080p';
     }
   } else if (url.host === 'www.pornhub.com') {
     if (p.startsWith('/categories/') || p.startsWith('/video') || p.startsWith('/search')) {
       if (url.searchParams.get('hd') !== '1') {
         window.stop();
         url.searchParams.set('min_duration', 20);
         url.searchParams.set('hd', 1);
         newUrl = url.toString();
       }
     }
   } else if (url.host === 'www.xvideos.com') {
     if (p === '/') {
       if (url.searchParams.has('k') && !url.searchParams.has('quality')) {
         window.stop();
         url.searchParams.set('sort', 'rating');
         url.searchParams.set('durf', '20min_more');
         url.searchParams.set('quality', '1080P');
         newUrl = url.toString();
       }
     } else {
       if (p.startsWith('/c/') && !p.includes('q:1080P')) {
         const ps = p.split('/');
         if (ps.length >= 3) {
           window.stop();
           url.pathname = ps[1] + '/s:rating/d:20min_more/q:1080P/' + ps[2];
           newUrl = url.toString();
         }
       }
     }
   }

   if (newUrl) {
     window.location.href = newUrl;
   }
})()
