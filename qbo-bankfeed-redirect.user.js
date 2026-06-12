// ==UserScript==
// @name         QBO → Bank Feed Redirect
// @namespace    http://tampermonkey.net/
// @version      1.5
// @description  Redirects QBO homepage to Bank Feed. Adds an escape button to visit the homepage intentionally.
// @author       Michael Volk
// @match        https://qbo.intuit.com/*
// @updateURL    https://raw.githubusercontent.com/mdvolkjr/tm-qbo-bankfeed-redirect/main/qbo-bankfeed-redirect.user.js
// @downloadURL  https://raw.githubusercontent.com/mdvolkjr/tm-qbo-bankfeed-redirect/main/qbo-bankfeed-redirect.user.js
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  const HOMEPAGE_PATTERNS = [
    /^https:\/\/qbo\.intuit\.com\/app\/homepage$/,
    /^https:\/\/qbo\.intuit\.com\/app\/homepage\?/,
    /^https:\/\/qbo\.intuit\.com\/app\/get-things-done$/,
    /^https:\/\/qbo\.intuit\.com\/app\/get-things-done\?/,
    /^https:\/\/qbo\.intuit\.com\/?$/,
  ];

  const BANK_FEED_URL = 'https://qbo.intuit.com/app/banking?jobId=accounting';
  const BYPASS_KEY = 'qbo_homepage_bypass';
  const BYPASS_TTL = 60 * 1000; // 1 minute grace window after clicking the button

  function isHomepage(url) {
    return HOMEPAGE_PATTERNS.some((p) => p.test(url));
  }

  function bypassActive() {
    const ts = sessionStorage.getItem(BYPASS_KEY);
    if (!ts) return false;
    const elapsed = Date.now() - parseInt(ts, 10);
    if (elapsed < BYPASS_TTL) return true;
    sessionStorage.removeItem(BYPASS_KEY);
    return false;
  }

  // ── SPA-aware redirect: fires on initial load AND client-side navigations ──

  function checkAndRedirect() {
    if (!isHomepage(window.location.href)) return;
    if (bypassActive()) {
      sessionStorage.removeItem(BYPASS_KEY);
      return;
    }
    window.location.replace(BANK_FEED_URL);
  }

  // Intercept history.pushState and history.replaceState
  ['pushState', 'replaceState'].forEach((method) => {
    const original = history[method];
    history[method] = function (...args) {
      original.apply(this, args);
      checkAndRedirect();
    };
  });

  // Also catch back/forward navigation
  window.addEventListener('popstate', checkAndRedirect);

  // Initial load check
  checkAndRedirect();

  // ── Inject the "Go to Homepage" escape button ──────────────────────────────const btn = document.createElement('button');
  btn.id = 'qbo-homepage-btn';
  btn.textContent = '⌂ Homepage';
  btn.title = 'Go to QBO Homepage (bypass redirect)';

  Object.assign(btn.style, {
    background: 'transparent',
    color: '#fff',
    border: '1px solid rgba(255,255,255,0.45)',
    borderRadius: '4px',
    padding: '4px 10px',
    fontSize: '12px',
    fontFamily: 'sans-serif',
    fontWeight: '600',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    opacity: '0.85',
    transition: 'opacity 0.15s, background 0.15s',
    marginLeft: '10px',
    flexShrink: '0',
    alignSelf: 'center',
  });

  btn.addEventListener('mouseenter', () => {
    btn.style.opacity = '1';
    btn.style.background = 'rgba(255,255,255,0.15)';
  });
  btn.addEventListener('mouseleave', () => {
    btn.style.opacity = '0.85';
    btn.style.background = 'transparent';
  });

  btn.addEventListener('click', () => {
    sessionStorage.setItem(BYPASS_KEY, Date.now().toString());
    window.location.href = 'https://qbo.intuit.com/app/get-things-done';
  });

  // ── Inject into the global header center node ──────────────────────────────
  // QBO renders late as a SPA, so poll via MutationObserver until the target exists.
  function injectButton() {
    if (document.getElementById('qbo-homepage-btn')) return true; // already injected

    const target = document.querySelector('.global-header-container.container-center');
    console.log('[QBO Redirect] header target:', target);

    if (target) {
      target.appendChild(btn);
      console.log('[QBO Redirect] button injected into header');
      return true;
    }

    // Fallback: just put it on the page so we know the script is running
    if (document.body) {
      // Re-apply fixed positioning as fallback
      btn.style.position = 'fixed';
      btn.style.bottom = '18px';
      btn.style.right = '18px';
      btn.style.zIndex = '99999';
      btn.style.background = '#0077C5';
      btn.style.marginLeft = '0';
      document.body.appendChild(btn);
      console.log('[QBO Redirect] button injected into body (fallback)');
      return true;
    }

    return false;
  }

  if (!injectButton()) {
    const observer = new MutationObserver(() => {
      if (injectButton()) observer.disconnect();
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }
})();
