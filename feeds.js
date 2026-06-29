// feeds.js — Master feed library (MEGA_MASTER_ONLY)
const FEED_LIBRARY = [
  {
    category: 'Music Industry',
    feeds: [
      { id: 'billboard',        name: 'Billboard',                url: 'https://www.billboard.com/feed/',                                                site: 'billboard.com',              description: 'Charts, news and trends across the music industry.' },
      { id: 'nme',              name: 'NME',                      url: 'https://www.nme.com/feed',                                                       site: 'nme.com',                    description: 'Rock, pop and electronic music news and reviews.' },
      { id: 'pitchfork',        name: 'Pitchfork',                url: 'https://pitchfork.com/feed/rss',                                                 site: 'pitchfork.com',              description: 'Independent music criticism, news and reviews.' },
      { id: 'rolling-stone',    name: 'Rolling Stone',            url: 'https://www.rollingstone.com/music/feed/',                                       site: 'rollingstone.com',           description: 'Music news, album reviews and artist features.' },
      { id: 'ra',               name: 'Resident Advisor',         url: 'https://ra.co/xml/news.xml',                                                     site: 'ra.co',                      description: 'Electronic music news, reviews and event listings.' },
      { id: 'mbw',              name: 'Music Business Worldwide', url: 'https://www.musicbusinessworldwide.com/feed/',                                   site: 'musicbusinessworldwide.com', description: 'Business news for the global music industry.' },
      { id: 'cmu',              name: 'Complete Music Update',    url: 'https://completemusicupdate.com/rss',                                            site: 'completemusicupdate.com',    description: 'UK music industry news and analysis.' },
      { id: 'dmn',              name: 'Digital Music News',       url: 'https://digitalmusicnews.com/feed/',                                             site: 'digitalmusicnews.com',       description: 'Digital music industry data and news.' },
      { id: 'consequence',      name: 'Consequence of Sound',     url: 'https://consequenceofsound.net/feed/',                                           site: 'consequenceofsound.net',     description: 'Music, film and TV reviews and features.' },
      { id: 'the-fader',        name: 'The Fader',                url: 'https://feeds.feedburner.com/TheFader',                                          site: 'thefader.com',               description: 'Music, culture and style.' },
      { id: 'spin',             name: 'Spin',                     url: 'https://spin.com/feed/',                                                         site: 'spin.com',                   description: 'Alternative music news and reviews.' },
      { id: 'hypebot',          name: 'Hypebot',                  url: 'https://www.hypebot.com/feed/',                                                  site: 'hypebot.com',                description: 'Music technology and industry analysis.' },
    ],
  },
  {
    category: 'Live Events',
    feeds: [
      { id: 'iq-magazine',      name: 'IQ Magazine',              url: 'https://www.iqmagazine.com/feed/',                                              site: 'iqmagazine.com',             description: 'International live music industry news and analysis.' },
      { id: 'pollstar',         name: 'Pollstar',                  url: 'https://news.pollstar.com/feed/',                                               site: 'pollstar.com',               description: 'Touring and concert industry news.' },
      { id: 'music-ally',       name: 'Music Ally',                url: 'https://musically.com/feed/',                                                   site: 'musically.com',              description: 'Digital music strategy for the live music industry.' },
    ],
  },
  {
    category: 'Australia & NZ',
    feeds: [
      { id: 'the-music-network', name: 'The Music Network',       url: 'https://themusicnetwork.com/feed/',                                             site: 'themusicnetwork.com',        description: 'Australian music industry news.' },
      { id: 'tone-deaf',        name: 'Tone Deaf',                 url: 'https://tonedeaf.thebrag.com/feed/',                                            site: 'tonedeaf.thebrag.com',       description: 'Australian music news and live reviews.' },
      { id: 'happy-mag',        name: 'Happy Mag',                 url: 'https://happymag.tv/feed/',                                                     site: 'happymag.tv',                description: 'Australian independent music and culture.' },
      { id: 'rs-australia',     name: 'Rolling Stone AU',          url: 'https://au.rollingstone.com/music/feed/',                                       site: 'au.rollingstone.com',        description: 'Australian edition of Rolling Stone.' },
    ],
  },
  {
    category: 'UK',
    feeds: [
      { id: 'line-of-best-fit', name: 'The Line of Best Fit',     url: 'https://feeds.feedburner.com/TheLineOfBestFit',                                 site: 'thelineofbestfit.com',       description: 'Independent music discovery and reviews.' },
    ],
  },
  {
    category: 'Electronic / Dance',
    feeds: [
      { id: 'dancing-astronaut', name: 'Dancing Astronaut',        url: 'https://dancingastronaut.com/feed/',                                            site: 'dancingastronaut.com',       description: 'Electronic dance music news and releases.' },
      { id: 'dj-mag',           name: 'DJ Mag',                    url: 'https://djmag.com/feed/',                                                       site: 'djmag.com',                  description: 'Electronic music, DJs and club culture.' },
      { id: 'mixmag',           name: 'Mixmag',                    url: 'https://mixmag.net/feed/',                                                      site: 'mixmag.net',                 description: 'Dance music and clubbing culture.' },
    ],
  },
  {
    category: 'Hip Hop',
    feeds: [
      { id: 'hiphopdx',         name: 'HipHopDX',                  url: 'https://hiphopdx.com/rss/news.xml',                                            site: 'hiphopdx.com',               description: 'Hip hop news, reviews and interviews.' },
    ],
  },
  {
    category: 'South Africa',
    feeds: [
      { id: 'daily-maverick',   name: 'Daily Maverick',            url: 'https://dailymaverick.co.za/dmrss',                                             site: 'dailymaverick.co.za',        description: 'South African news and investigative journalism.' },
      { id: 'mail-guardian',    name: 'Mail & Guardian',           url: 'https://mg.co.za/feed',                                                         site: 'mg.co.za',                   description: 'South African news and analysis.' },
      { id: 'timeslive',        name: 'TimesLIVE',                 url: 'https://www.timeslive.co.za/rss',                                               site: 'timeslive.co.za',            description: 'South African breaking news and sport.' },
      { id: 'sabc-news',        name: 'SABC News',                 url: 'https://www.sabcnews.com/sabcnews/feed/',                                       site: 'sabcnews.com',               description: 'South African Broadcasting Corporation news.' },
      { id: 'africanews',       name: 'Africanews',                url: 'https://www.africanews.com/feed/rss',                                            site: 'africanews.com',             description: 'Pan-African news and current affairs.' },
    ],
  },
  {
    category: 'Germany / Europe',
    feeds: [
      { id: 'dw-top',           name: 'DW Top Stories',            url: 'https://rss.dw.com/rdf/rss-en-top',                                            site: 'dw.com',                     description: 'Deutsche Welle top English-language stories.' },
      { id: 'dw-all',           name: 'DW All News',               url: 'https://rss.dw.com/rdf/rss-en-all',                                            site: 'dw.com',                     description: 'All Deutsche Welle English-language news.' },
      { id: 'dw-business',      name: 'DW Business',               url: 'https://rss.dw.com/rdf/rss-en-bus',                                            site: 'dw.com',                     description: 'Deutsche Welle business and economy news.' },
      { id: 'dw-culture',       name: 'DW Culture',                url: 'https://rss.dw.com/rdf/rss-en-cul',                                            site: 'dw.com',                     description: 'Deutsche Welle culture and lifestyle.' },
      { id: 'france24',         name: 'France 24 (English)',        url: 'https://www.france24.com/en/rss',                                               site: 'france24.com',               description: 'International news in English from France 24.' },
      { id: 'sky-news-world',   name: 'Sky News World',            url: 'https://feeds.skynews.com/feeds/rss/world.xml',                                 site: 'skynews.com',                description: 'World news from Sky News.' },
    ],
  },
  {
    category: 'World News',
    feeds: [
      { id: 'bbc-world',        name: 'BBC World',                 url: 'https://feeds.bbci.co.uk/news/world/rss.xml',                                  site: 'bbc.co.uk',                  description: 'World news from the BBC.' },
      { id: 'bbc-business',     name: 'BBC Business',              url: 'https://feeds.bbci.co.uk/news/business/rss.xml',                               site: 'bbc.co.uk',                  description: 'Business and economics news from the BBC.' },
      { id: 'al-jazeera',       name: 'Al Jazeera',                url: 'https://aljazeera.com/xml/rss/all.xml',                                        site: 'aljazeera.com',              description: 'Global news and analysis from Al Jazeera.' },
      { id: 'npr-world',        name: 'NPR World',                 url: 'https://feeds.npr.org/1004/rss.xml',                                           site: 'npr.org',                    description: 'International news from NPR.' },
      { id: 'scmp',             name: 'South China Morning Post',  url: 'https://www.scmp.com/rss/91/feed',                                             site: 'scmp.com',                   description: 'Asia-Pacific news and analysis.' },
      { id: 'reuters',          name: 'Reuters',                   url: 'https://news.google.com/rss/search?q=when:24h+allinurl:reuters.com',            site: 'reuters.com',                description: 'Global news from Reuters via Google News.' },
    ],
  },
  {
    category: 'Finance & Markets',
    feeds: [
      { id: 'cnbc-markets',     name: 'CNBC Markets',              url: 'https://search.cnbc.com/rs/search/combinedcss.htm?partnerId=wrss01&keywords=markets', site: 'cnbc.com',            description: 'Financial markets news from CNBC.' },
      { id: 'investing-com',    name: 'Investing.com',             url: 'https://www.investing.com/rss/news.rss',                                       site: 'investing.com',              description: 'Financial news, data and analysis.' },
      { id: 'seeking-alpha',    name: 'Seeking Alpha',             url: 'https://seekingalpha.com/feed.xml',                                             site: 'seekingalpha.com',           description: 'Investment analysis and market news.' },
      { id: 'marketwatch',      name: 'MarketWatch',               url: 'https://feeds.marketwatch.com/marketwatch/topstories/',                        site: 'marketwatch.com',            description: 'Stock market news and financial analysis.' },
      { id: 'wsj-markets',      name: 'WSJ Markets',               url: 'https://feeds.a.dj.com/rss/RSSMarketsMain.xml',                               site: 'wsj.com',                    description: 'Markets coverage from the Wall Street Journal.' },
      { id: 'ft',               name: 'Financial Times',           url: 'https://www.ft.com/?format=rss',                                               site: 'ft.com',                     description: 'Global business and financial news.' },
      { id: 'nasdaq-news',      name: 'Nasdaq News',               url: 'https://m.nasdaqtrader.com/Trader.aspx?id=NewsRSS',                            site: 'nasdaq.com',                 description: 'Market news from Nasdaq.' },
      { id: 'forbes-business',  name: 'Forbes Business',           url: 'https://www.forbes.com/business/feed/',                                        site: 'forbes.com',                 description: 'Business, investing and entrepreneurship news.' },
      { id: 'bloomberg',        name: 'Bloomberg',                 url: 'https://news.google.com/rss/search?q=when:24h+allinurl:bloomberg.com+markets', site: 'bloomberg.com',              description: 'Financial news from Bloomberg via Google News.' },
    ],
  },
  {
    category: 'Tech',
    feeds: [
      { id: 'techcrunch',       name: 'TechCrunch',                url: 'https://techcrunch.com/feed/',                                                 site: 'techcrunch.com',             description: 'Technology news and startup coverage.' },
      { id: 'wired',            name: 'Wired',                     url: 'https://www.wired.com/feed/rss',                                               site: 'wired.com',                  description: 'Technology, culture and ideas shaping the future.' },
      { id: 'the-verge',        name: 'The Verge',                 url: 'https://www.theverge.com/rss/index.xml',                                       site: 'theverge.com',               description: 'Technology, science, art and culture.' },
    ],
  },
];
