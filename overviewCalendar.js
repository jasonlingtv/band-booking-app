// overviewCalendar.js — Overview page calendar column (Day / Week / Month)
const OverviewCalendar = (() => {
  'use strict';

  const DAY_START = 7;  // 7 am
  const DAY_END   = 21; // 9 pm

  const MONTHS = ['January','February','March','April','May','June',
                  'July','August','September','October','November','December'];
  const DAYS_S  = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

  let _view     = 'day';
  let _date     = (() => { const d = new Date(); d.setHours(0,0,0,0); return d; })();
  let _calEl    = null;
  let _bodyEl   = null;
  let _navLbl   = null;
  let _toggle   = null;
  let _expanded = false;
  let _outsideH = null;
  let _onOpenTask = null;

  // ── Data helpers ────────────────────────────────────────────────────────────

  function _allEvents() {
    const out = [];
    DataLayer.getTeams().forEach(team => {
      (team.projects || []).forEach(project => {
        (project.sections || []).forEach(section => {
          (section.tasks || []).forEach(task => {
            if (task.startDate) out.push({ task, project, team });
          });
        });
      });
    });
    return out;
  }

  function _eventsOn(dateStr) {
    return _allEvents().filter(e => (e.task.startDate || '').slice(0, 10) === dateStr);
  }

  function _eventsInRange(a, b) {
    return _allEvents().filter(e => {
      const d = (e.task.startDate || '').slice(0, 10);
      return d >= a && d <= b;
    });
  }

  // ── Date helpers ────────────────────────────────────────────────────────────

  function _fmt(d) {
    return d.getFullYear() + '-' +
      String(d.getMonth() + 1).padStart(2, '0') + '-' +
      String(d.getDate()).padStart(2, '0');
  }

  function _weekOf(d) {
    const c = new Date(d); c.setHours(0,0,0,0);
    c.setDate(c.getDate() - c.getDay());
    return c;
  }

  function _same(a, b) {
    return a.getFullYear() === b.getFullYear() &&
           a.getMonth()    === b.getMonth()    &&
           a.getDate()     === b.getDate();
  }

  function _fmtHour(h) {
    if (h === 0) return '12am';
    if (h < 12)  return h + 'am';
    if (h === 12) return '12pm';
    return (h - 12) + 'pm';
  }

  function _navLabel() {
    if (_view === 'day') {
      const D = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
      return D[_date.getDay()] + ', ' + MONTHS[_date.getMonth()] + ' ' +
             _date.getDate() + ', ' + _date.getFullYear();
    }
    if (_view === 'week') {
      const ws = _weekOf(_date);
      const we = new Date(ws); we.setDate(we.getDate() + 6);
      if (ws.getMonth() === we.getMonth())
        return MONTHS[ws.getMonth()] + ' ' + ws.getDate() + '–' + we.getDate() + ', ' + ws.getFullYear();
      return MONTHS[ws.getMonth()] + ' ' + ws.getDate() + ' – ' + MONTHS[we.getMonth()] + ' ' + we.getDate();
    }
    return MONTHS[_date.getMonth()] + ' ' + _date.getFullYear();
  }

  // ── Project / section chooser ───────────────────────────────────────────────

  function _projectList() {
    const out = [];
    DataLayer.getTeams().forEach(team => {
      (team.projects || []).forEach(project => out.push({ team, project }));
    });
    return out;
  }

  function _firstSection(projectId) {
    const secs = DataLayer.getSections(projectId);
    return secs && secs.length ? secs[0] : null;
  }

  // ── Modal ───────────────────────────────────────────────────────────────────

  function _modal({ heading, placeholder, btnLabel, onConfirm }) {
    const overlay = document.createElement('div');
    overlay.className = 'cal-modal-overlay';

    const box = document.createElement('div');
    box.className = 'cal-modal';

    const ttl = document.createElement('div');
    ttl.className = 'cal-modal-title';
    ttl.textContent = heading;
    box.appendChild(ttl);

    const inp = document.createElement('input');
    inp.className = 'cal-modal-input';
    inp.placeholder = placeholder;
    inp.type = 'text';
    box.appendChild(inp);

    const projs = _projectList();
    let chosen = projs[0] || null;

    if (projs.length > 1) {
      const sel = document.createElement('select');
      sel.className = 'cal-modal-select';
      projs.forEach(({ team, project }) => {
        const o = document.createElement('option');
        o.value = project.id;
        o.textContent = team.name + ' / ' + project.name;
        sel.appendChild(o);
      });
      sel.addEventListener('change', () => {
        chosen = projs.find(p => p.project.id === sel.value) || null;
      });
      box.appendChild(sel);
    }

    const acts = document.createElement('div');
    acts.className = 'cal-modal-actions';

    const cancel = document.createElement('button');
    cancel.className = 'cal-modal-btn cal-modal-btn--cancel';
    cancel.textContent = 'Cancel';
    cancel.addEventListener('click', () => overlay.remove());

    const save = document.createElement('button');
    save.className = 'cal-modal-btn cal-modal-btn--save';
    save.textContent = btnLabel;
    save.addEventListener('click', () => {
      const name = inp.value.trim();
      if (!name) { inp.focus(); return; }
      const sec = chosen ? _firstSection(chosen.project.id) : null;
      if (!sec) { alert('No project/section found.'); return; }
      overlay.remove();
      onConfirm(name, sec.id);
    });

    acts.appendChild(cancel);
    acts.appendChild(save);
    box.appendChild(acts);
    overlay.appendChild(box);
    document.body.appendChild(overlay);

    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
    inp.addEventListener('keydown', e => {
      if (e.key === 'Enter') save.click();
      if (e.key === 'Escape') overlay.remove();
    });
    setTimeout(() => inp.focus(), 0);
  }

  function _createEvent(dateStr, hour) {
    _modal({
      heading: hour !== null
        ? 'New event — ' + dateStr + ' at ' + _fmtHour(hour)
        : 'New event — ' + dateStr,
      placeholder: 'Event name…',
      btnLabel: 'Create event',
      onConfirm: (name, sectionId) => {
        const overrides = { title: name, startDate: dateStr };
        if (hour !== null) overrides.calTime = hour;
        DataLayer.addTask(sectionId, overrides);
        Utils.EventBus.emit('todo:updated');
        _refreshBody();
      }
    });
  }

  function _createQuickReminder() {
    _modal({
      heading: 'Quick reminder — To Do only',
      placeholder: 'Reminder…',
      btnLabel: 'Add to To Do',
      onConfirm: (name, sectionId) => {
        DataLayer.addTask(sectionId, { title: name });
        Utils.EventBus.emit('todo:updated');
      }
    });
  }

  // ── Event chip ──────────────────────────────────────────────────────────────

  function _chip(task, project, team) {
    const el = document.createElement('div');
    el.className = 'cal-event-chip';
    el.title = task.title || '(Untitled)';

    const n = document.createElement('div');
    n.className = 'cal-event-name';
    n.textContent = task.title || '(Untitled)';
    el.appendChild(n);

    const s = document.createElement('div');
    s.className = 'cal-event-sub';
    s.textContent = team.name + ' / ' + project.name;
    el.appendChild(s);

    el.addEventListener('click', e => {
      e.stopPropagation();
      if (typeof _onOpenTask === 'function') _onOpenTask(task.id);
    });
    return el;
  }

  // ── Expand / Collapse ───────────────────────────────────────────────────────

  function _expand(v) {
    _view = v;
    _expanded = true;
    document.getElementById('app').classList.add('cal-expanded');
    _refreshBody();
    _refreshNav();
    _refreshToggle();
    _attachOutsideH();
  }

  function collapseIfExpanded() {
    if (!_expanded) return;
    _expanded = false;
    _view = 'day';
    document.getElementById('app').classList.remove('cal-expanded');
    _detachOutsideH();
    _refreshBody();
    _refreshNav();
    _refreshToggle();
  }

  function _attachOutsideH() {
    _detachOutsideH();
    _outsideH = e => {
      if (!_expanded) { _detachOutsideH(); return; }
      if (e.target.closest && e.target.closest('.cal-modal-overlay')) return;
      if (_calEl && _calEl.contains(e.target)) return;
      collapseIfExpanded();
    };
    setTimeout(() => document.addEventListener('click', _outsideH, true), 0);
  }

  function _detachOutsideH() {
    if (_outsideH) {
      document.removeEventListener('click', _outsideH, true);
      _outsideH = null;
    }
  }

  // ── Header ──────────────────────────────────────────────────────────────────

  function _buildHeader() {
    const hdr = document.createElement('div');
    hdr.className = 'cal-col-hdr';

    // Nav row
    const nav = document.createElement('div');
    nav.className = 'cal-nav-row';

    const prev = document.createElement('button');
    prev.className = 'cal-nav-btn'; prev.textContent = '‹'; prev.title = 'Previous';
    prev.addEventListener('click', () => _navigate(-1));

    const lbl = document.createElement('span');
    lbl.className = 'cal-nav-lbl';
    lbl.textContent = _navLabel();
    _navLbl = lbl;

    const next = document.createElement('button');
    next.className = 'cal-nav-btn'; next.textContent = '›'; next.title = 'Next';
    next.addEventListener('click', () => _navigate(1));

    const tod = document.createElement('button');
    tod.className = 'cal-today-btn'; tod.textContent = 'Today';
    tod.addEventListener('click', () => {
      _date = new Date(); _date.setHours(0,0,0,0);
      _refreshNav(); _refreshBody();
    });

    nav.appendChild(prev); nav.appendChild(lbl); nav.appendChild(next); nav.appendChild(tod);

    // View toggle
    const tgl = document.createElement('div');
    tgl.className = 'cal-view-tgl';
    _toggle = tgl;

    ['day','week','month'].forEach(v => {
      const btn = document.createElement('button');
      btn.className = 'cal-view-btn' + (_view === v ? ' active' : '');
      btn.dataset.v = v;
      btn.textContent = v.charAt(0).toUpperCase() + v.slice(1);
      btn.addEventListener('click', () => {
        if (v === 'day') { collapseIfExpanded(); }
        else if (v === _view && _expanded) { /* same view — no-op */ }
        else { _expand(v); }
      });
      tgl.appendChild(btn);
    });

    hdr.appendChild(nav);
    hdr.appendChild(tgl);
    _calEl.appendChild(hdr);
  }

  function _refreshNav() {
    if (_navLbl) _navLbl.textContent = _navLabel();
  }

  function _refreshToggle() {
    if (!_toggle) return;
    _toggle.querySelectorAll('.cal-view-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.v === _view);
    });
  }

  function _navigate(dir) {
    if (_view === 'day')   _date.setDate(_date.getDate() + dir);
    else if (_view === 'week') _date.setDate(_date.getDate() + dir * 7);
    else { _date.setMonth(_date.getMonth() + dir); _date.setDate(1); }
    _refreshNav(); _refreshBody();
  }

  // ── Body ────────────────────────────────────────────────────────────────────

  function _refreshBody() {
    if (!_calEl) return;
    if (_bodyEl) _bodyEl.remove();
    _bodyEl = document.createElement('div');
    _bodyEl.className = 'cal-body';

    if (_view === 'day')        _dayView(_bodyEl);
    else if (_view === 'week')  _weekView(_bodyEl);
    else                        _monthView(_bodyEl);

    const qr = document.createElement('button');
    qr.className = 'cal-qr-btn';
    qr.textContent = '+ Quick reminder (To Do only)';
    qr.addEventListener('click', () => _createQuickReminder());
    _bodyEl.appendChild(qr);

    _calEl.appendChild(_bodyEl);
  }

  // Day view
  function _dayView(parent) {
    const ds    = _fmt(_date);
    const evts  = _eventsOn(ds);
    const now   = new Date();
    const today = new Date(now); today.setHours(0,0,0,0);

    const wrap = document.createElement('div');
    wrap.className = 'cal-day-wrap';

    // All-day row for events with no calTime
    const allDay = evts.filter(e => e.task.calTime == null);
    if (allDay.length) {
      const adRow = document.createElement('div');
      adRow.className = 'cal-allday-row';
      const adLbl = document.createElement('div');
      adLbl.className = 'cal-time-lbl'; adLbl.textContent = 'All day';
      adRow.appendChild(adLbl);
      const adCell = document.createElement('div');
      adCell.className = 'cal-time-cell';
      allDay.forEach(({ task, project, team }) => adCell.appendChild(_chip(task, project, team)));
      adRow.appendChild(adCell);
      wrap.appendChild(adRow);
    }

    for (let h = DAY_START; h <= DAY_END; h++) {
      const row = document.createElement('div');
      const isNowHour = _same(_date, today) && now.getHours() === h;
      row.className = 'cal-time-row' + (isNowHour ? ' cal-now-row' : '');

      const lbl = document.createElement('div');
      lbl.className = 'cal-time-lbl'; lbl.textContent = _fmtHour(h);
      row.appendChild(lbl);

      const cell = document.createElement('div');
      cell.className = 'cal-time-cell';

      evts.filter(e => e.task.calTime === h).forEach(({ task, project, team }) => {
        cell.appendChild(_chip(task, project, team));
      });

      cell.addEventListener('click', e => {
        if (e.target.closest('.cal-event-chip')) return;
        _createEvent(ds, h);
      });

      row.appendChild(cell);
      wrap.appendChild(row);
    }

    parent.appendChild(wrap);
  }

  // Week view
  function _weekView(parent) {
    const ws   = _weekOf(_date);
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(ws); d.setDate(d.getDate() + i); return d;
    });
    const today = new Date(); today.setHours(0,0,0,0);
    const evts  = _eventsInRange(_fmt(days[0]), _fmt(days[6]));

    const grid = document.createElement('div');
    grid.className = 'cal-week-grid';

    // Day headers
    const hdrRow = document.createElement('div');
    hdrRow.className = 'cal-week-hdr-row';
    const corner = document.createElement('div');
    corner.className = 'cal-week-corner';
    hdrRow.appendChild(corner);
    days.forEach(d => {
      const h = document.createElement('div');
      h.className = 'cal-week-day-hdr' + (_same(d, today) ? ' today' : '');
      h.textContent = DAYS_S[d.getDay()] + ' ' + d.getDate();
      hdrRow.appendChild(h);
    });
    grid.appendChild(hdrRow);

    // All-day row
    const adRow = document.createElement('div');
    adRow.className = 'cal-week-allday-row';
    const adCorner = document.createElement('div');
    adCorner.className = 'cal-time-lbl'; adCorner.textContent = 'All day';
    adRow.appendChild(adCorner);
    days.forEach(d => {
      const ds = _fmt(d);
      const cell = document.createElement('div');
      cell.className = 'cal-week-cell' + (_same(d, today) ? ' today' : '');
      evts.filter(e => (e.task.startDate || '').slice(0,10) === ds && e.task.calTime == null)
          .forEach(({ task, project, team }) => cell.appendChild(_chip(task, project, team)));
      cell.addEventListener('click', ev => {
        if (ev.target.closest('.cal-event-chip')) return;
        _createEvent(ds, null);
      });
      adRow.appendChild(cell);
    });
    grid.appendChild(adRow);

    // Hour rows
    for (let h = DAY_START; h <= DAY_END; h++) {
      const row = document.createElement('div');
      row.className = 'cal-week-row';
      const lbl = document.createElement('div');
      lbl.className = 'cal-time-lbl'; lbl.textContent = _fmtHour(h);
      row.appendChild(lbl);
      days.forEach(d => {
        const ds = _fmt(d);
        const cell = document.createElement('div');
        cell.className = 'cal-week-cell' + (_same(d, today) ? ' today' : '');
        evts.filter(e => (e.task.startDate || '').slice(0,10) === ds && e.task.calTime === h)
            .forEach(({ task, project, team }) => cell.appendChild(_chip(task, project, team)));
        cell.addEventListener('click', ev => {
          if (ev.target.closest('.cal-event-chip')) return;
          _createEvent(ds, h);
        });
        row.appendChild(cell);
      });
      grid.appendChild(row);
    }

    parent.appendChild(grid);
  }

  // Month view
  function _monthView(parent) {
    const yr   = _date.getFullYear();
    const mo   = _date.getMonth();
    const first = new Date(yr, mo, 1);
    const last  = new Date(yr, mo + 1, 0);
    const today = new Date(); today.setHours(0,0,0,0);
    const evts  = _eventsInRange(_fmt(new Date(yr, mo, 1)), _fmt(new Date(yr, mo + 1, 0)));

    const grid = document.createElement('div');
    grid.className = 'cal-month-grid';

    DAYS_S.forEach(d => {
      const h = document.createElement('div');
      h.className = 'cal-month-dow'; h.textContent = d;
      grid.appendChild(h);
    });

    for (let i = 0; i < first.getDay(); i++) {
      const blank = document.createElement('div');
      blank.className = 'cal-month-cell cal-month-blank';
      grid.appendChild(blank);
    }

    for (let d = 1; d <= last.getDate(); d++) {
      const day = new Date(yr, mo, d);
      const ds  = _fmt(day);
      const cell = document.createElement('div');
      cell.className = 'cal-month-cell' + (_same(day, today) ? ' today' : '');

      const num = document.createElement('div');
      num.className = 'cal-month-day-num'; num.textContent = d;
      cell.appendChild(num);

      evts.filter(e => (e.task.startDate || '').slice(0,10) === ds)
          .forEach(({ task, project, team }) => cell.appendChild(_chip(task, project, team)));

      cell.addEventListener('click', ev => {
        if (ev.target.closest('.cal-event-chip')) return;
        _createEvent(ds, null);
      });

      grid.appendChild(cell);
    }

    parent.appendChild(grid);
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  function render(containerEl, opts) {
    _onOpenTask = opts && opts.onOpenTask ? opts.onOpenTask : null;
    _calEl = document.createElement('div');
    _calEl.className = 'overview-col overview-col--cal';
    _buildHeader();
    _refreshBody();
    containerEl.appendChild(_calEl);
    return _calEl;
  }

  function refresh() {
    _refreshBody();
    _refreshNav();
  }

  function getEl() { return _calEl; }

  function cleanup() {
    _detachOutsideH();
    const app = document.getElementById('app');
    if (app && _expanded) app.classList.remove('cal-expanded');
    _expanded = false;
    _view = 'day';
    _calEl = null;
    _bodyEl = null;
    _navLbl = null;
    _toggle = null;
    _onOpenTask = null;
  }

  return { render, refresh, getEl, cleanup, collapseIfExpanded };
})();
