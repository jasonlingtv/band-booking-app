// feeds.js — Master feed library (MEGA_MASTER_ONLY — editable via Dashboard in a future update)
const FEED_LIBRARY = [
  {
    category: 'Music Industry',
    feeds: [
      { id: 'billboard',       name: 'Billboard',               url: 'https://www.billboard.com/feed/',                                              site: 'billboard.com',               description: 'Charts, news and trends across the music industry.' },
      { id: 'nme',             name: 'NME',                     url: 'https://www.nme.com/feed',                                                     site: 'nme.com',                     description: 'Rock, pop and electronic music news and reviews.' },
      { id: 'pitchfork',       name: 'Pitchfork',               url: 'https://pitchfork.com/feed/rss',                                               site: 'pitchfork.com',               description: 'Independent music criticism, news and reviews.' },
      { id: 'rolling-stone',   name: 'Rolling Stone',           url: 'https://www.rollingstone.com/music/feed/',                                     site: 'rollingstone.com',            description: 'Music news, album reviews and artist features.' },
      { id: 'ra',              name: 'Resident Advisor',        url: 'https://ra.co/xml/news.xml',                                                   site: 'ra.co',                       description: 'Electronic music news, reviews and event listings.' },
      { id: 'mbw',             name: 'Music Business Worldwide', url: 'https://www.musicbusinessworldwide.com/feed/',                                 site: 'musicbusinessworldwide.com',  description: 'Business news for the global music industry.' },
    ],
  },
  {
    category: 'Live Events',
    feeds: [
      { id: 'iq-magazine',     name: 'IQ Magazine',             url: 'https://www.iqmagazine.com/feed/',                                             site: 'iqmagazine.com',              description: 'International live music industry news and analysis.' },
      { id: 'pollstar',        name: 'Pollstar',                url: 'https://news.pollstar.com/feed/',                                              site: 'pollstar.com',                description: 'Touring and concert industry news.' },
    ],
  },
  {
    category: 'Business / General',
    feeds: [
      { id: 'bbc-business',    name: 'BBC Business',            url: 'https://feeds.bbci.co.uk/news/business/rss.xml',                               site: 'bbc.co.uk',                   description: 'Business and economics news from the BBC.' },
      { id: 'reuters',         name: 'Reuters',                 url: 'https://news.google.com/rss/search?q=when:24h+allinurl:reuters.com',           site: 'reuters.com',                 description: 'Global news and analysis from Reuters via Google News.' },
      { id: 'forbes-business', name: 'Forbes Business',         url: 'https://www.forbes.com/business/feed/',                                        site: 'forbes.com',                  description: 'Business, investing and entrepreneurship news.' },
    ],
  },
  {
    category: 'Tech',
    feeds: [
      { id: 'techcrunch',      name: 'TechCrunch',              url: 'https://techcrunch.com/feed/',                                                 site: 'techcrunch.com',              description: 'Technology news and startup coverage.' },
      { id: 'wired',           name: 'Wired',                   url: 'https://www.wired.com/feed/rss',                                               site: 'wired.com',                   description: 'Technology, culture and ideas shaping the future.' },
      { id: 'the-verge',       name: 'The Verge',               url: 'https://www.theverge.com/rss/index.xml',                                       site: 'theverge.com',                description: 'Technology, science, art and culture.' },
    ],
  },
];
