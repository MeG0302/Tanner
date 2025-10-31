/**
 * Tanner.xyz Aggregator Backend
 * * This Node.js server acts as a proxy and data aggregator.
 * It fetches market data from multiple prediction market APIs (Polymarket, Kalshi, Limitless),
 * normalizes the data into a consistent format, and provides a single endpoint
 * for the React frontend to consume.
 * * This approach is CRITICAL to bypass browser CORS (Cross-Origin Resource Sharing)
 * limitations, as browsers would block the frontend from calling these APIs directly.
 */

const express = require('express');
// FIX: Use require() to import node-fetch-cjs correctly in a CommonJS environment
const fetch = (...args) => import('node-fetch-cjs').then(({default: fetch}) => fetch(...args));
const cors = require('cors');

const app = express();
const PORT = 3001;

// Enable CORS for your frontend
// In production, you should restrict this to your actual domain:
// app.use(cors({ origin: 'http://your-domain.com' }));
app.use(cors()); // Open for development

// --- API Endpoints ---
const API_ENDPOINTS = {
  // Polymarket: Using v2 (gamma-api) as it's simpler for lists.
  // We sort by 24h volume and take the top 100.
  POLYMARKET: 'https://gamma-api.polymarket.com/markets?limit=100&sort_by=volume_24h&order_by=desc&active=true',
  
  // Kalshi: This is a multi-step process.
  // 1. Get all *open* market tickers
  KALSHI_MARKETS: 'https://api.elections.kalshi.com/trade-api/v2/markets?status=open&limit=500',
  // 2. Get the *live data* (prices, volume) for those tickers
  KALSHI_LIVE_DATA: 'https://api.elections.kalshi.com/trade-api/v2/live-data',

  // Limitless: Endpoint for their markets
  LIMITLESS: 'https://api.limitless.exchange/api-v1/markets'
};

// ====================================================================
// DATA FETCHING FUNCTIONS
// ====================================================================

/**
 * Fetches market data from Polymarket.
 */
async function fetchPolymarketData() {
  try {
    const response = await fetch(API_ENDPOINTS.POLYMARKET);
    
    // --- DEBUGGING: Log raw response text ---
    const rawText = await response.text();
    if (!response.ok) {
      console.error(`Polymarket API error: ${response.statusText}`, rawText);
      throw new Error(`Polymarket API error: ${response.statusText}`);
    }

    let data;
    try {
      data = JSON.parse(rawText);
    } catch (jsonError) {
      console.error('Failed to parse Polymarket JSON:', jsonError.message);
      console.error('Polymarket Raw Response:', rawText);
      throw new Error('Polymarket returned invalid JSON');
    }

    // --- DEBUGGING: Validate expected data structure ---
    if (!data || !Array.isArray(data.data)) {
      console.error('Invalid Polymarket response structure. Expected { data: [...] }', data);
      throw new Error('Invalid Polymymarket response structure');
    }

    return data.data.map(normalizePolymarket).filter(m => m !== null); // Filter out nulls
  } catch (error) {
    console.error('Failed to fetch from Polymarket:', error.message);
    return []; // Return empty array on failure
  }
}

/**
 * Fetches market data from Kalshi.
 */
async function fetchKalshiData() {
  try {
    // 1. Fetch all open market tickers
    const marketsResponse = await fetch(API_ENDPOINTS.KALSHI_MARKETS);
    if (!marketsResponse.ok) throw new Error(`Kalshi API (markets) error: ${marketsResponse.statusText}`);
    const marketsData = await marketsResponse.json();
    
    // 2. Fetch live data for all markets
    const liveDataResponse = await fetch(API_ENDPOINTS.KALSHI_LIVE_DATA);
    if (!liveDataResponse.ok) throw new Error(`Kalshi API (live-data) error: ${liveDataResponse.statusText}`);
    const liveData = await liveDataResponse.json();

    // 3. Combine the data: Create a map of live data for easy lookup
    const liveDataMap = new Map(liveData.markets.map(m => [m.ticker_name, m]));

    // 4. Map and normalize, filtering by top 25 volume
    return marketsData.markets
      .map(market => {
        const liveMarketData = liveDataMap.get(market.ticker_name);
        return normalizeKalshi(market, liveMarketData); // Pass both info and live data
      })
      .filter(m => m !== null) // Filter out nulls
      .sort((a, b) => b.volume_24h - a.volume_24h) // Sort by 24h volume
      .slice(0, 25); // Take top 25

  } catch (error) {
    console.error('Failed to fetch from Kalshi:', error.message);
    return [];
  }
}

/**
 * Fetches market data from Limitless.
 */
async function fetchLimitlessData() {
  try {
    const response = await fetch(API_ENDPOINTS.LIMITLESS);

    // --- DEBUGGING: Log raw response text ---
    const rawText = await response.text();
    if (!response.ok) {
      console.error(`Limitless API error: ${response.statusText}`, rawText);
      throw new Error(`Limitless API error: ${response.statusText}`);
    }

    let data;
    try {
      data = JSON.parse(rawText);
    } catch (jsonError) {
      console.error('Failed to parse Limitless JSON:', jsonError.message);
      console.error('Limitless Raw Response:', rawText);
      // This error is what we are seeing: "Unexpected token < in JSON..."
      // It means the response was HTML (like a 404 or 500 error page), not JSON.
      throw new Error(`Limitless returned HTML instead of JSON: ${jsonError.message}`);
    }

    // --- DEBUGGING: Validate expected data structure ---
    if (!data || !Array.isArray(data)) {
        console.error('Invalid Limitless response structure. Expected [...]', data);
        throw new Error('Invalid Limitless response structure');
    }

    return data
      .map(normalizeLimitless)
      .filter(m => m !== null)
      .sort((a, b) => b.volume_24h - a.volume_24h)
      .slice(0, 25);
  } catch (error) {
    console.error('Failed to fetch from Limitless:', error.message);
    return [];
  }
}

// ====================================================================
// DATA NORMALIZATION FUNCTIONS
// ====================================================================

/**
 * Converts a Polymarket market object to our standard format.
 */
function normalizePolymarket(market) {
  try {
    // Find the 'YES' and 'NO' tokens
    const yesToken = market.tokens.find(t => t.outcome === 'Yes');
    const noToken = market.tokens.find(t => t.outcome === 'No');

    // If no 'Yes' or 'No' outcome, we can't use this market
    if (!yesToken || !noToken) return null;

    return {
      id: `poly-${market.id}`,
      title: market.question,
      platform: 'Polymarket',
      category: market.category || 'Politics',
      yes: parseFloat(yesToken.price),
      no: parseFloat(noToken.price),
      volume_24h: parseFloat(market.volume_24h) || 0,
    };
  } catch (err) {
    console.error("Error normalizing Polymarket market:", err.message, market);
    return null;
  }
}

/**
 * Converts a Kalshi event object to our standard format.
 */
function normalizeKalshi(market, liveData) {
  try {
    // If no live data, we can't get prices/volume
    if (!liveData) return null;

    return {
      id: `kalshi-${market.ticker_name}`,
      // --- FIX: Use subtitle, which has the actual question ---
      title: market.subtitle, 
      platform: 'Kalshi',
      category: market.category || 'Economics',
      // Kalshi prices are in cents (0-100), convert to 0-1.0
      yes: liveData.yes_price / 100.0,
      no: liveData.no_price / 100.0,
      volume_24h: parseFloat(liveData.volume_24h) || 0,
    };
  } catch (err) {
    console.error("Error normalizing Kalshi market:", err.message, market);
    return null;
  }
}

/**
 * Converts a Limitless market object to our standard format.
 */
function normalizeLimitless(market) {
  try {
    // --- GUESSING field names based on other APIs ---
    // --- WE WILL NEED TO UPDATE THIS ---
    return {
      id: `limitless-${market.id || market.ticker}`,
      title: market.title || market.name,
      platform: 'Limitless',
      category: market.category || 'Crypto',
      yes: parseFloat(market.yes_price || market.price),
      no: parseFloat(market.no_price || (1 - market.price)),
      volume_24h: parseFloat(market.volume_24h || market.volume) || 0,
    };
  } catch (err) {
    console.error("Error normalizing Limitless market:", err.message, market);
    return null;
  }
}

// ====================================================================
// THE MAIN API ENDPOINT
// ====================================================================

app.get('/api/markets', async (req, res) => {
  console.log('Received request for /api/markets');

  // Fetch from all platforms in parallel
  const results = await Promise.allSettled([
    fetchPolymarketData(),
    fetchKalshiData(),
    fetchLimitlessData(),
  ]);
