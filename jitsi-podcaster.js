// ==UserScript==
// @name Clean Jitsi in Tile Mode for Podcasting
// @icon https://www.google.com/s2/favicons?sz=64&domain=jitsi.org
// @version 0.2
// @downloadURL https://userscripts.codonaft.com/jitsi-podcaster.js
// @match https://*.jitsi-meet.*/*
// @match https://*.jitsi.*/*
// @match https://*.meet.switch.ch/*
// @match https://besprechung.net/*
// @match https://fairmeeting.net/*
// @match https://freejitsi01.netcup.net/*
// @match https://konferenz.buehl.digital/*
// @match https://konferenz.netzbegruenung.de/*
// @match https://meet.adminforge.de/*
// @match https://meet.alpha.berlin/*
// @match https://meet.alps.one/*
// @match https://meet.armstrong.zimt.uni-siegen.de/*
// @match https://meet.bitblaze.io/*
// @match https://meet.bjoernhaendler.de/*
// @match https://meet.collective.tools/*
// @match https://meet.computerwerk.org/*
// @match https://meet.corrently.cloud/*
// @match https://meet.cyber4edu.org/*
// @match https://meet.cyon.tools/*
// @match https://meet.darkly.biz/*
// @match https://meet.darmstadt.social/*
// @match https://meet.domov.de/*
// @match https://meet.dssr.ch/*
// @match https://meet.f3n-ac.de/*
// @match https://meet.ffbrb.de/*
// @match https://meet.ffmuc.net/*
// @match https://meet.ffrn.de/*
// @match https://meet.freifunk-aachen.de/*
// @match https://meet.freifunk-rhein-sieg.net/*
// @match https://meet.fuhrberg-digital.de/*
// @match https://meet.fyber.space/*
// @match https://meet.golem.de/*
// @match https://meet.hasi.it/*
// @match https://meet.in-berlin.de/*
// @match https://meet.isf.es/*
// @match https://meet.jit.si/*
// @match https://meet.jotbe.io/*
// @match https://meet.jugendrecht.org/*
// @match https://meet.kobschaetzki.de/*
// @match https://meet.leinelab.org/*
// @match https://meet.linus-neumann.de/*
// @match https://meet.lug-stormarn.de/*
// @match https://meet.meerfarbig.net/*
// @match https://meet.nerd.re/*
// @match https://meet.opensuse.org/*
// @match https://meet.osna.social/*
// @match https://meet.physnet.uni-hamburg.de/*
// @match https://meet.piraten-witten.de/*
// @match https://meet.piratenpartei-sh.de/*
// @match https://meet.rexum.space/*
// @match https://meet.roflcopter.fr/*
// @match https://meet.rollenspiel.monster/*
// @match https://meet.scheible.it/*
// @match https://meet.schnuud.de/*
// @match https://meet.studiumdigitale.uni-frankfurt.de/F*
// @match https://meet.stura.uni-heidelberg.de/*
// @match https://meet.stuvus.uni-stuttgart.de/*
// @match https://meet.systemli.org/*
// @match https://meet.teamcloud.work/*
// @match https://meet.teckids.org/*
// @match https://meet.ur.de/*
// @match https://meet.weimarnetz.de/*
// @match https://noalyss.free-solutions.org/*
// @match https://onlinetreff.ash-berlin.eu/*
// @match https://swisschat.free-solutions.org/*
// @match https://talk.linux-whv.de/*
// @match https://talk.snopyta.org/*
// @match https://vc.autistici.org/*
// @match https://vidconf.tech4good.ch/*
// @match https://virtual.chaosdorf.space/*
// @match https://webmeeting.opensolution.it/*
// @match https://www.kuketz-meet.de/*
// ==/UserScript==

(() => {
  'use strict';

  const hide = node => node.style.display = 'none';

  const process = node => {
    if (node.nodeType !== 1) return;

    if (node.matches?.('div.details-container, a.watermark.leftwatermark[href="https://jitsi.org"]')) {
      hide(node);
      return;
    }

    if (node.matches?.('span.videocontainer.display-video')) {
      if (node.children.length >= 5) {
        [3, 4].forEach(i => hide(node.children[i]));
      }
      return;
    }

    node.childNodes.forEach(process);
  };

  const subscribeOnChanges = (node, f) => {
    f(node);
    new MutationObserver(mutations => mutations.forEach(m => m.addedNodes.forEach(process)))
      .observe(node, { childList: true, subtree: true });
  };

  subscribeOnChanges(document.body, process);
})();
