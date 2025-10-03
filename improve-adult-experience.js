// ==UserScript==
// @name Improve Adult Experience
// @description Skip intros, set better default quality and duration filters, make unwanted video previews transparent, do fallbacks in case of load failures. Supported websites: pornhub.com, xvideos.com, spankbang.com, porntrex.com, xhamster.com
// @icon https://www.google.com/s2/favicons?sz=64&domain=pornhub.com
// @version 0.14
// @downloadURL https://userscripts.codonaft.com/improve-adult-experience.js
// @match https://spankbang.com/*
// @match https://www.pornhub.com/*
// @match https://www.porntrex.com/*
// @match https://www.xvideos.com/*
// @match https://xhamster.com/*
// ==/UserScript==

(_ => {
  'use strict';

  const MINOR_IMPROVEMENTS = true; // NOTE: try to turn this off in case if UI appears to be broken somehow
  const AUTOPLAY = true;

  const MIN_DURATION_MINS = 20;
  const MIN_VIDEO_HEIGHT = 1080;

  if (performance.getEntriesByType('navigation')[0]?.responseStatus !== 200) return;

  const UNWANTED = '__unwanted';

  const origin = window.location.origin;
  const url = new URL(window.location.href);
  const params = url.searchParams;
  const h = url.hostname;
  const p = url.pathname;
  const validLink = node => node?.tagName === 'A' && node?.href.startsWith(url.origin);
  const err = (e, node) => {
    console.log(node);
    console.error(e);
  };

  const currentTime = () => Math.round(Date.now() / 1000);
  const random = (min, max) => Math.floor(Math.random() * (max - min + 1) + min);
  const pickRandom = xs => xs[random(0, xs.length)];

  const timeToSeconds = time => (time || '').trim().split(':').map(Number).reduceRight((total, value, index, parts) => total + value * 60 ** (parts.length - 1 - index), 0);

  const simulateClick = (document, node) => {
    console.log('simulateClick', node);
    if (!node) return;
    try {
      const rect = node.getBoundingClientRect();
      const clientX = rect.x + rect.width / 2;
      const clientY = rect.y + rect.height / 2;
      const target = document.elementFromPoint(clientX, clientY);
      ['mouseover', 'mousemove', 'mousedown', 'mouseup', 'click']
        .forEach(i => target.dispatchEvent(new MouseEvent(i, { clientX, clientY, bubbles: true })))
    } catch (e) {
      err(e, node);
    }
  };

  const subscribeOnChanges = (node, f) => {
    const g = node => {
      const children = node?.querySelectorAll?.('a, div, li, span, var, video') || [];
      [node, ...children].forEach(i => {
        if (i?.nodeType !== 1) return;
        try {
          f(i);
        } catch (e) {
          err(e, node);
        }
      });
    };

    g(node);

    new MutationObserver(mutations => mutations.forEach(m => m.addedNodes.forEach(g)))
      .observe(node, { childList: true, subtree: true });
  };

  const pornhub = _ => {
    const loadUnwanted = () => JSON.parse(localStorage.getItem(UNWANTED)) || {};
    const setUnwanted = (url, ttl) => {
      const id = videoId(url);
      if (!id) return;
      const unwanted = loadUnwanted();
      if (!unwanted[id]) {
        localStorage.setItem(UNWANTED, JSON.stringify({ ...unwanted, [id]: ttl }));
      }
    };
    const isUnwanted = url => {
      const id = videoId(url);
      if (!id) return false;
      const unwanted = loadUnwanted();
      const ttl = unwanted[id];
      const result = currentTime() < ttl;
      if (!result && ttl) {
        delete unwanted[id];
        localStorage.setItem(UNWANTED, JSON.stringify(unwanted));
      }
      return result;
    };
    const videoId = url => url.searchParams.get('viewkey') || url.pathname.split('/').slice(-1)[0];
    const watchedVideos = new Set;
    const similarVideos = new Set;

    const disliked = body => !!body.querySelector('div.active[data-title="I Dislike This"]');
    const premiumRedirect = node => node.href.startsWith('javascript:');

    const searchFilterParams = Object.entries({
      'min_duration': MIN_DURATION_MINS,
      'hd': 1,
      'o': 'tr',
      't': 'm',
    });

    const processEmbedded = document => {
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

          if (similarVideos.size > 0) {
            console.log('redirecting to a random non-unwanted similar video');
            const newSimilarVideos = similarVideos.difference(watchedVideos);
            const href = pickRandom(newSimilarVideos.size > 0 ? [...newSimilarVideos] : [...similarVideos]);
            if (href) {
              window.location.href = href;
            }
          } else {
            console.log('giving up');
          }
          return;
        }
      } catch (e) {
        console.error(e);
      }

      if (AUTOPLAY) {
        video.addEventListener('loadstart', _ => {
          if (video.paused) {
            simulateClick(document, body.querySelector('div.mgp_playIcon'));
          }
        });
      }
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
      if (node.tagName === 'LI') {
        node = node.querySelector('a')?.querySelector('var.duration');
      }
      const duration = ['VAR', 'SPAN'].includes(node.tagName) && node.classList.contains('duration') && timeToSeconds(node.textContent);
      if (!duration) return;

      const link = node?.closest('a');
      if (!link) return;

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
        similarVideos.add(link.href);
      }
    };

    subscribeOnChanges(body, node => {
      try {
        processPreview(node);
      } catch (e) {
        err(e, node);
      }

      if (!validLink(node) || premiumRedirect(node) || node.closest('ul.filterListItem')) return;

      const url = new URL(node.href.startsWith('https:') ? node.href : `${origin}${node.href}`);
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
    });

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

        // TODO: f = fullscreen, space = pause
        if (document.activeElement !== searchInput && '/sS'.includes(event.key)) {
          event.preventDefault();
          searchInput.focus();
        }
      });
    }

    if (p.startsWith('/embed/')) {
      // this branch gets selected for both iframed and redirected embedded player
      setTimeout(_ => {
        console.log('processing embedded');
        processEmbedded(document); // document is a part of iframe here
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
            processEmbedded(iframe.contentWindow.document);
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
    const body = document.body;
    body
      .querySelectorAll('video')
      .forEach(i => {
        if (AUTOPLAY) {
          i.addEventListener('loadeddata', _ => {
            if (i.paused) {
              body.querySelector('div.big-button.play')?.click();
            }
          });
        }
        i.addEventListener('loadedmetadata', _ => i.currentTime = random(i.duration / 4, i.duration / 3));
        i.load();
      });

    const searchInput = body.querySelector('input.search-input[type="text"], input[placeholder="Search X videos"], input[type="text"]');
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

    try {
      const style = document.createElement('style');
      style.innerHTML = `
        div.${UNWANTED} { opacity: 10%; }
        div.${UNWANTED}:hover { opacity: 40%; }
        a.premium { display: none !important; }
      `;
      body.appendChild(style);
    } catch (e) {
      console.error(e);
    }

    subscribeOnChanges(body, node => {
      try {
        if (node.matches('span.video-hd-mark, span.video-sd-mark')) {
          const inside = node.closest('div.thumb-inside, div.video-thumb');
          const under = inside?.parentNode?.querySelector('div.thumb-under, div.video-under');
          const duration = under?.querySelector('span.duration')?.textContent;
          const tooShort = !duration?.includes('h') && Number(duration?.split(' min')[0] || 0) < MIN_DURATION_MINS;
          const tooSmall = (Number(node.textContent.split('p')[0]) || 0) < MIN_VIDEO_HEIGHT;
          if (tooShort || tooSmall) {
            under?.classList.add(UNWANTED);
            inside?.classList.add(UNWANTED);
          }
          return;
        }
      } catch (e) {
        err(e, node);
      }

      if (!validLink(node) || node.closest('div.search-filters')) return;

      const url = new URL(node.href);
      const params = url.searchParams;
      const p = url.pathname;
      if (p === '/' && params.has('k') && !params.has('quality')) {
        params.set('sort', 'rating');
        params.set('durf', `${MIN_DURATION_MINS}min_more`);
        params.set('quality', `${MIN_VIDEO_HEIGHT}P`);
        node.href = url.toString();
        return;
      } else if (p.startsWith('/c/') && !p.includes(`q:${MIN_VIDEO_HEIGHT}P`)) {
        const ps = p.split('/');
        if (ps.length >= 3) {
          url.pathname = `${ps[1]}/s:rating/d:${MIN_DURATION_MINS}min_more/q:${MIN_VIDEO_HEIGHT}P/${ps[2]}`;
          node.href = url.toString();
        }
      }
    });
  };

  const spankbang = _ => {
    const body = document.body;
    body
      .querySelectorAll('video')
      .forEach(i => {
        i.addEventListener('loadeddata', _ => {
          console.log('loadeddata');
          if (AUTOPLAY && i.paused) {
            body.querySelector('button[title="Play"]')?.click();
          }
        });
        i.addEventListener('loadedmetadata', _ => {
          console.log('loadedmetadata');
          i.currentTime = random(i.duration / 4, i.duration / 3)
          if (AUTOPLAY && i.paused) {
            body.querySelector('span.i-play#play-button')?.click();
          }
        });
        i.load();
      });

    try {
      const style = document.createElement('style');
      style.innerHTML = `
        div.${UNWANTED} { opacity: 10%; }
        div.${UNWANTED}:hover { opacity: 40%; }
      `;
      body.appendChild(style);
    } catch (e) {
      console.error(e);
    }

    // TODO
    /*const searchInput = body.querySelector('input#search-input[type="text"], input[type="text"]');
    const searchForm = searchInput?.closest('form');
    //body.querySelector('button#search-button, button[type="submit"]')?.addEventListener('click', event => {
    searchForm?.addEventListener('submit', event => {
      event.preventDefault();
      event.stopImmediatePropagation();

      const query = (searchInput.value || '').trim();
      if (query.length === 0) return;

      const url = new URL(`${origin}/s/${query}/`);
      const params = url.searchParams;
      params.set('d', MIN_DURATION_MINS);
      params.set('q', 'fhd');
      window.location.href = url.toString();
    }, true);*/

    subscribeOnChanges(body, node => {
      try {
        if (node.matches('span[data-testid="video-item-length"]')) {
          const duration = Number(node.textContent.split('m')[0]) || 0;
          if (duration < MIN_DURATION_MINS) {
            node.closest('div[data-testid="video-item"]')?.classList.add(UNWANTED);
          }
          return;
        }
      } catch (e) {
        console.error(e);
      }

      if (!validLink(node)) return;

      const url = new URL(node.href);
      const params = url.searchParams;
      const p = url.pathname;
      if (!p.endsWith('/tags') && !p.includes('/playlist/') && !p.includes('/video/') && !(params.has('q') && params.has('d'))) {
        if (p === '/') {
          url.pathname = '/trending_videos/'
        }
        params.set('q', 'fhd');
        params.set('d', MIN_DURATION_MINS);
        node.href = url.toString();
      }
    });
  };

  const porntrex = _ => {
    const body = document.body;
    const minDuration = 'thirty-all-min';
    const topRated = 'top-rated';
    const ending = `${topRated}/${minDuration}/`;

    const searchInput = body.querySelector('input[type="text"][placeholder="Search"], input[type="text"][name="q"]');
    body.querySelector('button[type="submit"][aria-label="search"], button[type="submit"]')?.addEventListener('click', event => {
      event.preventDefault();
      event.stopImmediatePropagation();

      const query = (searchInput.value || '').trim();
      if (query.length === 0) return;

      window.location.href = `${origin}/search/${query}/${ending}`;
    }, true);

    /*if (MINOR_IMPROVEMENTS) {
      try {
        console.log('applying style');
        const style = document.createElement('style');
        style.innerHTML = 'div.sort-holder { display: none !important; }';
        body.appendChild(style);
      } catch (e) {
        console.error(e);
      }
    }*/

    let initializedVideo = false;
    const processNode = node => {
      if (validLink(node)) {
        const href = node.href;
        if (href.includes('/video/')) return;
        if (href.includes('/models/') && href.length === origin.length + '/models/a/'.length) return;
        if ([`/${ending}`, '/channels/', '/tags/'].find(i => href.endsWith(i))) return;
        if (node.closest('div.sort')) return;

        if (href.includes('/search/')) {
          node.href = `${href}/${ending}`;
        } else if (['categories', 'channels', 'models', 'tags'].find(i => href.includes(`/${i}/`))) {
          node.href = `${href.replace('/hd/', '/')}hd/${ending}`;
        } else if (href === `${origin}/${topRated}/`) {
          node.href = `${origin}/hd/${ending}`;
        } else if (['latest-updates', 'most-commented', 'most-favourited', 'most-popular'].find(i => [`${origin}/${i}/`, `${origin}/hd/${i}/`].includes(href))) {
          node.href = `${origin.replace('/hd/', '/')}/hd${node.href.split(origin)[1]}${minDuration}/`;
        }
      } else if (!initializedVideo && node.tagName === 'VIDEO') {
        console.log('processing video');
        initializedVideo = true;
        node.addEventListener('loadeddata', _ => {
          console.log('loadeddata');
          if (AUTOPLAY && node.paused) {
            body.querySelector('div.big-button.play')?.click();
          }
        });
        node.addEventListener('loadedmetadata', _ => {
          console.log('loadedmetadata');
          node.currentTime = random(node.duration / 4, node.duration / 3);
        });
        node.load();
      }
    };
    subscribeOnChanges(body, processNode);

    if (AUTOPLAY) {
      body.querySelector('a.fp-play')?.click();
    }
  };

  const xhamster = _ => {
    const body = document.body;
    const searchInput = body.querySelector('input[name="q"][type="text"], input[type="text"]');
    const searchForm = searchInput?.closest('form');
    searchForm?.querySelector('button.search-submit[type="submit"], button[type="submit"]')?.addEventListener('click', event => {
      event.preventDefault();
      event.stopImmediatePropagation();

      const query = (searchInput.value || '').trim();
      if (query.length === 0) return;

      const url = new URL(`${origin}/search/${query}`);
      const params = url.searchParams;
      params.set('quality', `${MIN_VIDEO_HEIGHT}p`);
      params.set('min-duration', '20');
      params.set('length', 'full');
      window.location.href = url.toString();
    }, true);

    try {
      const style = document.createElement('style');
      style.innerHTML = `
        div.${UNWANTED} { opacity: 10%; }
        div.${UNWANTED}:hover { opacity: 40%; }
      `;
      body.appendChild(style);
    } catch (e) {
      console.error(e);
    }

    const best = 'hd/full-length/best';
    let initializedVideo = false;
    subscribeOnChanges(body, node => {
      if (node.matches('div[data-role="video-duration"]')) {
        // FIXME
        if (timeToSeconds(node.textContent) < MIN_DURATION_MINS * 60) {
          node.closest('div.video-thumb, div.thumb-list__item')?.classList.add(UNWANTED);
        }
      } else if (validLink(node)) {
        const url = new URL(node.href);
        const params = url.searchParams;
        const p = url.pathname;
        if (p.startsWith('/search/')) {
          if (params.get('length') !== 'full') {
            params.set('quality', `${MIN_VIDEO_HEIGHT}p`);
            params.set('length', 'full');
            node.href = url.toString();
          }
        } else if (p === '/' || ['/categories/', '/channels/'].find(i => p.startsWith(i))) {
          node.href = `${node.href.replace(/\/hd$/, '/')}/${best}/monthly?quality=${MIN_VIDEO_HEIGHT}p`;
        }
      } else if (!initializedVideo && node.tagName === 'VIDEO') {
        initializedVideo = true;
        node.addEventListener('loadeddata', _ => {
          console.log('loadeddata');
          /*if (AUTOPLAY && node.paused) {
            if (node.paused) {
              console.log('still paused');
              body.querySelector('div.play-inner')?.click();
            }
          }*/
        });
        node.addEventListener('loadedmetadata', _ => {
          console.log('loadedmetadata');
          node.currentTime = random(node.duration / 4, node.duration / 3)
          /*if (AUTOPLAY && node.paused) {
            body.querySelector('div.xplayer-start-button')?.click();
          }*/
        });
        node.load();
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
})();
