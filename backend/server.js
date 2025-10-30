const express = require('express');
const fetch = require('node-fetch-cjs'); // Use node-fetch-cjs for CommonJS
const cors = require('cors');

const app = express();
const PORT = 3001;

// Enable CORS for your frontend
// In production, you should restrict this to your actual domain
app.use(cors());

// --- API Keys (Keep these secret on your server!) ---
// Replace these placeholders with your real keys.
const API_KEYS = {
  KALSHI_API_KEY: 'YOUR_SECRET_KALSHI_KEY_GOES_HERE',
  // Polymarket/Limitless may use signed wallet transactions for trading,
  // but might have read-only API keys or public endpoints for market data.
};

// --- API Endpoints ---
const API_ENDPOINTS = {
  POLYMARKET: 'https://api.polymarket.com/markets', // Example endpoint
  KALSHI: 'https://trading-api.kalshi.com/v2/events', // Example endpoint
  LIMITLESS: 'https://api.limitless.com/v1/markets', // Example endpoint
};

// ====================================================================
// DATA FETCHING FUNCTIONS
// These run on your server and use your secret keys.
// ====================================================================

/**
 * Fetches market data from Polymarket.
 */
async function fetchPolymarketData() {
  try {
    // Note: Polymarket's v3 API is GraphQL. This is a simplified v2 REST example.
    // You'll need to adapt this to their actual API specification.
    const response = await fetch(API_ENDPOINTS.POLYMARKET);
    if (!response.ok) throw new Error(`Polymarket API error: ${response.statusText}`);
    const data = await response.json();
    // Assuming data is an array of market objects
    return data.map(normalizePolymarket);
  } catch (error) {
    console.error('Failed to fetch from Polymarket:', error.message);
    return []; // Return empty array on failure
  }
}

/**
 * Fetches market data from Kalshi.
 * This one requires an API key in the header.
 */
async function fetchKalshiData() {
  try {
    const response = await fetch(API_ENDPOINTS.KALSHI, {
      headers: {
        'Authorization': `Bearer ${API_KEYS.KALSHI_API_KEY}`,
        'Content-Type': 'application/json',
      },
    });
    if (!response.ok) throw new Error(`Kalshi API error: ${response.statusText}`);
    const data = await response.json();
    // Assuming data.events contains the markets
    return data.events.map(normalizeKalshi);
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
    // Assuming data.markets is the array
    return data.markets.map(normalizeLimitless);
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
  // THIS IS A SIMULATION based on a hypothetical API structure.
  // You MUST adapt this to the real Polymarket API response.
  return {
    id: `poly-${market.id}`,
    title: market.question,
    platform: 'Polymarket',
    category: market.category || 'Politics',
    // Polymarket often uses a single price for the 'YES' outcome.
    yes: market.outcomes[0]?.price || 0.5, // Example: price of the first outcome
    no: 1 - (market.outcomes[0]?.price || 0.5),
  };
}

/**
 * Converts a Kalshi event object to our standard format.
 */
function normalizeKalshi(event) {
  // Kalshi markets have a `yes_price` and `no_price`
  return {
    id: `kalshi-${event.id}`,
    title: event.title,
a    platform: 'Kalshi',
    category: event.category || 'Economics',
    yes: event.yes_price / 100.0, // Kalshi prices are in cents (0-100)
    no: event.no_price / 100.0,
  };
}

/**
 * Converts a Limitless market object to our standard format.
 */
function normalizeLimitless(market) {
  // THIS IS A SIMULATION. Adapt to the real Limitless API.
  return {
    id: `limitless-${market.id}`,
    title: market.title,
S    platform: 'Limitless',
    category: market.tags[0] || 'Crypto',
    yes: market.current_price, // Assuming a single price for 'YES'
    no: 1 - market.current_price,
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
  t  fetchLimitlessData(),
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
i  console.log(`Aggregator backend listening on port ${PORT}`);
});

