// newsView.js — News Feeds tab: feed discovery and source-card headline grid
const NewsView = (() => {
  'use strict';

  const STORAGE_KEY        = 'band_booking_news_subs';
  const CUSTOM_STORAGE_KEY = 'band_booking_news_custom_subs';
  const FAVICON_SVC        = 'https://www.google.com/s2/favicons?domain=';
  const CORSPROXY          = 'https://corsproxy.io/?';

  let _subs           = new Set();
  let _customSubs     = []; // [{id, name, url, site, description}]
  let _view           = 'empty'; // 'empty' | 'discover' | 'myfeeds'
  let _discoverActive = null;    // null = first cat, '__search__', or category name
  let _wrap           = null;
  let _gen            = 0;
  let _hoverShowTimer = null;
  let _hoverHideTimer = null;
  let _hoverPopover   = null;
  let _searchQuery    = '';
  let _searchDebounce = null;

  // ── Persistence ────────────────────────────────────────────────────────────

  function _loadSubs() {
    try { _subs = new Set(JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')); }
    catch (_) { _subs = new Set(); }
    try { _customSubs = JSON.parse(localStorage.getItem(CUSTOM_STORAGE_KEY) || '[]'); }
    catch (_) { _customSubs = []; }
  }

  function _saveSubs() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([..._subs]));
  }

  function _saveCustomSubs() {
    localStorage.setItem(CUSTOM_STORAGE_KEY, JSON.stringify(_customSubs));
  }

  function _hasAnySubs() {
    return _subs.size > 0 || _customSubs.length > 0;
  }

  // ── Feed helpers ───────────────────────────────────────────────────────────

  function _getAllFeeds() {
    const all = [];
    FEED_LIBRARY.forEach(cat => cat.feeds.forEach(f => all.push({ ...f, category: cat.category })));
    return all;
  }

  function _getSubscribedFeeds() {
    return [..._getAllFeeds().filter(f => _subs.has(f.id)), ..._customSubs];
  }

  function _getFeedByUrl(url) {
    if (!url) return null;
    const norm = url.replace(/\/$/, '');
    return _getAllFeeds().find(f => f.url.replace(/\/$/, '') === norm) || null;
  }

  function _isFollowedById(id) {
    return _subs.has(id) || _customSubs.some(f => f.id === id);
  }

  function _isFollowedByUrl(url) {
    const curated = _getFeedByUrl(url);
    if (curated) return _subs.has(curated.id);
    return _customSubs.some(f => f.url === url);
  }

  function _isAllFollowed(cat) {
    return cat.feeds.length > 0 && cat.feeds.every(f => _isFollowedById(f.id));
  }

  function _followById(id) { _subs.add(id); _saveSubs(); }
  function _unfollowById(id) { _subs.delete(id); _saveSubs(); }

  function _followByUrl(feedObj) {
    const curated = _getFeedByUrl(feedObj.url);
    if (curated) {
      _subs.add(curated.id); _saveSubs();
    } else if (!_customSubs.some(f => f.url === feedObj.url)) {
      _customSubs.push({ id: feedObj.url, ...feedObj }); _saveCustomSubs();
    }
  }

  function _unfollowByUrl(url) {
    const curated = _getFeedByUrl(url);
    if (curated) { _subs.delete(curated.id); _saveSubs(); }
    else { _customSubs = _customSubs.filter(f => f.url !== url); _saveCustomSubs(); }
  }

  function _faviconUrl(domain) {
    return FAVICON_SVC + encodeURIComponent(domain) + '&sz=64';
  }

  function _formatSubs(n) {
    if (!n) return '';
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
    if (n >= 1000) return Math.round(n / 1000) + 'K';
    return String(n);
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  function render(el) {
    _loadSubs();
    _hidePopover();
    if (!_hasAnySubs()) _view = 'empty';
    else if (_view === 'empty') _view = 'myfeeds';
    _wrap = document.createElement('div');
    _wrap.className = 'dash-wrap news-wrap';
    _gen++;
    _build(_wrap, _gen);
    el.appendChild(_wrap);
  }

  function cleanup() {
    clearTimeout(_hoverShowTimer);  _hoverShowTimer = null;
    clearTimeout(_hoverHideTimer);  _hoverHideTimer = null;
    clearTimeout(_searchDebounce);  _searchDebounce = null;
    _hidePopover();
  }

  function _rerender() {
    if (!_wrap || !_wrap.parentNode) return;
    _hidePopover();
    if (!_hasAnySubs() && _view !== 'discover') _view = 'empty';
    else if (_hasAnySubs() && _view === 'empty') _view = 'myfeeds';
    _wrap.innerHTML = '';
    _gen++;
    _build(_wrap, _gen);
  }

  function _build(wrap, gen) {
    if (_view === 'myfeeds') _renderMyFeeds(wrap, gen);
    else if (_view === 'discover') _renderDiscover(wrap);
    else _renderEmptyState(wrap);
  }

  // ── Empty state ────────────────────────────────────────────────────────────

  function _renderEmptyState(wrap) {
    const state = document.createElement('div');
    state.className = 'news-empty-state';

    const icon = document.createElement('div');
    icon.className = 'news-empty-icon';
    // Newspaper icon with RSS signal waves
    icon.innerHTML = '<svg width="72" height="72" viewBox="0 0 72 72" fill="none" aria-hidden="true"><rect x="8" y="12" width="48" height="44" rx="6" fill="none" stroke="currentColor" stroke-width="2.5"/><rect x="16" y="22" width="32" height="10" rx="2" fill="currentColor" opacity="0.15"/><line x1="16" y1="22" x2="48" y2="22" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><line x1="16" y1="32" x2="48" y2="32" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><line x1="16" y1="40" x2="40" y2="40" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><line x1="16" y1="48" x2="34" y2="48" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="56" cy="16" r="3" fill="currentColor" opacity="0.5"/><path d="M56 8 a8 8 0 0 1 0 16" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none" opacity="0.4"/><path d="M56 4 a12 12 0 0 1 0 24" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none" opacity="0.25"/></svg>';
    state.appendChild(icon);

    const heading = document.createElement('h3');
    heading.className = 'news-empty-heading';
    heading.textContent = 'Your news feed is empty';
    state.appendChild(heading);

    const sub = document.createElement('p');
    sub.className = 'news-empty-sub';
    sub.textContent = 'Browse our curated sources and follow the ones you care about';
    state.appendChild(sub);

    const cta = document.createElement('button');
    cta.className = 'news-empty-cta';
    cta.textContent = 'Browse Sources →';
    cta.addEventListener('click', () => { _view = 'discover'; _rerender(); });
    state.appendChild(cta);

    wrap.appendChild(state);
  }

  // ── Discover: two-panel layout ─────────────────────────────────────────────

  function _renderDiscover(wrap) {
    const header = document.createElement('div');
    header.className = 'dash-header';
    const title = document.createElement('h2');
    title.className = 'dash-title';
    title.textContent = 'Discover News Feeds';
    header.appendChild(title);

    const myBtn = document.createElement('button');
    myBtn.className = 'dash-btn-primary';
    myBtn.style.display = _hasAnySubs() ? '' : 'none';
    myBtn.textContent = 'My Feeds (' + (_subs.size + _customSubs.length) + ')';
    myBtn.addEventListener('click', () => { _view = 'myfeeds'; _rerender(); });
    header.appendChild(myBtn);
    wrap.appendChild(header);

    // Ensure a valid active category
    if (!_discoverActive || (_discoverActive !== '__search__' && !FEED_LIBRARY.some(c => c.category === _discoverActive))) {
      _discoverActive = FEED_LIBRARY[0].category;
    }

    const layout = document.createElement('div');
    layout.className = 'news-discover-layout';

    const menuEl = document.createElement('div');
    menuEl.className = 'news-cat-menu';

    const panelEl = document.createElement('div');
    panelEl.className = 'news-cat-panel';

    // Map category name → check span element (for "✓ All" updates)
    const menuCheckEls = new Map();

    function refreshHeader() {
      const count = _subs.size + _customSubs.length;
      myBtn.style.display = count > 0 ? '' : 'none';
      myBtn.textContent = 'My Feeds (' + count + ')';
    }

    function refreshMenuCheck(catName) {
      const cat = FEED_LIBRARY.find(c => c.category === catName);
      const el = menuCheckEls.get(catName);
      if (cat && el) el.style.display = _isAllFollowed(cat) ? '' : 'none';
    }

    function onFollowChange(catName) {
      refreshHeader();
      if (catName) refreshMenuCheck(catName);
    }

    function showCategory(cat, menuItem) {
      menuEl.querySelectorAll('.news-cat-menu-item').forEach(i => i.classList.remove('active'));
      menuItem.classList.add('active');
      _discoverActive = cat.category;
      _setCategoryPanel(panelEl, cat, (cn) => onFollowChange(cn || cat.category));
    }

    function showSearch(menuItem) {
      menuEl.querySelectorAll('.news-cat-menu-item').forEach(i => i.classList.remove('active'));
      menuItem.classList.add('active');
      _discoverActive = '__search__';
      _setSearchPanel(panelEl, () => onFollowChange(null));
    }

    // Build category menu items
    FEED_LIBRARY.forEach((cat, idx) => {
      const item = document.createElement('div');
      item.className = 'news-cat-menu-item' + (_discoverActive === cat.category ? ' active' : '');

      const nameEl = document.createElement('span');
      nameEl.className = 'news-cat-menu-name';
      nameEl.textContent = cat.category;
      item.appendChild(nameEl);

      const badge = document.createElement('span');
      badge.className = 'news-cat-menu-badge';
      badge.textContent = cat.feeds.length;
      item.appendChild(badge);

      const check = document.createElement('span');
      check.className = 'news-cat-menu-check';
      check.textContent = '✓';
      check.title = 'All followed';
      check.style.display = _isAllFollowed(cat) ? '' : 'none';
      item.appendChild(check);
      menuCheckEls.set(cat.category, check);

      const chevron = document.createElement('span');
      chevron.className = 'news-cat-menu-chevron';
      chevron.textContent = '›';
      item.appendChild(chevron);

      item.addEventListener('mouseenter', () => showCategory(cat, item));
      menuEl.appendChild(item);
    });

    // Search item at bottom
    const searchItem = document.createElement('div');
    searchItem.className = 'news-cat-menu-item news-cat-menu-search' + (_discoverActive === '__search__' ? ' active' : '');
    const searchNameEl = document.createElement('span');
    searchNameEl.className = 'news-cat-menu-name';
    searchNameEl.textContent = 'Search';
    searchItem.appendChild(searchNameEl);
    const searchIconEl = document.createElement('span');
    searchIconEl.className = 'news-cat-menu-search-icon';
    searchIconEl.textContent = '🔍';
    searchItem.appendChild(searchIconEl);
    searchItem.addEventListener('click', () => showSearch(searchItem));
    menuEl.appendChild(searchItem);

    layout.appendChild(menuEl);
    layout.appendChild(panelEl);
    wrap.appendChild(layout);

    // Render initial right panel
    if (_discoverActive === '__search__') {
      _setSearchPanel(panelEl, () => onFollowChange(null));
    } else {
      const initialCat = FEED_LIBRARY.find(c => c.category === _discoverActive) || FEED_LIBRARY[0];
      _discoverActive = initialCat.category;
      _setCategoryPanel(panelEl, initialCat, (cn) => onFollowChange(cn || initialCat.category));
    }
  }

  // ── Discover: category panel ───────────────────────────────────────────────

  function _setCategoryPanel(panelEl, cat, onFollowChange) {
    panelEl.innerHTML = '';
    const content = document.createElement('div');
    content.className = 'news-cat-panel-content';

    const titleEl = document.createElement('div');
    titleEl.className = 'news-cat-panel-title';
    titleEl.textContent = cat.category;
    content.appendChild(titleEl);

    const grid = document.createElement('div');
    grid.className = 'news-discover-grid';
    cat.feeds.forEach(feed => grid.appendChild(_makeDiscoverCard(feed, () => onFollowChange && onFollowChange(cat.category))));
    content.appendChild(grid);

    panelEl.appendChild(content);
  }

  // ── Discover: search panel ─────────────────────────────────────────────────

  function _looksLikeUrl(q) {
    if (!q || q.includes(' ')) return false;
    if (q.startsWith('http://') || q.startsWith('https://')) return true;
    return /^[^\s]+\.[a-zA-Z]{2,}(\/|$)/.test(q);
  }

  function _setSearchPanel(panelEl, onFollowChange) {
    panelEl.innerHTML = '';
    const content = document.createElement('div');
    content.className = 'news-cat-panel-content';

    const searchRow = document.createElement('div');
    searchRow.className = 'news-search-row';
    const searchWrap = document.createElement('div');
    searchWrap.className = 'news-search-wrap';

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'news-search-input news-panel-search-input';
    input.placeholder = 'Search topics or paste an RSS feed URL…';
    input.value = _searchQuery;

    const clearBtn = document.createElement('button');
    clearBtn.className = 'news-search-clear';
    clearBtn.textContent = '✕';
    clearBtn.style.display = _searchQuery ? '' : 'none';

    searchWrap.appendChild(input);
    searchWrap.appendChild(clearBtn);
    searchRow.appendChild(searchWrap);
    content.appendChild(searchRow);

    const helper = document.createElement('div');
    helper.className = 'news-search-helper';
    helper.textContent = 'Tip: You can paste any RSS feed URL directly to add it';
    content.appendChild(helper);

    const resultsEl = document.createElement('div');
    resultsEl.className = 'news-search-results';

    function showHint() {
      resultsEl.innerHTML = '';
      const p = document.createElement('p');
      p.className = 'dash-empty';
      p.textContent = 'Search any topic to see what\'s being covered, or paste an RSS feed URL to add it directly.';
      resultsEl.appendChild(p);
    }

    function dispatchSearch(q) {
      clearTimeout(_searchDebounce);
      if (!q) { showHint(); return; }
      if (_looksLikeUrl(q)) {
        resultsEl.innerHTML = '<div class="news-search-loading">Validating feed…</div>';
        _searchDebounce = setTimeout(() => _validateDirectUrl(q, resultsEl, onFollowChange), 400);
      } else {
        resultsEl.innerHTML = '<div class="news-search-loading">Searching…</div>';
        _searchDebounce = setTimeout(() => _runGoogleNewsSearch(q, resultsEl, onFollowChange), 500);
      }
    }

    clearBtn.addEventListener('click', () => {
      _searchQuery = '';
      input.value = '';
      clearBtn.style.display = 'none';
      clearTimeout(_searchDebounce);
      showHint();
    });

    input.addEventListener('input', () => {
      const q = input.value.trim();
      _searchQuery = q;
      clearBtn.style.display = q ? '' : 'none';
      dispatchSearch(q);
    });

    if (_searchQuery) {
      dispatchSearch(_searchQuery);
    } else {
      showHint();
    }

    content.appendChild(resultsEl);
    panelEl.appendChild(content);
    setTimeout(() => input.focus(), 50);
  }

  // ── Google News RSS search ─────────────────────────────────────────────────

  async function _runGoogleNewsSearch(query, container, onFollowChange) {
    try {
      const gnUrl = 'https://news.google.com/rss/search?q=' + encodeURIComponent(query) + '&hl=en-US&gl=US&ceid=US:en';
      const res = await window.fetch(CORSPROXY + encodeURIComponent(gnUrl));
      if (!res.ok) throw new Error('non-ok');
      const text = await res.text();
      const articles = _parseGoogleNewsRss(text);
      _renderGoogleNewsResults(container, articles, query, onFollowChange);
    } catch (_) {
      container.innerHTML = '';
      const p = document.createElement('p');
      p.className = 'dash-empty';
      p.textContent = 'Search unavailable right now. Try browsing the curated library or paste an RSS URL directly.';
      container.appendChild(p);
    }
  }

  function _parseGoogleNewsRss(xmlText) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlText, 'text/xml');
    return Array.from(doc.querySelectorAll('item')).slice(0, 20).map(item => {
      const sourceEl = item.querySelector('source');
      const sourceName = sourceEl?.textContent?.trim() || '';
      const sourceUrl  = sourceEl?.getAttribute('url') || '';
      const rawTitle   = item.querySelector('title')?.textContent || '';
      const title = (sourceName && rawTitle.endsWith(' - ' + sourceName))
        ? rawTitle.slice(0, -(' - ' + sourceName).length) : rawTitle;
      let link = '';
      for (const n of item.childNodes) {
        if (n.localName === 'link') { link = n.textContent.trim(); break; }
      }
      let domain = '';
      try { domain = new URL(sourceUrl).hostname.replace(/^www\./, ''); } catch (_) { domain = sourceUrl; }
      const pubDate = item.querySelector('pubDate')?.textContent || '';
      return { title, link, sourceName, sourceUrl, domain, pubDate };
    }).filter(a => a.title && a.sourceName);
  }

  function _renderGoogleNewsResults(container, articles, query, onFollowChange) {
    container.innerHTML = '';
    if (!articles.length) {
      const p = document.createElement('p');
      p.className = 'dash-empty';
      p.textContent = 'No results for "' + query + '". Try a different search term.';
      container.appendChild(p);
      return;
    }
    const label = document.createElement('div');
    label.className = 'news-cat-panel-title';
    label.textContent = 'Top stories for "' + query + '"';
    container.appendChild(label);

    const list = document.createElement('div');
    list.className = 'news-search-article-list';

    articles.forEach(article => {
      const row = document.createElement('div');
      row.className = 'news-search-article';

      const titleEl = document.createElement('a');
      titleEl.className = 'news-search-article-title';
      titleEl.textContent = article.title;
      if (article.link) { titleEl.href = article.link; titleEl.target = '_blank'; titleEl.rel = 'noopener noreferrer'; }
      row.appendChild(titleEl);

      const meta = document.createElement('div');
      meta.className = 'news-search-article-meta';

      if (article.domain) {
        const fav = document.createElement('img');
        fav.src = _faviconUrl(article.domain);
        fav.className = 'news-search-article-favicon';
        fav.alt = '';
        fav.addEventListener('error', function() { this.style.display = 'none'; });
        meta.appendChild(fav);
      }

      const srcSpan = document.createElement('span');
      srcSpan.className = 'news-search-article-source';
      srcSpan.textContent = article.sourceName;
      meta.appendChild(srcSpan);

      if (article.domain) {
        const alreadyFollowed = _customSubs.some(f => {
          try { return new URL(f.url).hostname.replace(/^www\./, '') === article.domain; } catch (_) { return false; }
        }) || _getAllFeeds().some(f => f.site === article.domain && _subs.has(f.id));

        const addBtn = document.createElement('button');
        addBtn.className = 'news-search-add-btn' + (alreadyFollowed ? ' following' : '');
        addBtn.textContent = alreadyFollowed ? 'Following ✓' : '+ Add';
        addBtn.disabled = alreadyFollowed;
        addBtn.dataset.domain = article.domain;

        if (!alreadyFollowed) {
          addBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            const domainBtns = container.querySelectorAll('[data-domain="' + article.domain + '"]');
            domainBtns.forEach(b => { b.textContent = 'Adding…'; b.disabled = true; });
            const feedObj = await _tryDiscoverFeed(article.domain, article.sourceName);
            if (feedObj) {
              _followByUrl(feedObj);
              domainBtns.forEach(b => { b.textContent = 'Following ✓'; b.className = 'news-search-add-btn following'; });
              if (onFollowChange) onFollowChange();
            } else {
              const clicked = e.currentTarget;
              domainBtns.forEach(b => { b.textContent = '+ Add'; b.className = 'news-search-add-btn'; b.disabled = false; });
              clicked.textContent = 'No feed found';
              clicked.className = 'news-search-add-btn news-search-add-btn--error';
              setTimeout(() => {
                if (clicked.textContent === 'No feed found') {
                  clicked.textContent = '+ Add'; clicked.className = 'news-search-add-btn'; clicked.disabled = false;
                }
              }, 2500);
            }
          });
        }
        meta.appendChild(addBtn);
      }

      if (article.pubDate) {
        const sep = document.createElement('span');
        sep.className = 'news-search-article-sep';
        sep.textContent = '·';
        meta.appendChild(sep);
        const timeEl = document.createElement('span');
        timeEl.className = 'news-search-article-time';
        try { timeEl.textContent = RssService.timeAgo(article.pubDate); } catch (_) { timeEl.textContent = ''; }
        meta.appendChild(timeEl);
      }

      row.appendChild(meta);
      list.appendChild(row);
    });
    container.appendChild(list);
  }

  async function _tryDiscoverFeed(domain, sourceName) {
    const patterns = [
      'https://' + domain + '/feed',
      'https://' + domain + '/feed/',
      'https://' + domain + '/rss',
      'https://' + domain + '/rss/',
      'https://' + domain + '/rss.xml',
      'https://' + domain + '/atom.xml',
      'https://' + domain + '/index.xml',
    ];
    for (const url of patterns) {
      try {
        const res = await window.fetch('https://api.rss2json.com/v1/api.json?rss_url=' + encodeURIComponent(url));
        if (!res.ok) continue;
        const data = await res.json();
        if (data.status === 'ok' && data.feed && data.feed.title) {
          return { url: data.feed.url || url, name: data.feed.title || sourceName, site: domain, description: data.feed.description || '' };
        }
      } catch (_) { continue; }
    }
    return null;
  }

  // ── Direct RSS URL validation ──────────────────────────────────────────────

  async function _validateDirectUrl(rawUrl, container, onFollowChange) {
    const url = (rawUrl.startsWith('http://') || rawUrl.startsWith('https://')) ? rawUrl : 'https://' + rawUrl;
    let domain = '';
    try { domain = new URL(url).hostname.replace(/^www\./, ''); } catch (_) { domain = url; }

    // Try rss2json (also validates and gives us the feed title)
    try {
      const res = await window.fetch('https://api.rss2json.com/v1/api.json?rss_url=' + encodeURIComponent(url));
      if (res.ok) {
        const data = await res.json();
        if (data.status === 'ok' && data.feed) {
          _renderUrlValidationSuccess(container, { url: data.feed.url || url, name: data.feed.title || domain, site: domain, description: data.feed.description || '' }, onFollowChange);
          return;
        }
      }
    } catch (_) {}

    // Fallback: fetch via CORS proxy and parse XML directly
    try {
      const res = await window.fetch(CORSPROXY + encodeURIComponent(url));
      if (res.ok) {
        const text = await res.text();
        const doc = new DOMParser().parseFromString(text, 'text/xml');
        if (!doc.querySelector('parsererror')) {
          const title = doc.querySelector('channel > title, feed > title')?.textContent?.trim() || '';
          if (title) {
            _renderUrlValidationSuccess(container, { url, name: title, site: domain, description: '' }, onFollowChange);
            return;
          }
        }
      }
    } catch (_) {}

    container.innerHTML = '';
    const err = document.createElement('div');
    err.className = 'news-search-url-error';
    err.textContent = 'Could not find an RSS feed at this URL. Try the full RSS feed URL (e.g. https://example.com/feed)';
    container.appendChild(err);
  }

  function _renderUrlValidationSuccess(container, feedObj, onFollowChange) {
    container.innerHTML = '';
    const label = document.createElement('div');
    label.className = 'news-cat-panel-title';
    label.textContent = 'RSS feed found';
    container.appendChild(label);

    const card = document.createElement('div');
    card.className = 'news-search-url-result';

    const info = document.createElement('div');
    info.className = 'news-search-url-result-info';
    if (feedObj.site) {
      const fav = document.createElement('img');
      fav.src = _faviconUrl(feedObj.site);
      fav.className = 'news-discover-favicon';
      fav.alt = '';
      fav.addEventListener('error', function() { this.style.display = 'none'; });
      info.appendChild(fav);
    }
    const nameEl = document.createElement('span');
    nameEl.className = 'news-search-url-result-name';
    nameEl.textContent = feedObj.name;
    info.appendChild(nameEl);
    if (feedObj.site) {
      const siteEl = document.createElement('span');
      siteEl.className = 'news-search-url-result-site';
      siteEl.textContent = feedObj.site;
      info.appendChild(siteEl);
    }
    card.appendChild(info);

    const already = _isFollowedByUrl(feedObj.url);
    const btn = document.createElement('button');
    btn.className = 'news-follow-btn' + (already ? ' following' : '');
    btn.textContent = already ? 'Following ✓' : '+ Follow';
    if (!already) {
      btn.addEventListener('click', () => {
        _followByUrl(feedObj);
        btn.className = 'news-follow-btn following';
        btn.textContent = 'Following ✓';
        if (onFollowChange) onFollowChange();
      });
    }
    card.appendChild(btn);
    container.appendChild(card);
  }

  // ── Discover cards ─────────────────────────────────────────────────────────

  function _makeDiscoverCard(feed, onFollowChange) {
    const card = _buildDiscoverCard(
      feed.site,
      feed.name,
      feed.description,
      feed.site,
      null,
      () => _isFollowedById(feed.id),
      () => { _followById(feed.id); },
      () => { _unfollowById(feed.id); },
      onFollowChange
    );
    return card;
  }

  function _buildDiscoverCard(faviconDomain, name, description, siteLabel, subsText, isFollowedFn, followFn, unfollowFn, onFollowChange) {
    const followed = isFollowedFn();
    const card = document.createElement('div');
    card.className = 'news-discover-card' + (followed ? ' following' : '');

    // Favicon + name row
    const top = document.createElement('div');
    top.className = 'news-discover-card-top';
    const favicon = document.createElement('img');
    favicon.className = 'news-discover-favicon';
    favicon.src = _faviconUrl(faviconDomain);
    favicon.alt = '';
    favicon.addEventListener('error', function() { this.style.display = 'none'; });
    top.appendChild(favicon);
    const nameEl = document.createElement('span');
    nameEl.className = 'news-discover-name';
    nameEl.textContent = name;
    top.appendChild(nameEl);
    card.appendChild(top);

    // Description
    if (description) {
      const desc = document.createElement('div');
      desc.className = 'news-discover-desc';
      desc.textContent = description;
      card.appendChild(desc);
    }

    // Footer: site label + follow button
    const footer = document.createElement('div');
    footer.className = 'news-discover-card-footer';
    const siteEl = document.createElement('div');
    siteEl.className = 'news-discover-site';
    siteEl.textContent = siteLabel;
    footer.appendChild(siteEl);

    const btn = document.createElement('button');
    btn.className = 'news-follow-btn' + (followed ? ' following' : '');
    btn.textContent = followed ? 'Following ✓' : '+ Follow';
    btn.addEventListener('click', () => {
      if (isFollowedFn()) {
        unfollowFn();
        btn.className = 'news-follow-btn';
        btn.textContent = '+ Follow';
        card.classList.remove('following');
      } else {
        followFn();
        btn.className = 'news-follow-btn following';
        btn.textContent = 'Following ✓';
        card.classList.add('following');
      }
      if (onFollowChange) onFollowChange();
    });
    footer.appendChild(btn);
    card.appendChild(footer);
    return card;
  }

  // ── My Feeds view ──────────────────────────────────────────────────────────

  function _renderMyFeeds(wrap, gen) {
    const subscribedFeeds = _getSubscribedFeeds();
    if (!subscribedFeeds.length) { _renderEmptyState(wrap); return; }

    const header = document.createElement('div');
    header.className = 'dash-header';
    const title = document.createElement('h2');
    title.className = 'dash-title';
    title.textContent = 'My Feeds';
    header.appendChild(title);

    const actions = document.createElement('div');
    actions.className = 'news-header-actions';
    const manageBtn = document.createElement('button');
    manageBtn.className = 'dash-btn-secondary';
    manageBtn.textContent = 'Manage Feeds';
    manageBtn.addEventListener('click', () => { _view = 'discover'; _rerender(); });
    actions.appendChild(manageBtn);
    const refreshBtn = document.createElement('button');
    refreshBtn.className = 'news-refresh-btn';
    refreshBtn.textContent = '↺ Refresh';
    refreshBtn.addEventListener('click', () => { RssService.invalidateAll(); _rerender(); });
    actions.appendChild(refreshBtn);
    header.appendChild(actions);
    wrap.appendChild(header);

    const loadingEl = document.createElement('div');
    loadingEl.className = 'news-loading';
    loadingEl.textContent = 'Loading feeds…';
    wrap.appendChild(loadingEl);

    Promise.all(
      subscribedFeeds.map(feed => RssService.fetch(feed.url).then(result => ({ feed, result })))
    ).then(results => {
      if (_gen !== gen) return;
      loadingEl.remove();

      const successCount = results.filter(r => !r.result.error).length;
      const totalItems   = results.reduce((n, r) => n + (r.result.items || []).length, 0);
      const oldestFetch  = results.reduce((m, r) => (r.result.fetchedAt || Infinity) < m ? r.result.fetchedAt : m, Infinity);
      const minsSince    = Number.isFinite(oldestFetch) ? Math.floor((Date.now() - oldestFetch) / 60000) : 0;

      const statusBar = document.createElement('div');
      statusBar.className = 'news-status-bar';
      statusBar.textContent = totalItems + ' headlines from ' + successCount + '/' + results.length + ' feeds — updated ' + (minsSince === 0 ? 'just now' : minsSince + 'm ago');
      wrap.appendChild(statusBar);

      _renderSourceGrid(wrap, results);
    });
  }

  // ── Source card grid ───────────────────────────────────────────────────────

  function _renderSourceGrid(wrap, results) {
    const errorFeeds = results.filter(r => r.result.error);
    if (errorFeeds.length) {
      const err = document.createElement('div');
      err.className = 'news-feed-error news-feed-error--banner';
      err.textContent = 'Could not load: ' + errorFeeds.map(r => r.feed.name).join(', ') + ' — try refreshing';
      wrap.appendChild(err);
    }
    const grid = document.createElement('div');
    grid.className = 'news-source-grid';
    results.forEach(({ feed, result }) => grid.appendChild(_makeSourceCard(feed, result)));
    wrap.appendChild(grid);
  }

  function _makeSourceCard(feed, result) {
    const card = document.createElement('div');
    card.className = 'news-source-card';

    const hdr = document.createElement('div');
    hdr.className = 'news-source-card-header';
    const favicon = document.createElement('img');
    favicon.className = 'news-source-favicon';
    favicon.src = _faviconUrl(feed.site);
    favicon.width = 16; favicon.height = 16;
    favicon.alt = '';
    favicon.addEventListener('error', function() { this.style.display = 'none'; });
    hdr.appendChild(favicon);
    const nameEl = document.createElement('span');
    nameEl.className = 'news-source-card-name';
    nameEl.textContent = feed.name;
    hdr.appendChild(nameEl);
    const siteLink = document.createElement('a');
    siteLink.className = 'news-source-card-site';
    siteLink.href = 'https://' + feed.site;
    siteLink.target = '_blank';
    siteLink.rel = 'noopener noreferrer';
    siteLink.textContent = '↗';
    siteLink.title = 'Visit ' + feed.site;
    siteLink.addEventListener('click', e => e.stopPropagation());
    hdr.appendChild(siteLink);
    card.appendChild(hdr);

    const articles = document.createElement('div');
    articles.className = 'news-source-card-articles';
    if (result.error) {
      articles.appendChild(_makeErrorEl('Could not load — try refreshing'));
    } else if (!result.items.length) {
      articles.appendChild(_makeErrorEl('No articles available'));
    } else {
      result.items.slice(0, 12).forEach(item => articles.appendChild(_makeArticleRow(item, feed)));
    }
    card.appendChild(articles);
    return card;
  }

  function _makeArticleRow(item, feed) {
    const row = document.createElement('div');
    row.className = 'news-article-row';
    row.addEventListener('click', () => { if (item.link) window.open(item.link, '_blank', 'noopener,noreferrer'); });

    const thumb = document.createElement('img');
    thumb.className = 'news-article-thumb';
    thumb.alt = '';
    if (item.thumbnail) {
      thumb.src = item.thumbnail;
      thumb.addEventListener('error', function() { this.src = _faviconUrl(feed.site); this.classList.add('news-article-thumb--favicon'); });
    } else {
      thumb.src = _faviconUrl(feed.site);
      thumb.classList.add('news-article-thumb--favicon');
    }
    row.appendChild(thumb);

    const body = document.createElement('div');
    body.className = 'news-article-body';
    const titleEl = document.createElement('div');
    titleEl.className = 'news-article-title';
    titleEl.textContent = item.title || '(No title)';
    body.appendChild(titleEl);
    if (item.pubDate) {
      const meta = document.createElement('div');
      meta.className = 'news-article-meta';
      meta.textContent = RssService.timeAgo(item.pubDate);
      body.appendChild(meta);
    }
    if (item.description) {
      const excerpt = document.createElement('div');
      excerpt.className = 'news-article-excerpt';
      excerpt.textContent = item.description;
      body.appendChild(excerpt);
    }
    row.appendChild(body);

    if (item.description) {
      row.addEventListener('mouseenter', () => { clearTimeout(_hoverHideTimer); _hoverHideTimer = null; clearTimeout(_hoverShowTimer); _hoverShowTimer = setTimeout(() => _showPopover(row, item.description), 350); });
      row.addEventListener('mouseleave', () => { clearTimeout(_hoverShowTimer); _hoverShowTimer = null; _hoverHideTimer = setTimeout(() => _hidePopover(), 250); });
    }
    return row;
  }

  // ── Shared helpers ─────────────────────────────────────────────────────────

  function _makeErrorEl(text) {
    const el = document.createElement('div');
    el.className = 'news-feed-error';
    el.style.padding = '12px';
    el.textContent = text;
    return el;
  }

  // ── Hover popover ──────────────────────────────────────────────────────────

  function _showPopover(row, text) {
    _hidePopover();
    const pop = document.createElement('div');
    pop.className = 'news-headline-popover';
    pop.textContent = text;
    pop.addEventListener('mouseenter', () => { clearTimeout(_hoverHideTimer); _hoverHideTimer = null; });
    pop.addEventListener('mouseleave', () => { _hoverHideTimer = setTimeout(() => _hidePopover(), 250); });
    document.body.appendChild(pop);
    _hoverPopover = pop;
    const rect = row.getBoundingClientRect();
    pop.style.top = rect.top + 'px';
    if (rect.right + 12 + 280 <= window.innerWidth) {
      pop.style.left = (rect.right + 12) + 'px'; pop.style.right = 'auto';
    } else {
      pop.style.right = (window.innerWidth - rect.left + 12) + 'px'; pop.style.left = 'auto';
    }
  }

  function _hidePopover() {
    if (_hoverPopover) { _hoverPopover.remove(); _hoverPopover = null; }
  }

  return { render, cleanup };
})();
