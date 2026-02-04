// ==UserScript==
// @name Label the links with CAPTCHA/PoW annoyance
// @description Helps to prefer visiting sites that aren't associated with the irrational businesses that keep "fighting" the spammy traffic by disrupting the UX with cringe challenges (rather than transforming the traffic into useful (UPoW) and profitable computations) as well as sites with PoW-based DDoS-protection pages (useless anti-ecological computations).
// @version 0.5
// @downloadURL https://userscripts.codonaft.com/annoyance-level-warning.user.js
// @require https://userscripts.codonaft.com/utils.js
// @grant GM.getValue
// @grant GM.xmlHttpRequest
// @grant GM_addStyle
// @grant GM_setValue
// ==/UserScript==

(async _ => {
'use strict';

const RECHECK_DURATION_SECS = 7 * 24 * 60 * 60;
const QUEUE_LIMIT = 128;
const RECORD_KEY = 'annoyanceLevelWarning';
const IP_TO_COMPANY_KEY = `${RECORD_KEY}IpToCompany`;

// FIXME: don't leak local IPs
// https://github.com/curl/curl/wiki/DNS-over-HTTPS#publicly-available-servers
const DOH_HOSTS = ['3dns.eu/dns-query', 'arashi.net.eu.org/dns-query', 'dns.belnet.be/dns-query', 'dns.blokada.org/dns-query', 'dns.csswg.org/dns-query', 'dns.dnsguard.pub/dns-query', 'dns.dnsguard.pub/dns-query', 'dns.elemental.software/dns-query', 'dns.girino.org/dns-query', 'dns.glf.wtf/dns-query', 'dns.mzjtechnology.com/dns-query', 'dns.nextdns.io/resolve', 'dns.novg.net/dns-query', 'dns.startupstack.tech/dns-query', 'dns.stirringphoto.com/dns-query', 'dns.svoi.dev/dns-query', 'dns.tls-data.de/dns-query', 'dns.w3ctag.org/dns-query', 'dns4eu.online/dns-query', 'doh.li/dns-query', 'doh.seby.io/dns-query', 'dukun.de/dns-query', 'masters-of-cloud.de/dns-query', 'ns.net.kg/dns-query'];

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
  position: relative;
}
.${RECORD_KEY}::after {
  font-size: 0.8rem;
  content: "🤖";
  position: absolute;
  top: 50%;
  left: 20%;
  transform: translate(-80%, -50%);
  z-index: -1;
}
.${RECORD_KEY}:hover {
  opacity: 1 !important;
  text-decoration: none !important;
}
.${RECORD_KEY}:hover::after {
  opacity: 0.3 !important;
  z-index: 1;
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

const currentTime = _ => Math.round(Date.now() / 1000);
const now = currentTime();

const b = document.body;

let records;
const loadRecords = async _ => { records = await GM.getValue(RECORD_KEY, {}); };
const newRecord = (level, updated = now) => { return { level: LEVEL_TO_NUMBER[level], updated }; };
const setRecord = async (hostname, level) => {
  await loadRecords();
  console.log(`setRecord ${hostname} ${level}`);
  records[hostname] = newRecord(level);
  GM_setValue(RECORD_KEY, records);
};
const removeRecord = async hostname => {
  await loadRecords();
  if (!records[hostname]) return;
  delete records[hostname];
  GM_setValue(RECORD_KEY, records);
};
const getRecord = hostname => (records[hostname] || newRecord(LEVEL_UNKNOWN, 0));
const isUnknown = record => NUMBER_TO_LEVEL[record.level] === LEVEL_UNKNOWN;
const setThisHostname = async level => await setRecord(window.location.hostname, level);

let ipToCompany;
const loadIpToCompany = async _ => { ipToCompany = await GM.getValue(IP_TO_COMPANY_KEY, {}); };
const addCompany = async (ip, company) => {
  await loadIpToCompany();
  if (ipToCompany[ip]) return;
  ipToCompany[ip] = company;
  GM_setValue(IP_TO_COMPANY_KEY, records);
};

const setWarning = (node, level) => {
  if ([LEVEL_UNKNOWN, LEVEL_OK].includes(level)) return;

  node.classList.add(RECORD_KEY);
  node.classList.add(`${RECORD_KEY}_${level}`);

  const warning = level.replaceAll('_', ' ');
  node.title = node.title?.length > 0 ? `(${warning}) ${node.title}` : warning; // TODO: css?
};

const resolveCompany = async (ip, hostname) => {
  const cachedCompany = ipToCompany[ip];
  if (cachedCompany) {
    return cachedCompany;
  }

  const rawCompanyResponse = await GM.xmlHttpRequest({ url: `https://api.ipapi.is/?q=${ip}` });
  if (rawCompanyResponse?.status !== 200) {
    throw `unexpected company response, hostname=${hostname}, response=${JSON.stringify(rawCompanyResponse)}`;
  }
  const companyResponse = JSON.parse(rawCompanyResponse.responseText);
  const company = companyResponse?.company?.name;
  if (!company) {
    throw `company failure, ip=${ip}, hostname=${hostname}, response=${JSON.stringify(companyResponse)}`;
  }
  await addCompany(ip, company);
  return company;
};

const enqueuedChecks = new Set;
const check = async hostname => {
  try {
    if (enqueuedChecks.size >= QUEUE_LIMIT || enqueuedChecks.has(hostname) || hostname.trim().length === 0) return;
    enqueuedChecks.add(hostname);
    const record = getRecord(hostname)

    const wasUnknown = isUnknown(record);
    if (now <= record.updated + RECHECK_DURATION_SECS) return;
    console.log(`check ${hostname}`);

    const dohHost = pickRandom(DOH_HOSTS);
    const rawDnsResponse = await GM.xmlHttpRequest({
      url: `https://${dohHost}?name=${hostname}&type=A`,
      headers: { 'accept': 'application/dns-json' },
    });
    if (rawDnsResponse?.status !== 200) {
      throw `unexpected status ${rawDnsResponse?.status}, hostname=${hostname}, resolver=${dohHost}`;
    }
    const dnsResponse = JSON.parse(rawDnsResponse.responseText);
    const ip = dnsResponse?.Answer?.find(i => i?.data && [1, 28].includes(i?.type))?.data;
    if (dnsResponse?.Status !== 0 || !ip) {
      throw `dns resolve failure: hostname=${hostname}, resolver=${dohHost}, response=${JSON.stringify(dnsResponse)}`;
    }

    // TODO: match IP by cidr?
    const company = await resolveCompany(ip, hostname);
    if (company === 'Cloudflare, Inc.') {
      // TODO: other proxy companies?
      if (record.level < LEVEL_TO_NUMBER[LEVEL_MAYBE_CAPTCHA]) {
        await setRecord(hostname, LEVEL_MAYBE_CAPTCHA);
        b.querySelectorAll(`a[href^="http://${hostname}/"], a[href^="https://${hostname}/"]`).forEach(i => setWarning(i, LEVEL_MAYBE_CAPTCHA));
      }
    } else if (wasUnknown) {
      await setRecord(hostname, LEVEL_OK);
    }
  } catch (e) {
    await removeRecord(hostname);
    err(e, hostname);
  }
};

await loadRecords();
await loadIpToCompany();

subscribeOnChanges(document.head, 'title', (node, observer) => {
  if (node.textContent !== 'DDOS-GUARD' && !node.textContent.includes("Making sure you're not a bot")) return;
  observer.disconnect();
  console.warn('anti-ddos detected');
  setThisHostname(LEVEL_POW);
  return false;
});

const AWS_SCRIPT = 'script[src$="/ait/captcha.js"]';
const CLOUDFLARE_SCRIPT = 'script[src^="https://challenges.cloudflare.com/"]';
subscribeOnChanges(document, [AWS_SCRIPT, CLOUDFLARE_SCRIPT].join(','), (_, observer) => {
  observer.disconnect();
  console.warn('captcha possible');
  setThisHostname(LEVEL_MAYBE_CAPTCHA);
  return false;
});

subscribeOnChanges(b, 'iframe[src^="https://newassets.hcaptcha.com/"], iframe[title="reCAPTCHA"], iframe[src^="https://client-api.arkoselabs.com/"], iframe[src^="https://geo.captcha-delivery.com/"], iframe[src^="https://global.frcapi.com/"], iframe[src^="https://captcha.edgecompute.app/"], div#captcha div[aria-label="Click to verify"], button#TencentCaptcha', (_, observer) => {
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
    return false;
  }
  return true;
});

subscribeOnChanges(b, 'div.amzn-captcha-modal, div#captcha-container', (_node, observer) => {
  if (document.querySelector(AWS_SCRIPT)) {
    observer.disconnect();
    console.warn('captcha started');
    setThisHostname(LEVEL_CAPTCHA);
    return false;
  }
  return true;
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
