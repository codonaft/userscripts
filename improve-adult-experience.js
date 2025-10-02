// ==UserScript==
// @name Improve Adult Experience
// @description Skip intros, set better default quality and duration filters, make unwanted video previews transparent, do fallbacks in case of load failures
// @icon https://www.google.com/s2/favicons?sz=64&domain=pornhub.com
// @version 0.12
// @downloadURL https://userscripts.codonaft.com/improve-adult-experience.js
// @match https://spankbang.com/*
// @match https://www.pornhub.com/*
// @match https://www.porntrex.com/*
// @match https://www.xvideos.com/*
// @match https://xhamster.com/*
// ==/UserScript==

(_ => {
  'use strict';

  // TODO: DRY links

  const MINOR_IMPROVEMENTS = true; // NOTE: try to turn this off in case if UI appears to be broken somehow
  const MIN_DURATION_MINS = 20;
  const MIN_VIDEO_HEIGHT = 1080;

  if (performance.getEntriesByType('navigation')[0]?.responseStatus !== 200) return;

  const url = new URL(window.location.href);
  const params = url.searchParams;
  const h = url.hostname;
  const p = url.pathname;
  const valid = link => link.href.startsWith(url.origin);

  const currentTime = () => Math.round(Date.now() / 1000);
  const random = (min, max) => Math.floor(Math.random() * (max - min + 1) + min);
  const pickRandom = xs => xs[random(0, xs.length)];

  const timeToSeconds = time => (time || '').trim().split(':').map(Number).reduceRight((total, value, index, parts) => total + value * 60 ** (parts.length - 1 - index), 0);

  const simulateClick = (document, node) => {
    console.log('simulateClick');
    try {
      if (!node) return;
      const rect = node.getBoundingClientRect();
      const clientX = rect.x + rect.width / 2;
      const clientY = rect.y + rect.height / 2;
      const target = document.elementFromPoint(clientX, clientY);
      ['mouseover', 'mousemove', 'mousedown', 'mouseup', 'click']
        .forEach(i => target.dispatchEvent(new MouseEvent(i, { clientX, clientY, bubbles: true })))
    } catch (e) {
      console.error(e);
    }
  };

  const subscribeOnChanges = (node, f) => {
    try {
      f(node);
      new MutationObserver(mutations => mutations.forEach(m => m.addedNodes.forEach(f)))
        .observe(node, { childList: true, subtree: true });
    } catch (e) {
      console.error(e);
    }
  };

  const pornhub = _ => {
    const UNWANTED = '__unwanted';
    // TODO: collect garbage
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

    const disliked = body => !!body.querySelector('div.active[data-title="I Dislike This"]');
    const premiumRedirect = node => node.href.startsWith('javascript:');

    const searchFilterParams = Object.entries({
      'min_duration': MIN_DURATION_MINS,
      'hd': 1,
      'o': 'tr',
      't': 'm',
    });

    const processEmbedded = (document, similarVideos) => {
      const body = document.body;
      try {
        const css = `
          div.mgp_topBar { display: none !important; }
          div.mgp_thumbnailsGrid { display: none !important; }
          img.mgp_pornhub { display: none !important; }
        `;
        const styleApplied = !![...body.querySelectorAll('style')].find(i => i.innerHTML === css);
        if (styleApplied) {
          console.log('embedded video is already initialized');
          return;
        }
        console.log('applying style');
        const style = document.createElement('style');
        style.innerHTML = css;
        body.appendChild(style);
      } catch (e) {
        console.error(e);
      }

      try {
        const requiresRefresh = body.querySelector('div.mgp_errorIcon') && body.querySelector('p')?.textContent.includes('Please refresh the page');
        if (requiresRefresh) {
          console.log('refreshing after error');
          window.location.href = window.location.toString();
        }
      } catch (e) {
        console.error(e);
      }

      const video = body.querySelector('video');
      try {
        if (!video) {
          console.log('embedding this video is probably not allowed');
          window.stop();

          if (!isUnwanted(url)) {
            console.log('making single refresh attempt');
            setUnwanted(url, currentTime() + 60 * 60);
            window.location = url.toString();
            return;
          }

          if (similarVideos.length > 0) {
            console.log('redirecting to a random non-unwanted similar video');
            const newSimilarVideos = similarVideos.filter(i => !watchedVideos.has(i));
            window.location.href = newSimilarVideos.length > 0 ? pickRandom(newSimilarVideos) : pickRandom(similarVideos);
          } else {
            console.log('giving up');
          }
          return;
        }
      } catch (e) {
        console.error(e);
      }

      video.addEventListener('loadstart', _ => simulateClick(document, body.querySelector('div.mgp_playIcon')));
      video.addEventListener('loadedmetadata', _ => {
        if (disliked(body)) {
          setUnwanted(url, Number.MAX_SAFE_INTEGER);
        }
        video.currentTime = random(video.duration / 4, video.duration / 3);
      });
      body.querySelector('div.mgp_gridMenu')?.addEventListener('click', _ => setTimeout(_ => {
        if (video.paused) {
          console.log('paused on grid menu');
          const button = body.querySelector('div.mgp_playIcon');
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

    const body = document.body;

    const processPreview = node => {
      try {
        const link = node.closest('a');
        if (!link) return;

        const duration = timeToSeconds(node.textContent);
        const premium = premiumRedirect(link);
        if (!premium) {
          const t = random(duration / 4, duration / 3);
          link.href += `&t=${t}`;
        }

        const container = link.closest('div.phimage')?.parentNode || link.closest('li');
        if (premium || duration < MIN_DURATION_MINS * 60 || isUnwanted(new URL(link.href))) {
          container?.classList.add(UNWANTED);
        } else {
          if (link.querySelector('div.watchedVideoText')) {
            watchedVideos.add(link.href);
          }
          return link.href;
        }
      } catch (e) {
        console.log(e);
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

    const processLink = node => {
      if (node.nodeType !== 1) return;
      if (node.tagName === 'A') {
        try {
          if (premiumRedirect(node) || node.closest('ul.filterListItem')) return;
          const url = new URL(node.href.startsWith('https:') ? node.href : `${window.location.origin}${node.href}`);
          const params = url.searchParams;
          const p = url.pathname;
          const parts = p.split('/');
          if (['/video', '/video/search'].includes(p) || p.startsWith('/categories/')) {
            searchFilterParams.forEach(([key, value]) => params.set(key, value));
          } else if (p.startsWith('/pornstar/')) {
            if (parts.length === 3) {
              url.pathname = [...parts, 'videos', 'upload'].join('/');
            } else if (!p.endsWith('/videos/upload')) {
              return;
            }
            params.set('o', 'lg');
          } else if (['/model/', '/channels/'].find(i => p.startsWith(i))) {
            if (parts.length === 3) {
              url.pathname = [...parts, 'videos'].join('/');
            } else if (!p.endsWith('/videos')) {
              return;
            }
            params.set('o', p.startsWith('/model/') ? 'lg' : 'ra');
          }
          setTimeout(_ => node.href = url.toString(), 500);
        } catch (e) {
          console.error(node.href, e);
        }
        return;
      }
      node.childNodes.forEach(processLink);
    };

    const similarVideos = [...body.querySelectorAll('var.duration')]
      .map(i => processPreview(i))
      .filter(i => i);
    subscribeOnChanges(body, processPlaylistItem);
    subscribeOnChanges(body, processLink);

    try {
      const style = document.createElement('style');
      style.innerHTML = `
        div.${UNWANTED}, li.${UNWANTED} { opacity: 10%; }
        div.${UNWANTED}:hover, li.${UNWANTED}:hover { opacity: 40%; }
        ${MINOR_IMPROVEMENTS ? `#searchSuggestions a:focus { background-color: #111111; }` : ''}
      `;
      body.appendChild(style);
    } catch (e) {
      console.error(e);
    }

    const searchInput = body.querySelector('input#searchInput[type="text"], input[type="text"][name="search"], input[type="text"]');
    const searchForm = searchInput?.closest('form');
    searchForm?.addEventListener('submit', event => {
      event.preventDefault();
      event.stopImmediatePropagation();

      const node = document.activeElement;
      const input = searchInput || (node.tagName === 'INPUT' && searchForm.contains(node) ? node : undefined);
      const query = (input?.value || '').trim();
      if (query.length === 0) return;

      const url = new URL(searchForm.action);
      searchFilterParams.forEach(([key, value]) => url.searchParams.set(key, value));
      url.searchParams.set('search', query);
      window.location.href = url.toString();
    }, true);

    if (MINOR_IMPROVEMENTS && searchInput) {
      document.addEventListener('keydown', event => {
        if (event.ctrlKey || event.altKey || event.metaKey) return;

        if (document.activeElement !== searchInput && ['/','s', 'S'].includes(event.key)) {
          event.preventDefault();
          searchInput.focus();
        }
      });
    }

    if (p.startsWith('/embed/')) {
      // this branch gets selected for both iframed and redirected embedded player
      setTimeout(_ => {
        console.log('processing embedded');
        processEmbedded(document, similarVideos); // document is a part of iframe here
      }, 1000);
    } else if (p === '/view_video.php') {
      const durationFromNormalPlayer = timeToSeconds(body.querySelector('span.mgp_total')?.textContent);
      if (durationFromNormalPlayer) {
        const lowQuality = ![...body.querySelectorAll('ul.mgp_quality > li')].find(i => i.textContent.includes(MIN_VIDEO_HEIGHT));
        console.log('low quality', lowQuality);
        if (lowQuality || disliked(body)) {
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
        const container = body.querySelector('div.playerFlvContainer');
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
    }
  };

  const xvideos = _ => {
    const searchInput = document.body.querySelector('input.search-input[type="text"], input[placeholder="Search X videos"], input[type="text"]');
    const searchForm = searchInput?.closest('form');
    searchForm?.addEventListener('submit', event => {
      event.preventDefault();
      event.stopImmediatePropagation();

      const query = (searchInput.value || '').trim();
      if (query.length === 0) return;

      const url = new URL(searchForm.action);
      const params = url.searchParams;
      params.set('sort', 'rating');
      params.set('durf', `${MIN_DURATION_MINS}min_more`);
      params.set('quality', `${MIN_VIDEO_HEIGHT}P`);
      url.searchParams.set('k', query);
      window.location.href = url.toString();
    }, true);

    const processLink = node => {
      if (node.nodeType !== 1) return;
      if (node.tagName === 'A') {
        try {
          if (!valid(node) || node.closest('div.search-filters')) return;

          const url = new URL(node.href);
          const params = url.searchParams;
          const p = url.pathname;
          if (p === '/' && params.has('k') && !params.has('quality')) {
            params.set('sort', 'rating');
            params.set('durf', `${MIN_DURATION_MINS}min_more`);
            params.set('quality', `${MIN_VIDEO_HEIGHT}P`);
            node.href = url.toString();
          } else if (p.startsWith('/c/') && !p.includes(`q:${MIN_VIDEO_HEIGHT}P`)) {
            const ps = p.split('/');
            if (ps.length >= 3) {
              url.pathname = `${ps[1]}/s:rating/d:${MIN_DURATION_MINS}min_more/q:${MIN_VIDEO_HEIGHT}P/${ps[2]}`;
              node.href = url.toString();
            }
          }
        } catch (e) {
          console.error(e);
        }
      }
      node.childNodes.forEach(processLink);
    };

    subscribeOnChanges(document.body, processLink);
  };

  const spankbang = _ => {
    // TODO: search?
    document.body.querySelectorAll('a').forEach(link => {
      try {
        const url = new URL(link.href);
        const params = url.searchParams;
        const p = url.pathname;
        if (!p.endsWith('/tags') && !p.includes('/playlist/') && !(params.has('q') && params.has('d'))) {
          if (p === '/') {
            url.pathname = '/trending_videos/'
          }
          params.set('q', 'fhd');
          params.set('d', MIN_DURATION_MINS);
          link.href = url.toString();
        }
      } catch (e) {
        console.error(e);
      }
    });
  };

  const porntrex = _ => {
    const body = document.body;
    const searchInput = body.querySelector('input[type="text"][name="q"]'); // TODO
    body.querySelector('button[type="submit"][aria-label="search"], button[type="submit"]')?.addEventListener('click', event => {
      event.preventDefault();
      event.stopImmediatePropagation();

      const query = (searchInput.value || '').trim();
      if (query.length === 0) return;

      window.location.href = `${window.location.origin}/search/${query}/top-rated/thirty-all-min/`;
    }, true);

    const expectedPage = (page, href) =>
      href.startsWith(`https://www.porntrex.com/${page}/`) && (page === 'top-rated' || href.split('/').length > 5);

    const processLink = node => {
      if (node.nodeType !== 1) return;
      if (node.tagName === 'A') {
        try {
          if (['categories', 'channels', 'models', 'top-rated'].find(page => expectedPage(page, node.href))) {
            const url = new URL(node.href);
            const ps = url.pathname.split('/').filter(i => i.length > 0);
            for (const i of ['hd', 'top-rated', 'thirty-all-min']) {
              if (!ps.includes(i)) {
                ps.push(i);
              }
            }
            ps.push('');
            ps.unshift('');
            url.pathname = ps.join('/');
            node.href = url.toString();
          } else if (node.href.startsWith(`${window.location.origin}/search/`) && !node.href.includes('/top-rated/thirty-all-min/')) {
            node.href = `${node.href}top-rated/thirty-all-min/`;
          }
        } catch (e) {
          console.error(e);
        }
      }

      node.childNodes.forEach(processLink);
    };

    body.querySelectorAll('a').forEach(processLink);
    subscribeOnChanges(document.body, processLink);
  };

  const xhamster = _ => {
    const searchInput = document.body.querySelector('input[name="q"][type="text"], input[type="text"]');
    const searchForm = searchInput?.closest('form');
    searchForm?.querySelector('button.search-submit[type="submit"], button[type="submit"]')?.addEventListener('click', event => {
      event.preventDefault();
      event.stopImmediatePropagation();

      const query = (searchInput.value || '').trim();
      if (query.length === 0) return;

      const url = new URL(`${window.location.origin}/search/${query}`);
      const params = url.searchParams;
      params.set('quality', `${MIN_VIDEO_HEIGHT}p`);
      params.set('min-duration', '20');
      params.set('length', 'full');
      window.location.href = url.toString();
    }, true);

    // TODO: suggest?
    document.body.querySelectorAll('a').forEach(link => {
      try {
        if (!valid(link)) return;

        const url = new URL(link.href);
        const params = url.searchParams;
        const p = url.pathname;
        if (p.startsWith('/search/')) {
          if (params.get('length') !== 'full') {
            params.set('quality', `${MIN_VIDEO_HEIGHT}p`);
            params.set('length', 'full');
            link.href = url.toString();
          }
        } else if (p.startsWith('/categories/') || p.startsWith('/channels/')) {
          if (!p.includes('/hd/')) {
            link.href = `${url}/hd/full-length/best?quality=${MIN_VIDEO_HEIGHT}p`;
          }
        } else if (p === '/') {
          link.href = `${url}/hd/full-length/best/monthly?quality=${MIN_VIDEO_HEIGHT}p`;
        }
      } catch (e) {
        console.error(link.href, e);
      }
    });
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
})()
