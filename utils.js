// utils.js — Shared utilities (no dependencies)
const Utils = (() => {
  'use strict';

  function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
  }

  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const MONTHS_FULL = ['January','February','March','April','May','June','July','August','September','October','November','December'];

  function parseDateFromTitle(title) {
    if (!title) return null;

    const patterns = [
      // DD.MM.YYYY or DD/MM/YYYY at start, optional dash separator
      {
        re: /^(\d{1,2})[./](\d{1,2})[./](\d{4})\s*[-–—]?\s*/,
        parse: (m) => new Date(+m[3], +m[2] - 1, +m[1])
      },
      // "12 Jan 2025" at start
      {
        re: /^(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+(\d{4})\s*[-–—]?\s*/i,
        parse: (m) => new Date(+m[3], MONTHS.findIndex(mo => mo.toLowerCase() === m[2].slice(0,3).toLowerCase()), +m[1])
      },
      // "Jan 12, 2025" or "Jan 12 2025" at start
      {
        re: /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+(\d{1,2}),?\s+(\d{4})\s*[-–—]?\s*/i,
        parse: (m) => new Date(+m[3], MONTHS.findIndex(mo => mo.toLowerCase() === m[1].slice(0,3).toLowerCase()), +m[2])
      }
    ];

    for (const { re, parse } of patterns) {
      const match = title.match(re);
      if (match) {
        const date = parse(match);
        if (!isNaN(date.getTime())) {
          return { date, cleanTitle: title.slice(match[0].length).trim() };
        }
      }
    }
    return null;
  }

  function formatDate(date) {
    if (!date) return '';
    const d = new Date(date);
    if (isNaN(d.getTime())) return '';
    return `${String(d.getDate()).padStart(2,'0')}.${String(d.getMonth()+1).padStart(2,'0')}.${d.getFullYear()}`;
  }

  function formatDateShort(date) {
    if (!date) return '';
    const d = new Date(date);
    if (isNaN(d.getTime())) return '';
    return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
  }

  function formatDateFull(date) {
    if (!date) return '';
    const d = new Date(date);
    if (isNaN(d.getTime())) return '';
    return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
  }

  function isSameDay(a, b) {
    if (!a || !b) return false;
    const da = new Date(a), db = new Date(b);
    return da.getFullYear() === db.getFullYear() &&
           da.getMonth() === db.getMonth() &&
           da.getDate() === db.getDate();
  }

  function isDateInRange(date, start, end) {
    if (!date || !start || !end) return false;
    const d = new Date(date).setHours(0,0,0,0);
    const s = new Date(start).setHours(0,0,0,0);
    const e = new Date(end).setHours(0,0,0,0);
    return d >= s && d <= e;
  }

  // Simple event bus for cross-module communication
  const _listeners = {};
  const EventBus = {
    on(event, fn) {
      (_listeners[event] = _listeners[event] || []).push(fn);
    },
    off(event, fn) {
      if (_listeners[event]) {
        _listeners[event] = _listeners[event].filter(f => f !== fn);
      }
    },
    emit(event, ...args) {
      (_listeners[event] || []).slice().forEach(fn => {
        try { fn(...args); } catch (e) { console.error('[EventBus]', event, e); }
      });
    }
  };

  // Returns the correct DataLayer.updateTask() payload for a raw title string.
  // Always call this instead of setting { title: rawValue } directly.
  // If a date is found in the string it is extracted and returned in startDate/endDate;
  // the returned title is the cleaned text with the date removed.
  function taskTitleChanges(rawTitle) {
    const parsed = parseDateFromTitle(rawTitle);
    if (parsed && parsed.cleanTitle) {
      return {
        title: parsed.cleanTitle,
        startDate: parsed.date.toISOString(),
        endDate: parsed.date.toISOString()
      };
    }
    return { title: rawTitle };
  }

  return {
    generateId,
    parseDateFromTitle,
    taskTitleChanges,
    formatDate, formatDateShort, formatDateFull,
    isSameDay, isDateInRange,
    MONTHS, MONTHS_FULL,
    EventBus
  };
})();
