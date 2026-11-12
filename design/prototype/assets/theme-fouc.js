// FOUC prevention — resolve theme synchronously before paint.
(function () {
  try {
    var choice = localStorage.getItem('label-suite-theme') || 'system';
    /* label-suite/label-suite#195: must resolve `system` the same way theme.js
       does, or the first paint is light and theme.js corrects it a moment
       later -- which is the flash this file exists to prevent. */
    var resolved = (choice === 'dark') ? 'dark'
      : (choice === 'light') ? 'light'
      : (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark'
      : 'light';
    document.documentElement.setAttribute('data-theme', resolved);
  } catch (e) {
    document.documentElement.setAttribute('data-theme', 'light');
  }
})();
