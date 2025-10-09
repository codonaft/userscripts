// ==UserScript==
// @name Improve Adult Experience
// @description Skip intros, set better default quality/duration filters, make unwanted video previews transparent, workaround load failures. Supported websites: pornhub.com, xvideos.com, anysex.com, spankbang.com, porntrex.com, txxx.com, xnxx.com, xhamster.com, vxxx.com
// @icon https://www.google.com/s2/favicons?sz=64&domain=pornhub.com
// @version 0.26
// @downloadURL https://userscripts.codonaft.com/improve-adult-experience.user.js
// ==/UserScript==

'use strict';

const IGNORE_HOSTS = []; // NOTE: without 'www.', e.g. 'xvideos.com'
const MINOR_IMPROVEMENTS = true; // NOTE: try to turn this off in case if some UI appears to be broken

const AUTOPLAY = true; // NOTE: probably still requires --autoplay-policy=no-user-gesture-required in chromium-like browsers to work properly
const HIDE_EXTERNAL_LINKS = true;
const RANDOM_POSITION = true;

const MIN_DURATION_MINS = 20;
const MIN_VIDEO_HEIGHT = 1080;

if (performance.getEntriesByType('navigation')[0]?.responseStatus !== 200) return;

const UNWANTED = '__unwanted';
const HIDE = '__hide';

const body = document.body;
const origin = window.location.origin;
const validLink = node => node?.tagName === 'A' && node?.href?.startsWith(origin);
const redirect = href => {
  window.stop();
  window.location.href = href
};
const refresh = _ => redirect(window.location);
const refreshWithNoHistory = _ => {
  window.stop();
  window.location.replace(window.location);
};

const err = (e, node) => {
  console.log(node);
  console.error(e);
};

const currentTime = _ => Math.round(Date.now() / 1000);
const random = (min, max) => Math.floor(Math.random() * (max - min + 1) + min);
const pickRandom = xs => xs[random(0, xs.length)];

const timeToSeconds = time => (time || '').trim().split(':').map(Number).reduceRight((total, value, index, parts) => total + value * 60 ** (parts.length - 1 - index), 0);

const getTopNode = (document, node, x, y) => {
  if (!node) return;
  try {
    const rect = node.getBoundingClientRect();
    const clientX = rect.x + rect.width * x;
    const clientY = rect.y + rect.height * y;
    const target = document.elementFromPoint(clientX, clientY) || node;
    return { target, clientX, clientY };
  } catch (e) {
    err(e, node);
  }
};

const simulateClick = (document, node) => {
  if (!node) return;
  console.log('simulateClick', node);
  try {
    const { target, clientX, clientY } = getTopNode(document, node, 0.5, 0.5);
    console.log('simulateClick target', target, clientX, clientY);
    ['mouseover', 'mousemove', 'mousedown', 'mouseup', 'click']
      .forEach(i => target.dispatchEvent(new MouseEvent(i, { clientX, clientY, bubbles: true })))
  } catch (e) {
    err(e, node);
  }
};

const subscribeOnChanges = (node, selector, f) => {
  const apply = (node, observer) => {
    if (node?.nodeType !== 1) return;

    let observeChildren = true;
    if (node?.matches?.(selector)) {
      try {
        observeChildren = f(node, observer);
      } catch (e) {
        err(e, node);
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

const init = args => {
  const {
    css,
    searchInputSelector,
    searchFormOrSubmitButtonSelector,
    onSearch,
    playSelector,
    videoSelector,
    thumbnailSelector,
    qualitySelector,
    durationSelector,
    isUnwantedQuality,
    isUnwantedDuration,
    isUnwantedUrl,
    isVideoUrl,
    refreshOnPageChange,
    fatalFallback,
    processNode,
  } = args || {};

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

  let searchInputInitialized = false;
  let initializedVideo = false;
  let loadedMetadata = false;
  let playbackInitiated = false;
  let playbackStarted = false;
  const playIfPaused = video => {
    const playButton = body.querySelector(playSelector) || video;
    if (!video || playbackInitiated || !video.paused) return;

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

    if (playbackInitiated || !video.paused) {
      return;
    }
    console.log('fallback');
    const rect = video.getBoundingClientRect();
    const offset = rect.width * 0.02;
    const clientX = rect.x + offset;
    const clientY = rect.y + rect.height - offset;
    const cornerPlayButton = document.elementFromPoint(clientX, clientY);
    if (cornerPlayButton && cornerPlayButton !== video && [...cornerPlayButton.attributes].filter(i => i.textContent.toLowerCase().includes('play')) > 0) {
      console.log('fallback to corner play button', cornerPlayButton);
      try {
        cornerPlayButton.click();
      } catch (e) {
        err(e, cornerPlayButton);
      }
    } else if (loadedMetadata) {
      console.log('fallback to play method', video);
      try {
        video.play();
      } catch (e) {
        err(e, video);
      }
    } else {
      console.log('fallback failure, perhaps main player is incorrectly selected, reloading');
      try {
        if (fatalFallback) {
          console.log('calling fatal fallback');
          fatalFallback();
          return;
        }

        video.addEventListener('loadstart', _ => {
          console.log('loadstart autoplay fallback');
          if (RANDOM_POSITION) {
            const duration = video.duration || (15 * 60);
            const time = random(duration / 4, duration / 3);
            console.log('fallback set random position', time);
            video.currentTime = time;
          }
          playIfPaused(video);
          //video.muted = false; // TODO
          playbackInitiated = true;
        }, { once: true });

        video.load();
      } catch (e) {
        err(e, video);
      }
    }
  };

  let lastHref = window.location.href;
  //let focusInterval;
  let disallowGeneralAutoplay = false;
  subscribeOnChanges(body, 'a, div, input, li, span, var, video', (node, _observer) => {
    const newHref = window.location.href;
    if (newHref !== lastHref) {
      console.log('new page', newHref);
      lastHref = newHref;
      initializedVideo = false;
      loadedMetadata = false;
      playbackInitiated = false;
      playbackStarted = false;
      //if (focusInterval) {
      //  clearInterval(focusInterval);
        if (refreshOnPageChange) {
          refreshWithNoHistory();
          return true;
        }
      //}
    }

    if (MINOR_IMPROVEMENTS && HIDE_EXTERNAL_LINKS && node.tagName === 'A' && node.href.length > 0 && !validLink(node)) {
      node.classList.add(HIDE);
      return true;
    }

    if (MINOR_IMPROVEMENTS && !searchInputInitialized && (node.matches(searchInputSelector) || node.matches(searchFormOrSubmitButtonSelector))) {
      console.log('initializing search input');
      searchInputInitialized = true;
      const searchInput = node.matches(searchInputSelector) ? node : body.querySelector(searchInputSelector);
      if (!searchInput) {
        console.error('search input not found');
        return true;
      }

      document.addEventListener('keydown', event => {
        if (event.ctrlKey || event.altKey || event.metaKey || document.activeElement.tagName === 'INPUT') return;

        if (['KeyS', 'Slash'].includes(event.code)) {
          console.log('use search input');
          event.preventDefault();
          searchInput.focus();
        }
      });

      const formOrButton = body.querySelector(searchFormOrSubmitButtonSelector);
      const searchForm = formOrButton?.tagName === 'FORM' ? formOrButton : (node.closest('form') || formOrButton?.closest('form'));

      const handleSearch = event => {
        event.preventDefault();
        event.stopImmediatePropagation();
        const query = (searchInput.value || '').trim();
        if (query.length > 0) {
          onSearch?.(query, searchForm);
        }
      };

      // TODO: subscribe on both?
      if (formOrButton?.tagName === 'BUTTON') {
        formOrButton.addEventListener('click', handleSearch, true);
      } else {
        searchForm?.addEventListener('submit', handleSearch, true);
      }
      return true;
    }

    const url = window.location;
    const videoPage = url.pathname !== '/' && (!isVideoUrl || isVideoUrl(url.href));

    try {
      if (AUTOPLAY && !playbackInitiated && videoPage && playSelector && !videoSelector && node.matches(playSelector) && !body.querySelector('video')) {
        console.log('detected play button while there is no video node yet', node);
        setTimeout(_ => node.click(), 1);
        return true;
      }

      const unwanted = (qualitySelector && node.matches(qualitySelector) && isUnwantedQuality?.(node.textContent)) || (durationSelector && node.matches(durationSelector) && isUnwantedDuration?.(node.textContent)) || (validLink(node) && isUnwantedUrl?.(new URL(node.href)));
      if (unwanted) {
        const thumbnail = node.closest(thumbnailSelector);
        const thumbnails = node.closest(thumbnailSelector)?.parentNode?.querySelectorAll(thumbnailSelector);
        if (thumbnails?.length > 0 && thumbnails?.length <= 2) {
          // xvideos
          thumbnails?.forEach(i => i.classList.add(UNWANTED));
        } else {
          thumbnail?.classList.add(UNWANTED);
        }
        return true;
      }
    } catch (e) {
      err(e, node);
    }

    try {
      disallowGeneralAutoplay = !!processNode?.(node);
    } catch (e) {
      err(e, node);
    }

    if (disallowGeneralAutoplay || initializedVideo || !videoPage || !node.matches(videoSelector || 'video')) return true;

    const nonPreviewVideos = [...body.querySelectorAll('video')].filter(i => {
      const text = [...i.classList.values()].join(' ').toLowerCase();
      return !i.hasAttribute('loop') && !text.includes('preview') && !text.includes('lazyload');
    });
    const video = body.querySelector(videoSelector) || (
       nonPreviewVideos
        .filter(i => i.offsetHeight > 0)
        .sort((a, b) => b.offsetHeight - a.offsetHeight)[0] || nonPreviewVideos[0]
    );
    if (!video) {
      console.log('no video');
      return true;
    }

    console.log('detected main video', video);

    ['loadstart', 'loadedmetadata', 'loadeddata', 'seeked', 'play'].forEach(i => {
      video.addEventListener(i, _ => {
        console.log(i);
        if (RANDOM_POSITION && !playbackStarted && video.duration > 0 && video.currentTime === 0) {
          console.log('set random position');
          video.currentTime = random(video.duration / 4, video.duration / 3)
        }
      });
    });

    video.addEventListener('loadedmetadata', _ => {
      loadedMetadata = true;
      console.log('loadedmetadata, duration', video.duration);
    });

    video.addEventListener('play', _ => {
      console.log('playback is initiated');
      playbackInitiated = true;
    });

    video.addEventListener('playing', _ => {
      console.log('playback is started')
      playbackStarted = true;
      video.focus();
    });

    video.addEventListener('stalled', refresh);

    if (AUTOPLAY) {
      console.log('setting autoplay');
      video.addEventListener('loadstart', _ => {
        console.log('loadstart autoplay');
        playIfPaused(video);
      }, { once: true });
    }

    if (MINOR_IMPROVEMENTS) {
      video.tabindex = -1;
      // TODO: stop when page is not visible
      /*focusInterval = setInterval(_ => {
        const active = document.activeElement;
        if (active !== video && active.tagName !== 'INPUT') {
          console.log('restore focus to player');
          video.focus({ preventScroll: true });
        }
      }, 3000);*/
    }

    initializedVideo = true;
    console.log('load');
    video.load();

    return true;
  });
};

// TODO: consider redtube.com, tnaflix.com, hdzog.tube, pornxp.com, рус-порно.tv, xgroovy.com, pmvhaven.com, pornhits.com, manysex.com, inporn.com, hqporner.com, bingato.com, taboodude.com
const shortDomain = window.location.hostname.replace(/^www\./, '');
if (IGNORE_HOSTS.includes(shortDomain)) {
  console.log(shortDomain, 'is a part of ignore list');
  return;
}

({
  'anysex.com': _ => {
    const isVideoUrl = href => href.includes('/video/');
    init({
      searchInputSelector: 'input[type="text"][name="q"][placeholder="Search"], input#search-form[type="text"][name="q"], input[type="text"]',
      onSearch: (query, _form) => redirect(`${origin}/search/?sort=top&q=${query}`),
      thumbnailSelector: 'div.item',
      qualitySelector: 'span.item-quality',
      durationSelector: 'div.duration',
      isUnwantedDuration: text => timeToSeconds(text) < MIN_DURATION_MINS * 60,
      isUnwantedQuality: text => (Number(text.split('p')[0]) || 0) < MIN_VIDEO_HEIGHT,
      isVideoUrl,
      processNode: node => {
        if (!validLink(node) || node.closest('div.sort')) return;

        const url = new URL(node.href);
        if (url.pathname === '/') return;

        url.searchParams.set('sort', 'top');
        node.href = url;
      },
    });
  },

  'beeg.com': _ => {
    const cookie = document.cookie;
    const qualityPattern = 'video__quality=';
    const quality = Number(cookie.split(qualityPattern)[1]?.split(';')[0]) || 0;
    if (quality > 0 && quality < MIN_VIDEO_HEIGHT) {
      console.log('wrong quality', quality);
      document.cookie = `${qualityPattern}${MIN_VIDEO_HEIGHT}`;
      refresh();
      return;
    }

    const isVideoUrl = href => new URL(href).pathname !== '/';
    init({
      thumbnailSelector: 'div.tw-relative[data-testid="unit"]',
      durationSelector: 'span[data-testid="unit-amount"]',
      isUnwantedDuration: text => !text?.includes('FULL '),
      isVideoUrl,
      refreshOnPageChange: true,
      processNode: _node => {
        // TODO
      },
    });
  },

  'pornhub.com': _ => {
    const playSelector = 'div.mgp_playIcon';
    const videoSelector = 'video.mgp_videoElement:not(.gifVideo)';
    const durationSelector = 'var.duration, span.duration';

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

    const fatalFallback = _ => {
      console.log('fallback to embedded player');
      const container = body.querySelector('div.playerFlvContainer');
      try {
        const normalPlayer = body.querySelector(videoSelector);
        if (normalPlayer) {
          console.log('normal player', normalPlayer.duration, normalPlayer.paused, normalPlayer);
          setTimeout(_ => {
            if (normalPlayer.paused) {
              refresh();
            }
          }, 25000);
          return;
          /*if (!normalPlayer.paused) {
            const playButton = body.querySelector(playSelector);
            playButton?.click();
            console.log('stopped the normal player with button', playButton);
          }*/
          //normalPlayer.volume = 0;
          //normalPlayer.muted = true;
          //if (isFinite(normalPlayer.duration)) {
          //  normalPlayer.currentTime = normalPlayer.duration;
          //  console.log('set normal player currentTime to end');
          //}
        }
        //container?.querySelectorAll('*').forEach(i => i.classList.add(HIDE));
        //console.log('stopped and hidden the original player');
      } catch (e) {
        console.error(e);
      }

      const embedUrl = `${origin}/embed/${params.get('viewkey')}`;
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
    };

    let disallowGeneralAutoplay = false;
    const processEmbedded = document => {
      disallowGeneralAutoplay = true;
      const body = document.body;
      try {
        const css = 'div.mgp_topBar, div.mgp_thumbnailsGrid, img.mgp_pornhub { display: none !important; }';
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

      // TODO: use general autoplay?
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
            redirect(url);
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

      const playButton = body.querySelector(playSelector);
      if (AUTOPLAY) {
        video.addEventListener('loadstart', _ => {
          if (video.paused) {
            simulateClick(document, playButton);
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
          simulateClick(document, playButton);
          setTimeout(_ => {
            if (video.paused) {
              console.log('still paused');
              simulateClick(document, playButton);
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
      const duration = node.matches(durationSelector) && timeToSeconds(node.textContent);
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
      css: '#searchSuggestions a:focus { background-color: #111111 !important; }',
      searchInputSelector: 'input#searchInput[type="text"], input[type="text"][name="search"], input[type="text"]', // TODO: multiple selectors for priority?
      onSearch: (query, form) => {
        const url = new URL(form.action);
        searchFilterParams.forEach(([key, value]) => url.searchParams.set(key, value));
        url.searchParams.set('search', query);
        redirect(url);
      },
      playSelector,
      videoSelector,
      thumbnailSelector: 'div.phimage, li:has(span.info-wrapper)',
      durationSelector,
      isUnwantedDuration: text => timeToSeconds(text) < MIN_DURATION_MINS * 60,
      isUnwantedUrl: url => isUnwanted(url),
      isVideoUrl,
      fatalFallback,
      processNode: node => {
        try {
          processPreview(node);
        } catch (e) {
          err(e, node);
        }

        if (!validLink(node) || node.closest('ul.filterListItem')) return disallowGeneralAutoplay;

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
            return disallowGeneralAutoplay;
          }
          params.set('o', 'lg');
        } else if (['/model/', '/channels/'].find(i => p.startsWith(i))) {
          if (parts.length === 3) {
            url.pathname = [...parts, 'videos'].join('/');
          } else if (!p.endsWith('/videos')) {
            return disallowGeneralAutoplay;
          }
          params.set('o', p.startsWith('/model/') ? 'lg' : 'ra');
        }
        setTimeout(_ => node.href = url.toString(), 500);
        return disallowGeneralAutoplay;
      },
    });

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
          window.location.replace(url);
        } else {
          setTimeout(_ => {
            const normalPlayer = body.querySelector(videoSelector);
            const error = normalPlayer?.error;
            if (!normalPlayer || error) {
              console.log('normal player has failed anyway', error, normalPlayer);
              fatalFallback();
            }
          }, 25000);
        }
      } else {
        console.log('no duration from normal player, calling fatal fallback');
        fatalFallback();
      }
    }
  },

  'porntrex.com': _ => {
    const minDuration = 'thirty-all-min';
    const topRated = 'top-rated';
    const ending = `${topRated}/${minDuration}/`;

    init({
      // TODO: css: 'div.sort-holder { display: none !important; }',
      searchInputSelector: 'input[type="text"][placeholder="Search"], input[type="text"][name="q"]',
      searchFormOrSubmitButtonSelector: 'form#search_form > button[type="submit"][aria-label="search"], button[type="submit"]',
      onSearch: (query, _form) => redirect(`${origin}/search/${query}/${ending}`),
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
    init({
      css: 'div[x-data="gifPage"], section.timeline, div.positions-wrapper { display: none !important; }',
      searchInputSelector: 'input#search-input[type="text"], input[type="text"]',
      /*onSearch: (query, form) => { // TODO
        const url = new URL(`${origin}/s/${query}/`);
        const params = url.searchParams;
        params.set('d', MIN_DURATION_MINS);
        params.set('q', 'fhd');
        redirect(url);
      },*/
      playSelector: 'span.i-play#play-button',
      videoSelector: 'video#main_video_player_html5_api',
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
    const isVideoUrl = href => href.includes('/videos/');
    init({
      css: '.jw-hardlink-inner { display: none !important; }',
      searchInputSelector: 'div.search-input > input[type="text"][placeholder="Search by videos..."], input[type="text"][placeholder="Search by videos..."], input[type="text"]',
      thumbnailSelector: 'div.thumb',
      qualitySelector: 'div.labels',
      durationSelector: 'div.labels',
      isUnwantedQuality: text => !text.startsWith(hd),
      isUnwantedDuration: text => timeToSeconds(text.split(hd)[1]) < MIN_DURATION_MINS * 60,
      isVideoUrl,
      processNode: node => {
        if (!validLink(node) || isVideoUrl(node.href)) return;

        const url = new URL(node.href);
        const p = url.pathname;
        const params = url.searchParams;
        if (p.startsWith('/search/')) {
          url.pathname = '/search/1/';
          params.set('type', 'hd');
          params.set('duration', '3');
          node.href = url;
        } else if (['/categories/', '/channel/', '/models/'].filter(i => p.startsWith(i).length > 0)) {
          const parts = p.split('/');
          if (parts.length >= 4) {
            const action = parts[1];
            const query = parts.slice(-2)[0];
            if (query) {
              url.pathname = `/${action}/${query}/1/`;
              params.set('sort', p.startsWith('/categories/') ? 'top-rated' : 'longest');
              params.set('date', 'all');
              params.set('type', 'hd');
              params.set('duration', '2');
              node.href = url;
            }
          }
        }
      },
    });
  },

  'vxxx.com': _ => {
    const minDurationMins = 8; // NOTE: content is a disaster here
    init({
      css: '.jw-hardlink-inner { display: none !important; }',
      searchInputSelector: 'input[type="text"][placeholder="Search..."], input[type="text"]',
      thumbnailSelector: 'div.thumb, a.thumb',
      durationSelector: 'span.duration',
      isUnwantedDuration: text => timeToSeconds(text) < minDurationMins * 60,
    });
  },

  'xhamster.com': _ => {
    const best = 'hd/full-length/best';
    init({
      css: 'div[data-block="moments"] { display: none !important; }',
      searchInputSelector: 'input[name="q"][type="text"], input[type="text"]',
      searchFormOrSubmitButtonSelector: 'form.search-submit-container > button.search-submit[type="submit"], button[type="submit"]',
      onSearch: (query, _form) => {
        const url = new URL(`${origin}/search/${query}`);
        const params = url.searchParams;
        params.set('quality', `${MIN_VIDEO_HEIGHT}p`);
        params.set('min-duration', '20');
        params.set('length', 'full');
        redirect(url);
      },
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

  'xnxx.com': _ => {
    const searchPath = '/search/hits/20min+/fullhd';
    init({
      css: '.gold-plate, .premium-results-line { display: none !important; }',
      searchInputSelector: 'input[type="text"][name="k"][placeholder="Search..."], input[type="text"]',
      onSearch: (query, _form) => redirect(`${searchPath}/${query}`),
      // TODO: thumbnailSelector: 'div.thumb',
      // TODO: qualitySelector: 'div.video-hd',
      // TODO: durationSelector: 'span.right',
      // TODO: isUnwantedDuration: text => Number(text.split('mins')[0] || 0) < MIN_DURATION_MINS,
      // TODO: isUnwantedQuality: text => (Number(text.split('p')[0]) || 0) < MIN_VIDEO_HEIGHT,
      isVideoUrl: href => href.includes('/video-'),
      processNode: node => {
        if (!validLink(node)) return;

        const url = new URL(node.href);
        const p = url.pathname;
        if (p.startsWith('/search/')) {
          const query = p.split('/').slice(-1);
          url.pathname = `${searchPath}/${query}`;
          url.search = '';
          node.href = url.toString();
        }
      },
    });
  },

  'xvideos.com': _ => {
    init({
      css: 'a.premium { display: none !important; }',
      searchInputSelector: 'input.search-input[type="text"], input[placeholder="Search X videos"], input[type="text"]',
      onSearch: (query, form) => {
        const url = new URL(form.action);
        const params = url.searchParams;
        params.set('sort', 'rating');
        params.set('durf', `${MIN_DURATION_MINS}min_more`);
        params.set('quality', `${MIN_VIDEO_HEIGHT}P`);
        url.searchParams.set('k', query);
        redirect(url);
      },
      thumbnailSelector: 'div.thumb-inside, div.video-thumb, div.thumb-under, div.video-under',
      qualitySelector: 'span.video-hd-mark, span.video-sd-mark',
      durationSelector: 'span.duration',
      isUnwantedQuality: text => (Number(text.split('p')[0]) || 0) < MIN_VIDEO_HEIGHT,
      isUnwantedDuration: text => !text.includes('h') && Number(text.split(' min')[0] || 0) < MIN_DURATION_MINS,
      processNode: node => {
        if (node.matches('div.error-dialog div.error-content button') && node.textContent.includes('Retry')) {
          node.click();
          return;
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
      },
    });
  },
}[shortDomain] || init)();
