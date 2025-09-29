// ==UserScript==
// @name Improve Adult Experience
// @description Skip intros, set best quality and duration filters by default, make unrelated video previews transparent
// @version 0.7
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

(_ => {
  'use strict';

  const MIN_DURATION_MIN = 20;
  const MIN_VIDEO_HEIGHT = 1080;

  if (performance.getEntriesByType('navigation')[0]?.responseStatus !== 200) return;

  const url = new URL(window.location.href);
  const params = url.searchParams;
  const h = url.hostname;
  const p = url.pathname;
  let newUrl;

  const currentTime = () => Math.round(Date.now() / 1000);
  const random = (min, max) => Math.floor(Math.random() * (max - min + 1) + min);
  const pickRandom = xs => xs[random(0, xs.length)];

  const timeToSeconds = time => (time || '').trim().split(':').map(Number).reduceRight((total, value, index, parts) => total + value * 60 ** (parts.length - 1 - index), 0);

  const simulateClick = (document, node) => {
    console.log('simulateClick');
    const rect = node.getBoundingClientRect();
    const clientX = rect.x + rect.width / 2;
    const clientY = rect.y + rect.height / 2;
    const target = document.elementFromPoint(clientX, clientY);
    ['mouseover', 'mousemove', 'mousedown', 'mouseup', 'click']
      .forEach(i => target.dispatchEvent(new MouseEvent(i, { clientX, clientY, bubbles: true })))
  };

  const subscribeOnChanges = (node, f) => {
    f(node);
    new MutationObserver(mutations => mutations.forEach(m => m.addedNodes.forEach(f)))
      .observe(node, { childList: true, subtree: true });
  };

  const pornhub = _ => {
    // TODO: never redirect, just update the URLs
    // TODO: improve resistance to exceptions

    const UNWANTED = '__unwanted';
    const loadUnwanted = () => JSON.parse(localStorage.getItem(UNWANTED)) || {};
    const setUnwanted = (url, ttl) => {
      const id = videoId(url);
      if (!id) return;
      const unwanted = loadUnwanted();
      if (!unwanted[id]) {
        localStorage.setItem(UNWANTED, JSON.stringify({ ...unwanted, [id]: ttl }))
      }
    };
    const isUnwanted = url => currentTime() < loadUnwanted()[videoId(url)];
    const videoId = url => url.searchParams.get('viewkey') || url.pathname.split('/').slice(-1)[0];
    const watchedVideos = new Set;
    const disliked = main => !!main.querySelector('div.active[data-title="I Dislike This"]');

    const processEmbedded = (document, similarVideos) => {
      const main = document.querySelector('div#main-container') || document.body;
      const css = `
        div.mgp_topBar { display: none !important; }
        div.mgp_thumbnailsGrid { display: none !important; }
        img.mgp_pornhub { display: none !important; }
      `;
      const styleApplied = [...main.querySelectorAll('style')]
        .filter(i => i.innerHTML === css)
        .length > 0;
      if (styleApplied) {
        console.log('embedded video is already initialized');
        return;
      }
      console.log('applying style');
      const style = document.createElement('style');
      style.innerHTML = css;
      main.appendChild(style);

      const requiresRefresh = main.querySelector('div.mgp_errorIcon') && main.querySelector('p')?.textContent.includes('Please refresh the page');
      if (requiresRefresh) {
        console.log('refreshing after error');
        window.location.href = window.location.toString();
      }

      const video = main.querySelector('video');
      if (!video) {
        console.log('embedding this video is probably not allowed');
        window.stop();

        if (!isUnwanted(url)) {
          console.log('making single refresh attempt');
          setUnwanted(url, currentTime() + 5 * 60);
          window.location = url.toString();
          return;
        }

        if (similarVideos.length > 0) {
          console.log('redirecting to random non-unwanted similar video');
          const newSimilarVideos = similarVideos.filter(i => !watchedVideos.has(i));
          window.location.href = newSimilarVideos.length > 0 ? pickRandom(newSimilarVideos) : pickRandom(similarVideos);
        } else {
          console.log('giving up');
        }
        return;
      }

      video.addEventListener('loadstart', _ => simulateClick(document, main.querySelector('div.mgp_playIcon')));
      video.addEventListener('loadedmetadata', _ => {
        if (disliked(main)) {
          setUnwanted(url, Number.MAX_SAFE_INTEGER);
        }
        video.currentTime = random(video.duration / 4, video.duration / 3);
      });
      main.querySelector('div.mgp_gridMenu')?.addEventListener('click', _ => setTimeout(_ => {
        if (video.paused) {
          console.log('paused on grid menu');
          const button = main.querySelector('div.mgp_playIcon');
          simulateClick(document, button);
          setTimeout(_ => {
            if (video.paused) {
              console.log('still paused');
              simulateClick(document, button);
            }
          }, 500);
        }
      }, 100));

      video.load();
    };

    const processPreview = i => {
      const link = i.closest('a');
      if (link) {
        const duration = timeToSeconds(i.textContent);
        const t = random(duration / 4, duration / 3);

        const premiumRedirect = !link.href.startsWith('https://');
        if (!premiumRedirect) {
          link.href += `&t=${t}`;
        }

        const node = link.closest('div.phimage')?.parentNode || link.closest('li');
        if (premiumRedirect || duration < MIN_DURATION_MIN * 60 || isUnwanted(new URL(link.href))) {
          node?.classList.add(UNWANTED);
        } else {
          if (link.querySelector('div.watchedVideoText')) {
            watchedVideos.add(link.href);
          }
          return link.href;
        }
      }
    };

    const processPlaylistItem = node => {
      if (node.nodeType !== 1) return;

      if (node.tagName === 'SPAN' && node.classList.contains('duration')) {
        processPreview(node);
        return;
      }

      node.childNodes.forEach(processPlaylistItem);
    };

    const main = document.querySelector('div#main-container') || document.body;
    subscribeOnChanges(main, processPlaylistItem);

    const style = document.createElement('style');
    style.innerHTML = `
      div.${UNWANTED}, li.${UNWANTED} { opacity: 10%; }
      div.${UNWANTED}:hover, li.${UNWANTED}:hover { opacity: 40%; }
    `;
    main.appendChild(style);

    const similarVideos = [...main.querySelectorAll('var.duration')]
      .map(i => processPreview(i))
      .filter(i => i);

    if (p.startsWith('/embed/')) {
      // this branch gets selected for both iframed and redirected embedded player
      setTimeout(_ => {
        console.log('processing embedded');
        processEmbedded(document, similarVideos); // document is a part of iframe here
      }, 1000);
    } else if (p === '/view_video.php') {
      const durationFromNormalPlayer = timeToSeconds(main.querySelector('span.mgp_total')?.textContent);
      if (durationFromNormalPlayer) {
        const lowQuality = ![...main.querySelectorAll('ul.mgp_quality > li')].find(i => i.textContent.includes(MIN_VIDEO_HEIGHT));
        console.log('low quality', lowQuality);
        if (lowQuality || disliked(main)) {
          setUnwanted(url, Number.MAX_SAFE_INTEGER);
        }

        if (!params.has('t') || Number(params.get('t')) >= durationFromNormalPlayer) {
          window.stop();
          params.set('t', random(durationFromNormalPlayer / 4, durationFromNormalPlayer / 3));
          window.location.replace(url.toString());
        }
      } else {
        console.log('fallback to embedded player');
        const embedUrl = `https://www.pornhub.com/embed/${params.get('viewkey')}`;
        const container = main.querySelector('div.playerFlvContainer');
        if (container) {
          const iframe = document.createElement('iframe');
          iframe.onload = _ => {
            console.log('processing embedded video from onload');
            processEmbedded(iframe.contentWindow.document, similarVideos);
          };
          iframe.referrerpolicy = 'no-referrer';
          iframe.width = '100%';
          iframe.height = '100%';
          iframe.frameborder = '0';
          iframe.scrolling = 'no';
          iframe.allowfullscreen = '';
          iframe.src = embedUrl;
          container.appendChild(iframe);
        } else {
          console.log('player not found, redirecting to embedded player');
          window.stop();
          window.location.href = embedUrl;
        }
      }
    } else if (params.get('hd') !== '1' && !params.has('min_duration') && (p.startsWith('/categories/') || p === '/video' || p === '/video/search')) {
      params.set('min_duration', MIN_DURATION_MIN);
      params.set('hd', 1);
      newUrl = url.toString();
    }
  };

  const xvideos = _ => {
    // TODO: never redirect, just update the URLs

    if (p === '/' && params.has('k') && !params.has('quality')) {
      params.set('sort', 'rating');
      params.set('durf', `${MIN_DURATION_MIN}min_more`);
      params.set('quality', `${MIN_VIDEO_HEIGHT}P`);
      newUrl = url.toString();
    } else if (p.startsWith('/c/') && !p.includes(`q:${MIN_VIDEO_HEIGHT}P`)) {
      const ps = p.split('/');
      if (ps.length >= 3) {
        url.pathname = `${ps[1]}/s:rating/d:${MIN_DURATION_MIN}min_more/q:${MIN_VIDEO_HEIGHT}P/${ps[2]}`;
        newUrl = url.toString();
      }
    }
  };

  const spankbang = _ => {
    // TODO: never redirect, just update the URLs

    if (!p.endsWith('/tags') && !p.includes('/playlist/') && !(params.has('q') && params.has('d'))) {
      if (p === '/') {
        url.pathname = '/trending_videos/'
      }
      params.set('q', 'fhd');
      params.set('d', MIN_DURATION_MIN);
      newUrl = url.toString();
    }
  };

  const porntrex = _ => {
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

  const xhamster = _ => {
    // TODO: never redirect, just update the URLs

    if (p.startsWith('/search/')) {
      if (params.get('length') !== 'full') {
        params.set('quality', `${MIN_VIDEO_HEIGHT}p`);
        params.set('length', 'full');
        newUrl = url.toString();
      }
    } else if (p.startsWith('/categories/') || p.startsWith('/channels/')) {
      if (!p.includes('/hd/')) {
        newUrl = `${url}/hd/full-length/best?quality=${MIN_VIDEO_HEIGHT}p`;
      }
    } else if (p === '/') {
      newUrl = `${url}/hd/full-length/best/monthly?quality=${MIN_VIDEO_HEIGHT}p`;
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
