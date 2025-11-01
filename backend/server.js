/**
 * Tanner.xyz Aggregator Backend
 * * This Node.js server acts as a proxy and data aggregator.
 * It fetches market data from multiple prediction market APIs (Polymarket, Kalshi),
 * normalizes the data into a consistent format, and provides a single endpoint
 * for the React frontend to consume.
 * * This approach is CRITICAL to bypass browser CORS (Cross-Origin Resource Sharing)
 * limitations, as browsers would block the frontend from calling these APIs directly.
 */

const express = require('express');
const https = require('https'); // FIX: Use native Node.js HTTPS module for stable fetching
const http = require('http');   // Also needed for some HTTP traffic/robustness
const cors = require('cors');

const app = express();
const PORT = 3001;

// Enable CORS for your frontend
app.use(cors());

// --- API Endpoints ---
const API_ENDPOINTS = {
  // Polymarket CLOB API (Official endpoint from docs)
  POLYMARKET: 'https://gamma-api.polymarket.com/markets?limit=200&sort_by=volume_24h&order_by=desc&active=true',
  
  // Kalshi Trade API (Official endpoints from docs)
  KALSHI_MARKETS: 'https://api.elections.kalshi.com/trade-api/v2/markets?status=open&limit=500',
  KALSHI_EVENTS: 'https://api.elections.kalshi.com/trade-api/v2/events?status=open&limit=200',
  KALSHI_SERIES: 'https://api.elections.kalshi.com/trade-api/v2/series',
  
  // Limitless: Temporarily disabled
  LIMITLESS: 'https://api.limitless.exchange/api-v1/markets' 
};

// --- Market Cache (to avoid repeated API calls) ---
let marketCache = {
  data: [],
  timestamp: 0,
  ttl: 60000 // Cache for 60 seconds
};

// ====================================================================
// NATIVE HTTP/S FETCH HELPER
// ====================================================================

/**
 * Executes a GET request using Node's native HTTP/S module.
 * @param {string} url The URL to fetch.
 * @returns {Promise<any>} The parsed JSON data.
 */
function nativeFetch(url) {
  // Safety check for undefined URL
  if (!url || typeof url !== 'string') {
    return Promise.reject(new Error(`Invalid URL provided: ${url}`));
  }
  
  const isHttps = url.startsWith('https');
  const client = isHttps ? https : http;

  return new Promise((resolve, reject) => {
    client.get(url, (res) => {
      let data = '';

      // A chunk of data has been received.
      res.on('data', (chunk) => {
        data += chunk;
      });

      // The whole response has been received.
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            // Log raw response on JSON parsing failure
            console.error(`JSON Parse Error for ${url}: ${e.message}. Status: ${res.statusCode}. Raw data: ${data.substring(0, 500)}...`);
            reject(new Error(`Failed to parse JSON response. Status: ${res.statusCode}`));
          }
        } else {
          // Log raw response on HTTP error
          console.error(`HTTP Error for ${url}: Status: ${res.statusCode}. Raw data: ${data.substring(0, 500)}...`);
          reject(new Error(`HTTP Error Status: ${res.statusCode} for ${url}`));
        }
      });
    }).on('error', (err) => {
      reject(new Error(`Native Fetch Error: ${err.message}`));
    });
  });
}

// ====================================================================
// OPTIMIZATION & DATA HELPERS
// ====================================================================

/**
 * --- NEW: Market Filtering Logic ---
 * Checks if a market is currently open and relevant (not expired/resolved).
 * @param {Object} market The normalized market object.
 * @returns {boolean} True if market should be displayed.
 */
function isMarketCurrentlyOpen(market) {
  const now = new Date('2025-11-01'); // Current date: Nov 1, 2025
  
  // Check if market has an end date
  if (market.endDate) {
    const endDate = new Date(market.endDate);
    // Market is closed if end date has passed
    if (endDate < now) {
      return false;
    }
  }
  
  // Check if market is marked as closed/resolved
  if (market.closed === true || market.resolved === true) {
    return false;
  }
  
  // Filter out markets with very low volume (likely inactive)
  if (market.volume_24h < 10) {
    return false;
  }
  
  return true;
}

/**
 * Cleans and optimizes market titles by removing redundant "yes/no" prefixes
 * @param {string} title The raw market title from API
 * @returns {string} Cleaned title
 */
function cleanMarketTitle(title) {
  if (!title) return '';
  
  let cleaned = title;
  
  // Remove leading "yes " or "no " patterns (case-insensitive)
  // This handles Kalshi's multi-leg format: "yes Player A, yes Player B"
  cleaned = cleaned.replace(/^(yes|no)\s+/gi, '');
  
  // Remove multiple consecutive "yes " or "no " in the middle
  cleaned = cleaned.replace(/,\s*(yes|no)\s+/gi, ', ');
  
  // Clean up extra spaces
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  
  return cleaned;
}

/**
 * Creates a shortened, optimized title for a market card.
 * @param {string} title The full market title.
 * @returns {string} A truncated title, if necessary.
 */
function optimizeTitle(title) {
  const MAX_LENGTH = 50; // Max characters for a card title (user specified)
  
  // First clean the title
  const cleaned = cleanMarketTitle(title);
  
  if (cleaned.length > MAX_LENGTH) {
    return cleaned.substring(0, MAX_LENGTH - 3) + '...';
  }
  return cleaned;
}

/**
 * Limits outcomes to top 3 for card display.
 * @param {Array} outcomes Array of outcome objects.
 * @returns {Array} Top 3 outcomes sorted by price.
 */
function limitOutcomesForCard(outcomes) {
  if (!Array.isArray(outcomes)) return [];
  
  // Sort by price descending and take top 3
  return outcomes
    .sort((a, b) => b.price - a.price)
    .slice(0, 3);
}

/**
 * Maps Kalshi's native categories to our categories
 */
function mapKalshiCategory(kalshiCategory) {
  if (!kalshiCategory) return null;
  
  const categoryMap = {
    'politics': 'Politics',
    'elections': 'Politics',
    'sports': 'Sports',
    'economics': 'Economics',
    'finance': 'Economics',
    'crypto': 'Crypto',
    'world': 'World',
    'culture': 'Culture',
    'entertainment': 'Culture',
  };
  
  return categoryMap[kalshiCategory.toLowerCase()] || null;
}

/**
 * Intelligently assigns a category based on keywords in the title.
 * @param {string} title The market title.
 * @param {string} nativeCategory Optional native category from API
 * @returns {string} A specific category.
 */
function getAdvancedCategory(title, nativeCategory = null) {
  // First try to use native category if provided
  if (nativeCategory) {
    const mapped = mapKalshiCategory(nativeCategory);
    if (mapped) return mapped;
  }
  
  const lowerTitle = title.toLowerCase();

  // Politics (Enhanced)
  if (lowerTitle.includes('trump') || lowerTitle.includes('biden') || lowerTitle.includes('election') || 
      lowerTitle.includes('president') || lowerTitle.includes('mayor') || lowerTitle.includes('governor') ||
      lowerTitle.includes('senate') || lowerTitle.includes('congress')) {
    return 'Politics';
  }
  // Geopolitics (New)
  if (lowerTitle.includes('russia') || lowerTitle.includes('china') || lowerTitle.includes('taiwan') || lowerTitle.includes('gaza') || lowerTitle.includes('war')) {
    return 'Geopolitics';
  }
  // Crypto
  if (lowerTitle.includes('btc') || lowerTitle.includes('bitcoin') || lowerTitle.includes('eth') || lowerTitle.includes('solana') || lowerTitle.includes('crypto')) {
    return 'Crypto';
  }
  // Economics
  if (lowerTitle.includes('fed') || lowerTitle.includes('inflation') || lowerTitle.includes('interest rate') || lowerTitle.includes('gdp') || lowerTitle.includes('cpi')) {
    return 'Economics';
  }
  // Sports (Enhanced with player names and teams)
  if (lowerTitle.includes('nba') || lowerTitle.includes('nfl') || lowerTitle.includes('lakers') || lowerTitle.includes('world cup') ||
      lowerTitle.includes('mahomes') || lowerTitle.includes('josh allen') || lowerTitle.includes('james cook') ||
      lowerTitle.includes('touchdown') || lowerTitle.includes('quarterback') || lowerTitle.includes('yards') ||
      lowerTitle.includes('chiefs') || lowerTitle.includes('bills') || lowerTitle.includes('cowboys') ||
      lowerTitle.includes('packers') || lowerTitle.includes('broncos') || lowerTitle.includes('rams')) {
    return 'Sports';
  }
  // World (New)
  if (lowerTitle.includes('india') || lowerTitle.includes('uk') || lowerTitle.includes('prime minister')) {
    return 'World';
  }
  // Culture (New)
  if (lowerTitle.includes('movie') || lowerTitle.includes('box office') || lowerTitle.includes('taylor swift') || lowerTitle.includes('grammy')) {
    return 'Culture';
  }

  // Fallback
  return 'Other';
}

/**
 * --- NEW: HISTORICAL DATA SIMULATOR ---
 * Generates a realistic (but fake) 7-day price history for an outcome.
 * @param {number} startPrice The starting price (probability) for this outcome.
 * @returns {Array<Object>} An array of data points for the chart.
 */
function generateMarketHistory(startPrice) {
  let history = [];
  let price = startPrice;
  const now = Math.floor(Date.now() / 1000); // Current time in seconds
  const sevenDaysAgo = now - (7 * 24 * 60 * 60); // 7 days ago
  const dataPoints = 168; // One point per hour for 7 days (7 * 24)
  const timeStep = (7 * 24 * 60 * 60) / dataPoints; // Seconds per step

  for (let i = 0; i < dataPoints; i++) {
    const change = (Math.random() - 0.5) * 0.02; // Small random change
    price += change;
    if (price > 0.99) price = 0.99;
    if (price < 0.01) price = 0.01;
    
    // The format required by Lightweight Charts is: { time: (seconds), value: (price) }
    history.push({ time: sevenDaysAgo + (i * timeStep), value: price });
  }
  
  // Ensure the last data point is the *current* startPrice at the *current* time
  history.push({ time: now, value: startPrice });
  
  return history;
}


// ====================================================================
// DATA FETCHING FUNCTIONS (Using nativeFetch)
// ====================================================================

/**
 * Fetches market data from Polymarket.
 */
async function fetchPolymarketData() {
  try {
    const data = await nativeFetch(API_ENDPOINTS.POLYMARKET);

    // NOTE: Polymarket sometimes returns the array directly, sometimes nested under 'data'.
    const marketArray = Array.isArray(data) ? data : data.data;

    if (!Array.isArray(marketArray)) {
      console.error('Invalid Polymarket response structure. Expected array.', data);
      throw new Error('Invalid Polymarket structure');
    }
    
    // Use .map to transform data, .filter(Boolean) to remove any nulls from failed normalization
    return marketArray.map(normalizePolymarket).filter(Boolean).slice(0, 25);
    
  } catch (error) {
    console.error('Failed to fetch from Polymarket:', error.message);
    return [];
  }
}

/**
 * Fetches market data from Kalshi using Markets API (fallback to original)
 */
async function fetchKalshiData() {
  try {
    console.log('Fetching Kalshi data using Markets API...');
    
    // Use the original Markets endpoint (more reliable)
    const marketsData = await nativeFetch(API_ENDPOINTS.KALSHI_MARKETS);

    if (!marketsData || !Array.isArray(marketsData.markets)) {
        console.error('Invalid Kalshi Markets response structure. Expected { markets: [...] }');
        throw new Error('Invalid Kalshi Markets structure');
    }

    console.log(`Fetched ${marketsData.markets.length} markets from Kalshi`);

    // Temporarily accept all markets to debug the issue
    const qualityMarkets = marketsData.markets;

    console.log(`Filtered to ${qualityMarkets.length} quality markets`);

    // Map and normalize
    return qualityMarkets
      .map(normalizeKalshi)
      .filter(Boolean)
      .sort((a, b) => b.volume_24h - a.volume_24h)
      .slice(0, 50);

  } catch (error) {
    console.error('Failed to fetch from Kalshi:', error.message);
    return [];
  }
}

/**
 * Fetches market data from Limitless. (Temporarily disabled)
 */
async function fetchLimitlessData() {
  // NOTE: TEMPORARILY DISABLED
  return []; 
}

// ====================================================================
// DATA NORMALIZATION FUNCTIONS (UPDATED FOR MULTI-OUTCOME)
// ====================================================================

/**
 * --- UPDATED ---
 * Converts a Polymarket market object to our new standard multi-outcome format.
 */
function normalizePolymarket(market) {
  try {
    const rawTitle = market.question;
    const cleanedTitle = cleanMarketTitle(rawTitle);
    
    const commonData = {
      id: `poly-${market.id}`,
      title: cleanedTitle, // Use cleaned title
      shortTitle: optimizeTitle(rawTitle), // This will also clean and truncate
      platform: 'Polymarket',
      category: getAdvancedCategory(cleanedTitle), // Categorize based on cleaned title
      volume_24h: parseFloat(market.volume_24h || market.volume) || 0,
      outcomes: [], // We will populate this next
      // Add market status fields
      closed: market.closed || false,
      resolved: market.resolved || false,
      endDate: market.end_date_iso || market.endDate || null,
    };

    // Polymarket's `market.tokens` array contains the outcomes.
    if (market.tokens && market.tokens.length > 0) {
      // This is a Multi-Outcome market (like the election)
      commonData.outcomes = market.tokens.map(token => {
        const price = parseFloat(token.price || 0);
        return {
          name: token.outcome, // e.g., "Zohran Mamdani", "Andrew Cuomo", "Yes", "No"
          price: price,
          history: generateMarketHistory(price), // Generate history for this specific outcome
        };
      });

    } else {
      // This is a simple Yes/No market that isn't using the tokens array
      const yesPrice = parseFloat(market.lastTradePrice || 0.5);
      const noPrice = 1 - yesPrice;
      
      commonData.outcomes = [
        { name: 'Yes', price: yesPrice, history: generateMarketHistory(yesPrice) },
        { name: 'No', price: noPrice, history: generateMarketHistory(noPrice) },
      ];
    }
    
    // Sort outcomes by price, descending (Top outcome first)
    commonData.outcomes.sort((a, b) => b.price - a.price);
    
    // Store all outcomes for detail page
    commonData.allOutcomes = [...commonData.outcomes];
    
    // Limit to top 3 for card display
    commonData.outcomes = limitOutcomesForCard(commonData.outcomes);

    return commonData;

  } catch (err) {
    console.error("Error normalizing Polymarket market:", err.message, market);
    return null;
  }
}

/**
 * --- NEW: Normalizes Kalshi Event (better quality than markets)
 * Events API provides cleaner data structure
 */
function normalizeKalshiEvent(event) {
  try {
    // Events have better structure: title is the question, not the bet structure
    const rawTitle = event.title || event.event_ticker;
    const cleanedTitle = cleanMarketTitle(rawTitle);
    
    // Get category from event's category field or infer from title
    const category = getAdvancedCategory(cleanedTitle, event.category);
    
    // Kalshi events have markets array, use the first one for pricing
    let yesPrice = 0.5;
    let noPrice = 0.5;
    
    if (event.markets && event.markets.length > 0) {
      const market = event.markets[0];
      yesPrice = (market.yes_ask || market.yes_bid || 50) / 100.0;
      noPrice = (market.no_ask || market.no_bid || 50) / 100.0;
    }
    
    return {
      id: `kalshi-event-${event.event_ticker}`,
      title: cleanedTitle,
      shortTitle: optimizeTitle(rawTitle),
      platform: 'Kalshi',
      category: category,
      volume_24h: parseFloat(event.volume || event.volume_24h) || 0,
      outcomes: [
        { name: 'Yes', price: yesPrice, history: generateMarketHistory(yesPrice) },
        { name: 'No', price: noPrice, history: generateMarketHistory(noPrice) },
      ],
      closed: event.status === 'closed' || event.status === 'settled',
      resolved: event.status === 'settled',
      endDate: event.close_time || event.expiration_time || null,
    };
  } catch (err) {
    console.error("Error normalizing Kalshi event:", err.message, event);
    return null;
  }
}

/**
 * --- LEGACY: Old market normalizer (kept for backward compatibility)
 */
function normalizeKalshi(market) {
  try {
    const rawTitle = market.subtitle || market.title;
    const cleanedTitle = cleanMarketTitle(rawTitle);
    
    const yesPrice = (market.yes_ask || market.yes_bid || 50) / 100.0;
    const noPrice = (market.no_ask || market.no_bid || 50) / 100.0;
    
    return {
      id: `kalshi-${market.ticker_name || market.ticker}`,
      title: cleanedTitle,
      shortTitle: optimizeTitle(rawTitle),
      platform: 'Kalshi',
      category: getAdvancedCategory(cleanedTitle),
      volume_24h: parseFloat(market.volume_24h || market.volume) || 0,
      outcomes: [
        { name: 'Yes', price: yesPrice, history: generateMarketHistory(yesPrice) },
        { name: 'No', price: noPrice, history: generateMarketHistory(noPrice) },
      ],
      closed: market.status === 'closed' || market.status === 'settled',
      resolved: market.status === 'settled',
      endDate: market.close_time || market.expiration_time || null,
    };
  } catch (err) {
    console.error("Error normalizing Kalshi market:", err.message, market);
    return null;
  }
}

/**
 * Converts a Limitless market object to our standard format. (DISABLED)
 */
function normalizeLimitless(market) {
  // This function is currently disabled in fetchLimitlessData()
  return null;
}

// ====================================================================
// THE MAIN API ENDPOINT
// ====================================================================

/**
 * Fetches and caches all markets from all platforms
 */
async function getAllMarkets() {
  const now = Date.now();
  
  // Return cached data if still valid
  if (marketCache.data.length > 0 && (now - marketCache.timestamp) < marketCache.ttl) {
    console.log('Returning cached market data');
    return marketCache.data;
  }
  
  console.log('Fetching fresh market data from all platforms...');
  
  // Fetch from all platforms in parallel
  const results = await Promise.allSettled([
    fetchPolymarketData(),
    fetchKalshiData(),
    fetchLimitlessData(),
  ]);

  // Combine all successful results
  const allNormalizedMarkets = results
    .filter(result => result.status === 'fulfilled')
    .flatMap(result => result.value);
  
  // Filter to only show currently open markets
  const openMarkets = allNormalizedMarkets.filter(isMarketCurrentlyOpen);
  
  // Sort by 24h volume
  const sortedMarkets = openMarkets.sort((a, b) => b.volume_24h - a.volume_24h);
  
  // Update cache
  marketCache.data = sortedMarkets;
  marketCache.timestamp = now;
  
  console.log(`Cached ${sortedMarkets.length} open markets`);
  return sortedMarkets;
}

// --- NEW: Get markets by category (top 25) ---
app.get('/api/markets/:category', async (req, res) => {
  const category = req.params.category;
  console.log(`Received request for category: ${category}`);
  
  try {
    const allMarkets = await getAllMarkets();
    
    // Filter by category (case-insensitive)
    let filteredMarkets;
    if (category.toLowerCase() === 'all') {
      filteredMarkets = allMarkets;
    } else {
      filteredMarkets = allMarkets.filter(m => 
        m.category.toLowerCase() === category.toLowerCase()
      );
    }
    
    // Return top 25 by volume
    const top25 = filteredMarkets.slice(0, 25);
    
    console.log(`Returning ${top25.length} markets for category: ${category}`);
    res.json(top25);
    
  } catch (error) {
    console.error('Error fetching markets:', error);
    res.status(500).json({ error: 'Failed to fetch markets' });
  }
});

// --- Legacy endpoint (returns all markets, for backward compatibility) ---
app.get('/api/markets', async (req, res) => {
  console.log('Received request for /api/markets (all)');
  
  try {
    const allMarkets = await getAllMarkets();
    res.json(allMarkets.slice(0, 50)); // Return top 50
  } catch (error) {
    console.error('Error fetching markets:', error);
    res.status(500).json({ error: 'Failed to fetch markets' });
  }
});

// ====================================================================
// START THE SERVER
// ====================================================================

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Aggregator backend listening on port ${PORT}`);
});
