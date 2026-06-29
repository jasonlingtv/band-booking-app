// feeds.js — Master feed library (MEGA_MASTER_ONLY)
const FEED_LIBRARY = [
  {
    category: 'Music Industry',
    feeds: [
      { id: 'billboard',        name: 'Billboard',                url: 'https://www.billboard.com/feed/',                                                site: 'billboard.com',               description: 'Charts, news and trends across the music industry.' },
      { id: 'nme',              name: 'NME',                      url: 'https://www.nme.com/feed',                                                       site: 'nme.com',                     description: 'Rock, pop and electronic music news and reviews.' },
      { id: 'pitchfork',        name: 'Pitchfork',                url: 'https://pitchfork.com/feed/rss',                                                 site: 'pitchfork.com',               description: 'Independent music criticism, news and reviews.' },
      { id: 'rolling-stone',    name: 'Rolling Stone',            url: 'https://www.rollingstone.com/music/feed/',                                       site: 'rollingstone.com',            description: 'Music news, album reviews and artist features.' },
      { id: 'ra',               name: 'Resident Advisor',         url: 'https://ra.co/xml/news.xml',                                                     site: 'ra.co',                       description: 'Electronic music news, reviews and event listings.' },
      { id: 'mbw',              name: 'Music Business Worldwide', url: 'https://www.musicbusinessworldwide.com/feed/',                                   site: 'musicbusinessworldwide.com',  description: 'Business news for the global music industry.' },
      { id: 'cmu',              name: 'Complete Music Update',    url: 'https://completemusicupdate.com/rss',                                            site: 'completemusicupdate.com',     description: 'UK music industry news and analysis.' },
      { id: 'dmn',              name: 'Digital Music News',       url: 'https://digitalmusicnews.com/feed/',                                             site: 'digitalmusicnews.com',        description: 'Digital music industry data and news.' },
      { id: 'consequence',      name: 'Consequence of Sound',     url: 'https://consequenceofsound.net/feed/',                                           site: 'consequenceofsound.net',      description: 'Music, film and TV reviews and features.' },
      { id: 'the-fader',        name: 'The Fader',                url: 'https://www.thefader.com/rss',                                                   site: 'thefader.com',                description: 'Music, culture and style.' },
      { id: 'spin',             name: 'Spin',                     url: 'https://www.spin.com/feed/',                                                     site: 'spin.com',                    description: 'Alternative music news and reviews.' },
      { id: 'hypebot',          name: 'Hypebot',                  url: 'https://www.hypebot.com/feed/',                                                  site: 'hypebot.com',                 description: 'Music technology and industry analysis.' },
    ],
  },
  {
    category: 'Live Events',
    feeds: [
      { id: 'iq-magazine',      name: 'IQ Magazine',              url: 'https://www.iqmagazine.com/feed/',                                              site: 'iqmagazine.com',              description: 'International live music industry news and analysis.' },
      { id: 'pollstar',         name: 'Pollstar',                  url: 'https://news.pollstar.com/feed/',                                               site: 'pollstar.com',                description: 'Touring and concert industry news.' },
      { id: 'music-ally',       name: 'Music Ally',                url: 'https://musically.com/feed/',                                                   site: 'musically.com',               description: 'Digital music strategy for the live music industry.' },
    ],
  },
  {
    category: 'Australia & New Zealand',
    feeds: [
      { id: 'the-music-network', name: 'The Music Network',       url: 'https://themusicnetwork.com/feed/',                                             site: 'themusicnetwork.com',         description: 'Australian music industry news.' },
      { id: 'tone-deaf',        name: 'Tone Deaf',                 url: 'https://tonedeaf.thebrag.com/feed/',                                            site: 'tonedeaf.thebrag.com',        description: 'Australian music news and live reviews.' },
      { id: 'happy-mag',        name: 'Happy Mag',                 url: 'https://happymag.tv/feed/',                                                     site: 'happymag.tv',                 description: 'Australian independent music and culture.' },
      { id: 'rs-australia',     name: 'Rolling Stone AU',          url: 'https://au.rollingstone.com/music/feed/',                                       site: 'au.rollingstone.com',         description: 'Australian edition of Rolling Stone.' },
      { id: 'the-music',        name: 'The Music',                 url: 'https://www.themusic.com.au/rss',                                               site: 'themusic.com.au',             description: 'Australian gig guide, reviews and music news.' },
      { id: 'stuff-nz',         name: 'Stuff Entertainment',       url: 'https://www.stuff.co.nz/rss/entertainment/',                                    site: 'stuff.co.nz',                 description: 'New Zealand entertainment news.' },
    ],
  },
  {
    category: 'UK',
    feeds: [
      { id: 'line-of-best-fit', name: 'Line of Best Fit',         url: 'https://www.thelineofbestfit.com/rss',                                          site: 'thelineofbestfit.com',        description: 'Independent music discovery and reviews.' },
      { id: 'clash',            name: 'Clash',                     url: 'https://www.clashmusic.com/feed/',                                              site: 'clashmusic.com',              description: 'Alternative and electronic music from the UK.' },
      { id: 'guardian-music',   name: 'The Guardian — Music',      url: 'https://www.theguardian.com/music/rss',                                         site: 'theguardian.com',             description: 'Music criticism and news from The Guardian.' },
      { id: 'loud-and-quiet',   name: 'Loud And Quiet',            url: 'https://www.loudandquiet.com/feed/',                                            site: 'loudandquiet.com',            description: 'Independent UK music magazine.' },
    ],
  },
  {
    category: 'Electronic / Dance',
    feeds: [
      { id: 'dancing-astronaut', name: 'Dancing Astronaut',        url: 'https://dancingastronaut.com/feed/',                                            site: 'dancingastronaut.com',        description: 'Electronic dance music news and releases.' },
      { id: 'dj-mag',           name: 'DJ Mag',                    url: 'https://djmag.com/feed/',                                                       site: 'djmag.com',                   description: 'Electronic music, DJs and club culture.' },
      { id: 'mixmag',           name: 'Mixmag',                    url: 'https://mixmag.net/feed/',                                                      site: 'mixmag.net',                  description: 'Dance music and clubbing culture.' },
      { id: 'xlr8r',            name: 'XLR8R',                     url: 'https://xlr8r.com/feed/',                                                       site: 'xlr8r.com',                   description: 'Electronic music: news, mixes and culture.' },
      { id: 'magnetic-mag',     name: 'Magnetic Magazine',         url: 'https://www.magneticmag.com/feed/',                                             site: 'magneticmag.com',             description: 'Electronic music news and DJ features.' },
    ],
  },
  {
    category: 'Hip Hop',
    feeds: [
      { id: 'hiphopdx',         name: 'HipHopDX',                  url: 'https://hiphopdx.com/rss/news.xml',                                            site: 'hiphopdx.com',                description: 'Hip hop news, reviews and interviews.' },
      { id: 'complex',          name: 'Complex',                    url: 'https://www.complex.com/music/rss',                                             site: 'complex.com',                 description: 'Hip hop, streetwear and pop culture.' },
      { id: 'hotnewhiphop',     name: 'HotNewHipHop',              url: 'https://www.hotnewhiphop.com/rss.xml',                                          site: 'hotnewhiphop.com',            description: 'Hip hop news, mixtapes and releases.' },
      { id: 'xxl-mag',          name: 'XXL',                        url: 'https://www.xxlmag.com/feed/',                                                  site: 'xxlmag.com',                  description: 'Hip hop magazine: news, interviews and features.' },
    ],
  },
  {
    category: 'South Africa',
    feeds: [
      { id: 'daily-maverick',   name: 'Daily Maverick',            url: 'https://www.dailymaverick.co.za/dmrss/',                                        site: 'dailymaverick.co.za',         description: 'South African news and investigative journalism.' },
      { id: 'mail-guardian',    name: 'Mail & Guardian',           url: 'https://mg.co.za/feed',                                                         site: 'mg.co.za',                    description: 'South African news and analysis.' },
      { id: 'timeslive',        name: 'TimesLIVE',                 url: 'https://www.timeslive.co.za/rss/',                                              site: 'timeslive.co.za',             description: 'South African breaking news and sport.' },
      { id: 'sabc-news',        name: 'SABC News',                 url: 'https://www.sabcnews.com/sabcnews/feed/',                                       site: 'sabcnews.com',                description: 'South African Broadcasting Corporation news.' },
      { id: 'eye-witness-news', name: 'EWN',                       url: 'https://ewn.co.za/RSS/TopStories/feed.rss',                                     site: 'ewn.co.za',                   description: 'Eyewitness News — South African breaking news.' },
      { id: 'bdlive',           name: 'Business Day',              url: 'https://businesslive.co.za/rss/top-stories/',                                   site: 'businesslive.co.za',          description: 'South African business news and financial markets.' },
    ],
  },
  {
    category: 'Germany / Europe',
    feeds: [
      { id: 'dw-top',           name: 'DW Top Stories',            url: 'https://rss.dw.com/rdf/rss-en-top',                                            site: 'dw.com',                      description: 'Deutsche Welle top English-language stories.' },
      { id: 'dw-culture',       name: 'DW Culture',                url: 'https://rss.dw.com/rdf/rss-en-cul',                                            site: 'dw.com',                      description: 'Deutsche Welle culture and lifestyle.' },
      { id: 'dw-business',      name: 'DW Business',               url: 'https://rss.dw.com/rdf/rss-en-bus',                                            site: 'dw.com',                      description: 'Deutsche Welle business and economy news.' },
      { id: 'france24',         name: 'France 24',                  url: 'https://www.france24.com/en/rss',                                               site: 'france24.com',                description: 'International news in English from France 24.' },
      { id: 'euronews',         name: 'Euronews',                   url: 'https://www.euronews.com/rss',                                                  site: 'euronews.com',                description: 'European and world news from Euronews.' },
      { id: 'politico-europe',  name: 'Politico Europe',           url: 'https://www.politico.eu/rss/',                                                  site: 'politico.eu',                 description: 'European politics and policy news.' },
    ],
  },
  {
    category: 'World News',
    feeds: [
      { id: 'bbc-world',        name: 'BBC World',                 url: 'https://feeds.bbci.co.uk/news/world/rss.xml',                                  site: 'bbc.co.uk',                   description: 'World news from the BBC.' },
      { id: 'bbc-business',     name: 'BBC Business',              url: 'https://feeds.bbci.co.uk/news/business/rss.xml',                               site: 'bbc.co.uk',                   description: 'Business and economics news from the BBC.' },
      { id: 'al-jazeera',       name: 'Al Jazeera',                url: 'https://www.aljazeera.com/xml/rss/all.xml',                                    site: 'aljazeera.com',               description: 'Global news and analysis from Al Jazeera.' },
      { id: 'reuters',          name: 'Reuters',                   url: 'https://news.google.com/rss/search?q=when:24h+allinurl:reuters.com',            site: 'reuters.com',                 description: 'Global news and analysis from Reuters via Google News.' },
      { id: 'npr-world',        name: 'NPR World',                 url: 'https://feeds.npr.org/1004/rss.xml',                                           site: 'npr.org',                     description: 'International news from NPR.' },
      { id: 'scmp',             name: 'South China Morning Post',  url: 'https://www.scmp.com/rss/91/feed',                                             site: 'scmp.com',                    description: 'Asia-Pacific news and analysis.' },
      { id: 'ap-news',          name: 'Associated Press',          url: 'https://feeds.apnews.com/apf-topnews',                                         site: 'apnews.com',                  description: 'Breaking world news from the Associated Press.' },
    ],
  },
  {
    category: 'Finance & Markets',
    feeds: [
      { id: 'cnbc-markets',     name: 'CNBC Markets',              url: 'https://www.cnbc.com/id/20910258/device/rss/rss.xml',                          site: 'cnbc.com',                    description: 'Financial markets news from CNBC.' },
      { id: 'marketwatch',      name: 'MarketWatch',               url: 'https://feeds.marketwatch.com/marketwatch/topstories/',                        site: 'marketwatch.com',             description: 'Stock market news and financial analysis.' },
      { id: 'wsj-markets',      name: 'WSJ Markets',               url: 'https://feeds.a.dj.com/rss/RSSMarketsMain.xml',                               site: 'wsj.com',                     description: 'Markets coverage from the Wall Street Journal.' },
      { id: 'ft',               name: 'Financial Times',           url: 'https://www.ft.com/?format=rss',                                               site: 'ft.com',                      description: 'Global business and financial news.' },
      { id: 'investing-com',    name: 'Investing.com',             url: 'https://www.investing.com/rss/news.rss',                                       site: 'investing.com',               description: 'Financial news, data and analysis.' },
      { id: 'forbes-business',  name: 'Forbes Business',           url: 'https://www.forbes.com/business/feed/',                                        site: 'forbes.com',                  description: 'Business, investing and entrepreneurship news.' },
    ],
  },
  {
    category: 'Tech',
    feeds: [
      { id: 'techcrunch',       name: 'TechCrunch',                url: 'https://techcrunch.com/feed/',                                                 site: 'techcrunch.com',              description: 'Technology news and startup coverage.' },
      { id: 'wired',            name: 'Wired',                     url: 'https://www.wired.com/feed/rss',                                               site: 'wired.com',                   description: 'Technology, culture and ideas shaping the future.' },
      { id: 'the-verge',        name: 'The Verge',                 url: 'https://www.theverge.com/rss/index.xml',                                       site: 'theverge.com',                description: 'Technology, science, art and culture.' },
      { id: 'ars-technica',     name: 'Ars Technica',              url: 'https://feeds.arstechnica.com/arstechnica/index',                              site: 'arstechnica.com',             description: 'In-depth technology news and analysis.' },
      { id: 'hacker-news',      name: 'Hacker News',               url: 'https://news.ycombinator.com/rss',                                             site: 'news.ycombinator.com',        description: 'Top links from the Hacker News community.' },
    ],
  },
];
