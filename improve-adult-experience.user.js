// ==UserScript==
// @name Improve Adult Experience
// @description Skip intros, set better default quality/duration filters, make unwanted video previews transparent, workaround load failures, make input more consistent across the websites, remove spammy elements. Usually affects every media player it can find, designed to be used on a separate browser profile. Supported websites: anysex.com, beeg.com, bingato.com, drtuber.com, hqporner.com, hdzog.tube, hypnotube.com, incestporno.vip, inporn.com, manysex.com, mat6tube.com, pmvhaven.com, pmvtube.com, porn00.tv, pornheed.com, pornhits.com, pornhub.com, porno365.best, pornone.com, porntati.com, porntrex.com, pornxp.com, redtube.com, spankbang.com, taboodude.com, tnaflix.com, tube8.com, txxx.com, veporn.com, vxxx.com, whoreshub.com, xgroovy.com, xhamster.com, xnxx.com, xvideos.com, xxxbp.tv, youporn.com, рус-порно.tv
// @icon https://external-content.duckduckgo.com/ip3/pornhub.com.ico
// @version 0.74
// @downloadURL https://userscripts.codonaft.com/improve-adult-experience.user.js
// @require https://userscripts.codonaft.com/utils.js
// @grant GM_addStyle
// ==/UserScript==

// TODO: cumlouder.com, tubeon.com, xtits.xxx, eporner.com, pervclips.com, bigbumfun.com, momvids.com, zbporn.com, ok.xxx / perfectgirls.xxx, tubev.sex, youjizz.com, empflix.com, babestube.com, pornwhite.com, pornomira.net, videosection.com, upornia.com, free.brazzers.com, hdsex.org, gay0day.com, collectionofbestporn.com, pissjapantv.com, pervertslut.com, luxuretv.com, 4kporn.xxx, minuporno.com, prndb.net, familyporn.tv

(_ => {
'use strict';

const IGNORE_HOSTS = []; // NOTE: without 'www.', e.g. 'xvideos.com'
const HOME = 'google.com'; // NOTE: set your home button to 'https://www.google.com/blank.html' to get the list of supported websites

const AUTOPLAY = true;
const HIDE_EXTERNAL_LINKS = true;
const RANDOM_POSITION = true;

const MIN_DURATION_MINS = 20;
const MIN_VIDEO_HEIGHT = 1080;

if (performance.getEntriesByType('navigation')[0]?.responseStatus !== 200) return;

// TODO: sync volume?

const opensearch = document.head?.querySelector('link[type="application/opensearchdescription+xml"]')?.title;
const body = document.body;
if (opensearch === 'metasearch') return;
if (opensearch?.toLowerCase().includes('searx') || [...body.querySelectorAll('a[href="https://searx.space"]')].find(i => i.textContent?.includes('Public instances'))) return;

const UNWANTED = '__unwanted';
const HIDE = '__hide';
const INITIALIZED = '__initialized';

let pageIsHidden = true;
let initializedVideo = false;
let playbackInitiated = false;
let playbackStarted = false;
const resetVideo = _ => {
  console.log('reset video');
  initializedVideo = false;
  playbackInitiated = false;
  playbackStarted = false;
};

const loc = window.location;

let redirectHref;
const redirect = (href, force = true) => {
  if (force) {
    loc.href = href;
    return;
  }

  if (redirectHref) return;
  redirectHref = href;
  if (!pageIsHidden) {
    redirect(redirectHref, true);
  }
};
const refresh = (force = false) => redirect(loc, force);

const origin = loc.origin;
const validLink = node => node?.tagName === 'A' && (node?.href?.startsWith(origin) || node?.href?.startsWith('javascript:void(0)'));
const parts = pathname => pathname.split('/').filter(i => i.length > 0);

const FLUID_PLAYER = '#fluid_video_wrapper_player, div.fluid_button';
const JW_PLAYER_SELECTOR = 'video.jw-video, video.js-player';
const KT_PLAYER_SELECTOR = 'div#kt_player';
const VJS_PLAYER_SELECTOR = 'video.vjs-tech[id*="player_html5_api"]';

const currentTime = _ => Math.round(Date.now() / 1000);

const TIME_PATTERN = /(\d+(?:\.\d+)?)([hms])/g;
const MINUTE = 60;
const HOUR = 60 * MINUTE;
const timeToSeconds = rawText => {
  const text = (rawText || '').trim();

  if (text.includes(':')) {
    const parts = text.split(':').map(parseFloat);
    if (parts.length === 2) {
      return parts[0] * MINUTE + parts[1];
    } else if (parts.length === 3) {
      return parts[0] * HOUR + parts[1] * MINUTE + parts[2];
    }
  }

  let total = 0;
  for (const [_, value, unit] of text.matchAll(TIME_PATTERN))
    total += value * (unit === 'h' ? HOUR : unit === 'm' ? MINUTE : 1);
  return total;
};

const applySearchFilter = (params, url) => Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));

const focus = node => {
  if (!node) return;
  if (!node.hasAttribute('tabindex')) {
    node.setAttribute('tabindex', 1);
  }
  node.focus({ preventScroll: true });
};

const simulateMouse = (document, node, events = ['mouseenter', 'mouseover', 'mousemove', 'mousedown', 'mouseup', 'click']) => {
  if (!node) return;

  console.log('simulateMouse', node, events);
  try {
    const { target, clientX, clientY } = getTopNode(document, node, 0.5, 0.5);
    console.log('simulateMouse target', target, clientX, clientY);
    events.forEach(i => target.dispatchEvent(new MouseEvent(i, { clientX, clientY, bubbles: true, cancelable: true })));
  } catch (e) {
    err(e, node);
  }
};

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

const updateUrl = (node, href, newTab = false) => {
  const url = new URL(href);
  url.pathname = url.pathname.replace('//', '/');
  node.href = url;
  node.addEventListener('click', _ => {
    if (!event.isTrusted) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (newTab) {
      window.open(url, '_blank');
    } else {
      redirect(url);
    }
  }, true);
};

const defaultArgs = {
  css: '',
  searchFilter: '',
  searchFilterParams: {},
  videoSelector: 'video',
  isUnwantedDuration: text => timeToSeconds(text) < MIN_DURATION_MINS * 60,
  nodeChangeSelector: 'a, button, div, input, li, span, video',
};

const init = (args = {}) => {
  let {
    css,
    noKeysOverride,
    searchInputSelector,
    searchFilter,
    searchFilterParams,
    videoSelector,
    playSelector,
    pauseSelector,
    fullscreenSelector,
    thumbnailSelector,
    qualitySelector,
    durationSelector,
    isUnwantedQuality,
    isUnwantedDuration,
    isUnwantedUrl,
    isVideoUrl,
    hideSelector,
    nodeChangeSelector,
    onPlaybackStart,
    onNodeChange,
  } = { ...defaultArgs, ...args };

  GM_addStyle(`
    .${HIDE} { display: none !important }
    .${UNWANTED} { opacity: 10% !important }
    .${UNWANTED}:hover { opacity: 40% !important }
    ${css}
  `);

  let searchInputInitialized = false;

  const findPlayButton = video => {
    const selector = !video.paused && pauseSelector ? pauseSelector : playSelector;
    return [...body.querySelectorAll(selector)]
      .filter(i => parseFloat(i.style.opacity || '1') > 0 && i.style.display !== 'none')[0];
  };

  let playStrategy = 0;
  const togglePlay = video => {
    let button;
    try {
      console.log('toggle play');
      button = findPlayButton(video);
      const strategies = [
        _ => button?.click(),
        _ => simulateMouse(document, video),
        _ => video.play?.(),
      ];

      let attempt = 0;
      const state = video.paused;
      const nextStrategyIfFailed = _ => {
        setTimeout(_ => {
          if (state !== video.paused || attempt >= strategies.length) return;

          attempt++;
          playStrategy = (playStrategy + 1) % strategies.length;
          console.log('fallback play strategy', playStrategy);
          togglePlay(video);
        }, 300); // TODO: smaller timeout?
      };

      strategies[playStrategy]();
      nextStrategyIfFailed();
    } catch (e) {
      err(e, button);
    }
  };

  let fullscreenStrategy = 0;
  const toggleFullscreen = video => {
    let button;
    try {
      button = body.querySelector(fullscreenSelector);
      console.log('toggle fullscreen', fullscreenStrategy);
      const strategies = [
        _ => button?.click(),
        _ => simulateMouse(document, button),
        _ => {
          simulateMouse(document, video)
          setTimeout(_ => simulateMouse(document, video, ['mousedown', 'mouseup', 'click']), 2); // TODO: smaller timeout?
        },
      ];

      let attempt = 0;
      const state = !!document.fullscreenElement;
      const nextStrategyIfFailed = _ => {
        setTimeout(_ => {
          if (state !== !!document.fullscreenElement || attempt >= strategies.length) return;

          attempt++;
          fullscreenStrategy = (fullscreenStrategy + 1) % strategies.length;
          console.log('fallback fullscreen strategy', fullscreenStrategy);
          toggleFullscreen(video);
        }, 10); // TODO: smaller timeout?
      };

      strategies[fullscreenStrategy]();
      nextStrategyIfFailed();
    } catch (e) {
      err(e, button);
    }
  };

  const maybeStartAutoplay = video => {
    if (!AUTOPLAY || playbackInitiated) return;

    if (video.muted && video.matches('video')) {
      console.log('unmute');
      video.volume = 0.1;
      video.muted = false;
    }

    if (pageIsHidden || playbackStarted || !video || !video.paused) return;

    if (video.matches(JW_PLAYER_SELECTOR)) {
      console.log('starting playback');
      try {
        video.play();
        return;
      } catch (e) {
        err(e, video);
      }
    }

    togglePlay(video);
  };

  const videoPage = loc.pathname !== '/' && (!isVideoUrl || isVideoUrl(loc.href));
  let lastHref = loc.href;
  subscribeOnChanges(body, nodeChangeSelector, (node, _observer) => {
    const newHref = loc.href;
    if (newHref !== lastHref) {
      console.log('new page', newHref);
      lastHref = newHref;
      resetVideo();
    }

    if (videoPage && !playSelector && !fullscreenSelector) {
      if (body.querySelector(FLUID_PLAYER)) {
        console.log('detected fluid player');
        playSelector = 'div.fluid_button_play, div.fluid_control_playpause';
        fullscreenSelector = 'div.fluid_button_fullscreen, div.fluid_button_fullscreen_exit, div.fluid_control_fullscreen, div.fluid_button[title="Full Screen"]';
      } else if (body.querySelector(JW_PLAYER_SELECTOR)) {
        console.log('detected jw player');
        playSelector = 'div.jw-icon-playback';
        fullscreenSelector = 'div.jw-icon-fullscreen';
      } else if (body.querySelector(KT_PLAYER_SELECTOR)) {
        console.log('detected kt player');
        playSelector = 'a.fp-play';
        fullscreenSelector = 'a.fp-fullscreen';
      } else if (body.querySelector(VJS_PLAYER_SELECTOR)) {
        console.log('detected vjs player');
        playSelector = 'span.i-play#play-button, button.vjs-big-play-button, button.vjs-play-control[title="Play"]';
        pauseSelector = 'button.vjs-play-control[title="Pause"]';
        fullscreenSelector = 'button.vjs-fullscreen-control';
        videoSelector = VJS_PLAYER_SELECTOR;
      }
    }

    const ad = node.matches('.jw-hardlink-inner') && node.textContent?.trim?.()?.toLowerCase?.()?.includes?.('unlock');
    if (ad || node.matches(hideSelector) || (HIDE_EXTERNAL_LINKS && node.tagName === 'A' && node.href.length > 0 && !validLink(node))) {
      node.classList.add(HIDE);
      return false;
    }

    const docs = [window.top.document];
    if (docs[0] !== document) {
      docs.push(document);
    }

    if (!searchInputInitialized && node.matches(searchInputSelector)) {
      console.log('initializing search input');
      searchInputInitialized = true;
      const searchInput = node.matches(searchInputSelector) ? node : body.querySelector(searchInputSelector);
      if (!searchInput) {
        console.error('search input not found');
        return true;
      }

      const handleSearch = event => {
        event.preventDefault();
        event.stopImmediatePropagation();
        const query = (searchInput.value || '').trim();
        if (query.length > 0) {
          const [path, params] = searchFilter(query);
          const url = new URL(`${origin}/${path}`);
          Object
            .entries({ ...searchFilterParams, ...params })
            .forEach(([key, value]) => url.searchParams.set(key, value));
          redirect(url);
        }
      };

      searchInput.closest('form')?.addEventListener('submit', handleSearch, true);
      searchInput.addEventListener('keydown', event => {
      if (!event.isTrusted) return;
        if (noKeysOverride?.includes(event.code)) return;
        if (event.code === 'Enter') {
          console.log('handle enter');
          handleSearch(event);
        }
      }, true);
      return true;
    }

    try {
      if (AUTOPLAY && !playbackInitiated && videoPage && playSelector && node.matches(playSelector) && !body.querySelector(videoSelector)) {
        console.log('detected play button while there is no video node yet', node);
        setTimeout(_ => node.click(), 1);
        return true;
      }

      const unwanted = (qualitySelector && node.matches(qualitySelector) && isUnwantedQuality?.(node.textContent)) || (durationSelector && node.matches(durationSelector) && isUnwantedDuration?.(node.textContent)) || (validLink(node) && isUnwantedUrl?.(node));
      if (unwanted) {
        const thumbnail = node.closest(thumbnailSelector);
        const thumbnails = thumbnail?.parentNode?.querySelectorAll(thumbnailSelector);
        if (thumbnails?.length > 0 && thumbnails?.length <= 3) {
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
      onNodeChange?.(node);
    } catch (e) {
      err(e, node);
    }

    if (initializedVideo || !videoPage || !node.matches(videoSelector)) return true;

    const nonPreviewVideos = [...body.querySelectorAll(videoSelector)].filter(i => {
      const text = [...i.classList.values()].join(' ').toLowerCase();
      return !text.includes('preview') && !text.includes('lazyload');
    });
    const sortedVideos = nonPreviewVideos
      .filter(i => i.offsetHeight > 0)
      .sort((a, b) => b.offsetHeight - a.offsetHeight);

    let video;
    if (sortedVideos.length > 1 && sortedVideos[0].offsetHeight - sortedVideos[1].offsetHeight > screen.height * 0.1) {
      video = sortedVideos[0];
    } else if (nonPreviewVideos.length === 1 || sortedVideos.length === 0) {
      video = nonPreviewVideos[0];
    }

    if (!video) {
      console.log('no video', nonPreviewVideos);
      return true;
    }
    console.log('detected main video', video);

    const maybeSetRandomPosition = _ => {
      if (RANDOM_POSITION && !playbackStarted && video.duration > 0 && video.currentTime === 0) {
        console.log('set random position');
        video.currentTime = random(video.duration * 0.25, video.duration * 0.3);
      }
    };

    ['loadstart', 'loadeddata', 'seeked'].forEach(i => {
      video.addEventListener(i, _ => {
        console.log(i);
        maybeSetRandomPosition();
        maybeStartAutoplay(video);
      }, { once: true });
    });

    video.addEventListener('loadedmetadata', _ => {
      console.log('loadedmetadata, duration', video.duration);
      maybeSetRandomPosition();
    }, { once: true });

    video.addEventListener('playing', _ => {
      console.log('playback is started')
      playbackStarted = true;
      focus(video);
      setTimeout(_ => {
        console.log('onPlaybackStart');
        onPlaybackStart?.(video)
      }, 700);
    }, { once: true });

    video.addEventListener('stalled', _ => {
      console.log('stalled');
      refresh();
    }, { once: true });

    const mouseMove = event => {
      if (!event.isTrusted) return;
      console.log('mousemove');
      pageIsHidden = false;
      maybeStartAutoplay(video);
    };
    docs.forEach(d => {
      d.addEventListener('mousemove', mouseMove);
      d.addEventListener('visibilitychange', _ => {
        pageIsHidden = d.hidden;
        if (redirectHref && !pageIsHidden) {
          redirect(redirectHref);
          return;
        }
        console.log('visibilitychange pageIsHidden', pageIsHidden);
        maybeStartAutoplay(video);
      }, { once: true });
    });

    video.addEventListener('play', _ => {
      console.log('playback is initiated');
      docs.forEach(d => d.removeEventListener('mousemove', mouseMove));
      playbackInitiated = true;
      maybeSetRandomPosition();
    }, { once: true });

    docs.forEach(d => { d.addEventListener('keydown', event => {
      if (!event.isTrusted) return;
      pageIsHidden = false;
      maybeStartAutoplay(video);

      if (noKeysOverride?.includes(event.code)) return;
      if (event.ctrlKey || event.altKey || event.metaKey || d.activeElement.tagName === 'INPUT') return;

      console.log('keydown', event.code);
      if (['Space', 'KeyP'].includes(event.code)) {
        event.preventDefault();
        event.stopImmediatePropagation();
        togglePlay(video);
      } else if (fullscreenSelector && event.code === 'KeyF') {
        event.preventDefault();
        event.stopImmediatePropagation();
        toggleFullscreen(video);
      } else {
        focus(video);
      }
    }, true); });

    initializedVideo = true;
    if (playSelector) {
      maybeSetRandomPosition(); // TODO
      maybeStartAutoplay(video);
    } else {
      console.log('load');
      video.load?.();
    }

    return true;
  });
};

const shortDomain = loc.hostname.split('.').slice(-2).join('.');
if (IGNORE_HOSTS.includes(shortDomain)) {
  console.log(shortDomain, 'is a part of ignore list');
  return;
}

const p365 = _ => {
  const isVideoUrl = href => href.includes('/movie/');
  init({
    thumbnailSelector: 'li.video_block',
    durationSelector: 'span.duration',
    isVideoUrl,
    hideSelector: 'div.cat_description',
    onNodeChange: node => {
      if (!validLink(node) || isVideoUrl(node.href) || node.closest('div.div_sort')) return;
      const url = new URL(node.href);
      const p = url.pathname;
      const topRated = '/toprated';
      if (!p.endsWith(topRated) && ((parts(p).length < 3 && !['/blog', '/models'].includes(p)) || p.startsWith('/models/'))) {
        url.pathname += topRated;
        updateUrl(node, url);
      }
    },
  });
};

const defaultInit = _ => init({ noKeysOverride: ['KeyF', 'Space'] });
const sites = {
  [HOME]: _ => {
    document.head.innerHTML = `<style>
      body {
        a { color: white !important }
        background-color: black !important;
      }
    </style>`;
    body.innerHTML = Object
      .entries(sites)
      .filter(([i, _]) => i !== HOME)
      .map(([i, handler]) => {
        const protocol = handler === p365 ? 'http' : 'https';
        const href = `${protocol}://${i}`;
        return `<p><a href="${href}">${href}</p>`;
      })
      .join('');
  },

  '1porno365.info': p365,
  'porno365.best': p365,

  'anysex.com': _ => {
    const searchFilterParams = { sort: 'top' };
    const isVideoUrl = href => href.includes('/video/');
    init({
      searchInputSelector: 'input[type="text"][name="q"][placeholder="Search"], input#search-form[type="text"][name="q"]',
      searchFilter: q => ['search/', { q }],
      searchFilterParams,
      fullscreenSelector: 'div#main_video_fluid_control_fullscreen',
      thumbnailSelector: 'div.item',
      qualitySelector: 'span.item-quality',
      durationSelector: 'div.duration',
      isUnwantedQuality: text => (parseFloat(text.split('p')[0]) || 0) < MIN_VIDEO_HEIGHT,
      isVideoUrl,
      onNodeChange: node => {
        if (!validLink(node) || node.closest('div.sort')) return;

        const url = new URL(node.href);
        if (url.pathname === '/') return;

        applySearchFilter(searchFilterParams, url);
        updateUrl(node, url);
      },
    });
  },

  'beeg.com': _ => {
    const cookie = document.cookie;
    const qualityPattern = 'video__quality=';
    const quality = parseFloat(cookie.split(qualityPattern)[1]?.split(';')[0]);
    if (Number.isNaN(quality) && quality < MIN_VIDEO_HEIGHT) {
      console.log('wrong quality', quality);
      document.cookie = `${qualityPattern}${MIN_VIDEO_HEIGHT}`;
      refresh();
      return;
    }

    const isVideoUrl = href => new URL(href).pathname !== '/';
    init({
      noKeysOverride: ['Space'],
      fullscreenSelector: 'button.x-player__fullscreen-btn',
      thumbnailSelector: 'div.tw-relative[data-testid="unit"]',
      durationSelector: 'span[data-testid="unit-amount"]',
      isUnwantedDuration: text => !text?.includes('FULL '),
      isVideoUrl,
      onNodeChange: node => {
        if (!validLink(node)) return;
        updateUrl(node, node.href);
      },
    });
  },

  'bingato.com': _ => {
    const sort = 'sort_by';
    const searchFilterParams = { [sort]: 'longest' };
    init({
      searchInputSelector: 'div.search-text input[type="text"][name="q"]',
      searchFilter: q => ['s', { q }],
      searchFilterParams,
      thumbnailSelector: 'div.item',
      qualitySelector: 'span.is-hd',
      durationSelector: 'div.duration',
      isUnwantedQuality: text => text !== 'HD',
      isVideoUrl: href => href.includes('/item/'),
      onNodeChange: node => {
        if (!validLink(node)) return;
        const url = new URL(node.href);
        const params = url.searchParams;
        if (['/babe/', '/c/'].find(i => url.pathname.startsWith(i)) && !params.has(sort)) {
          applySearchFilter(searchFilterParams, url);
          updateUrl(node, url);
        }
      },
    });
  },

  'drtuber.com': _ => {
    const thumbnailSelector = 'a.wrap-better-content';
    init({
      playSelector: 'a.drt-button-play[title="Play"]',
      fullscreenSelector: 'div.drt-button-fullscreen, div.drt-control-item[title="Fullscreen"]',
      thumbnailSelector,
      durationSelector: 'em.time_thumb',
      isUnwantedDuration: text => {
        const time = text.split(' ')[2];
        return !time?.includes(':') || timeToSeconds(time) < MIN_DURATION_MINS * 60;
      },
      isVideoUrl: href => href.includes('/video/'),
      hideSelector: 'div.posting_view',
      nodeChangeSelector: `${defaultArgs.nodeChangeSelector}, em`,
      onNodeChange: node => {
        if (!validLink(node)) return;

        if (node.matches(thumbnailSelector) && !node.querySelector('i.quality')) {
          node.classList.add(UNWANTED);
          return;
        }

        const url = new URL(node.href);
        const p = url.pathname;
        if (p.startsWith('/linkout/')) {
          node.classList.add(HIDE);
        } else if (p.startsWith('/categories/') && !['hd', '4k'].find(i => p.endsWith(i))) {
          node.href += '/4k';
        }
      },
    });
  },

  'hqporner.com': _ => {
    init({
      thumbnailSelector: 'section.box',
      durationSelector: 'span.fa-clock-o',
      isVideoUrl: href => href.includes('/hdporn/'),
    });
  },

  'hdzog.tube': _ => {
    init({
      thumbnailSelector: 'article.item-video',
      durationSelector: 'span.listing__item-rating',
      isUnwantedDuration: text => text.includes(':') && timeToSeconds(text) < MIN_DURATION_MINS * 60,
      isVideoUrl: href => href.includes('/videos/'),
      hideSelector: 'p.seo-text',
    });
  },

  'hypnotube.com': _ => {
    const duration = MIN_DURATION_MINS * 60;
    const thumbnailSelector = `a[href*="${origin}/video/"]`;
    init({
      thumbnailSelector,
      qualitySelector: 'span.quality-icon',
      durationSelector: 'span.time',
      isUnwantedQuality: text => !text.includes('HD'),
      isVideoUrl: href => href.includes('/video/'),
      hideSelector: 'div.vip',
      onNodeChange: node => {
        if (node.matches(thumbnailSelector) && node.querySelector('span.sub-desc')?.textContent?.includes('VIP')) {
          node.classList.add(HIDE);
          return;
        }

        if (node.matches('div.box-container')) {
          const content = node.textContent;
          if (['Latest VIP', 'Gallery Content'].find(i => content.includes(i))) {
            node.classList.add(HIDE);
            return;
          }
        }

        if (validLink(node) && !node.closest('div.dropdown-menu, div.filter-sort')) {
          const url = new URL(node.href);
          const p = url.pathname;
          const params = url.searchParams;
          if (params.has('durationFrom')) return;
          if (p.startsWith('/channels/')) {
            url.pathname += '/rating/';
            params.set('durationFrom', duration);
            updateUrl(node, url);
          } else if (p === '/videos/') {
            url.pathname = '/top-rated/';
            params.set('durationFrom', duration);
            updateUrl(node, url);
          } else if (p === '/most-viewed/month/') {
            params.set('durationFrom', duration);
            updateUrl(node, url);
          }
        }
      },
    });
  },

  'incestporno.vip': _ => {
    init({
      playSelector: 'div.fp-player',
      thumbnailSelector: 'div.preview',
      durationSelector: 'div.meta-dur-date > ul > li',
      isUnwantedDuration: text => text.includes(':') && timeToSeconds(text) < MIN_DURATION_MINS * 60,
      isVideoUrl: href => {
        const p = new URL(href).pathname;
        return !['/cat-', '/categories/', '/latest-updates/', '/most-popular/', '/top-rated/', '/search/'].find(i => p.startsWith(i));
      },
      hideSelector: 'p.megatext',
      nodeChangeSelector: `${defaultArgs.nodeChangeSelector}, p`,
    });
  },

  'inporn.com': _ => {
    const latestUpdates = '/latest-updates/1/';
    const searchFilterParams = { duration: 3 };
    init({
      searchInputSelector: 'div.search__container input[type="text"][name="search"]',
      searchFilter: query => ['search/1/', { s: query }],
      searchFilterParams,
      isVideoUrl: href => href.includes('/video/'),
      hideSelector: 'div.btn-yellow',
      onNodeChange: node => {
        if (!validLink(node)) return;
        const url = new URL(node.href);
        const p = url.pathname;
        const params = url.searchParams;
        if (p.startsWith('/categories/') && p.endsWith(latestUpdates)) {
          url.pathname = url.pathname.replace(latestUpdates, '/top-rated/1/');
          applySearchFilter(searchFilterParams, url);
          updateUrl(node, url);
        } else if (['/pornsite/', '/pornstar/'].find(i => p.startsWith(i)) && p.endsWith('/videos/1/') && params.get('sort') !== 'longest') {
          params.set('sort', 'longest');
          updateUrl(node, url);
        } else if (['/search/1/', '/top-rated/1/', '/videos/latest-updates/1/'].find(i => p.startsWith(i)) && !params.has('duration')) {
          applySearchFilter(searchFilterParams, url);
          updateUrl(node, url);
        }
      },
    });
  },

  'manysex.com': _ => {
    const isVideoUrl = href => href.includes('/video/');
    const categories = '/categories/';
    const longest = '/longest/';
    const topRated = '/top-rated/';
    const searchFilterParams = { duration: 3 };
    init({
      searchInputSelector: 'div.header__search input[type="text"][name="search"]',
      searchFilter: query => [`search/${encodeURIComponent(query)}`, {}],
      searchFilterParams,
      thumbnailSelector: 'div.thumb',
      durationSelector: 'div.thumb__duration',
      isVideoUrl,
      onNodeChange: node => {
        if (!validLink(node) || isVideoUrl(node.href) || node.closest('div.filters')) return;

        const url = new URL(node.href);
        const p = url.pathname;
        const params = url.searchParams;
        if (p.startsWith('/search/')) {
          applySearchFilter(searchFilterParams, url);
          updateUrl(node, url);
        } else if (p.includes(categories) && !p.endsWith(categories) && ![longest, topRated].find(i => p.includes(i))) {
          if (p.split(',').length <= 1) {
            applySearchFilter(searchFilterParams, url);
            url.pathname += topRated;
          } else {
            url.pathname += longest;
          }
          updateUrl(node, url);
        } else if (p.startsWith('/videos/') && !p.includes(`/${topRated}`)) {
          applySearchFilter(searchFilterParams, url);
          url.pathname += topRated;
          updateUrl(node, url);
        } else if (['/pornsite/', '/pornstar/'].find(i => p.startsWith(i))) {
          params.set('sort', longest);
          updateUrl(node, url);
        }
      },
    });
  },

  'mat6tube.com': _ => {
    const searchFilterParams = {
      'len': 'long',
      'hd': 1,
      'sort': 2,
    };
    init({
      searchInputSelector: 'div.search input[type="search"][name="search"]',
      searchFilter: query => [`video/${encodeURIComponent(query)}/`, {}],
      searchFilterParams,
      thumbnailSelector: 'div.item',
      qualitySelector: 'i.hd_mark',
      durationSelector: 'div.m_time',
      isUnwantedDuration: text => text.includes(':') && timeToSeconds(text) < MIN_DURATION_MINS * 60,
      isUnwantedQuality: text => text.contains('HD'),
      isVideoUrl: href => href.includes('/watch/'),
      hideSelector: '#particles-js',
      onNodeChange: node => {
        if (!validLink(node)) return;
        const url = new URL(node.href);
        if (!url.searchParams.has('len')) {
          applySearchFilter(searchFilterParams, url);
          updateUrl(node, url);
        }
      },
    });
  },

  'pmvhaven.com': _ => {
    const isVideoUrl = href => href.includes('/video/');
    init({
      searchInputSelector: 'input[type="text"]',
      searchFilter: q => ['search', { q }],
      videoSelector: 'video#VideoPlayer',
      thumbnailSelector: 'a[href*="/video/"]',
      qualitySelector: 'div:not([title^="Aspect ratio:"]):not(.aspect-video)',
      durationSelector: 'div:not([title^="Aspect ratio:"]):not(.aspect-video)',
      isUnwantedDuration: text => text.includes(':') && timeToSeconds(text) < MIN_DURATION_MINS * 60,
      isUnwantedQuality: text => (text.includes('HD') && !text.includes('FHD')) || text.includes('SD'),
      isVideoUrl,
      hideSelector: '.v-badge',
      nodeChangeSelector: `${defaultArgs.nodeChangeSelector}, button[aria-haspopup="menu"], p`,
      onNodeChange: node => {
        if (validLink(node)) {
          updateUrl(node, node.href);
          return;
        }
        // TODO: set filters
      },
    });
  },

  'pmvtube.com': _ => {
    init({
      searchInputSelector: 'input#s[type="text"], input[type="text"][name="s"]',
      searchFilter: query => ['search', { s: query, filter: 'longest' }],
      videoSelector: 'div.video-player',
      thumbnailSelector: 'article.thumb-block',
      durationSelector: 'span.duration',
      isUnwantedDuration: text => text.includes(':') && timeToSeconds(text) < MIN_DURATION_MINS * 60,
      onNodeChange: node => {
        if (!validLink(node)) return;

        const url = new URL(node.href);
        url.searchParams.set('filter', 'longest');
        updateUrl(node, url);
      },
    });
  },

  'porn00.tv': _ => {
    if (loc.pathname === '/') {
      redirect('/latest-vids/');
      return;
    }

    let sorted = false;
    init({
      thumbnailSelector: 'div.item',
      qualitySelector: 'span.is-hd',
      durationSelector: 'div.wrap div.duration',
      isUnwantedDuration: text => text.includes(':') && timeToSeconds(text) < MIN_DURATION_MINS * 60,
      isUnwantedUrl: node => !node.querySelector('div.img span.is-hd') && node.closest('div.item'),
      isVideoUrl: href => href.includes('/video/'),
      onNodeChange: node => {
        if (!sorted && node.matches('div.sort a[data-parameters*="sort_by:rating"]')) {
          sorted = true;
          node.click();
        }
      },
    });
  },

  'pornheed.com': _ => {
    const searchFilter = query => [`s/top-rated/all-time/all-tubes/all-words/long-duration/${query}/1`, {}];
    const thumbnailSelector = 'li.video-item';
    const qualitySelector = 'div.res';
    init({
      searchInputSelector: 'input#searchterm[type="text"], input[type="text"][name="searchterm"]',
      searchFilter,
      thumbnailSelector,
      qualitySelector,
      durationSelector: 'div.runtime',
      isUnwantedQuality: text => (parseFloat(text.split('p')[0]) || 0) < MIN_VIDEO_HEIGHT,
      isUnwantedDuration: text => text.includes(':') && timeToSeconds(text) < MIN_DURATION_MINS * 60,
      onNodeChange: node => {
        if (node.matches(thumbnailSelector) && !node.querySelector(qualitySelector)) {
          node.classList.add(UNWANTED);
          return;
        }

        if (!validLink(node)) return;

        const url = new URL(node.href);
        const ps = parts(url.pathname);
        if (ps.length === 2 && ['s', 'search'].includes(ps[0])) {
          url.pathname = searchFilter(ps[1])[0];
          updateUrl(node, url);
        }
      },
    });
  },

  'pornhits.com': _ => {
    init({
      thumbnailSelector: 'article.item',
      durationSelector: 'span.duration',
      isUnwantedDuration: text => text.includes(':') && timeToSeconds(text) < MIN_DURATION_MINS * 60,
      isVideoUrl: href => href.includes('/video/'),
    });
  },

  'pornhub.com': _ => {
    const playSelector = 'div.mgp_playIcon, div.mgp_bigPlay, div.mgp_playbackBtn, mgp_smallPlay';
    const videoSelector = 'video.mgp_videoElement:not(.gifVideo)';
    const durationSelector = 'var.duration, span.duration';

    const url = new URL(loc.href);
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
    const videoId = url => url.searchParams.get('viewkey') || parts(url.pathname).slice(-1)[0];
    const isVideoUrl = href => href.includes('/view_video.php') || href.includes('/embed/');
    const watchedVideos = new Set;
    const similarVideos = new Set;

    const disliked = body => !!body.querySelector('div.active[data-title="I Dislike This"]');

    const searchFilterParams = {
      'min_duration': MIN_DURATION_MINS,
      'hd': 1,
      'o': 'tr',
      't': 'm',
    };

    const fatalFallback = _ => {
      console.log('fallback to embedded player');
      const container = body.querySelector('div.playerFlvContainer');
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
        redirect(embedUrl, false);
      }
    };

    const processEmbedded = document => {
      const body = document.body;
      if (body.classList.contains(INITIALIZED)) {
        console.log('embedded video is already initialized');
        return;
      }
      body.classList.add(INITIALIZED)

      const video = body.querySelector('video');
      if (!video) {
        console.log('embedding this video is probably not allowed');

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

      video.addEventListener('loadedmetadata', _ => {
        console.log('loadedmetadata');
        if (disliked(body)) {
          setUnwanted(url, Number.MAX_SAFE_INTEGER);
        }
      }, { once: true });
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

      if (link.querySelector('div.watchedVideoText')) {
        watchedVideos.add(link.href);
      }
      similarVideos.add(link.href);
    };

    init({
      css: '#searchSuggestions a:focus { background-color: #111111 !important }',
      searchInputSelector: 'input#searchInput[type="text"], input[type="text"][name="search"]',
      searchFilter: query => ['video/search', { search: query }],
      searchFilterParams,
      playSelector,
      fullscreenSelector: 'div[data-text="Enter Fullscreen"], div[data-text="Exit fullscreen"]',
      videoSelector,
      thumbnailSelector: 'div.phimage, li:has(span.info-wrapper)',
      durationSelector,
      isUnwantedUrl: node => isUnwanted(new URL(node.href)),
      isVideoUrl,
      hideSelector: 'div.mgp_topBar, div.mgp_thumbnailsGrid, img.mgp_pornhub, div.mgp_gridMenu, ul#headerMainMenu li.photos',
      nodeChangeSelector: `${defaultArgs.nodeChangeSelector}, var`,
      onNodeChange: node => {
        try {
          processPreview(node);
        } catch (e) {
          err(e, node);
        }

        if (node.matches('div.mgp_source-unavailable-screen') || (node.matches('div.mgp_errorIcon') && body.querySelector('p')?.textContent?.includes('Please refresh the page'))) {
          console.log('refreshing after error');
          refresh();
          return;
        }

        if (!validLink(node) || node.closest('ul.filterListItem')) return;

        if (node.href.endsWith('/shorties')) {
          node.classList.add(HIDE);
          return;
        }

        const url = new URL(node.href.startsWith('https:') ? node.href : `${origin}${node.href}`);
        const params = url.searchParams;
        const p = url.pathname;
        const ps = parts(p);
        if (['/video', '/video/search'].includes(p) || p.startsWith('/categories/')) {
          applySearchFilter(searchFilterParams, url);
        } else if (p.startsWith('/pornstar/')) {
          if (ps.length === 2) {
            url.pathname = [...ps, 'videos', 'upload'].join('/');
          } else if (!p.endsWith('/videos/upload')) {
            return;
          }
          params.set('o', 'lg');
        } else if (['/model/', '/channels/'].find(i => p.startsWith(i))) {
          if (ps.length === 2) {
            url.pathname = [...ps, 'videos'].join('/');
          } else if (!p.endsWith('/videos')) {
            return;
          }

          if (!node.closest('ul.subFilterList')) {
            params.set('o', p.startsWith('/model/') ? 'lg' : 'ra');
          }
        }
        setTimeout(_ => updateUrl(node, url), 500);
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
        const lowQuality = ![...body.querySelectorAll('ul.mgp_quality li')].find(i => i.textContent?.includes(MIN_VIDEO_HEIGHT));
        console.log('low quality', lowQuality);
        if (lowQuality || disliked(body)) {
          setUnwanted(url, Number.MAX_SAFE_INTEGER);
        }

        const normalPlayer = body.querySelector(videoSelector);
        const error = normalPlayer?.error;
        if (!normalPlayer || error) {
          console.log('normal player has failed', error, normalPlayer);
          fatalFallback();
        }
      } else {
        console.log('no duration from normal player, calling fatal fallback');
        fatalFallback();
      }
    }
  },

  'pornone.com': _ => {
    const filter = 'rating/hd/';
    const isVideoUrl = href => {
      const p = new URL(href).pathname;
      return !p.startsWith('/channel/') && !Number.isNaN(parseFloat(parts(p).slice(-1)));
    };
    init({
      searchInputSelector: 'input[type="text"][name="q"]',
      searchFilter: query => [`search/${filter}`, { q: query }],
      thumbnailSelector: 'a.videocard',
      qualitySelector: 'span.durlabel img[alt="HD Video"]',
      durationSelector: 'span.durlabel',
      isUnwantedQuality: text => text === undefined,
      isVideoUrl,
      onPlaybackStart: video => {
        video.click();
        video.click();
      },
      onNodeChange: node => {
        if (!validLink(node) || node.classList.contains('hidden') || node.rel === 'nofollow' || node.closest('div.gandermenu, footer')) return;

        const url = new URL(node.href);
        const p = url.pathname;
        if (!isVideoUrl(node.href) && !p.includes(filter)) {
          url.pathname += filter;
          updateUrl(node, url);
        }
      },
    });
  },

  'porntati.com': _ => {
    init({
      thumbnailSelector: 'div.item',
      qualitySelector: 'div.format',
      durationSelector: 'div.duration',
      hideSelector: 'div.text',
      isUnwantedQuality: text => (parseFloat(text.split('p')[0]) || 0) < MIN_VIDEO_HEIGHT,
      isVideoUrl: href => {
        const p = new URL(href).pathname;
        return p.startsWith('/video/');
      },
    });
  },

  'porntrex.com': _ => {
    const minDuration = 'thirty-all-min';
    const topRated = 'top-rated';
    const ending = `${topRated}/${minDuration}/`;

    init({
      searchInputSelector: 'input[type="text"][placeholder="Search"], input[type="text"][name="q"]',
      searchFilter: query => [`search/${encodeURIComponent(query)}/${ending}`, {}],
      playSelector: 'a.fp-play',
      fullscreenSelector: 'a.fp-screen',
      thumbnailSelector: 'div.thumb-item, div.video-item, span.video-item',
      qualitySelector: 'span.quality',
      durationSelector: 'div.durations, span.video-item-duration',
      isUnwantedQuality: text => (parseFloat(text.split('p')[0]) || 0) < MIN_VIDEO_HEIGHT,
      isVideoUrl: href => {
        const p = new URL(href).pathname;
        return p.startsWith('/video/') || (p.startsWith('/playlists/') && parts(p).length > 2);
      },
      onNodeChange: node => {
        if (!validLink(node)) return;

        const href = node.href;
        if (href.includes('/video/')) {
          if (loc.pathname.startsWith('/playlists/')) {
            updateUrl(node, href, true);
          }
          return;
        }
        if (href.includes('/models/') && href.length === origin.length + '/models/a/'.length) return;
        if ([`/${ending}`, '/channels/', '/tags/'].find(i => href.endsWith(i))) return;
        if (node.closest('div.sort')) return;

        if (href.includes('/search/')) {
          updateUrl(node, `${href}/${ending}`);
        } else if (['categories', 'channels', 'models', 'tags'].find(i => href.includes(`/${i}/`))) {
          updateUrl(node, `${href.replace('/hd/', '/')}hd/${ending}`);
        } else if (href === `${origin}/${topRated}/`) {
          updateUrl(node, `${origin}/hd/${ending}`);
        } else if (['latest-updates', 'most-commented', 'most-favourited', 'most-popular'].find(i => [`${origin}/${i}/`, `${origin}/hd/${i}/`].includes(href))) {
          updateUrl(node, `${origin.replace('/hd/', '/')}/hd${node.href.split(origin)[1]}${minDuration}/`);
        }
      },
    });
  },

  'pornxp.com': _ => {
    init({
      thumbnailSelector: 'div.item_cont',
      durationSelector: 'div.item_dur',
      isVideoUrl: href => href.includes('/videos/'),
    });
  },

  'redtube.com': _ => {
    const searchFilterParams = { min_duration: MIN_DURATION_MINS, hd: 1 };
    init({
      searchInputSelector: 'input[type="text"][name="search"]',
      searchFilter: query => ['', { search: query }],
      searchFilterParams,
      thumbnailSelector: 'div.video_block_wrapper',
      videoSelector: 'video.mgp_videoElement:not(.gifVideo)',
      playSelector: 'div.mgp_playIcon, div.mgp_bigPlay, div.mgp_playbackBtn, mgp_smallPlay',
      fullscreenSelector: 'div[data-text="Enter Fullscreen"], div[data-text="Exit fullscreen"]',
      durationSelector: 'div.duration',
      isVideoUrl: href => parseFloat(parts(new URL(href).pathname)[0]) || false,
      onNodeChange: node => {
        if (!validLink(node) || node.closest('div.videos_sorting_container')) return;

        const url = new URL(node.href);
        const params = url.searchParams;
        const p = url.pathname;
        if ((p === '/' || p.startsWith('/redtube/') || params.has('search')) && (!params.has('min_duration') || !params.has('hd'))) {
          applySearchFilter(searchFilterParams, url);
          updateUrl(node, url);
        } else if (['channels', 'pornstar'].find(i => p.startsWith(`/${i}/`)) && !p.endsWith('/longest')) {
          url.pathname += '/longest';
          updateUrl(node, url);
        } else if (p.startsWith('/amateur/') && !p.endsWith('/rating')) {
          url.pathname += '/rating';
          updateUrl(node, url);
        }
      },
    });
  },

  'spankbang.com': _ => { // FIXME: consistently set random position
    const searchFilterParams = { d: MIN_DURATION_MINS, q: 'fhd' };
    init({
      searchInputSelector: 'input#search-input[type="text"], input[type="text"][aria-label="Search porn videos"]',
      searchFilter: query => [`s/${encodeURIComponent(query)}/`, {}],
      searchFilterParams,
      thumbnailSelector: 'div[data-testid="video-item"]',
      durationSelector: 'span[data-testid="video-item-length"], div[data-testid="video-item-length"]',
      isVideoUrl: href => href.includes('/video/'),
      hideSelector: 'div[x-data="gifPage"], section.timeline, div.positions-wrapper',
      onPlaybackStart: _ => {
        body.querySelector('button.vjs-control[title="Unmute"]')?.click();
        const cover = body.querySelector('div.play_cover');
        if (cover?.style?.cursor === 'pointer') {
          console.log('fixing invisible player');
          cover.click();
        }
      },
      onNodeChange: node => {
        if (!validLink(node)) return;

        const url = new URL(node.href);
        const params = url.searchParams;
        const p = url.pathname;
        if (p === '/gifs') {
          node.classList.add(HIDE);
        } else if (!p.endsWith('/tags') && !['/playlist/', '/video/'].find(i => p.includes(i)) && !(params.has('q') && params.has('d'))) {
          if (p === '/') {
            url.pathname = '/trending_videos/'
          }
          applySearchFilter(searchFilterParams, url);
          updateUrl(node, url);
        }
      },
    });
  },

  'taboodude.com': _ => {
    const searchFilterParams = { 'sort_by': 'quality' };
    const thumbnailSelector = 'div.item';
    const qualitySelector = 'span.is-hd';
    init({
      searchInputSelector: 'input[type="text"][name="q"]',
      searchFilter: query => ['search', { q: query }],
      searchFilterParams,
      thumbnailSelector,
      qualitySelector,
      durationSelector: 'div.duration',
      isUnwantedQuality: text => !['HD', '4K'].includes(text),
      isVideoUrl: href => href.includes('/video/'),
      onNodeChange: node => {
        if (node.matches(thumbnailSelector) && !node.querySelector('span.is-hd')) {
          node.classList.add(UNWANTED);
        } else if (validLink(node)) {
          const url = new URL(node.href);
          const p = url.pathname;
          if (p === '/' || ['/category/', '/search', '/model/'].find(i => p.startsWith(i))) {
            applySearchFilter(searchFilterParams, url);
            updateUrl(node, url);
          }
        }
      },
    });
  },

  'tnaflix.com': _ => {
    const searchFilterParams = { d: 'full' };
    const qualitySelector = 'div.max-quality';
    const thumbnailSelector = 'div[data-vid]';
    const isVideoUrl = href => parts(href).slice(-1)[0]?.startsWith('video');
    init({
      searchInputSelector: 'input[type="text"][name="what"]',
      searchFilter: query => ['search', { 'what': query }],
      searchFilterParams,
      thumbnailSelector,
      qualitySelector,
      durationSelector: 'div.video-duration',
      playSelector: 'button[aria-label="Play"]',
      pauseSelector: 'button[aria-label="Pause"]',
      isUnwantedQuality: text => parseFloat(text.split('p')[0]) < MIN_VIDEO_HEIGHT,
      isVideoUrl,
      onNodeChange: node => {
        if (node.matches(thumbnailSelector) && !node.querySelector(qualitySelector)) {
          node.classList.add(UNWANTED);
          return;
        }

        if (!validLink(node)) return;
        const href = node.href;

        if (isVideoUrl(href) || ['channel', 'galleries', 'profile'].find(i => href.includes(`/${i}/`)) || ['categories', 'channels', 'pornstars'].find(i => href.endsWith(`/${i}`))) return;

        if (href.includes('/track/')) {
          node.closest('div.row')?.classList.add(HIDE);
          return;
        }

        if (href.includes('/goto/')) {
          node.classList.add(HIDE);
          return;
        }

        const url = new URL(href);
        const p = url.pathname;
        if (parts(p).length > 1) return;

        const params = url.searchParams;

        if (p.includes('/search')) {
          if (params.has('d')) return;
          applySearchFilter(searchFilterParams, url);
          updateUrl(node, url);
        } else if (p !== '/' && !p.includes('/top-rated')) {
          url.pathname += '/top-rated';
          applySearchFilter(searchFilterParams, url);
          updateUrl(node, url);
        }
      },
    });
  },

  'tube8.com': _ => {
    const searchFilterParams = { res: 'HD', min_minutes: MIN_DURATION_MINS };
    init({
      searchInputSelector: 'input[type="text"][name="q"]',
      searchFilter: query => ['searches.html/', { q: query }],
      searchFilterParams,
      videoSelector: 'video.mgp_videoElement:not(.gifVideo)',
      playSelector: 'div.mgp_playIcon, div.mgp_bigPlay, div.mgp_playbackBtn, mgp_smallPlay',
      fullscreenSelector: 'div[data-text="Enter Fullscreen"], div[data-text="Exit fullscreen"]',
      thumbnailSelector: 'div.video-box',
      durationSelector: 'div.video-duration',
      isVideoUrl: href => href.includes('/porn-video/'),
      hideSelector: 'div#cookie_consent_wrapper',
      onNodeChange: node => {
        if (!validLink(node)) return;

        const url = new URL(node.href);
        const p = url.pathname;
        const params = url.searchParams;
        if (['newest.html', 'mostviewed.html', 'searches.html', 'top.html', 'cat/', 'porntags/'].find(i => p.startsWith(`/${i}`)) && (!params.has('res') || !params.has('min_minutes'))) {
          applySearchFilter(searchFilterParams, url);
          updateUrl(node, url);
        } else if (p.startsWith('/pornstar/') && !p.endsWith('/duration/')) {
          url.pathname += 'duration/';
          updateUrl(node, url);
        } else if (p.startsWith('/channel/') && !params.has('orderBy')) {
          params.set('orderBy', 'tr');
          updateUrl(node, url);
        } else if (p.startsWith('/amateur/') && parts(p).length === 2 && !node.closest('ul.filter-list')) {
          url.pathname += '/rating/';
          updateUrl(node, url);
        }
      },
    });
  },

  'txxx.com': _ => {
    const hd = 'HD';
    const searchFilterParams = { type: 'hd', duration: 3 };
    const isVideoUrl = href => href.includes('/videos/');
    init({
      searchInputSelector: 'input[type="text"][placeholder="Search by videos..."]',
      searchFilter: query => ['search/', { s: query }],
      searchFilterParams,
      thumbnailSelector: 'div.thumb',
      qualitySelector: 'div.labels',
      durationSelector: 'div.labels',
      isUnwantedQuality: text => !text.startsWith(hd),
      isUnwantedDuration: text => timeToSeconds(text.split(hd)[1]) < MIN_DURATION_MINS * 60,
      isVideoUrl,
      hideSelector: 'div.nopop',
      onNodeChange: node => {
        if (!validLink(node) || isVideoUrl(node.href)) return;

        const url = new URL(node.href);
        const p = url.pathname;
        const params = url.searchParams;
        applySearchFilter(searchFilterParams, url);
        if (p.startsWith('/search/')) {
          const page = parseFloat(p.split('/search/')[1]?.split('/')[0]) || 1;
          url.pathname = `/search/${page}/`;
          updateUrl(node, url);
        } else if (['/categories/', '/channel/', '/models/'].find(i => p.startsWith(i))) {
          const ps = parts(p);
          const action = ps[0];
          const query = ps[1];
          const page = parseFloat(ps[2]) || 1;
          if (query) {
            url.pathname = `/${action}/${encodeURIComponent(query)}/${page}/`;
            const categories = action === 'categories';
            params.set('sort', categories ? 'top-rated' : 'longest');
            params.set('date', 'all');
            params.set('duration', categories ? '3' : 'all');
            updateUrl(node, url);
          }
        }
      },
    });
  },

  'veporn.com': _ => {
    init({
      fullscreenSelector: 'div.fluid_button[title="Full Screen"]',
      thumbnailSelector: 'article.loop-post',
      durationSelector: 'p.meta span:has(i.fa-clock)',
      hideSelector: '#onPauseAdContainer',
    });
  },

  'vxxx.com': _ => {
    const minDurationMins = 8; // NOTE: content is a disaster here
    const searchFilterParams = { sort: 'top-rated' };
    init({
      searchInputSelector: 'div.search-input input[type="text"], input[type="text"][placeholder="Search..."]',
      searchFilter: query => [`search/${encodeURIComponent(query)}/1/`, {}],
      searchFilterParams,
      fullscreenSelector: 'div[role="button"][aria-label="Fullscreen"], div[role="button"][aria-label="Exit Fullscreen"]',
      thumbnailSelector: 'div.thumb, a.thumb',
      durationSelector: 'span.duration',
      isUnwantedDuration: text => timeToSeconds(text) < minDurationMins * 60,
      onNodeChange: node => {
        if (!validLink(node)) return;

        const url = new URL(node.href);
        const p = url.pathname;
        if (p !== '/' && !['/ai', '/categories', '/channels', '/pornstars', '/video-', 'watch-history', '/watch-later'].find(i => p.startsWith(i))) {
          if (p.includes('/pornstar') && !p.includes('/videos/')) {
            url.pathname += '/videos';
          }
          if (!parts(p).find(parseFloat)) {
            url.pathname += '/1/';
          }
          applySearchFilter(searchFilterParams, url);
          updateUrl(node, url);
        }
      },
    });
  },

  'whoreshub.com': _ => {
    init({
      thumbnailSelector: 'div.thumb',
      qualitySelector: 'span.is-hd',
      durationSelector: 'span.duration',
      isUnwantedQuality: text => !['HD', '4K'].includes(text),
      isVideoUrl: href => href.includes('/videos/'),
    });
  },

  'xgroovy.com': _ => {
    init({
      searchInputSelector: 'input[type="text"][name="q"]',
      searchFilter: query => [`search/${encodeURIComponent(query.replaceAll(' ', '-'))}/`, { sort: 'duration' }],
      thumbnailSelector: 'div.item',
      qualitySelector: 'span.is-hd',
      durationSelector: 'div.duration',
      isUnwantedQuality: text => parseFloat(text.split('p')[0] || 0) < MIN_VIDEO_HEIGHT,
      isUnwantedDuration: text => text.includes(' sec') || parseFloat(text.split(' min')[0] || 0) < MIN_DURATION_MINS,
      isVideoUrl: href => href.includes('/videos/'),
    });
  },

  'xhamster.com': _ => {
    // TODO: <iframe src="https://xhamster.com/embed/xhHw7V9" scrolling="no" allowfullscreen="" width="640" height="480" frameborder="0"></iframe><p></p>
    const qualityKey = 'quality';
    const hd = '/hd/';
    const best = `${hd}full-length/best`;
    const quality = `${MIN_VIDEO_HEIGHT}p`;
    const searchFilterParams = {
      quality,
      'min-duration': 30,
      'length': 'full'
    };
    init({
      searchInputSelector: 'input[name="q"][type="text"]',
      searchFilter: query => [`search/${encodeURIComponent(query)}`, {}],
      searchFilterParams,
      thumbnailSelector: 'div.video-thumb, div.thumb-list__item',
      durationSelector: 'div[data-role="video-duration"]',
      isVideoUrl: href => href.includes('/videos/'),
      hideSelector: 'a[href*="/ff/out?"], div.dyltv-inner-container, div[data-block="moments"], div[data-role="cookies-modal"], div[class*="skeleton"], div[data-role="contest-banner-block"]',
      onNodeChange: node => {
        if ((node.matches('span') && node.textContent.includes('Watch more')) || (node.matches('div.thumb-plug') && node.textContent.includes('Not available'))) {
          node.closest('div')?.classList?.add(HIDE);
          return;
        }

        if (!validLink(node) || node.closest('div.categories-container, div[class^="videoFilters-"]')) return;

        const url = new URL(node.href.replace(/\/hd$/, '/'));
        const params = url.searchParams;
        const p = url.pathname;
        if (params.has(qualityKey)) return;

        if (p.startsWith('/search/') && params.get('length') !== 'full') {
          applySearchFilter(searchFilterParams, url);
          updateUrl(node, url);
        } else if (p === '/' || (['/categories/', '/channels/'].find(i => p.startsWith(i)) && !p.includes(best))) {
          url.pathname += `${best}/monthly`;
          params.set(qualityKey, quality);
          updateUrl(node, url);
        } else if (parts(p).length > 1 && p.startsWith('/creators/') && !['/all/', '/awards', '/contest/', '/videos/', hd].find(i => p.includes(i))) {
          url.pathname += hd;
          params.set(qualityKey, quality);
          updateUrl(node, url);
        } else if (parts(p).length > 1 && p.startsWith('/pornstars/') && !['/all/', best].find(i => p.includes(i))) {
          url.pathname += best;
          params.set(qualityKey, quality);
          updateUrl(node, url);
        }
      },
    });
  },

  'xn----ztbcbceder.tv': _ => {
    init({
      thumbnailSelector: 'a[vid]',
      durationSelector: 'div.durik',
      isVideoUrl: href => href.endsWith('.html'),
      hideSelector: 'p',
      nodeChangeSelector: `${defaultArgs.nodeChangeSelector}, p`,
    });
  },

  'xnxx.com': _ => {
    const searchPath = 'search/hits/20min+/fullhd';
    const containerSelector = 'div#html5video';
    init({
      searchInputSelector: 'input.search-input[type="text"][name="k"], div.form-group input[type="text"][placeholder="Search..."]',
      searchFilter: query => [`${searchPath}/${encodeURIComponent(query)}`, {}],
      playSelector: `${containerSelector} span.player-icon-f[title="Play"]`,
      pauseSelector: `${containerSelector} span.player-icon-f[title="Pause"]`,
      fullscreenSelector: `${containerSelector} span.player-icon-f[title="Fullscreen"]`,
      videoSelector: `${containerSelector} video`,
      thumbnailSelector: 'div.thumb-block',
      qualitySelector: 'span.video-hd',
      durationSelector: 'div.thumb-under p.metadata',
      isUnwantedQuality: text => parseFloat((text.split('\n').find(i => i.endsWith('p'))?.split('p')[0]) || 0) < MIN_VIDEO_HEIGHT,
      isUnwantedDuration: text => parseFloat(text.split('\n').find(i => i.endsWith('min'))?.split('min')[0] || 0) < MIN_DURATION_MINS,
      isVideoUrl: href => href.includes('/video-'),
      hideSelector: '.gold-plate, .premium-results-line',
      nodeChangeSelector: `${defaultArgs.nodeChangeSelector}, p`,
      onNodeChange: node => {
        if (!validLink(node) || node.closest('div#listing-page-filters-block')) return;

        const url = new URL(node.href);
        const p = url.pathname;
        if (p.startsWith('/search/')) {
          const ps = parts(p);
          const lastPart = ps.slice(-1)[0] || '';
          const hasPage = ps.length > 4 && !!parseFloat(lastPart);
          const page = hasPage ? lastPart : '';
          const query = ps.slice(hasPage ? -2 : -1)[0] || '';
          url.pathname = `/${searchPath}/${encodeURIComponent(query)}/${page}`;
          url.search = '';
          updateUrl(node, url);
        }
      },
    });
  },

  'xvideos.com': _ => {
    const searchFilterParams = {
      sort: 'rating',
      durf: `${MIN_DURATION_MINS}min_more`,
      quality: `${MIN_VIDEO_HEIGHT}P`,
    };
    init({
      searchInputSelector: 'input.search-input[type="text"], input[type="text"][placeholder="Search X videos"]',
      searchFilter: query => ['', { k: query }],
      searchFilterParams,
      thumbnailSelector: 'div.thumb, div.thumb-inside, div.video-thumb, div.thumb-under, div.video-under',
      playSelector: 'span.player-icon-f[title="Play"]',
      pauseSelector: 'span.player-icon-f[title="Pause"]',
      fullscreenSelector: 'span.player-icon-f[title="Fullscreen"]',
      qualitySelector: 'span.video-hd-mark, span.video-sd-mark',
      durationSelector: 'span.duration',
      isUnwantedQuality: text => (parseFloat(text.split('p')[0]) || 0) < MIN_VIDEO_HEIGHT,
      isUnwantedDuration: text => text.includes(' sec') || (!text.includes('h') && parseFloat(text.split(' min')[0] || 0) < MIN_DURATION_MINS),
      isVideoUrl: href => new URL(href).pathname.startsWith('/video.'),
      hideSelector: 'a.premium, button.comments span.badge, div[style*="color: rgb(255, 255, 255)"][style*="text-align: center"], div.banner-slider, div.p-red, div.premium-free-switch, div.quickies-lat, div.premium-results-line, ul.search-premium-tabs',
      nodeChangeSelector: `${defaultArgs.nodeChangeSelector}, strong`,
      onNodeChange: node => {
        if (node.matches('div.error-dialog div.error-content button') && node.textContent?.includes('Retry')) {
          node.click();
          return;
        }

        if (!validLink(node) || node.closest('div.search-filters')) return;

        const url = new URL(node.href);
        const params = url.searchParams;
        const p = url.pathname;
        if (p === '/' && params.has('k') && !params.has('quality')) {
          applySearchFilter(searchFilterParams, url);
          updateUrl(node, url);
          return;
        } else if (p.startsWith('/c/') && !p.includes(`q:${MIN_VIDEO_HEIGHT}P`)) {
          const ps = parts(p);
          if (ps.length >= 2) {
            url.pathname = `${ps[0]}/s:rating/d:${MIN_DURATION_MINS}min_more/q:${MIN_VIDEO_HEIGHT}P/${ps[1]}`;
            updateUrl(node, url);
          }
        } else if (['channels', 'pornstars', 'profiles'].find(i => p.startsWith(`/${i}/`))) {
          url.hash = '_tabVideos';
          updateUrl(node, url);
        }
      },
    });
  },

  'xxxbp.tv': _ => {
    const isVideoUrl = href => href.includes('/video/');
    const topRated = '/top-rated';
    init({
      css: `
        html { background: black !important }
        .heading-sort .heading-sort-active { color: #ffd030 !important }
      `,
      searchInputSelector: 'input#searchInput[type="text"]',
      searchFilter: query => [`x/${encodeURIComponent(query.replaceAll(' ', '-'))}${topRated}`, {}],
      thumbnailSelector: 'article.thumb',
      durationSelector: 'span.thumb-box-title',
      isUnwantedDuration: text => text.includes(':') && timeToSeconds(text) < MIN_DURATION_MINS * 60,
      isVideoUrl,
      onNodeChange: node => {
        if (!validLink(node) || isVideoUrl(node.href) || node.href.endsWith(topRated) || ['categories', 'history', 'models', 'recommended', 'tags'].find(i => node.href.endsWith(`/${i}`)) || node.closest('div.heading-sort')) return;
        node.href += topRated;
      },
    });
  },

  'youporn.com': _ => {
    const rating = '/rating/';
    const searchFilterParams = { res: 'HD', min_minutes: MIN_DURATION_MINS };
    init({
      searchInputSelector: 'input[name="query"][type="text"]',
      searchFilter: query => ['search/', { query }],
      searchFilterParams,
      videoSelector: 'video.mgp_videoElement:not(.gifVideo)',
      playSelector: 'div.mgp_playIcon, div.mgp_bigPlay, div.mgp_playbackBtn, mgp_smallPlay',
      fullscreenSelector: 'div.mgp_fullscreenIcon, div[data-text="Enter Fullscreen"], div[data-text="Exit fullscreen"]',
      thumbnailSelector: 'div.video-box',
      durationSelector: 'div.video-duration',
      isUnwantedDuration: text => timeToSeconds(text) < MIN_DURATION_MINS * 60,
      isVideoUrl: href => href.includes('/watch/'),
      hideSelector: 'div#cookie_consent_wrapper, div.channel-description, div.recommended-videos-wrapper',
      onNodeChange: node => {
        if (!validLink(node) || node.closest('ul.filter-list')) return;

        const url = new URL(node.href);
        const p = url.pathname;
        if (['category', 'most_favorited', 'most_viewed', 'porntags', 'top_rated', 'search'].find(i => p.includes(`/${i}/`))) {
          applySearchFilter(searchFilterParams, url);
          updateUrl(node, url);
        } else if (!p.includes(rating) && ['channel', 'pornstar'].find(i => p.includes(`/${i}/`))) {
          url.pathname += rating;
          updateUrl(node, url);
        }
      },
    });
  },
};
(sites[shortDomain] || defaultInit)();

})();
