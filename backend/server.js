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
const https = require('https'); // FIX: Use native Node.js HTTPS module
const http = require('http');   // Added for http support (though APIs are mostly https)
const cors = require('cors');

const app = express();
const PORT = 3001;

// Enable CORS for your frontend
app.use(cors());

// --- API Endpoints ---
const API_ENDPOINTS = {
  // Polymarket: We use HTTPS and accept public data.
  POLYMARKET: 'https://gamma-api.polymarket.com/markets?limit=100&sort_by=volume_24h&order_by=desc&active=true',
  
  // Kalshi: We use the main markets endpoint since the live-data one 404s.
  KALSHI_MARKETS: 'https://api.elections.kalshi.com/trade-api/v2/markets?status=open&limit=500',
  
  // Limitless: This URL is likely incorrect, but we keep it here for diagnostics.
  LIMITLESS: 'https://api.limitless.exchange/api-v1/markets'
};

// ====================================================================
// NATIVE HTTP FETCH HELPER (FINAL FIX FOR "fetch is not a function")
// ====================================================================

/**
 * Executes a GET request using Node's native HTTP/HTTPS modules.
 * @param {string} url The URL to fetch.
 * @returns {Promise<any>} The parsed JSON data.
 */
function nativeFetch(url) {
  const client = url.startsWith('https') ? https : http;
  
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
            console.error(`JSON Parse Error for ${url}: ${e.message}. Raw data: ${data.substring(0, 500)}...`);
            reject(new Error(`Failed to parse JSON response. Status: ${res.statusCode}`));
          }
        } else {
          // Log the raw response body on HTTP error
          console.error(`HTTP Error Body for ${url} (Status ${res.statusCode}): ${data.substring(0, 500)}...`);
          reject(new Error(`HTTP Error Status: ${res.statusCode} for ${url}`));
        }
      });
    }).on('error', (err) => {
      reject(new Error(`Native Fetch Error: ${err.message}`));
    });
  });
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

    // FIX: Polymarket structure is { data: [...] }
    if (!data || !Array.isArray(data.data)) {
      console.error('Invalid Polymarket structure. Expected { data: [...] }', data);
      throw new Error('Invalid Polymarket structure');
    }
    
    // Take top 25
    return data.data.map(normalizePolymarket).filter(m => m !== null).slice(0, 25);
  } catch (error) {
    console.error('Failed to fetch from Polymarket:', error.message);
    return [];
  }
}

/**
 * Fetches market data from Kalshi.
 */
async function fetchKalshiData() {
  try {
    // FIX: Only use the main markets endpoint to avoid 404 on live-data
    const marketsData = await nativeFetch(API_ENDPOINTS.KALSHI_MARKETS);
    
    // Kalshi structure is { markets: [...] }
    if (!marketsData || !Array.isArray(marketsData.markets)) {
      console.error('Invalid Kalshi structure. Expected { markets: [...] }', marketsData);
      throw new Error('Invalid Kalshi structure');
    }
    
    // We can only normalize based on the data available in this single call.
    return marketsData.markets
      .map(market => normalizeKalshi(market))
      .filter(m => m !== null)
      .sort((a, b) => b.volume_24h - a.volume_24h) // Sort by available volume
      .slice(0, 25);
  } catch (error) {
    console.error('Failed to fetch from Kalshi:', error.message);
    return [];
  }
}

/**
 * Fetches market data from Limitless.
 */
async function fetchLimitlessData() {
  // FIX: This API is currently broken/misconfigured. Disable for now.
  // We will re-enable this later if you find a working Limitless API URL.
  // try {
  //   const data = await nativeFetch(API_ENDPOINTS.LIMITLESS);

  //   if (!data || !Array.isArray(data)) {
  //       console.error('Invalid Limitless structure. Expected [...]', data);
  //       throw new Error('Invalid Limitless structure');
  //   }
    
  //   return data.map(normalizeLimitless).filter(m => m !== null).slice(0, 25);
  // } catch (error) {
  //   console.error('Failed to fetch from Limitless:', error.message);
  //   return [];
  // }
  console.log("Limitless fetch temporarily skipped (API URL likely incorrect/non-JSON response)");
  return [];
}

// ====================================================================
// DATA NORMALIZATION FUNCTIONS
// ====================================================================

function normalizePolymarket(market) {
  try {
    const yesToken = market.tokens.find(t => t.outcome === 'Yes');
    const noToken = market.tokens.find(t => t.outcome === 'No');

    // Polymarket prices are often in a 'price' field on the token object
    if (!yesToken || !noToken || yesToken.price === undefined || noToken.price === undefined) return null;

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

function normalizeKalshi(market) {
  try {
    // Kalshi Market Endpoint structure provides most data directly.
    // Price fields are `yes_price` and `no_price` (in cents)
    
    // We assume the market is valid if prices exist (they are required to trade)
    if (market.yes_price === undefined || market.no_price === undefined) return null;

    return {
      id: `kalshi-${market.ticker_name}`,
      title: market.subtitle || market.title, 
      platform: 'Kalshi',
      category: market.category || 'Economics',
      // Kalshi prices are in cents (0-100), convert to 0-1.0
      yes: market.yes_price / 100.0,
      no: market.no_price / 100.0,
      volume_24h: parseFloat(market.volume_24h) || 0,
    };
  } catch (err) {
    console.error("Error normalizing Kalshi market:", err.message, market);
    return null;
  }
}

function normalizeLimitless(market) {
  // Since Limitless is currently skipped, this function is mostly a placeholder for when we fix the API call.
  return null;
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
    fetchLimitlessData(), // This will be skipped
  ]);

  // Combine all successful results
  const allNormalizedMarkets = results
    .filter(result => result.status === 'fulfilled')
    .flatMap(result => result.value);
  
  const sortedMarkets = allNormalizedMarkets.sort((a, b) => b.volume_24h - a.volume_24h);

  console.log(`Returning ${sortedMarkets.length} normalized markets.`);
  res.json(sortedMarkets);
});

// ====================================================================
// START THE SERVER
// ====================================================================

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Aggregator backend listening on port ${PORT}`);
});

