// ==UserScript==
// @name Improve Adult Experience
// @description Skip intros, set better default quality/duration filters, make unwanted video previews transparent, workaround load failures. Supported websites: pornhub.com, xvideos.com, spankbang.com, porntrex.com, xhamster.com, txxx.com
// @icon https://www.google.com/s2/favicons?sz=64&domain=pornhub.com
// @version 0.19
// @downloadURL https://userscripts.codonaft.com/improve-adult-experience.js
// ==/UserScript==

(_ => {
  'use strict';

  const MINOR_IMPROVEMENTS = true; // NOTE: try to turn this off in case if UI appears to be broken somehow
  const AUTOPLAY = true; // NOTE: requires --autoplay-policy=no-user-gesture-required in chromium-like browsers

  const MIN_DURATION_MINS = 20;
  const MIN_VIDEO_HEIGHT = 1080;

  if (performance.getEntriesByType('navigation')[0]?.responseStatus !== 200) return;

  const UNWANTED = '__unwanted';
  const HIDE = '__hide';

  const body = document.body;
  const origin = window.location.origin;
  const validLink = node => node?.tagName === 'A' && node?.href?.startsWith(origin);
  const redirect = href => window.location.href = href;
  const refresh = _ => redirect(window.location.toString());

  const err = (e, node) => {
    console.log(node);
    console.error(e);
  };

  const currentTime = _ => Math.round(Date.now() / 1000);
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
      const target = document.elementFromPoint(clientX, clientY) || node;
      console.log('simulateClick target', target, clientX, clientY);
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

  const init = args => {
    const {
      shouldSetRandomPosition,
      css,
      playSelector,
      videoSelector,
      thumbnailSelector,
      qualitySelector,
      durationSelector,
      isUnwantedQuality,
      isUnwantedDuration,
      isUnwantedUrl,
      isVideoUrl,
      shouldHideLink,
      processNode,
    } = args || { shouldSetRandomPosition: true };

    try {
      const style = document.createElement('style');
      style.innerHTML = `
        .${HIDE} { display: none !important; }
        .${UNWANTED} { opacity: 10% !important; }
        .${UNWANTED}:hover { opacity: 40% !important; }
        ${MINOR_IMPROVEMENTS && css ? css : ''}
      `;
      body.appendChild(style);
    } catch (e) {
      console.error(e);
    }

    let usedToPlayOrIsPlaying = false;
    const playIfPaused = (playButton, video) => {
      if (usedToPlayOrIsPlaying || !video.paused) return;

      if (video.matches('video.jw-video')) {
        console.log('starting jwplayer');
        try {
          video.play();
          return;
        } catch (e) {
          err(e, video);
        }
      }

      console.log('clicking on play button', playButton, 'for the video', video);
      //simulateClick(document, playButton);
      try {
        playButton.click();
      } catch (e) {
        err(e, playButton);
      }

      setTimeout(_ => {
        if (usedToPlayOrIsPlaying || !video.paused) return;
        const rect = video.getBoundingClientRect();
        const offset = rect.width * 0.02;
        const clientX = rect.x + offset;
        const clientY = rect.y + rect.height - offset;
        const cornerPlayButton = document.elementFromPoint(clientX, clientY);
        if (cornerPlayButton && cornerPlayButton !== video) {
          console.log('fallback to corner play button', cornerPlayButton);
          try {
            cornerPlayButton.click();
          } catch (e) {
            err(e, cornerPlayButton);
          }
        } else {
          console.log('fallback to play method', video);
          try {
            video.play();
          } catch (e) {
            err(e, video);
          }
        }
      }, 1000);
    };

    let initializedVideo = false;
    subscribeOnChanges(body, node => {
      const url = new URL(window.location.href);
      const p = url.pathname;
      const isVideoPage = p !== '/' && (!isVideoUrl || isVideoUrl(p));

      if (AUTOPLAY && !usedToPlayOrIsPlaying && isVideoPage && playSelector && !videoSelector && node.matches(playSelector) && !body.querySelector('video')) {
        console.log('detected play button while there is no video node yet', node);
        setTimeout(_ => node.click(), 1);
        return;
      }

      if (node.tagName === 'A' && (!validLink(node)) || (node.href && shouldHideLink?.(node.href))) {
        node.classList.add(HIDE);
        return;
      }

      const unwanted = (qualitySelector && node.matches(qualitySelector) && isUnwantedQuality?.(node.textContent)) || (durationSelector && node.matches(durationSelector) && isUnwantedDuration?.(node.textContent)) || (validLink(node) && isUnwantedUrl?.(new URL(node.href)));
      if (unwanted) {
        const thumbnail = node.closest(thumbnailSelector);
        const thumbnails = node.closest(thumbnailSelector)?.parentNode?.querySelectorAll(thumbnailSelector);
        if (thumbnails?.length <= 2) {
          // xvideos
          thumbnails?.forEach(i => i.classList.add(UNWANTED));
        } else {
          thumbnail?.classList.add(UNWANTED);
        }
        return;
      }

      try {
        if (processNode) {
          processNode(node);
        }
      } catch (e) {
        err(e, node);
      }

      if (initializedVideo || !isVideoPage || !node.matches(videoSelector || 'video')) return;
      console.log('detected main video', node);

      ['loadstart', 'loadedmetadata', 'loadeddata', 'seeked', 'play'].forEach(i => {
        node.addEventListener(i, _ => {
          console.log(i);
          if (shouldSetRandomPosition && node.duration > 0 && node.currentTime === 0) {
            node.currentTime = random(node.duration / 4, node.duration / 3)
          }
        });
      })

      node.addEventListener('play', _ => {
        console.log('playback is initiated');
        usedToPlayOrIsPlaying = true;
      });

      node.addEventListener('playing', _ => {
        console.log('playback is started')
        node.focus(); // TODO: if observed on the page?
      });

      if (AUTOPLAY) {
        console.log('setting autoplay');

        node.addEventListener('loadstart', _ => {
          const playButton = body.querySelector(playSelector) || node;
          playIfPaused(playButton, node);
        });
      }

      initializedVideo = true;
      console.log('load');
      node.load();
    });
  };

  // TODO: consider xnxx.com, redtube.com, tnaflix.com, hdzog.tube, pornxp.com, рус-порно.tv, anysex.com, xgroovy.com, pmvhaven.com, pornhits.com, vxxx.com, manysex.com, inporn.com, hqporner.com, beeg.com, bingato.com, taboodude.com
  const shortDomain = window.location.hostname.replace(/^www\./, '');
  ({
    'pornhub.com': _ => {
      const DURATION_SELECTOR = 'var.duration, span.duration';

      const url = new URL(window.location.href);
      const params = url.searchParams;
      const p = url.pathname;

      const loadUnwanted = _ => JSON.parse(localStorage.getItem(UNWANTED)) || {};
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
      const isVideoUrl = href => href.includes('/view_video.php');
      const watchedVideos = new Set;
      const similarVideos = new Set;

      const disliked = body => !!body.querySelector('div.active[data-title="I Dislike This"]');

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
            refresh();
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
              redirect(url.toString());
              return;
            }

            if (similarVideos.size > 0) {
              console.log('redirecting to a random non-unwanted similar video');
              const newSimilarVideos = similarVideos.difference(watchedVideos);
              const href = pickRandom(newSimilarVideos.size > 0 ? [...newSimilarVideos] : [...similarVideos]);
              if (href) {
                redirect(href);
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

      const processPreview = node => {
        if (node.tagName === 'LI') {
          node = node.querySelector('a')?.querySelector('var.duration');
          if (!node) return;
        }
        const duration = node.matches(DURATION_SELECTOR) && timeToSeconds(node.textContent);
        if (!duration) return;

        const link = node?.closest('a');
        if (!link || !isVideoUrl(link.href)) return;

        const t = random(duration / 4, duration / 3);
        link.href += `&t=${t}`;

        if (link.querySelector('div.watchedVideoText')) {
          watchedVideos.add(link.href);
        }
        similarVideos.add(link.href);
      };

      init({
        shouldSetRandomPosition: false,
        css: '#searchSuggestions a:focus { background-color: #111111 !important; }',
        videoSelector: 'video:not(.gifVideo)',
        thumbnailSelector: 'div.phimage, li:has(span.info-wrapper)',
        durationSelector: DURATION_SELECTOR,
        isUnwantedDuration: text => timeToSeconds(text) < MIN_DURATION_MINS * 60,
        isUnwantedUrl: url => isUnwanted(url),
        isVideoUrl,
        shouldHideLink: href => href.includes('/gif/'),
        processNode: node => {
          try {
            processPreview(node);
          } catch (e) {
            err(e, node);
          }

          if (!validLink(node) || node.closest('ul.filterListItem')) return;

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
        },
      });

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
        redirect(url.toString());
      }, true);

      if (MINOR_IMPROVEMENTS && searchInput) {
        document.addEventListener('keydown', event => {
          if (event.ctrlKey || event.altKey || event.metaKey) return;

          // TODO: f = fullscreen, space = pause, click = toggle playback
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
      } else if (isVideoUrl(p)) {
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
            redirect(embedUrl);
          }
        }
      }
    },

    'porntrex.com': _ => {
      const minDuration = 'thirty-all-min';
      const topRated = 'top-rated';
      const ending = `${topRated}/${minDuration}/`;

      const searchInput = body.querySelector('input[type="text"][placeholder="Search"], input[type="text"][name="q"]');
      body.querySelector('button[type="submit"][aria-label="search"], button[type="submit"]')?.addEventListener('click', event => {
        event.preventDefault();
        event.stopImmediatePropagation();

        const query = (searchInput.value || '').trim();
        if (query.length === 0) return;

        redirect(`${origin}/search/${query}/${ending}`);
      }, true);

      init({
        shouldSetRandomPosition: true,
        // TODO: css: 'div.sort-holder { display: none !important; }',
        playSelector: 'a.fp-play',
        thumbnailSelector: 'div.thumb-item, span.video-item',
        qualitySelector: 'span.quality',
        durationSelector: 'div.durations, span.video-item-duration',
        isUnwantedQuality: text => (Number(text.split('p')[0]) || 0) < MIN_VIDEO_HEIGHT,
        isUnwantedDuration: text => timeToSeconds(text) < MIN_DURATION_MINS * 60,
        processNode: node => {
          if (!validLink(node)) return;

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
        },
      });
    },

    'spankbang.com': _ => {
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
        redirect(url.toString());
      }, true);*/

      init({
        shouldSetRandomPosition: true,
        css: `
          div[x-data="gifPage"] { display: none !important; }
          section.timeline { display: none !important; }
          div.positions-wrapper { display: none !important; }
        `,
        playSelector: 'span.i-play#play-button',
        videoSelector: 'div#video video',
        thumbnailSelector: 'div[data-testid="video-item"]',
        durationSelector: 'span[data-testid="video-item-length"], div[data-testid="video-item-length"]',
        isUnwantedDuration: text => (Number(text.split('m')[0]) || 0) < MIN_DURATION_MINS,
        processNode: node => {
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
        },
      });
    },

    'txxx.com': _ => {
      const hd = 'HD';
      init({
        shouldSetRandomPosition: true,
        css: '.jw-hardlink-inner { display: none !important; }',
        thumbnailSelector: 'div[class="thumb"]',
        qualitySelector: 'div[class="labels"]',
        durationSelector: 'div[class="labels"]',
        isUnwantedQuality: text => !text.startsWith(hd),
        isUnwantedDuration: text => timeToSeconds(text.split(hd)[1]) < MIN_DURATION_MINS * 60,
        processNode: _node => {
          // TODO: https://txxx.com/categories/big-butt/1/?sort=most-popular&date=all&type=hd&duration=2
        },
      });
    },

    'xhamster.com': _ => {
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
        redirect(url.toString());
      }, true);

      const best = 'hd/full-length/best';
      init({
        shouldSetRandomPosition: true,
        css: 'div[data-block="moments"] { display: none !important; }',
        thumbnailSelector: 'div.video-thumb, div.thumb-list__item',
        durationSelector: 'div[data-role="video-duration"]',
        isUnwantedDuration: text => timeToSeconds(text) < MIN_DURATION_MINS * 60,
        processNode: node => {
          if (!validLink(node)) return;

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
        },
      });
    },

    'xvideos.com': _ => {
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
        redirect(url.toString());
      }, true);

      init({
        shouldSetRandomPosition: true,
        css: 'a.premium { display: none !important; }',
        thumbnailSelector: 'div.thumb-inside, div.video-thumb, div.thumb-under, div.video-under',
        qualitySelector: 'span.video-hd-mark, span.video-sd-mark',
        durationSelector: 'span.duration',
        isUnwantedQuality: text => (Number(text.split('p')[0]) || 0) < MIN_VIDEO_HEIGHT,
        isUnwantedDuration: text => !text.includes('h') && Number(text.split(' min')[0] || 0) < MIN_DURATION_MINS,
        processNode: node => {
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
        },
      });
    },
  }[shortDomain] || init)();
})();
