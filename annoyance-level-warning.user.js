// ==UserScript==
// @name Cross off the links with CAPTCHA/PoW annoyance
// @description Helps to prefer visiting sites that aren't associated with the irrational businesses that keep "fighting" the spammy traffic by disrupting the UX with cringe challenges (rather than transforming the traffic into useful (UPoW) and profitable computations) as well as sites with PoW-based DDoS-protection pages (useless anti-ecological computations).
// @version 0.1
// @downloadURL https://userscripts.codonaft.com/annoyance-level-warning.user.js
// @grant GM.getValue
// @grant GM.xmlHttpRequest
// @grant GM_addStyle
// @grant GM_setValue
// ==/UserScript==

(async _ => {
'use strict';

const RECHECK_DURATION_SECS = 7 * 24 * 60 * 60;
const QUEUE_LIMIT = 32;
const RECORD_KEY = '__annoyance_level_warning';

const LEVEL_UNKNOWN = 'unknown';
const LEVEL_OK = 'ok';
const LEVEL_POW = 'pow';
const LEVEL_MAYBE_CAPTCHA = 'maybe_captcha';
const LEVEL_CAPTCHA = 'captcha';

const NUMBER_TO_LEVEL = [LEVEL_UNKNOWN, LEVEL_OK, LEVEL_POW, LEVEL_MAYBE_CAPTCHA, LEVEL_CAPTCHA];
const LEVEL_TO_NUMBER = Object.fromEntries(NUMBER_TO_LEVEL.entries().map(xs => xs.reverse()));

const STRIKE_COLOR = '#828282';
GM_addStyle(`
.${RECORD_KEY} {
  text-decoration-thickness: 0.1px !important;
}
.${RECORD_KEY}:hover {
  opacity: 1 !important;
  text-decoration: none !important;
}
.${RECORD_KEY}_${LEVEL_POW} {
  opacity: 0.7 !important;
  text-decoration: line-through ${STRIKE_COLOR} dashed !important;
}
.${RECORD_KEY}_${LEVEL_MAYBE_CAPTCHA} {
  opacity: 0.4 !important;
  text-decoration: line-through ${STRIKE_COLOR} !important;
}
.${RECORD_KEY}_${LEVEL_CAPTCHA} {
  opacity: 0.2 !important;
  text-decoration: line-through ${STRIKE_COLOR} double !important;
`);

// TODO: hover

const currentTime = _ => Math.round(Date.now() / 1000);
const now = currentTime();

const b = document.body;
const records = await GM.getValue(RECORD_KEY, {});
console.log('annoyance records', records);

const newRecord = (level, updated = now) => { return { level: LEVEL_TO_NUMBER[level], updated }; };
const setRecord = (hostname, level) => {
  console.log(`setRecord ${hostname} ${level}`);
  records[hostname] = newRecord(level);
  GM_setValue(RECORD_KEY, records);
};
const removeRecord = hostname => {
  if (!records[hostname]) return;
  delete records[hostname];
  GM_setValue(RECORD_KEY, records);
};
const getRecord = hostname => (records[hostname] || newRecord(LEVEL_UNKNOWN, 0));
const isUnknown = record => NUMBER_TO_LEVEL[record.level] === LEVEL_UNKNOWN;
const setThisHostname = level => setRecord(window.location.hostname, level);

const err = (e, data) => {
  console.log(data);
  console.error(e);
};

const setWarning = (node, level) => {
  if ([LEVEL_UNKNOWN, LEVEL_OK].includes(level)) return;
  node.classList.add(RECORD_KEY);
  node.classList.add(`${RECORD_KEY}_${level}`);

  const warning = level.replaceAll('_', ' ');
  node.title = node.title?.length > 0 ? `(${warning}) ${node.title}` : warning; // TODO: css?
};

const isIPv4 = s => s.split('.').length === 4 && s.split('.').every(n => n >= 0 && n <= 255 && n === String(Number(n)));
const isIPv6 = s => s.split(':').every(h => h.length === 0 || /^[0-9a-fA-F]{1,4}$/.test(h));
const isIP = s => s.includes('.') ? isIPv4(s) : isIPv6(s);

const enqueuedChecks = new Set;
const check = async hostname => {
  try {
    if (enqueuedChecks.size >= QUEUE_LIMIT || enqueuedChecks.has(hostname) || hostname.trim().length === 0) return;
    enqueuedChecks.add(hostname);
    const record = getRecord(hostname)

    const wasUnknown = isUnknown(record);
    if (now <= record.updated + RECHECK_DURATION_SECS) return;
    console.log(`check ${hostname}`);

    const rawDnsResponse = await GM.xmlHttpRequest({ url: `https://dns.google/resolve?name=${hostname}` });
    if (rawDnsResponse?.status !== 200) {
      throw `unexpected dns response, hostname=${hostname}`;
    }
    const dnsResponse = JSON.parse(rawDnsResponse.responseText);
    if (dnsResponse?.Status !== 0) {
      throw `dns failure, hostname=${hostname}`;
    }
    const ip = dnsResponse?.Answer?.find(i => i?.data && isIP(i.data))?.data;
    if (!ip) {
      throw `dns resolve failure hostname=${hostname}`;
    }

    const rawCompanyResponse = await GM.xmlHttpRequest({ url: `https://api.ipapi.is/?q=${ip}` });
    if (rawCompanyResponse?.status !== 200) {
      throw `unexpected company response, hostname=${hostname}`;
    }
    const companyResponse = JSON.parse(rawCompanyResponse.responseText);
    const company = companyResponse?.company?.name;
    if (!company) {
      throw `company failure, ip=${ip}, hostname=${hostname}`;
    }

    if (company === 'Cloudflare, Inc.') {
      if (record.level < LEVEL_TO_NUMBER[LEVEL_MAYBE_CAPTCHA]) {
        setRecord(hostname, LEVEL_MAYBE_CAPTCHA);
        b.querySelectorAll(`a[href^="http://${hostname}/"], a[href^="https://${hostname}/"]`).forEach(i => setWarning(i, LEVEL_MAYBE_CAPTCHA));
      }
    } else if (wasUnknown) {
      setRecord(hostname, LEVEL_OK);
    }
  } catch (e) {
    removeRecord(hostname);
    err(e, hostname);
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
        if (e.name === 'SecurityError') {
          observer.disconnect();
          return;
        }
      }
    }

    if (observeChildren) {
      const children = node?.childNodes || [];
      children.forEach(i => apply(i, observer));
    }
  };

  const observer = new MutationObserver(mutations => mutations.forEach(m => m.addedNodes.forEach(i => apply(i, observer))));
  observer.observe(node, { childList: true, subtree: true });
  node.querySelectorAll(selector).forEach(i => apply(i, observer));
};

subscribeOnChanges(document.head, 'title', (node, observer) => {
  if (node.textContent !== 'DDOS-GUARD' && !node.textContent.includes("Making sure you're not a bot")) return;
  observer.disconnect();
  console.warn('anti-ddos detected');
  setThisHostname(LEVEL_POW);
  return false;
});

const CLOUDFLARE_SCRIPT = 'script[src^="https://challenges.cloudflare.com/"]';
subscribeOnChanges(document, CLOUDFLARE_SCRIPT, (_, observer) => {
  observer.disconnect();
  console.warn('captcha possible');
  setThisHostname(LEVEL_MAYBE_CAPTCHA);
  return false;
});

subscribeOnChanges(b, 'iframe[src^="https://newassets.hcaptcha.com/"], iframe[title="reCAPTCHA"], iframe[src^="https://client-api.arkoselabs.com/"], iframe[src^="https://geo.captcha-delivery.com/"], iframe[src^="https://global.frcapi.com/"], div#captcha div[aria-label="Click to verify"], button#TencentCaptcha', (_, observer) => {
  observer.disconnect();
  console.warn('captcha detected');
  setThisHostname(LEVEL_CAPTCHA);
  return false;
});

subscribeOnChanges(b, 'p[class="h2"]', (node, observer) => {
  if (['Verify you are human', 'Verifying you are human'].find(i => node.textContent.includes(i)) && document.querySelector(CLOUDFLARE_SCRIPT)) {
    observer.disconnect();
    console.warn('captcha started');
    setThisHostname(LEVEL_CAPTCHA);
  }
  return false;
});

subscribeOnChanges(b, 'a[href]', node => {
  if (!node.href) return;
  const url = new URL(node.href);
  const hostname = url.hostname;
  const record = getRecord(hostname);
  if (hostname !== window.location.hostname) {
    setWarning(node, NUMBER_TO_LEVEL[record.level]);
  }
  check(hostname);
  return true;
});

setTimeout(_ => {
  const hostname = window.location.hostname;
  const result = getRecord(hostname);
  if (now > result.updated + RECHECK_DURATION_SECS && (enqueuedChecks.size < QUEUE_LIMIT || !enqueuedChecks.has(hostname))) {
    console.log('perhaps there is no captcha or pow');
    setThisHostname(LEVEL_OK);
  }
}, 5 * 60 * 1000);

const checkUnknown = _ => Object
  .entries(records)
  .forEach(([hostname, record]) => {
    if (isUnknown(record)) {
      check(hostname)
    }
  });

checkUnknown();

window.addEventListener('pageshow', event => {
 if (!event.persisted) return;
 console.log('back button is probably pressed');
 enqueuedChecks.clear();
 checkUnknown();
});
})();
