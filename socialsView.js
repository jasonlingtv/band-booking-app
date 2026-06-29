// socialsView.js — My Socials dashboard tab
const SocialsView = (() => {
  'use strict';

  const YT_CHANNEL_KEY = 'band_booking_yt_channel';
  const CORSPROXY = 'https://corsproxy.io/?';

  let _wrap = null;
  let _ytChannel = null; // { channelId, channelName }

  // ── Persistence ──────────────────────────────────────────────────────────

  function _loadChannel() {
    try { _ytChannel = JSON.parse(localStorage.getItem(YT_CHANNEL_KEY) || 'null'); }
    catch (_) { _ytChannel = null; }
  }

  function _saveChannel(data) {
    _ytChannel = data;
    localStorage.setItem(YT_CHANNEL_KEY, JSON.stringify(data));
  }

  function _clearChannel() {
    _ytChannel = null;
    localStorage.removeItem(YT_CHANNEL_KEY);
  }

  // ── XML helpers ───────────────────────────────────────────────────────────

  function _xmlByLocal(parent, localname) {
    const nodes = parent.getElementsByTagName('*');
    for (let i = 0; i < nodes.length; i++) {
      if (nodes[i].localName === localname) return nodes[i];
    }
    return null;
  }

  function _xmlText(parent, localname) {
    const el = _xmlByLocal(parent, localname);
    return el ? el.textContent.trim() : '';
  }

  function _xmlAttr(parent, localname, attr) {
    const el = _xmlByLocal(parent, localname);
    return el ? (el.getAttribute(attr) || '') : '';
  }

  // ── Formatting helpers ────────────────────────────────────────────────────

  function _timeAgo(dateStr) {
    if (!dateStr) return '';
    const diff = Math.max(0, Date.now() - new Date(dateStr).getTime());
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(mins / 60);
    const days = Math.floor(hours / 24);
    if (days > 60) return new Date(dateStr).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
    if (days > 0) return days + 'd ago';
    if (hours > 0) return hours + 'h ago';
    if (mins > 0) return mins + 'm ago';
    return 'just now';
  }

  function _fmtNum(n) {
    const v = parseInt(n, 10);
    if (isNaN(v)) return '';
    if (v >= 1000000) return (v / 1000000).toFixed(1) + 'M';
    if (v >= 1000) return Math.round(v / 1000) + 'K';
    return String(v);
  }

  // ── SVG icons ─────────────────────────────────────────────────────────────

  const YT_LOGO_SM = '<svg width="20" height="14" viewBox="0 0 20 14" fill="none" aria-hidden="true"><rect width="20" height="14" rx="3" fill="#FF0000"/><path d="M8 4l6 3-6 3V4Z" fill="white"/></svg>';
  const YT_LOGO_LG = '<svg width="64" height="45" viewBox="0 0 64 45" fill="none" aria-hidden="true"><rect width="64" height="45" rx="10" fill="#FF0000"/><path d="M26 14l18 8.5-18 8.5V14Z" fill="white"/></svg>';

  // ── Public API ────────────────────────────────────────────────────────────

  function render(el) {
    _loadChannel();
    _wrap = document.createElement('div');
    _wrap.className = 'dash-wrap socials-wrap';
    _build(_wrap);
    el.appendChild(_wrap);
  }

  function cleanup() {}

  // ── Main build ────────────────────────────────────────────────────────────

  function _build(wrap) {
    const header = document.createElement('div');
    header.className = 'dash-header';
    const title = document.createElement('h2');
    title.className = 'dash-title';
    title.textContent = 'My Socials';
    header.appendChild(title);
    wrap.appendChild(header);

    const ytSection = document.createElement('div');
    ytSection.className = 'socials-section';
    wrap.appendChild(ytSection);

    if (_ytChannel) {
      _renderYTFeed(ytSection);
    } else {
      _renderYTSetup(ytSection);
    }

    _renderComingSoon(wrap);
  }

  // ── YouTube setup ─────────────────────────────────────────────────────────

  function _renderYTSetup(section) {
    section.innerHTML = '';

    const setup = document.createElement('div');
    setup.className = 'socials-yt-setup';

    const logoEl = document.createElement('div');
    logoEl.className = 'socials-yt-logo-large';
    logoEl.innerHTML = YT_LOGO_LG;
    setup.appendChild(logoEl);

    const heading = document.createElement('h3');
    heading.className = 'socials-setup-heading';
    heading.textContent = 'Connect your YouTube channel';
    setup.appendChild(heading);

    const inputRow = document.createElement('div');
    inputRow.className = 'socials-input-row';

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'socials-channel-input';
    input.placeholder = 'https://www.youtube.com/@channelname  or  @channelname';
    input.autocomplete = 'off';
    inputRow.appendChild(input);

    const connectBtn = document.createElement('button');
    connectBtn.className = 'dash-btn-primary';
    connectBtn.textContent = 'Connect';
    inputRow.appendChild(connectBtn);
    setup.appendChild(inputRow);

    const statusEl = document.createElement('div');
    statusEl.className = 'socials-status';
    setup.appendChild(statusEl);

    const helper = document.createElement('p');
    helper.className = 'socials-helper';
    helper.textContent = "We'll show your latest videos here. Your channel must be public.";
    setup.appendChild(helper);

    section.appendChild(setup);

    function doConnect() {
      const val = input.value.trim();
      if (!val) { input.focus(); return; }
      connectBtn.textContent = 'Connecting…';
      connectBtn.disabled = true;
      statusEl.textContent = '';
      statusEl.className = 'socials-status';

      _resolveChannelId(val).then(({ channelId, channelName }) => {
        _saveChannel({ channelId, channelName });
        _renderYTFeed(section);
      }).catch(err => {
        statusEl.textContent = err.message || 'Could not find this channel. Try entering the direct channel URL from YouTube.';
        statusEl.className = 'socials-status socials-status--error';
        connectBtn.textContent = 'Connect';
        connectBtn.disabled = false;
      });
    }

    connectBtn.addEventListener('click', doConnect);
    input.addEventListener('keydown', e => { if (e.key === 'Enter') doConnect(); });
  }

  // ── Channel ID resolution ─────────────────────────────────────────────────

  async function _resolveChannelId(raw) {
    const s = raw.trim();

    // Direct UC channel ID
    if (/^UC[\w-]{22}$/.test(s)) return _buildChannelResult(s);

    // URL with /channel/UCID
    const chanMatch = s.match(/\/channel\/(UC[\w-]{22})/);
    if (chanMatch) return _buildChannelResult(chanMatch[1]);

    // Extract @handle or /user/USERNAME
    const atMatch = s.match(/@([\w.-]+)/);
    const userMatch = s.match(/\/user\/([^/?&\s]+)/);
    const handle = (atMatch && atMatch[1]) || (userMatch && userMatch[1]) || null;

    if (handle) {
      // Try legacy user RSS feed (works for some older channels)
      try {
        const uRes = await window.fetch(CORSPROXY + encodeURIComponent(
          'https://www.youtube.com/feeds/videos.xml?user=' + handle
        ));
        if (uRes.ok) {
          const text = await uRes.text();
          const parser = new DOMParser();
          const doc = parser.parseFromString(text, 'text/xml');
          const channelId = _xmlText(doc, 'channelId');
          if (channelId) {
            return { channelId, channelName: _xmlText(doc, 'title') || channelId };
          }
        }
      } catch (_) {}

      // Scrape the @handle page for embedded channelId JSON
      try {
        const pRes = await window.fetch(CORSPROXY + encodeURIComponent(
          'https://www.youtube.com/@' + handle
        ));
        if (pRes.ok) {
          const html = await pRes.text();
          for (const pat of [
            /"channelId"\s*:\s*"(UC[\w-]{22})"/,
            /"externalId"\s*:\s*"(UC[\w-]{22})"/,
            /\/channel\/(UC[\w-]{22})(?:"|\/)/,
            /channel_id=(UC[\w-]{22})/,
          ]) {
            const m = html.match(pat);
            if (m) return _buildChannelResult(m[1]);
          }
        }
      } catch (_) {}
    }

    // Any YouTube URL — try page scrape
    if (s.includes('youtube.com') || s.includes('youtu.be')) {
      try {
        const pRes = await window.fetch(CORSPROXY + encodeURIComponent(s));
        if (pRes.ok) {
          const html = await pRes.text();
          for (const pat of [
            /"channelId"\s*:\s*"(UC[\w-]{22})"/,
            /"externalId"\s*:\s*"(UC[\w-]{22})"/,
            /\/channel\/(UC[\w-]{22})(?:"|\/)/,
          ]) {
            const m = html.match(pat);
            if (m) return _buildChannelResult(m[1]);
          }
        }
      } catch (_) {}
    }

    throw new Error('Could not find this channel. Try entering the direct channel URL from YouTube.');
  }

  async function _buildChannelResult(channelId) {
    const feedUrl = 'https://www.youtube.com/feeds/videos.xml?channel_id=' + channelId;
    try {
      const res = await window.fetch(CORSPROXY + encodeURIComponent(feedUrl));
      if (!res.ok) throw new Error('Channel not found. Make sure the channel is public and try again.');
      const text = await res.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(text, 'text/xml');
      if (doc.querySelector('parsererror')) throw new Error('Channel not found. Make sure the channel is public and try again.');
      const channelName = _xmlText(doc, 'title') || channelId;
      return { channelId, channelName };
    } catch (e) {
      const msg = e.message || '';
      if (msg.includes('Channel not found') || msg.includes('Could not')) throw e;
      throw new Error('Could not connect to YouTube. Check your connection and try again.');
    }
  }

  // ── YouTube feed ──────────────────────────────────────────────────────────

  function _renderYTFeed(section) {
    section.innerHTML = '';

    // Section header
    const hdr = document.createElement('div');
    hdr.className = 'socials-section-header';

    const titleRow = document.createElement('div');
    titleRow.className = 'socials-yt-title-row';

    const logoSpan = document.createElement('span');
    logoSpan.style.display = 'flex';
    logoSpan.style.alignItems = 'center';
    logoSpan.innerHTML = YT_LOGO_SM;
    titleRow.appendChild(logoSpan);

    const nameEl = document.createElement('span');
    nameEl.className = 'socials-section-name';
    nameEl.textContent = _ytChannel.channelName || 'YouTube';
    titleRow.appendChild(nameEl);
    hdr.appendChild(titleRow);

    const controls = document.createElement('div');
    controls.className = 'socials-section-controls';

    const changeBtn = document.createElement('button');
    changeBtn.className = 'socials-change-btn';
    changeBtn.textContent = 'Change channel';
    changeBtn.addEventListener('click', () => { _clearChannel(); _renderYTSetup(section); });
    controls.appendChild(changeBtn);

    const refreshBtn = document.createElement('button');
    refreshBtn.className = 'news-refresh-btn';
    refreshBtn.textContent = '↺ Refresh';
    refreshBtn.addEventListener('click', () => _renderYTFeed(section));
    controls.appendChild(refreshBtn);

    hdr.appendChild(controls);
    section.appendChild(hdr);

    // Loading state
    const loadingEl = document.createElement('div');
    loadingEl.className = 'news-loading';
    loadingEl.textContent = 'Loading videos…';
    section.appendChild(loadingEl);

    _fetchYTFeed(_ytChannel.channelId).then(result => {
      loadingEl.remove();
      if (result.error) {
        const err = document.createElement('p');
        err.className = 'socials-error';
        err.textContent = 'Could not load videos. Check your connection and make sure the channel is still public.';
        section.appendChild(err);
        return;
      }
      if (!result.videos.length) {
        const empty = document.createElement('p');
        empty.className = 'socials-error';
        empty.textContent = 'No videos found for this channel.';
        section.appendChild(empty);
        return;
      }
      const grid = document.createElement('div');
      grid.className = 'socials-video-grid';
      result.videos.forEach(v => grid.appendChild(_makeVideoCard(v)));
      section.appendChild(grid);
    });
  }

  async function _fetchYTFeed(channelId) {
    const feedUrl = 'https://www.youtube.com/feeds/videos.xml?channel_id=' + channelId;
    try {
      const res = await window.fetch(CORSPROXY + encodeURIComponent(feedUrl));
      if (!res.ok) return { error: true };
      const text = await res.text();
      return { videos: _parseYTFeed(text) };
    } catch (_) {
      return { error: true };
    }
  }

  function _parseYTFeed(xmlText) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlText, 'text/xml');
    return Array.from(doc.querySelectorAll('entry')).slice(0, 12).map(entry => {
      const videoId = _xmlText(entry, 'videoId');
      return {
        videoId,
        title: _xmlText(entry, 'title'),
        published: entry.querySelector('published')?.textContent?.trim() || '',
        link: videoId ? 'https://www.youtube.com/watch?v=' + videoId : '',
        thumbnail: videoId ? 'https://img.youtube.com/vi/' + videoId + '/mqdefault.jpg' : '',
        views: _xmlAttr(entry, 'statistics', 'views'),
      };
    }).filter(v => v.videoId);
  }

  function _makeVideoCard(video) {
    const card = document.createElement('div');
    card.className = 'socials-video-card';
    card.setAttribute('tabindex', '0');
    const open = () => { if (video.link) window.open(video.link, '_blank', 'noopener,noreferrer'); };
    card.addEventListener('click', open);
    card.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });

    const thumbWrap = document.createElement('div');
    thumbWrap.className = 'socials-video-thumb-wrap';
    const thumb = document.createElement('img');
    thumb.className = 'socials-video-thumb';
    thumb.src = video.thumbnail;
    thumb.alt = '';
    thumb.loading = 'lazy';
    thumbWrap.appendChild(thumb);
    card.appendChild(thumbWrap);

    const info = document.createElement('div');
    info.className = 'socials-video-info';

    const titleEl = document.createElement('div');
    titleEl.className = 'socials-video-title';
    titleEl.textContent = video.title;
    info.appendChild(titleEl);

    const meta = document.createElement('div');
    meta.className = 'socials-video-meta';
    const parts = [];
    if (video.published) parts.push(_timeAgo(video.published));
    if (video.views) parts.push(_fmtNum(video.views) + ' views');
    meta.textContent = parts.join(' · ');
    info.appendChild(meta);

    card.appendChild(info);
    return card;
  }

  // ── Coming soon ───────────────────────────────────────────────────────────

  function _renderComingSoon(wrap) {
    const section = document.createElement('div');
    section.className = 'socials-coming-soon';

    const label = document.createElement('div');
    label.className = 'socials-coming-label';
    label.textContent = 'More platforms coming soon';
    section.appendChild(label);

    const grid = document.createElement('div');
    grid.className = 'socials-coming-grid';

    [
      {
        name: 'Instagram',
        icon: '<svg width="22" height="22" viewBox="0 0 22 22" fill="none"><rect x="1" y="1" width="20" height="20" rx="6" stroke="#C13584" stroke-width="2"/><circle cx="11" cy="11" r="4.5" stroke="#C13584" stroke-width="1.5"/><circle cx="16.5" cy="5.5" r="1.3" fill="#C13584"/></svg>',
      },
      {
        name: 'TikTok',
        icon: '<svg width="20" height="22" viewBox="0 0 20 22" fill="none"><path d="M13.5 0c.5 3.5 2.5 5.5 6 5.5v4c-2.5 0-4.5-1-6-2.5V16c0 3.5-2.5 6-6 6S1.5 19.5 1.5 16s2.5-6 6-6v4c-1.5 0-2.5 1-2.5 2s1 2 2.5 2 2.5-1 2.5-2V0h3Z" fill="#000"/></svg>',
      },
      {
        name: 'Facebook',
        icon: '<svg width="22" height="22" viewBox="0 0 22 22" fill="none"><rect width="22" height="22" rx="5" fill="#1877F2"/><path d="M14.5 11.5h-2.5V8.5c0-.6.4-1 1-1h1.5v-3h-2c-2.5 0-3.5 1.5-3.5 3v4H6.5v3h2.5V22H12V14.5h2l.5-3Z" fill="white"/></svg>',
      },
    ].forEach(p => {
      const card = document.createElement('div');
      card.className = 'socials-coming-card';

      const iconEl = document.createElement('div');
      iconEl.className = 'socials-coming-icon';
      iconEl.innerHTML = p.icon;
      card.appendChild(iconEl);

      const textWrap = document.createElement('div');
      const nameEl = document.createElement('div');
      nameEl.className = 'socials-coming-name';
      nameEl.textContent = p.name;
      textWrap.appendChild(nameEl);
      const badge = document.createElement('div');
      badge.className = 'socials-coming-badge';
      badge.textContent = 'Coming soon';
      textWrap.appendChild(badge);
      card.appendChild(textWrap);

      grid.appendChild(card);
    });

    section.appendChild(grid);
    wrap.appendChild(section);
  }

  return { render, cleanup };
})();
