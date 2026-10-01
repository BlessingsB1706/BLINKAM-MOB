/*
 * BlinkAm PWA helper
 * - registers the service worker
 * - captures `beforeinstallprompt` and shows a premium install modal 5s after load
 * - iOS / unsupported browsers get a guided "Add to Home Screen" sheet instead
 * - any element with [data-pwa-install] opens the installer on click
 */
(function () {
  'use strict';

  var AUTO_PROMPT_DELAY_MS = 5000;
  var DISMISS_KEY = 'blinkam_install_dismissed_at';
  var INSTALLED_KEY = 'blinkam_installed';
  var DISMISS_COOLDOWN_MS = 3 * 24 * 60 * 60 * 1000;

  var deferredPrompt = null;
  var autoTimerElapsed = false;
  var autoShown = false;
  var modal = null;

  var ua = window.navigator.userAgent || '';
  var isIOS = /iphone|ipad|ipod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  var isIOSSafari = isIOS && /safari/i.test(ua) && !/crios|fxios|edgios|opios/i.test(ua);

  function isStandalone() {
    return window.matchMedia('(display-mode: standalone)').matches ||
      window.matchMedia('(display-mode: minimal-ui)').matches ||
      window.navigator.standalone === true;
  }

  function recentlyDismissed() {
    var at = parseInt(localStorage.getItem(DISMISS_KEY) || '0', 10);
    return at && Date.now() - at < DISMISS_COOLDOWN_MS;
  }

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('service-worker.js', { scope: './' }).catch(function (err) {
        console.warn('BlinkAm SW registration failed:', err);
      });
    });
  }

  var CSS = [
    '.bk-pwa-backdrop{position:fixed;inset:0;z-index:9999;display:flex;align-items:flex-end;justify-content:center;padding:0;background:rgba(5,7,11,.72);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);opacity:0;transition:opacity .3s ease;font-family:Inter,system-ui,-apple-system,sans-serif}',
    '.bk-pwa-backdrop.bk-open{opacity:1}',
    '.bk-pwa-sheet{position:relative;width:100%;max-width:420px;max-height:92vh;overflow-y:auto;color:#fff;background:linear-gradient(160deg,rgba(22,27,38,.96),rgba(11,14,20,.98));border:1px solid rgba(0,255,162,.25);border-bottom:none;border-radius:28px 28px 0 0;padding:28px 22px calc(22px + env(safe-area-inset-bottom));box-shadow:0 -10px 60px rgba(0,255,162,.15);transform:translateY(100%);transition:transform .45s cubic-bezier(.2,.9,.25,1)}',
    '.bk-pwa-backdrop.bk-open .bk-pwa-sheet{transform:translateY(0)}',
    '@media (min-width:640px){.bk-pwa-backdrop{align-items:center;padding:24px}.bk-pwa-sheet{border-radius:28px;border-bottom:1px solid rgba(0,255,162,.25);transform:translateY(24px) scale(.96);opacity:0;transition:transform .4s cubic-bezier(.2,.9,.25,1),opacity .3s}.bk-pwa-backdrop.bk-open .bk-pwa-sheet{transform:none;opacity:1}}',
    '.bk-pwa-grip{width:44px;height:4px;border-radius:4px;background:rgba(255,255,255,.18);margin:-14px auto 18px}',
    '@media (min-width:640px){.bk-pwa-grip{display:none}}',
    '.bk-pwa-close{position:absolute;top:14px;right:14px;width:34px;height:34px;border-radius:50%;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.05);color:rgba(255,255,255,.6);font-size:18px;line-height:1;cursor:pointer}',
    '.bk-pwa-close:hover{color:#fff;background:rgba(255,255,255,.1)}',
    '.bk-pwa-head{display:flex;align-items:center;gap:14px;margin-bottom:18px}',
    '.bk-pwa-icon{width:64px;height:64px;border-radius:18px;flex-shrink:0;object-fit:cover;border:1px solid rgba(0,255,162,.35);box-shadow:0 0 28px rgba(0,255,162,.35)}',
    '.bk-pwa-kicker{font-size:10px;font-weight:800;letter-spacing:.25em;text-transform:uppercase;color:#00ffa2}',
    '.bk-pwa-title{font-size:22px;font-weight:900;letter-spacing:-.02em;margin:2px 0 0}',
    '.bk-pwa-sub{font-size:13px;line-height:1.55;color:rgba(255,255,255,.6);margin:0 0 18px}',
    '.bk-pwa-perks{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:22px}',
    '.bk-pwa-perk{padding:12px 6px;border-radius:16px;text-align:center;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.07)}',
    '.bk-pwa-perk svg{width:20px;height:20px;color:#00ffa2;margin:0 auto 6px;display:block}',
    '.bk-pwa-perk span{display:block;font-size:10px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:rgba(255,255,255,.75)}',
    '.bk-pwa-steps{list-style:none;padding:0;margin:0 0 22px;display:flex;flex-direction:column;gap:10px}',
    '.bk-pwa-steps li{display:flex;align-items:center;gap:12px;padding:12px 14px;border-radius:16px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.07);font-size:13px;color:rgba(255,255,255,.85)}',
    '.bk-pwa-steps b{color:#fff}',
    '.bk-pwa-num{width:26px;height:26px;border-radius:50%;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:900;color:#0b0e14;background:#00ffa2}',
    '.bk-pwa-glyph{display:inline-flex;vertical-align:middle;width:22px;height:22px;margin:0 2px;color:#0a84ff}',
    '.bk-pwa-actions{display:flex;flex-direction:column;gap:10px}',
    '.bk-pwa-btn{width:100%;padding:16px;border-radius:16px;font-size:13px;font-weight:900;letter-spacing:.18em;text-transform:uppercase;cursor:pointer;border:none;transition:transform .15s ease,box-shadow .2s}',
    '.bk-pwa-btn:active{transform:scale(.98)}',
    '.bk-pwa-primary{background:#00ffa2;color:#0b0e14;box-shadow:0 0 26px rgba(0,255,162,.4)}',
    '.bk-pwa-primary:hover{box-shadow:0 0 36px rgba(0,255,162,.6)}',
    '.bk-pwa-ghost{background:transparent;color:rgba(255,255,255,.55);border:1px solid rgba(255,255,255,.1)}',
    '.bk-pwa-ghost:hover{color:#fff;background:rgba(255,255,255,.05)}',
    '.bk-pwa-arrow{position:fixed;left:50%;bottom:calc(10px + env(safe-area-inset-bottom));transform:translateX(-50%);z-index:10000;color:#00ffa2;font-size:28px;animation:bk-bounce 1.2s infinite;pointer-events:none}',
    '@keyframes bk-bounce{0%,100%{transform:translate(-50%,0)}50%{transform:translate(-50%,8px)}}'
  ].join('');

  var ICONS = {
    bolt: '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>',
    offline: '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>',
    bell: '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.4-1.4A2 2 0 0118 14.2V11a6 6 0 00-4-5.7V5a2 2 0 10-4 0v.3A6 6 0 006 11v3.2c0 .5-.2 1-.6 1.4L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/></svg>',
    share: '<svg class="bk-pwa-glyph" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v12m0-12l-4 4m4-4l4 4M6 11H5a1 1 0 00-1 1v8a1 1 0 001 1h14a1 1 0 001-1v-8a1 1 0 00-1-1h-1"/></svg>',
    plus: '<svg class="bk-pwa-glyph" style="color:#fff" fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="4" stroke-width="2"/><path stroke-linecap="round" stroke-width="2" d="M12 8v8M8 12h8"/></svg>'
  };

  function header(kicker, title) {
    return '<div class="bk-pwa-grip"></div>' +
      '<button type="button" class="bk-pwa-close" data-bk-dismiss aria-label="Close">&times;</button>' +
      '<div class="bk-pwa-head"><img class="bk-pwa-icon" src="icon-192.png" alt="BlinkAm">' +
      '<div><div class="bk-pwa-kicker">' + kicker + '</div><h2 class="bk-pwa-title" id="bk-pwa-title">' + title + '</h2></div></div>';
  }

  function nativeContent() {
    return header('Get the App', 'Install BlinkAm') +
      '<p class="bk-pwa-sub">Add BlinkAm to your home screen for the full cinematic experience — launches instantly, full-screen, no app store needed.</p>' +
      '<div class="bk-pwa-perks">' +
      '<div class="bk-pwa-perk">' + ICONS.bolt + '<span>Instant</span></div>' +
      '<div class="bk-pwa-perk">' + ICONS.offline + '<span>Offline</span></div>' +
      '<div class="bk-pwa-perk">' + ICONS.bell + '<span>Live Pulse</span></div></div>' +
      '<div class="bk-pwa-actions">' +
      '<button type="button" class="bk-pwa-btn bk-pwa-primary" data-bk-install>Install App</button>' +
      '<button type="button" class="bk-pwa-btn bk-pwa-ghost" data-bk-dismiss>Maybe Later</button></div>';
  }

  function iosContent() {
    var where = isIOSSafari ? 'in Safari\u2019s toolbar' : 'in your browser\u2019s toolbar or menu';
    return header('Add to Home Screen', 'Install BlinkAm') +
      '<p class="bk-pwa-sub">iPhone and iPad install web apps from the Share menu. It takes two taps:</p>' +
      '<ol class="bk-pwa-steps">' +
      '<li><span class="bk-pwa-num">1</span><span>Tap <b>Share</b> ' + ICONS.share + ' ' + where + '</span></li>' +
      '<li><span class="bk-pwa-num">2</span><span>Scroll and choose <b>Add to Home Screen</b> ' + ICONS.plus + '</span></li>' +
      '<li><span class="bk-pwa-num">3</span><span>Tap <b>Add</b> — BlinkAm lands on your home screen</span></li></ol>' +
      '<div class="bk-pwa-actions">' +
      '<button type="button" class="bk-pwa-btn bk-pwa-primary" data-bk-dismiss data-bk-ack>Got it</button>' +
      '<button type="button" class="bk-pwa-btn bk-pwa-ghost" data-bk-dismiss>Maybe Later</button></div>';
  }

  function manualContent() {
    return header('Get the App', 'Install BlinkAm') +
      '<p class="bk-pwa-sub">Your browser doesn\u2019t offer one-tap install here. You can still add BlinkAm:</p>' +
      '<ol class="bk-pwa-steps">' +
      '<li><span class="bk-pwa-num">1</span><span>Open your browser menu (<b>\u22EE</b> or <b>Share</b>)</span></li>' +
      '<li><span class="bk-pwa-num">2</span><span>Choose <b>Install app</b>, <b>Add to Home Screen</b> or <b>Add to Dock</b></span></li></ol>' +
      '<div class="bk-pwa-actions">' +
      '<button type="button" class="bk-pwa-btn bk-pwa-primary" data-bk-dismiss data-bk-ack>Got it</button></div>';
  }

  function ensureStyles() {
    if (document.getElementById('bk-pwa-styles')) return;
    var style = document.createElement('style');
    style.id = 'bk-pwa-styles';
    style.textContent = CSS;
    document.head.appendChild(style);
  }

  function onKey(e) { if (e.key === 'Escape') closeModal(true); }

  function closeModal(rememberDismiss) {
    if (!modal) return;
    if (rememberDismiss) localStorage.setItem(DISMISS_KEY, String(Date.now()));
    var el = modal;
    modal = null;
    el.classList.remove('bk-open');
    document.removeEventListener('keydown', onKey);
    var arrow = document.querySelector('.bk-pwa-arrow');
    if (arrow) arrow.remove();
    setTimeout(function () { el.remove(); }, 400);
  }

  async function runNativePrompt() {
    if (!deferredPrompt) return;
    var promptEvent = deferredPrompt;
    deferredPrompt = null;
    promptEvent.prompt();
    var choice = await promptEvent.userChoice;
    closeModal(choice.outcome !== 'accepted');
    if (choice.outcome === 'accepted') localStorage.setItem(INSTALLED_KEY, '1');
  }

  function openModal() {
    if (modal || isStandalone()) return;
    ensureStyles();

    var content = deferredPrompt ? nativeContent() : (isIOS ? iosContent() : manualContent());
    modal = document.createElement('div');
    modal.className = 'bk-pwa-backdrop';
    modal.innerHTML = '<div class="bk-pwa-sheet" role="dialog" aria-modal="true" aria-labelledby="bk-pwa-title">' + content + '</div>';

    modal.addEventListener('click', function (e) {
      if (e.target === modal) return closeModal(true);
      if (e.target.closest('[data-bk-install]')) return runNativePrompt();
      if (e.target.closest('[data-bk-dismiss]')) return closeModal(true);
    });

    document.body.appendChild(modal);
    document.addEventListener('keydown', onKey);
    requestAnimationFrame(function () {
      modal.classList.add('bk-open');
      var primary = modal.querySelector('.bk-pwa-primary');
      if (primary) primary.focus({ preventScroll: true });
    });

    if (isIOSSafari && !deferredPrompt) {
      var arrow = document.createElement('div');
      arrow.className = 'bk-pwa-arrow';
      arrow.setAttribute('aria-hidden', 'true');
      arrow.textContent = '\u2193';
      document.body.appendChild(arrow);
    }
  }

  function maybeAutoPrompt() {
    if (autoShown || !autoTimerElapsed || isStandalone() || recentlyDismissed()) return;
    if (localStorage.getItem(INSTALLED_KEY)) return;
    if (!deferredPrompt && !isIOS) return;
    autoShown = true;
    openModal();
  }

  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    deferredPrompt = e;
    localStorage.removeItem(INSTALLED_KEY);
    maybeAutoPrompt();
  });

  window.addEventListener('appinstalled', function () {
    deferredPrompt = null;
    localStorage.setItem(INSTALLED_KEY, '1');
    closeModal(false);
    document.querySelectorAll('[data-pwa-install]').forEach(function (btn) { btn.style.display = 'none'; });
  });

  function init() {
    document.querySelectorAll('[data-pwa-install]').forEach(function (btn) {
      if (isStandalone()) { btn.style.display = 'none'; return; }
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        openModal();
      });
    });

    setTimeout(function () {
      autoTimerElapsed = true;
      maybeAutoPrompt();
    }, AUTO_PROMPT_DELAY_MS);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.BlinkAmPWA = { open: openModal, close: closeModal };
})();
