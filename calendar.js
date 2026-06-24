// calendar.js — Date range picker popup
const Calendar = (() => {
  'use strict';

  let _popup = null;
  let _onSelect = null;
  let _startDate = null;
  let _endDate = null;
  let _dragging = false;
  let _dragStart = null;
  let _viewYear = new Date().getFullYear();
  let _viewMonth = new Date().getMonth();
  let _triggerEl = null;

  // Stored cell refs for lightweight highlight updates (avoids full re-render on hover)
  let _cells = [];

  // ── Open / Close ──────────────────────────────────────────────────────────

  function open(triggerEl, options) {
    close();
    _triggerEl = triggerEl;
    _onSelect = options.onSelect || function () {};
    _startDate = options.startDate ? new Date(options.startDate) : null;
    _endDate = options.endDate ? new Date(options.endDate) : null;
    _dragging = false;
    _dragStart = null;
    _cells = [];

    const ref = _startDate || new Date();
    _viewYear = ref.getFullYear();
    _viewMonth = ref.getMonth();

    _popup = document.createElement('div');
    _popup.className = 'calendar-popup';
    document.body.appendChild(_popup);
    _render();
    _position();
  }

  function close() {
    if (_popup) { _popup.remove(); _popup = null; }
    _dragging = false;
    _cells = [];
  }

  // ── Rendering ─────────────────────────────────────────────────────────────

  function _render() {
    if (!_popup) return;
    _popup.innerHTML = '';
    _cells = [];

    // Header
    const header = document.createElement('div');
    header.className = 'cal-header';

    const prev = document.createElement('button');
    prev.className = 'cal-nav';
    prev.textContent = '‹';
    prev.addEventListener('mousedown', (e) => e.preventDefault());
    prev.addEventListener('click', (e) => { e.stopPropagation(); _prevMonth(); });

    const titleEl = document.createElement('span');
    titleEl.className = 'cal-title';
    titleEl.textContent = `${Utils.MONTHS_FULL[_viewMonth]} ${_viewYear}`;

    const next = document.createElement('button');
    next.className = 'cal-nav';
    next.textContent = '›';
    next.addEventListener('mousedown', (e) => e.preventDefault());
    next.addEventListener('click', (e) => { e.stopPropagation(); _nextMonth(); });

    header.appendChild(prev);
    header.appendChild(titleEl);
    header.appendChild(next);
    _popup.appendChild(header);

    // Day names (Mon – Sun)
    const dayNames = document.createElement('div');
    dayNames.className = 'cal-day-names';
    ['Mo','Tu','We','Th','Fr','Sa','Su'].forEach(d => {
      const el = document.createElement('span');
      el.textContent = d;
      dayNames.appendChild(el);
    });
    _popup.appendChild(dayNames);

    // Grid
    const grid = document.createElement('div');
    grid.className = 'cal-grid';

    const firstDay = new Date(_viewYear, _viewMonth, 1);
    const startOffset = (firstDay.getDay() + 6) % 7; // Mon=0 … Sun=6
    const daysInMonth = new Date(_viewYear, _viewMonth + 1, 0).getDate();
    const today = new Date(); today.setHours(0, 0, 0, 0);

    for (let i = 0; i < startOffset; i++) {
      const blank = document.createElement('div');
      blank.className = 'cal-cell blank';
      grid.appendChild(blank);
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(_viewYear, _viewMonth, day);
      const cell = document.createElement('div');
      cell.className = 'cal-cell';
      cell.textContent = day;
      if (Utils.isSameDay(date, today)) cell.classList.add('today');

      _cells.push({ date, el: cell });

      cell.addEventListener('mousedown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        _dragging = true;
        _dragStart = date;
        _startDate = date;
        _endDate = null;
        _updateHighlights();
      });

      cell.addEventListener('mouseenter', () => {
        if (_dragging && _dragStart) {
          if (date < _dragStart) {
            _startDate = date;
            _endDate = _dragStart;
          } else {
            _startDate = _dragStart;
            _endDate = date;
          }
          _updateHighlights();
        }
      });

      cell.addEventListener('mouseup', (e) => {
        e.stopPropagation();
        if (_dragging) {
          _dragging = false;
          if (!_endDate) _endDate = _startDate;
          const s = _startDate, en = _endDate;
          _onSelect({ startDate: s, endDate: en });
          close();
        }
      });

      grid.appendChild(cell);
    }

    _popup.appendChild(grid);
    _updateHighlights();

    // Footer
    const footer = document.createElement('div');
    footer.className = 'cal-footer';
    const clearBtn = document.createElement('button');
    clearBtn.className = 'cal-clear';
    clearBtn.textContent = 'Clear dates';
    clearBtn.addEventListener('mousedown', (e) => e.preventDefault());
    clearBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      _onSelect({ startDate: null, endDate: null });
      close();
    });
    footer.appendChild(clearBtn);
    _popup.appendChild(footer);
  }

  // Only update CSS classes — no DOM rebuild. Called on every mouseenter during drag.
  function _updateHighlights() {
    _cells.forEach(({ date, el }) => {
      const isStart = _startDate && Utils.isSameDay(date, _startDate);
      const isEnd = _endDate && Utils.isSameDay(date, _endDate);
      const inRange = _startDate && _endDate && Utils.isDateInRange(date, _startDate, _endDate) && !isStart && !isEnd;
      const today = el.classList.contains('today');

      el.className = 'cal-cell' + (today ? ' today' : '');
      if (isStart) el.classList.add('selected', 'range-start');
      if (isEnd) el.classList.add('selected', 'range-end');
      if (inRange) el.classList.add('in-range');
    });
  }

  function _prevMonth() {
    _viewMonth--;
    if (_viewMonth < 0) { _viewMonth = 11; _viewYear--; }
    _render();
    _position();
  }

  function _nextMonth() {
    _viewMonth++;
    if (_viewMonth > 11) { _viewMonth = 0; _viewYear++; }
    _render();
    _position();
  }

  // ── Positioning ───────────────────────────────────────────────────────────

  function _position() {
    if (!_popup || !_triggerEl) return;
    const tr = _triggerEl.getBoundingClientRect();
    _popup.style.left = tr.left + 'px';
    _popup.style.top = (tr.bottom + 6) + 'px';
    requestAnimationFrame(() => {
      if (!_popup) return;
      const pr = _popup.getBoundingClientRect();
      if (pr.right > window.innerWidth - 8) {
        _popup.style.left = Math.max(8, window.innerWidth - 8 - pr.width) + 'px';
      }
      if (pr.bottom > window.innerHeight - 8) {
        _popup.style.top = (tr.top - pr.height - 6) + 'px';
      }
    });
  }

  // ── Init ──────────────────────────────────────────────────────────────────

  function init() {
    document.addEventListener('mousedown', (e) => {
      if (!_popup) return;
      if (!_popup.contains(e.target) && e.target !== _triggerEl && !_triggerEl.contains(e.target)) {
        close();
      }
    });

    document.addEventListener('mouseup', (e) => {
      if (_dragging && _popup) {
        _dragging = false;
        if (_startDate && _endDate) {
          const s = _startDate, en = _endDate;
          _onSelect({ startDate: s, endDate: en });
          close();
        }
      }
    });
  }

  function isOpen() { return !!_popup; }

  return { open, close, init, isOpen };
})();
