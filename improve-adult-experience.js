// ==UserScript==
// @name Improve Adult Experience
// @description Skip intros, set best quality and duration filters by default, make unrelated video previews transparent
// @version 0.3
// @downloadURL https://userscripts.codonaft.com/improve-adult-experience.js
// @exclude-match https://spankbang.com/*/video/*
// @match https://spankbang.com/*
// @match https://www.pornhub.com/*
// @match https://www.porntrex.com/*
// @match https://www.xvideos.com/
// @match https://www.xvideos.com/c/*
// @match https://xhamster.com/
// @match https://xhamster.com/categories/*
// @match https://xhamster.com/channels/*
// @match https://xhamster.com/search/*
// ==/UserScript==

(() => {
  'use strict';

  if (performance.getEntriesByType('navigation')[0]?.responseStatus !== 200) return;

  const url = new URL(window.location.href);
  const params = url.searchParams;
  const h = url.hostname;
  const p = url.pathname;
  let newUrl;

  const random = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

  const timeToSeconds = time => (time || '').split(':').map(Number).reduceRight((total, value, index, parts) => total + value * 60 ** (parts.length - 1 - index), 0);

  const pornhub = () => {
    // TODO: never redirect, just update the URLs

    const processEmbedded = document => {
      const style = document.createElement('style');
      style.innerHTML = `
        div.mgp_eventCatcher { display: none !important; }
        div.mgp_topBar { display: none !important; }
        div.mgp_thumbnailsGrid { display: none !important; }
        img.mgp_pornhub { display: none !important; }
      `;
      document.body.appendChild(style);
      const video = document.body.querySelector('video');
      video?.addEventListener('loadedmetadata', _ => video.currentTime = random(video.duration / 4, video.duration / 3));
    };

    const style = document.createElement('style');
    style.innerHTML = `
      div.unrelatedcontent { opacity: 10%; }
      div.unrelatedcontent:hover { opacity: 40%; }
    `;
    document.querySelector('div#main-container')?.appendChild(style);

    [...document.body.querySelectorAll('var.duration')].forEach(i => {
      const duration = timeToSeconds(i.innerText);
      const t = random(Math.floor(duration / 4), Math.floor(duration / 3));
      const link = i.closest('a');
      if (link) {
        link.href += `&t=${t}`;
      }

      const div = i.closest('a').closest('div.phimage')?.parentNode;
      if (duration < 20 * 60) { // TODO: check quality
        div?.classList.add('unrelatedcontent');
      }
    });

    if (p.startsWith('/embed/')) {
      // happens for both iframed and redirected embedded player here
      console.log('processing embed');
      processEmbedded(document); // document is a part of iframe here
    } else if (p === '/view_video.php') {
      const durationFromNormalPlayer = timeToSeconds(document.body.querySelector('span.mgp_total')?.innerText);
      if (durationFromNormalPlayer) {
        if (!params.has('t') || Number(params.get('t')) >= durationFromNormalPlayer) {
          window.stop();
          params.set('t', random(Math.floor(durationFromNormalPlayer / 4), Math.floor(durationFromNormalPlayer / 3)));
          window.location.replace(url.toString());
        }
      } else {
        console.log('fallback to embedded player');
        const embedUrl = `https://www.pornhub.com/embed/${params.get('viewkey')}`;
        const container = document.body.querySelector('div.playerFlvContainer');
        if (container) {
          const iframe = document.createElement('iframe');
          /*iframe.onload = () => {
            console.log('iframe onload');
            processEmbedded(iframe.contentWindow.document);
          };*/
          iframe.referrerpolicy = 'no-referrer';
          iframe.width = '100%';
          iframe.height = '100%';
          iframe.frameborder = '0';
          iframe.scrolling = 'no';
          iframe.allowfullscreen = '';
          iframe.src = embedUrl;
          container.appendChild(iframe);
        } else {
          console.log('redirecting to embedded player');
          window.stop();
          window.location.href = embedUrl;
        }
      }
    } else if (params.get('hd') !== '1' && !params.has('min_duration') && (p.startsWith('/categories/') || p === '/video' || p === '/video/search')) {
      params.set('min_duration', 20);
      params.set('hd', 1);
      newUrl = url.toString();
    }
  };

  const xvideos = () => {
    // TODO: never redirect, just update the URLs

    if (p === '/' && params.has('k') && !params.has('quality')) {
      params.set('sort', 'rating');
      params.set('durf', '20min_more');
      params.set('quality', '1080P');
      newUrl = url.toString();
    } else if (p.startsWith('/c/') && !p.includes('q:1080P')) {
      const ps = p.split('/');
      if (ps.length >= 3) {
        url.pathname = `${ps[1]}/s:rating/d:20min_more/q:1080P/${ps[2]}`;
        newUrl = url.toString();
      }
    }
  };

  const spankbang = () => {
    // TODO: never redirect, just update the URLs

    if (!p.endsWith('/tags') && !p.includes('/playlist/') && !(params.has('q') && params.has('d'))) {
      if (p === '/') {
        url.pathname = '/trending_videos/'
      }
      params.set('q', 'fhd');
      params.set('d', '20');
      newUrl = url.toString();
    }
  };

  const porntrex = () => {
    const expectedPage = (page, href) => href.startsWith(`https://www.porntrex.com/${page}/`) && (page === 'top-rated' || href.split('/').length > 5);

    [...document.body.querySelectorAll('a')]
      .filter(i => ['categories', 'channels', 'models', 'top-rated'].filter(page => expectedPage(page, i.href)).length > 0)
      .forEach(i => {
        const url = new URL(i.href);
        const ps = url.pathname.split('/').filter(i => i.length > 0);
        for (const i of ['hd', 'top-rated', 'thirty-all-min']) {
          if (!ps.includes(i)) {
            ps.push(i);
          }
        }
        ps.push('');
        ps.unshift('');
        url.pathname = ps.join('/');
        i.href = url.toString();
      });
  };

  const xhamster = () => {
    // TODO: never redirect, just update the URLs

    if (p.startsWith('/search/')) {
      if (params.get('length') !== 'full') {
        params.set('quality', '1080p');
        params.set('length', 'full');
        newUrl = url.toString();
      }
    } else if (p.startsWith('/categories/') || p.startsWith('/channels/')) {
      if (!p.includes('/hd/')) {
        newUrl = `${url}/hd/full-length/best?quality=1080p`;
      }
    } else if (p === '/') {
      newUrl = `${url}/hd/full-length/best/monthly?quality=1080p`;
    }
  };

  if (h === 'www.pornhub.com') {
    pornhub();
  } else if (h === 'www.xvideos.com') {
    xvideos();
  } else if (h === 'spankbang.com') {
    spankbang();
  } else if (h === 'www.porntrex.com') {
    porntrex();
  } else if (h === 'xhamster.com') {
    xhamster();
  }

  if (newUrl) {
    window.stop();
    window.location.replace(newUrl);
  }
})()
