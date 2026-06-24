// ui-helpers.js — Shared UI utilities: context menus, saved indicator, inline prompts
const UIHelpers = (() => {
  'use strict';

  // ── Context Menu ──────────────────────────────────────────────────────────

  let _menu = null;
  let _menuTrigger = null;

  function closeMenu() {
    if (_menu) { _menu.remove(); _menu = null; _menuTrigger = null; }
  }

  function openMenu(triggerEl, items) {
    closeMenu();
    const menu = document.createElement('div');
    menu.className = 'context-menu';

    items.forEach(item => {
      if (item === 'divider') {
        const d = document.createElement('div');
        d.className = 'context-menu-divider';
        menu.appendChild(d);
        return;
      }
      const btn = document.createElement('button');
      btn.className = 'context-menu-item' + (item.danger ? ' danger' : '');
      btn.textContent = item.label;
      btn.addEventListener('click', () => {
        closeMenu();
        item.action();
      });
      menu.appendChild(btn);
    });

    // Append hidden to measure
    menu.style.visibility = 'hidden';
    document.body.appendChild(menu);
    _menu = menu;
    _menuTrigger = triggerEl;

    // Position
    const tr = triggerEl.getBoundingClientRect();
    const mw = menu.offsetWidth;
    const mh = menu.offsetHeight;
    let left = tr.right - mw;
    let top = tr.bottom + 4;
    if (left < 8) left = tr.left;
    if (left + mw > window.innerWidth - 8) left = window.innerWidth - 8 - mw;
    if (top + mh > window.innerHeight - 8) top = tr.top - mh - 4;
    menu.style.left = left + 'px';
    menu.style.top = top + 'px';
    menu.style.visibility = '';
  }

  // ── Saved Indicator ───────────────────────────────────────────────────────

  let _savedTimeout = null;
  function showSaved() {
    let el = document.getElementById('saved-indicator');
    if (!el) {
      el = document.createElement('div');
      el.id = 'saved-indicator';
      el.textContent = 'Saved';
      document.body.appendChild(el);
    }
    el.classList.add('visible');
    clearTimeout(_savedTimeout);
    _savedTimeout = setTimeout(() => el.classList.remove('visible'), 1200);
  }

  // ── Simple inline rename (uses prompt for now) ────────────────────────────

  function promptRename(currentName, label) {
    const val = window.prompt(`Rename ${label}:`, currentName);
    return (val !== null && val.trim()) ? val.trim() : null;
  }

  // ── Task type choice modal ────────────────────────────────────────────────

  function openTaskTypeModal(templateName, onTemplate, onBlank) {
    const existing = document.getElementById('task-type-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'task-type-overlay';
    overlay.className = 'task-type-overlay';

    const modal = document.createElement('div');
    modal.className = 'task-type-modal';

    const heading = document.createElement('div');
    heading.className = 'task-type-heading';
    heading.textContent = 'New Task';
    modal.appendChild(heading);

    const opts = document.createElement('div');
    opts.className = 'task-type-options';

    function makeOpt(label, desc, cls, handler) {
      const btn = document.createElement('button');
      btn.className = 'task-type-btn ' + cls;
      const lbl = document.createElement('span');
      lbl.className = 'task-type-btn-label';
      lbl.textContent = label;
      const dsc = document.createElement('span');
      dsc.className = 'task-type-btn-desc';
      dsc.textContent = desc;
      btn.appendChild(lbl);
      btn.appendChild(dsc);
      btn.addEventListener('click', () => { overlay.remove(); handler(); });
      return btn;
    }

    opts.appendChild(makeOpt(
      templateName, 'With template fields',
      'task-type-btn--template', onTemplate
    ));
    opts.appendChild(makeOpt(
      'Blank task', 'Title, notes, and sub-tasks only',
      'task-type-btn--blank', onBlank
    ));

    modal.appendChild(opts);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    overlay.addEventListener('mousedown', (e) => {
      if (e.target === overlay) overlay.remove();
    });
  }

  // ── Init (global click handler to close menu) ─────────────────────────────

  function init() {
    document.addEventListener('mousedown', (e) => {
      if (_menu && _menuTrigger) {
        if (!_menu.contains(e.target) && !_menuTrigger.contains(e.target)) {
          closeMenu();
        }
      }
    });
  }

  return { openMenu, closeMenu, showSaved, promptRename, openTaskTypeModal, init };
})();
