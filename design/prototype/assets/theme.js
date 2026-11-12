/* global window, document */
(function bootstrapLabelSuiteTheme(windowObj, documentObj) {
  const STORAGE_KEY = 'label-suite-theme';
  const VALID_CHOICES = ['system', 'light', 'dark'];
  const DEFAULT_CHOICE = 'system';
  const listeners = new Set();

  function getStoredChoice() {
    try {
      const value = windowObj.localStorage.getItem(STORAGE_KEY);
      return VALID_CHOICES.indexOf(value) >= 0 ? value : DEFAULT_CHOICE;
    } catch (_err) {
      return DEFAULT_CHOICE;
    }
  }

  /* label-suite/label-suite#195 (spec 01-04 Q7, maintainer 2026-11-09): `system`
     reads the operating system instead of resolving to light, so the three
     choices really do behave three ways. Spec 07-01 Q10 had settled on "always
     light" but said to confirm it again when 01-04 landed; Q14 there is that
     re-confirmation. */
  function prefersDark() {
    try {
      return !!(windowObj.matchMedia && windowObj.matchMedia('(prefers-color-scheme: dark)').matches);
    } catch (_err) {
      return false; // no matchMedia (old browser, test harness) -- fall back to light
    }
  }

  function resolveChoice(choice) {
    if (choice === 'dark') return 'dark';
    if (choice === 'light') return 'light';
    return prefersDark() ? 'dark' : 'light';
  }

  function applyResolved(resolved) {
    documentObj.documentElement.setAttribute('data-theme', resolved);
  }

  function setChoice(choice) {
    if (VALID_CHOICES.indexOf(choice) < 0) return;
    try {
      windowObj.localStorage.setItem(STORAGE_KEY, choice);
    } catch (_err) {
      // localStorage unavailable (private mode etc) — apply for this session only
    }
    const resolved = resolveChoice(choice);
    applyResolved(resolved);
    listeners.forEach((cb) => {
      try { cb({ choice: choice, resolved: resolved }); } catch (_err) { /* ignore */ }
    });
  }

  function onChange(callback) {
    if (typeof callback === 'function') {
      listeners.add(callback);
      return function unsubscribe() { listeners.delete(callback); };
    }
    return function noop() {};
  }

  /* label-suite/label-suite#195: while the choice is `system`, the OS can change
     under us (macOS auto appearance, a user toggling dark mode), and spec 01-04
     §偏好設定 point 4 says the three choices must really differ -- a `system`
     that only reads the OS once would drift back into looking like `light`.
     Only `system` listens; an explicit light/dark choice must not move. */
  function watchSystemAppearance() {
    var mq;
    try {
      mq = windowObj.matchMedia && windowObj.matchMedia('(prefers-color-scheme: dark)');
    } catch (_err) {
      return; // no matchMedia -- nothing to listen to
    }
    if (!mq) return;
    /* Not named onChange: that name is already the module's subscribe function. */
    var onSystemChange = function () {
      if (getStoredChoice() !== 'system') return;
      var resolved = resolveChoice('system');
      applyResolved(resolved);
      listeners.forEach(function (cb) {
        try { cb({ choice: 'system', resolved: resolved }); } catch (_err) { /* ignore */ }
      });
    };
    /* Safari below 14 has no addEventListener on MediaQueryList. */
    if (mq.addEventListener) mq.addEventListener('change', onSystemChange);
    else if (mq.addListener) mq.addListener(onSystemChange);
  }

  // Apply on script load (the inline <head> snippet has already set
  // data-theme to prevent FOUC; this is a no-op if values already match).
  applyResolved(resolveChoice(getStoredChoice()));
  watchSystemAppearance();

  windowObj.LabelSuiteTheme = {
    STORAGE_KEY: STORAGE_KEY,
    VALID_CHOICES: VALID_CHOICES.slice(),
    getStoredChoice: getStoredChoice,
    getResolved: function () { return resolveChoice(getStoredChoice()); },
    setChoice: setChoice,
    onChange: onChange,
  };
})(window, document);
