const express = require('express');
const fetch = require('node-fetch-cjs'); // Use node-fetch-cjs for CommonJS
const cors = require('cors');

const app = express();
const PORT = 3001;

// Enable CORS for your frontend
app.use(cors());

// --- API Endpoints (Updated to correct URLs) ---
const API_ENDPOINTS = {
  // Polymarket: Using gamma-api for market lists
  POLYMARKET: 'https://gamma-api.polymarket.com/markets?limit=100&sort_by=volume_24h',
  
  // Kalshi: Using v2 markets endpoint
  KALSHI: 'https://api.elections.kalshi.com/trade-api/v2/markets?status=open&limit=100',
  
  // Limitless: Using the v1 endpoint you provided
  LIMITLESS: 'https://api.limitless.exchange/api-v1/markets'
};

// ====================================================================
// DATA FETCHING FUNCTIONS
// These run on your server.
// ====================================================================

/**
 * Fetches market data from Polymarket.
 */
async function fetchPolymarketData() {
  try {
    const response = await fetch(API_ENDPOINTS.POLYMARKET);
    if (!response.ok) throw new Error(`Polymarket API error: ${response.statusText}`);
    const data = await response.json();
    
    // The markets are in the 'data' property
    if (!data || !data.data) throw new Error("Invalid Polymarket response structure");

    return data.data.map(normalizePolymarket);
  } catch (error) {
    console.error('Failed to fetch from Polymarket:', error.message);
    return []; // Return empty array on failure
  }
}

/**
 * Fetches market data from Kalshi.
 * This is a public endpoint and does not require an API key.
 */
async function fetchKalshiData() {
  try {
    const response = await fetch(API_ENDPOINTS.KALSHI);
    if (!response.ok) throw new Error(`Kalshi API error: ${response.statusText}`);
    const data = await response.json();
    
    // The markets are in the 'markets' property
    if (!data || !data.markets) throw new Error("Invalid Kalshi response structure");

    return data.markets.map(normalizeKalshi);
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
    if (!response.ok) throw new Error(`Limitless API error: ${response.statusText}`);
    const data = await response.json();

    // This assumes the data is an array of markets.
    // If it's nested (e.g., data.markets), you'll need to change this.
    if (!Array.isArray(data)) throw new Error("Invalid Limitless response structure, expected an array.");

    return data.map(normalizeLimitless);
  } catch (error) {
    console.error('Failed to fetch from Limitless:', error.message);
    return [];
  }
}

// ====================================================================
// DATA NORMALIZATION FUNCTIONS
// These convert data from each platform into our standard format
// that app.jsx expects.
// ====================================================================

/**
 * Converts a Polymarket market object to our standard format.
 */
function normalizePolymarket(market) {
  // Safely get prices, default to 0.5 if structure is missing
  const yesPrice = market.outcome_prices?.[0]?.price ?? 0.5;
  const noPrice = market.outcome_prices?.[1]?.price ?? (1 - yesPrice);

  return {
    id: `poly-${market.id}`,
    title: market.question,
    platform: 'Polymarket',
    category: market.category || 'Other',
    yes: parseFloat(yesPrice),
    no: parseFloat(noPrice),
  };
}

/**
 * Converts a Kalshi market object to our standard format.
 */
function normalizeKalshi(market) {
  // Kalshi prices are in cents (0-100)
  const lastPriceCents = market.last_price ?? 50; // Default to 50 cents
  const yesPrice = lastPriceCents / 100.0;
  const noPrice = (100 - lastPriceCents) / 100.0;

  return {
    id: `kalshi-${market.ticker}`,
    title: market.title,
    platform: 'Kalshi',
    category: market.category || 'Other',
    yes: yesPrice,
    no: noPrice,
  };
}

/**
 * Converts a Limitless market object to our standard format.
 */
function normalizeLimitless(market) {
  // --- THIS IS A GUESS ---
  // You MUST adapt this to the real Limitless API response structure.
  // I am guessing the field names based on common conventions.
  const yesPrice = market.last_price ?? market.price ?? 0.5; // Guessing field names

  return {
    id: `limitless-${market.id || market.market_id}`,
    title: market.title || market.name,
    platform: 'Limitless',
    category: market.category || 'Crypto',
    yes: parseFloat(yesPrice),
    no: 1 - parseFloat(yesPrice),
  };
}

// ====================================================================
// THE MAIN API ENDPOINT
// This is what your React app (app.jsx) will call.
// ====================================================================

app.get('/api/markets', async (req, res) => {
  console.log('Received request for /api/markets');

  // Fetch from all platforms in parallel
  const results = await Promise.allSettled([
    fetchPolymarketData(),
    fetchKalshiData(),
    fetchLimitlessData(),
  ]);

  // Combine all successful results
  const allNormalizedMarkets = results
    .filter(result => result.status === 'fulfilled') // Only take successful fetches
    .flatMap(result => result.value); // Flatten the arrays [[...], [...]] into [...]

  console.log(`Returning ${allNormalizedMarkets.length} normalized markets.`);
  res.json(allNormalizedMarkets);
});

// ====================================================================
// START THE SERVER
// ====================================================================

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Aggregator backend listening on port ${PORT}`);
});
