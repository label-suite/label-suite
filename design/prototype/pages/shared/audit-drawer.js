/* Shared change-history drawer (#422 / design-gaps G-38).
 *
 * user-management and role-settings each carried a copy of this drawer's
 * markup and open/close code, with no focus management. This module owns the
 * markup and the open/close behaviour; each page keeps its own i18n text and
 * its own log rendering, and fills the elements below by id:
 *   #auditDrawerTitle, #auditDrawerSubtitle, #auditDrawerCloseBtn,
 *   #auditLogList, #auditDrawerEmpty, #auditDrawerEmptyText
 *
 * The drawer mounts itself when this script loads, so include it after the
 * page's body content and before the page's inline script. Initial text comes
 * from data-* attributes on the script tag (the page's i18n overwrites it):
 *   data-title, data-subtitle, data-empty-text, data-close-label
 *
 * Focus handling reuses modal-focus.js (load it first): focus moves into the
 * drawer, Tab stays inside, Esc closes, focus returns to the trigger. While
 * closed the drawer is `inert`, so its off-screen close button is not
 * reachable by Tab.
 *
 *   LabelSuiteAuditDrawer.open({ trigger: el })
 *   LabelSuiteAuditDrawer.close()
 */
(function () {
  'use strict';

  var script = document.currentScript;
  var data = (script && script.dataset) || {};

  function el(id) { return document.getElementById(id); }

  function mount() {
    if (el('auditDrawer')) return;
    var holder = document.createElement('div');
    holder.innerHTML =
      '<div class="audit-drawer-overlay" id="auditDrawerOverlay" aria-hidden="true"></div>' +
      '<aside class="audit-drawer" id="auditDrawer" role="dialog" aria-modal="true"' +
      ' aria-labelledby="auditDrawerTitle" aria-hidden="true" inert>' +
        '<div class="audit-drawer-header">' +
          '<div>' +
            '<h2 id="auditDrawerTitle" class="audit-drawer-title"></h2>' +
            '<p id="auditDrawerSubtitle" class="audit-drawer-subtitle"></p>' +
          '</div>' +
          '<button type="button" class="modal-close" id="auditDrawerCloseBtn">' +
            '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">' +
              '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>' +
            '</svg>' +
          '</button>' +
        '</div>' +
        '<div class="audit-drawer-body">' +
          '<div id="auditLogList" class="audit-log-list" role="list"></div>' +
          '<div id="auditDrawerEmpty" class="empty-state empty-state-compact hidden">' +
            '<p id="auditDrawerEmptyText"></p>' +
          '</div>' +
        '</div>' +
      '</aside>';
    while (holder.firstChild) document.body.appendChild(holder.firstChild);

    el('auditDrawerTitle').textContent = data.title || '';
    el('auditDrawerSubtitle').textContent = data.subtitle || '';
    el('auditDrawerEmptyText').textContent = data.emptyText || '';
    el('auditDrawerCloseBtn').setAttribute('aria-label', data.closeLabel || 'Close');
    el('auditDrawerCloseBtn').addEventListener('click', close);
    el('auditDrawerOverlay').addEventListener('click', close);
  }

  function open(options) {
    var drawer = el('auditDrawer');
    var overlay = el('auditDrawerOverlay');
    drawer.removeAttribute('inert');
    drawer.classList.add('open');
    drawer.setAttribute('aria-hidden', 'false');
    overlay.classList.add('open');
    overlay.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    if (window.LabelSuiteModalFocus) {
      window.LabelSuiteModalFocus.open(drawer, {
        trigger: (options && options.trigger) || document.activeElement,
        onClose: close
      });
    }
  }

  /* Safe to call while the drawer is closed (the pages' Escape handlers do). */
  function close() {
    var drawer = el('auditDrawer');
    var wasOpen = drawer.classList.contains('open');
    drawer.classList.remove('open');
    drawer.setAttribute('aria-hidden', 'true');
    drawer.setAttribute('inert', '');
    el('auditDrawerOverlay').classList.remove('open');
    el('auditDrawerOverlay').setAttribute('aria-hidden', 'true');
    if (wasOpen) document.body.style.overflow = '';
    if (window.LabelSuiteModalFocus) window.LabelSuiteModalFocus.close(drawer);
  }

  mount();
  window.LabelSuiteAuditDrawer = { open: open, close: close };
})();
