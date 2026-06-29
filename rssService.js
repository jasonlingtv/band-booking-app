// rssService.js — RSS fetching via CORS proxy with in-memory session caching
const RssService = (() => {
  'use strict';

  const _cache = {}; // url -> { items, fetchedAt, error? }
  const CACHE_TTL   = 5 * 60 * 1000; // 5 minutes
  const RSS2JSON    = 'https://api.rss2json.com/v1/api.json?rss_url=';
  const CORSPROXY   = 'https://corsproxy.io/?';

  function _clean(str) {
    return (str || '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ')
      .replace(/\s+/g, ' ').trim();
  }

  function _excerpt(str) {
    const s = _clean(str);
    return s.length > 300 ? s.slice(0, 299) + '…' : s;
  }

  function _thumbFromXmlNode(node) {
    const enc = node.querySelector('enclosure');
    if (enc && (enc.getAttribute('type') || '').startsWith('image/')) return enc.getAttribute('url');
    // media:thumbnail or media:content — try via local name
    for (const el of Array.from(node.children)) {
      const ln = el.localName;
      if ((ln === 'thumbnail' || ln === 'content') && el.getAttribute('url')) return el.getAttribute('url');
    }
    return null;
  }

  function _parseXml(xmlText) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlText, 'text/xml');
    const items = [];
    doc.querySelectorAll('item').forEach(node => {
      const get = tag => node.querySelector(tag)?.textContent || '';
      items.push({
        title:       _clean(get('title')),
        link:        (get('link') || get('guid')).trim(),
        description: _excerpt(get('description') || get('content')),
        pubDate:     get('pubDate'),
        thumbnail:   _thumbFromXmlNode(node),
      });
    });
    return items;
  }

  async function fetch(url) {
    const cached = _cache[url];
    if (cached && !cached.error && (Date.now() - cached.fetchedAt) < CACHE_TTL) return cached;

    // Primary: rss2json.com (handles CORS + converts to JSON)
    try {
      const res = await window.fetch(RSS2JSON + encodeURIComponent(url));
      if (res.ok) {
        const data = await res.json();
        if (data.status === 'ok' && Array.isArray(data.items)) {
          const items = data.items.map(i => ({
            title:       _clean(i.title || ''),
            link:        i.link || '',
            description: _excerpt(i.description || i.content || ''),
            pubDate:     i.pubDate || '',
            thumbnail:   i.thumbnail || (i.enclosure && i.enclosure.link) || null,
          }));
          return (_cache[url] = { items, fetchedAt: Date.now() });
        }
      }
    } catch (_) {}

    // Fallback: corsproxy.io + manual XML parse
    try {
      const res = await window.fetch(CORSPROXY + encodeURIComponent(url));
      if (res.ok) {
        const items = _parseXml(await res.text());
        return (_cache[url] = { items, fetchedAt: Date.now() });
      }
    } catch (_) {}

    return (_cache[url] = { items: [], fetchedAt: Date.now(), error: true });
  }

  function invalidate(url)  { delete _cache[url]; }
  function invalidateAll()  { Object.keys(_cache).forEach(k => delete _cache[k]); }

  function timeAgo(dateStr) {
    if (!dateStr) return '';
    const diff  = Math.max(0, Date.now() - new Date(dateStr).getTime());
    const mins  = Math.floor(diff / 60000);
    const hours = Math.floor(mins / 60);
    const days  = Math.floor(hours / 24);
    if (days  > 0) return days  + 'd ago';
    if (hours > 0) return hours + 'h ago';
    if (mins  > 0) return mins  + 'm ago';
    return 'just now';
  }

  return { fetch, invalidate, invalidateAll, timeAgo };
})();
