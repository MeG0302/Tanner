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

// --- Configuration ---
const CONFIG = {
  // Pagination settings
  FETCH_STRATEGY: 'FULL', // 'SMART' (2 pages), 'FULL' (all pages), 'MINIMAL' (1 page)
  MAX_PAGES: {
    SMART: 2,    // Fetch 2000 markets (2 pages × 1000) - FAST
    FULL: 50,    // Fetch up to 50,000 markets (50 pages) - COMPLETE DATA (all active markets)
    MINIMAL: 1   // Fetch 1000 markets (1 page) - FAST but incomplete
  },
  
  // Cache settings (TWO-TIER: Browse vs Trade)
  CACHE_TTL: {
    METADATA: 600000,     // 10 minutes - For browsing/listing markets
    FULL_DATA: 300000,    // 5 minutes - For market details
    TRENDING: 300000,     // 5 minutes - For trending markets (custom algorithm)
    LIVE_PRICES: 5000     // 5 seconds - For real-time trading prices
  },
  
  // Performance settings
  CLEANUP_INTERVAL: 120000, // 2 minutes
  MAX_CACHE_SIZE: 500       // Maximum markets in full data cache
};

// --- API Endpoints ---
const API_ENDPOINTS = {
  // Polymarket Gamma API - Fetch active markets with pagination
  POLYMARKET: 'https://gamma-api.polymarket.com/markets?active=true&closed=false',
  // Polymarket Trending - Active markets sorted by volume
  POLYMARKET_TRENDING: 'https://gamma-api.polymarket.com/markets?active=true&closed=false',
  
  // Kalshi Trade API (Official endpoints from docs)
  KALSHI_MARKETS: 'https://api.elections.kalshi.com/trade-api/v2/markets?status=open&limit=500',
  KALSHI_EVENTS: 'https://api.elections.kalshi.com/trade-api/v2/events?status=open&limit=200',
  KALSHI_SERIES: 'https://api.elections.kalshi.com/trade-api/v2/series',
  
  // Limitless: Temporarily disabled
  LIMITLESS: 'https://api.limitless.exchange/api-v1/markets' 
};

// ====================================================================
// SMART CACHE MANAGER (Two-Tier Caching System)
// ====================================================================

/**
 * SmartCacheManager - Intelligent two-tier caching system
 * Separates lightweight metadata from heavy full market data
 * Automatically manages memory with TTL-based expiration and LRU eviction
 */
class SmartCacheManager {
  constructor() {
    // Metadata Cache (Lightweight - ~200 bytes per market)
    this.metadataCache = {
      timestamp: Date.now(),
      ttl: 600000, // 10 minutes
      data: {} // { 'Politics': [...markets], 'Sports': [...markets] }
    };
    
    // Full Data Cache (Heavy - ~10KB per market)
    this.fullDataCache = {
      timestamp: Date.now(),
      ttl: 300000, // 5 minutes
      maxSize: 500, // Maximum number of markets
      data: {} // { 'poly-12345': {...fullMarketData} }
    };
    
    // Access Frequency Tracker
    this.accessTracker = {}; // { 'Politics': { lastAccess: timestamp, hitCount: 15, extended: false } }
    
    // Performance tracking
    this.performanceStats = {
      cacheHits: 0,
      cacheMisses: 0,
      fetchOperations: [],
      cacheOperations: []
    };
    
    console.log('[Cache] SmartCacheManager initialized');
  }
  
  /**
   * Get metadata for a category (lightweight)
   * @param {string} category The category to retrieve
   * @returns {Array|null} Cached markets or null if expired/missing
   */
  getMetadata(category) {
    try {
      const now = Date.now();
      const cached = this.metadataCache.data[category];
      
      if (!cached || !Array.isArray(cached)) {
        this.performanceStats.cacheMisses++;
        return null;
      }
      
      // Check if cache is expired
      const cacheAge = now - this.metadataCache.timestamp;
      if (cacheAge > this.metadataCache.ttl) {
        console.log(`[Cache] Metadata expired for ${category} (age: ${Math.round(cacheAge / 1000)}s)`);
        this.performanceStats.cacheMisses++;
        return null;
      }
      
      this.performanceStats.cacheHits++;
      console.log(`[Cache] Metadata hit for ${category} (${cached.length} markets)`);
      return cached;
      
    } catch (error) {
      console.error('[Cache] Metadata corruption detected:', error);
      this.metadataCache.data[category] = null;
      return null;
    }
  }
  
  /**
   * Get full data for specific markets
   * @param {Array<string>} marketIds Array of market IDs
   * @returns {Array} Array of full market data objects
   */
  getFullData(marketIds) {
    if (!Array.isArray(marketIds)) return [];
    
    const now = Date.now();
    const cacheAge = now - this.fullDataCache.timestamp;
    
    // Check if full data cache is expired
    if (cacheAge > this.fullDataCache.ttl) {
      console.log(`[Cache] Full data cache expired (age: ${Math.round(cacheAge / 1000)}s)`);
      return [];
    }
    
    const results = [];
    for (const id of marketIds) {
      const market = this.fullDataCache.data[id];
      if (market) {
        results.push(market);
      }
    }
    
    return results;
  }
  
  /**
   * Store metadata after fetch
   * @param {string} category The category name
   * @param {Array} markets Array of market objects
   */
  setMetadata(category, markets) {
    if (!Array.isArray(markets)) {
      console.error('[Cache] Invalid markets array for setMetadata');
      return;
    }
    
    this.metadataCache.data[category] = markets;
    this.metadataCache.timestamp = Date.now();
    
    console.log(`[Cache] Stored ${markets.length} markets in metadata cache for ${category}`);
  }
  
  /**
   * Store full data for markets
   * @param {Array} markets Array of full market objects
   */
  setFullData(markets) {
    if (!Array.isArray(markets)) {
      console.error('[Cache] Invalid markets array for setFullData');
      return;
    }
    
    for (const market of markets) {
      if (market && market.id) {
        this.fullDataCache.data[market.id] = market;
      }
    }
    
    this.fullDataCache.timestamp = Date.now();
    
    // Enforce size limit after storing
    this.enforceSizeLimit();
    
    console.log(`[Cache] Stored ${markets.length} markets in full data cache`);
  }
  
  /**
   * Track access and extend TTL if needed
   * @param {string} category The category being accessed
   */
  trackAccess(category) {
    const now = Date.now();
    
    if (!this.accessTracker[category]) {
      this.accessTracker[category] = {
        lastAccess: now,
        hitCount: 1,
        extended: false
      };
    } else {
      this.accessTracker[category].lastAccess = now;
      this.accessTracker[category].hitCount++;
      
      // Extend TTL for frequently accessed categories (5+ hits)
      if (this.accessTracker[category].hitCount >= 5 && !this.accessTracker[category].extended) {
        this.extendTTL(category);
      }
    }
  }
  
  /**
   * Extend TTL for a frequently accessed category
   * @param {string} category The category to extend
   */
  extendTTL(category) {
    // Add 5 minutes to the metadata TTL
    this.metadataCache.ttl += 300000;
    this.accessTracker[category].extended = true;
    console.log(`[Cache] Extended TTL for ${category} (new TTL: ${this.metadataCache.ttl / 1000}s)`);
  }
  
  /**
   * Run cleanup (called every 2 minutes)
   */
  runCleanup() {
    const startTime = Date.now();
    console.log('[Cache] Running cleanup...');
    
    const deletedExpired = this.deleteExpired();
    this.enforceSizeLimit();
    this.markInactiveCategories();
    
    const duration = Date.now() - startTime;
    console.log(`[Cache] Cleanup complete in ${duration}ms (deleted ${deletedExpired} expired entries)`);
  }
  
  /**
   * Delete expired entries
   * @returns {number} Number of entries deleted
   */
  deleteExpired() {
    const now = Date.now();
    let deletedCount = 0;
    
    // Check metadata cache
    const metadataAge = now - this.metadataCache.timestamp;
    if (metadataAge > this.metadataCache.ttl) {
      const categoryCount = Object.keys(this.metadataCache.data).length;
      this.metadataCache.data = {};
      this.metadataCache.timestamp = now;
      deletedCount += categoryCount;
      console.log(`[Cache] Deleted ${categoryCount} expired metadata categories`);
    }
    
    // Check full data cache
    const fullDataAge = now - this.fullDataCache.timestamp;
    if (fullDataAge > this.fullDataCache.ttl) {
      const marketCount = Object.keys(this.fullDataCache.data).length;
      this.fullDataCache.data = {};
      this.fullDataCache.timestamp = now;
      deletedCount += marketCount;
      console.log(`[Cache] Deleted ${marketCount} expired full data entries`);
    }
    
    return deletedCount;
  }
  
  /**
   * Enforce max size limit using LRU eviction
   */
  enforceSizeLimit() {
    const currentSize = Object.keys(this.fullDataCache.data).length;
    
    if (currentSize > this.fullDataCache.maxSize) {
      console.warn(`[Cache] Size limit exceeded: ${currentSize}/${this.fullDataCache.maxSize}`);
      
      // Sort categories by last access time (oldest first)
      const entries = Object.entries(this.accessTracker)
        .sort((a, b) => a[1].lastAccess - b[1].lastAccess);
      
      // Delete oldest 20%
      const toDelete = Math.ceil(currentSize * 0.2);
      let deleted = 0;
      
      for (let i = 0; i < entries.length && deleted < toDelete; i++) {
        const [category] = entries[i];
        
        // Find and delete markets from this category
        const marketIds = Object.keys(this.fullDataCache.data);
        for (const id of marketIds) {
          if (deleted >= toDelete) break;
          delete this.fullDataCache.data[id];
          deleted++;
        }
        
        console.log(`[Cache] LRU eviction: deleted markets from ${category}`);
      }
      
      console.log(`[Cache] Evicted ${deleted} markets to enforce size limit`);
    }
  }
  
  /**
   * Mark inactive categories for priority deletion
   */
  markInactiveCategories() {
    const now = Date.now();
    const inactiveThreshold = 15 * 60 * 1000; // 15 minutes
    
    for (const [category, tracker] of Object.entries(this.accessTracker)) {
      const timeSinceAccess = now - tracker.lastAccess;
      
      if (timeSinceAccess > inactiveThreshold) {
        // Delete full data for inactive category
        delete this.metadataCache.data[category];
        console.log(`[Cache] Marked ${category} as inactive (${Math.round(timeSinceAccess / 1000)}s since last access)`);
      }
    }
  }
  
  /**
   * Get cache statistics
   * @returns {Object} Cache statistics
   */
  getStats() {
    const metadataSize = Object.keys(this.metadataCache.data).length;
    const fullDataSize = Object.keys(this.fullDataCache.data).length;
    const totalRequests = this.performanceStats.cacheHits + this.performanceStats.cacheMisses;
    const hitRate = totalRequests > 0 ? (this.performanceStats.cacheHits / totalRequests * 100).toFixed(2) : 0;
    const missRate = totalRequests > 0 ? (this.performanceStats.cacheMisses / totalRequests * 100).toFixed(2) : 0;
    
    // Get top categories by hit count
    const topCategories = Object.entries(this.accessTracker)
      .sort((a, b) => b[1].hitCount - a[1].hitCount)
      .slice(0, 5)
      .map(([category, tracker]) => ({
        category,
        hitCount: tracker.hitCount,
        lastAccess: new Date(tracker.lastAccess).toISOString()
      }));
    
    return {
      metadataSize,
      fullDataSize,
      hitRate: parseFloat(hitRate),
      missRate: parseFloat(missRate),
      totalRequests,
      topCategories,
      cacheHits: this.performanceStats.cacheHits,
      cacheMisses: this.performanceStats.cacheMisses
    };
  }
  
  /**
   * Get all metadata (for fallback scenarios)
   * @returns {Array} All cached markets
   */
  getAllMetadata() {
    const allMarkets = [];
    for (const markets of Object.values(this.metadataCache.data)) {
      if (Array.isArray(markets)) {
        allMarkets.push(...markets);
      }
    }
    return allMarkets;
  }
}

// Initialize the Smart Cache Manager
const cacheManager = new SmartCacheManager();

// Start cleanup interval (runs every 2 minutes)
const cleanupInterval = setInterval(() => {
  cacheManager.runCleanup();
}, 120000); // 2 minutes

console.log('[Cache] Cleanup interval started (runs every 2 minutes)');

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
  
  // Gamma API pre-filters for active markets, so accept all
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
// TRENDING ALGORITHM (Custom Implementation)
// ====================================================================

/**
 * Calculates a trending score for a market based on multiple factors
 * @param {Object} market Normalized market object
 * @returns {number} Trending score (higher = more trending)
 */
function calculateTrendingScore(market) {
  const now = Date.now();
  
  // 1. Volume Velocity (volume per hour) - 30% weight
  const volumeVelocity = market.volume_24h / 24;
  
  // 2. Volume Magnitude (log scale to prevent dominance) - 25% weight
  const volumeMagnitude = Math.log10(market.volume_24h + 1);
  
  // 3. Liquidity Factor (higher liquidity = more stable market) - 15% weight
  const liquidityFactor = Math.log10((market.liquidity || 0) + 1);
  
  // 4. Price Competitiveness (markets with close odds are more interesting) - 15% weight
  let priceCompetitiveness = 1.0;
  if (market.outcomes && market.outcomes.length >= 2) {
    const topPrice = market.outcomes[0].price;
    const secondPrice = market.outcomes[1].price;
    const priceDiff = Math.abs(topPrice - secondPrice);
    // Closer prices = more competitive = higher score
    priceCompetitiveness = 1 + (1 - priceDiff);
  }
  
  // 5. Recency Boost (new markets get priority) - 15% weight
  let recencyBoost = 1.0;
  if (market.startDate) {
    try {
      const hoursSinceStart = (now - new Date(market.startDate).getTime()) / (1000 * 60 * 60);
      if (hoursSinceStart < 48) {
        recencyBoost = 1.5; // 50% boost for markets < 48 hours old
      } else if (hoursSinceStart < 168) { // 1 week
        recencyBoost = 1.2; // 20% boost for markets < 1 week old
      }
    } catch (e) {
      // Invalid date, use default boost
      recencyBoost = 1.0;
    }
  }
  
  // Weighted trending score
  let score = (
    (volumeVelocity * 0.3) +
    (volumeMagnitude * 0.25) +
    (liquidityFactor * 0.15) +
    (priceCompetitiveness * 0.15) +
    (market.volume_24h * 0.15)
  ) * recencyBoost;
  
  // NEW: Boost multi-outcome markets (they're more interesting!)
  if (market.isMultiOutcome) {
    const originalScore = score;
    score *= 1.2; // 20% boost for multi-outcome markets
    console.log(`[Trending] Multi-outcome boost: "${market.shortTitle}" - Score: ${originalScore.toFixed(2)} → ${score.toFixed(2)} (+20%)`);
  }
  
  return score;
}

/**
 * Fetches and calculates trending markets using custom algorithm
 * @returns {Promise<Array>} Array of trending markets sorted by trending score
 */
async function fetchTrendingMarkets() {
  try {
    console.log('[Trending] Fetching markets for trending calculation...');
    
    // Fetch first 2 pages (2000 markets) for trending calculation
    // This is faster than fetching all markets and provides good coverage
    const allMarkets = await fetchPolymarketData(2);
    
    if (!allMarkets || allMarkets.length === 0) {
      console.warn('[Trending] No markets fetched');
      return [];
    }
    
    console.log(`[Trending] Calculating trending scores for ${allMarkets.length} markets...`);
    
    // Calculate trending score for each market
    const marketsWithScores = allMarkets.map(market => ({
      ...market,
      trendingScore: calculateTrendingScore(market)
    }));
    
    // Sort by trending score (descending) and return top 100
    const trendingMarkets = marketsWithScores
      .sort((a, b) => b.trendingScore - a.trendingScore)
      .slice(0, 100);
    
    console.log(`[Trending] Top 5 trending markets:`);
    trendingMarkets.slice(0, 5).forEach((m, i) => {
      console.log(`  ${i + 1}. ${m.shortTitle?.substring(0, 40)} - Score: ${m.trendingScore.toFixed(2)}, Volume: $${m.volume_24h?.toLocaleString()}`);
    });
    
    return trendingMarkets;
    
  } catch (error) {
    console.error('[Trending] Failed to fetch trending markets:', error.message);
    throw error;
  }
}

// ====================================================================
// SMART FILTERING (Top Quality Markets)
// ====================================================================

/**
 * Calculates a quality score for a market based on volume, liquidity, and activity
 * @param {Object} market Normalized market object
 * @returns {number} Quality score (higher = better quality)
 */
function calculateQualityScore(market) {
  // 1. Volume score (40% weight) - log scale
  const volumeScore = Math.log10((market.volume_24h || 0) + 1);
  
  // 2. Liquidity score (30% weight) - log scale
  const liquidityScore = Math.log10((market.liquidity || 0) + 1);
  
  // 3. Recency score (20% weight) - newer markets get boost
  let recencyScore = 1.0;
  if (market.startDate) {
    try {
      const now = Date.now();
      const daysSinceStart = (now - new Date(market.startDate).getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceStart < 7) {
        recencyScore = 2.0; // New markets (< 1 week)
      } else if (daysSinceStart < 30) {
        recencyScore = 1.5; // Recent markets (< 1 month)
      }
    } catch (e) {
      recencyScore = 1.0;
    }
  }
  
  // 4. Price competitiveness (10% weight) - close odds = more interesting
  let competitivenessScore = 1.0;
  if (market.outcomes && market.outcomes.length >= 2) {
    const topPrice = market.outcomes[0].price;
    const secondPrice = market.outcomes[1].price;
    const priceDiff = Math.abs(topPrice - secondPrice);
    competitivenessScore = 1 + (1 - priceDiff); // Closer = higher score
  }
  
  // Weighted quality score
  const score = (
    (volumeScore * 0.4) +
    (liquidityScore * 0.3) +
    (recencyScore * 0.2) +
    (competitivenessScore * 0.1)
  );
  
  return score;
}

/**
 * Filters markets to return only top quality ones
 * @param {Array} markets Array of all markets
 * @param {number} limit Maximum number of markets to return (default: 600)
 * @returns {Array} Top quality markets
 */
function filterTopQualityMarkets(markets, limit = 600) {
  if (!Array.isArray(markets) || markets.length === 0) {
    return [];
  }
  
  console.log(`[Filter] Filtering top ${limit} markets from ${markets.length} total...`);
  
  // Calculate quality score for each market
  const marketsWithScores = markets.map(market => ({
    ...market,
    qualityScore: calculateQualityScore(market)
  }));
  
  // Sort by quality score (descending) and return top N
  const topMarkets = marketsWithScores
    .sort((a, b) => b.qualityScore - a.qualityScore)
    .slice(0, limit);
  
  console.log(`[Filter] Top 5 quality markets:`);
  topMarkets.slice(0, 5).forEach((m, i) => {
    console.log(`  ${i + 1}. ${m.shortTitle?.substring(0, 40)} - Score: ${m.qualityScore.toFixed(2)}, Volume: $${m.volume_24h?.toLocaleString()}`);
  });
  
  return topMarkets;
}


// ====================================================================
// DATA FETCHING FUNCTIONS (Using nativeFetch)
// ====================================================================

/**
 * OPTIMIZED: Fetches market data from Polymarket with smart pagination.
 * Uses a hybrid approach: fetch first page immediately, then lazy-load more if needed.
 */
async function fetchPolymarketData(maxPages = 10) {
  try {
    console.log(`[Polymarket] Fetching markets (max ${maxPages} pages)...`);
    
    let allMarkets = [];
    let offset = 0;
    const limit = 1000; // Max per request
    let pagesFetched = 0;
    
    // Fetch pages up to maxPages limit
    while (pagesFetched < maxPages) {
      const url = `https://gamma-api.polymarket.com/markets?active=true&closed=false&limit=${limit}&offset=${offset}`;
      console.log(`[Polymarket] Fetching page ${pagesFetched + 1}/${maxPages} at offset ${offset}...`);
      
      const data = await nativeFetch(url);
      const marketArray = Array.isArray(data) ? data : data.data;

      if (!Array.isArray(marketArray)) {
        console.error('[Polymarket] Invalid response structure. Expected array.');
        throw new Error('Invalid Polymarket structure');
      }
      
      console.log(`[Polymarket] Fetched ${marketArray.length} markets at offset ${offset}`);
      
      // Add to collection
      allMarkets.push(...marketArray);
      pagesFetched++;
      
      // Check if there are more pages
      // API returns 0 markets when no more data available
      if (marketArray.length === 0) {
        console.log(`[Polymarket] Reached last page (no more markets)`);
        break; // No more markets available
      }
      
      // If we got fewer markets than requested, we might be near the end
      // but continue fetching until we get 0 markets
      if (marketArray.length < limit) {
        console.log(`[Polymarket] Got ${marketArray.length} markets (less than ${limit}), continuing...`);
      }
      
      offset += limit;
    }
    
    console.log(`[Polymarket] Total fetched: ${allMarkets.length} markets from ${pagesFetched} page(s)`);
    
    // Debug: Log first market to understand structure (only on first page)
    if (allMarkets.length > 0 && pagesFetched === 1) {
      console.log('\n=== SAMPLE POLYMARKET MARKET ===');
      const sample = allMarkets[0];
      console.log('Question:', sample.question);
      console.log('Volume fields:');
      console.log('  - volume:', sample.volume);
      console.log('  - volume24hr:', sample.volume24hr);
      console.log('  - volume_24h:', sample.volume_24h);
      console.log('  - volumeNum:', sample.volumeNum);
      console.log('  - liquidity:', sample.liquidity);
      console.log('Full sample (first 800 chars):', JSON.stringify(sample, null, 2).substring(0, 800));
      console.log('=== END SAMPLE ===\n');
    }
    
    // Normalize and sort by volume
    const normalized = allMarkets
      .map(normalizePolymarket)
      .filter(Boolean)
      .filter(isMarketCurrentlyOpen) // Filter to only open markets
      .sort((a, b) => b.volume_24h - a.volume_24h);
    
    const filtered = allMarkets.length - normalized.length;
    console.log(`[Polymarket] Normalized ${normalized.length} markets (removed ${filtered} closed/invalid)`);
    
    // Log sample volumes for debugging
    if (normalized.length > 0) {
      console.log('[Polymarket] Sample volumes (top 5):');
      normalized.slice(0, 5).forEach((m, i) => {
        console.log(`  ${i + 1}. ${m.shortTitle?.substring(0, 40)} - Volume: $${m.volume_24h?.toLocaleString() || 0}`);
      });
    }
    
    // Log multi-outcome statistics
    logMultiOutcomeStats(normalized);
    
    // Return ALL fetched markets
    return normalized;
    
  } catch (error) {
    console.error('[Polymarket] Failed to fetch markets:', error.message);
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
    
    // Debug: Log first 3 markets to see structure
    if (marketsData.markets.length > 0) {
      console.log('\n=== SAMPLE KALSHI MARKETS ===');
      marketsData.markets.slice(0, 3).forEach((m, i) => {
        console.log(`\nMarket ${i + 1}:`);
        console.log(`  ticker: ${m.ticker}`);
        console.log(`  title: ${m.title}`);
        console.log(`  subtitle: ${m.subtitle}`);
        console.log(`  status: ${m.status}`);
        console.log(`  volume: ${m.volume}`);
      });
      console.log('=== END SAMPLES ===\n');
    }

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
    
    // Extract volume from Polymarket API (try multiple field names)
    // Polymarket API fields: volume, volume24hr, liquidity
    const marketVolume = parseFloat(
      market.volume || 
      market.volume24hr || 
      market.volume_24h || 
      market.volumeNum ||
      0
    );
    
    // Also try to calculate from tokens as fallback
    let tokenVolume = 0;
    if (market.tokens && Array.isArray(market.tokens)) {
      tokenVolume = market.tokens.reduce((sum, token) => {
        return sum + parseFloat(token.volume || token.volume24hr || token.volume_24h || 0);
      }, 0);
    }
    
    // Use whichever is higher (market volume is usually more accurate)
    const totalVolume = Math.max(marketVolume, tokenVolume);
    
    // Get liquidity separately
    const liquidity = parseFloat(market.liquidity || 0);
    
    const commonData = {
      id: `poly-${market.condition_id || market.id}`,
      title: cleanedTitle,
      shortTitle: optimizeTitle(rawTitle),
      platform: 'Polymarket',
      category: getAdvancedCategory(cleanedTitle),
      volume_24h: totalVolume,
      liquidity: liquidity,
      outcomes: [],
      closed: market.closed || false,
      resolved: market.resolved || false,
      endDate: market.end_date_iso || market.endDate || null,
      // NEW: Enhanced metadata for market detail page
      image: market.image || market.icon || null,
      startDate: market.start_date_iso || market.startDate || market.created_at || null,
      polymarketUrl: market.id ? `https://polymarket.com/event/${market.slug || market.id}` : null,
      totalVolume: totalVolume,
    };

    // Color palette for different outcomes
    const outcomeColors = ['#3B82F6', '#EF4444', '#F59E0B', '#10B981', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316'];
    
    // Polymarket's `market.tokens` array contains the outcomes.
    if (market.tokens && market.tokens.length > 0) {
      // This is a Multi-Outcome market (like the election)
      console.log(`[Debug] Market "${cleanedTitle}" has ${market.tokens.length} tokens`);
      commonData.outcomes = market.tokens.map((token, index) => {
        const price = parseFloat(token.price || 0);
        return {
          name: token.outcome, // e.g., "Zohran Mamdani", "Andrew Cuomo", "Yes", "No"
          price: price,
          history: generateMarketHistory(price), // Generate history for this specific outcome
          color: outcomeColors[index % outcomeColors.length], // Assign color from palette
          image: token.image || null, // Token image if available
          rank: index + 1, // Rank by order
        };
      });

    } else {
      // This is a simple Yes/No market that isn't using the tokens array
      const yesPrice = parseFloat(market.lastTradePrice || 0.5);
      const noPrice = 1 - yesPrice;
      
      commonData.outcomes = [
        { name: 'Yes', price: yesPrice, history: generateMarketHistory(yesPrice), color: '#10B981', image: null, rank: 1 },
        { name: 'No', price: noPrice, history: generateMarketHistory(noPrice), color: '#EF4444', image: null, rank: 2 },
      ];
    }
    
    // Sort outcomes by price, descending (Top outcome first)
    commonData.outcomes.sort((a, b) => b.price - a.price);
    
    // Update ranks after sorting (highest price = rank 1)
    commonData.outcomes.forEach((outcome, index) => {
      outcome.rank = index + 1;
    });
    
    // Store all outcomes for detail page
    commonData.allOutcomes = [...commonData.outcomes];
    
    // NEW: Add multi-outcome detection
    const outcomeCount = commonData.outcomes.length;
    const isMultiOutcome = outcomeCount > 2;
    
    commonData.isMultiOutcome = isMultiOutcome;
    commonData.outcomeCount = outcomeCount;
    commonData.marketType = isMultiOutcome ? 'multi-outcome' : 'binary';
    
    // Log multi-outcome markets for monitoring
    if (isMultiOutcome) {
      console.log(`[Multi-Outcome] Detected: "${commonData.shortTitle}" with ${outcomeCount} outcomes`);
    }
    
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
        { name: 'Yes', price: yesPrice, history: generateMarketHistory(yesPrice), color: '#10B981', image: null },
        { name: 'No', price: noPrice, history: generateMarketHistory(noPrice), color: '#EF4444', image: null },
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
        { name: 'Yes', price: yesPrice, history: generateMarketHistory(yesPrice), color: '#10B981', image: null },
        { name: 'No', price: noPrice, history: generateMarketHistory(noPrice), color: '#EF4444', image: null },
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
// MARKET FETCHING WITH SMART CACHING
// ====================================================================

/**
 * Get markets by category with smart caching
 * @param {string} category The category to filter by (or 'All' for all markets)
 * @returns {Promise<Array>} Array of market objects
 */
async function getMarketsByCategory(category) {
  const startTime = Date.now();
  
  try {
    // Check cache first
    const cached = cacheManager.getMetadata(category);
    if (cached) {
      cacheManager.trackAccess(category);
      const duration = Date.now() - startTime;
      console.log(`[API] Cache hit for ${category}: ${cached.length} markets in ${duration}ms`);
      return cached;
    }
    
    // Cache miss: fetch from API
    console.log(`[API] Cache miss for ${category}, fetching from Polymarket...`);
    const maxPages = CONFIG.MAX_PAGES[CONFIG.FETCH_STRATEGY];
    const allMarkets = await fetchPolymarketData(maxPages);
    
    // Filter by category (case-insensitive)
    let filteredMarkets;
    if (category.toLowerCase() === 'all') {
      filteredMarkets = allMarkets;
    } else {
      filteredMarkets = allMarkets.filter(m => 
        m.category.toLowerCase() === category.toLowerCase()
      );
    }
    
    // SMART FILTERING: Return only top 600 quality markets for default display
    // This reduces data transfer and improves frontend performance
    const topQualityMarkets = filterTopQualityMarkets(filteredMarkets, 600);
    
    // Store FULL list in cache for search functionality
    cacheManager.setMetadata(category + '_full', filteredMarkets);
    // Store TOP 600 in cache for default display
    cacheManager.setMetadata(category, topQualityMarkets);
    cacheManager.trackAccess(category);
    
    const duration = Date.now() - startTime;
    console.log(`[API] Fetched and cached ${topQualityMarkets.length} top markets (from ${filteredMarkets.length} total) for ${category} in ${duration}ms`);
    
    return topQualityMarkets;
    
  } catch (error) {
    console.error(`[API] Error fetching markets for ${category}:`, error.message);
    
    // Try to return stale cache as fallback
    const staleCache = cacheManager.getAllMetadata();
    if (staleCache && staleCache.length > 0) {
      console.log(`[API] Returning stale cache as fallback (${staleCache.length} markets)`);
      
      // Filter stale cache by category
      if (category.toLowerCase() === 'all') {
        return staleCache;
      } else {
        return staleCache.filter(m => 
          m.category.toLowerCase() === category.toLowerCase()
        );
      }
    }
    
    // No fallback available
    console.error(`[API] No fallback cache available for ${category}`);
    return [];
  }
}

/**
 * LEGACY: Fetches and caches all markets from all platforms
 * @deprecated Use getMarketsByCategory() instead
 */
async function getAllMarkets() {
  console.warn('[API] getAllMarkets() is deprecated, use getMarketsByCategory("All") instead');
  return getMarketsByCategory('All');
}

// --- Get trending markets (with smart caching and custom algorithm) ---
app.get('/api/markets/trending', async (req, res) => {
  const startTime = Date.now();
  console.log('[API] Received request for trending markets');
  
  try {
    // Check cache first (5-minute TTL for trending)
    const cached = cacheManager.getMetadata('trending');
    const cacheAge = Date.now() - cacheManager.metadataCache.timestamp;
    const TRENDING_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
    
    if (cached && cacheAge < TRENDING_CACHE_TTL) {
      cacheManager.trackAccess('trending');
      const duration = Date.now() - startTime;
      console.log(`[API] Cache hit for trending: ${cached.length} markets in ${duration}ms (age: ${Math.round(cacheAge / 1000)}s)`);
      return res.json(cached);
    }
    
    // Cache miss or expired: fetch fresh trending data using custom algorithm
    console.log('[API] Cache miss/expired for trending, calculating with custom algorithm...');
    
    const trendingMarkets = await fetchTrendingMarkets();
    
    console.log(`[API] Calculated ${trendingMarkets.length} trending markets`);
    
    // Cache the results
    cacheManager.setMetadata('trending', trendingMarkets);
    cacheManager.trackAccess('trending');
    
    const duration = Date.now() - startTime;
    console.log(`[API] Returning ${trendingMarkets.length} trending markets in ${duration}ms (Cache: MISS)`);
    res.json(trendingMarkets);
    
  } catch (error) {
    console.error('[API] Error fetching trending markets:', error);
    
    // Fallback: return stale cache if available
    const staleCache = cacheManager.getMetadata('trending');
    if (staleCache && staleCache.length > 0) {
      console.log('[API] Returning stale cache as fallback');
      return res.json(staleCache);
    }
    
    res.status(500).json({ error: 'Failed to fetch trending markets' });
  }
});

// --- NEW: Multi-Outcome Markets endpoint ---
app.get('/api/markets/multi-outcome', async (req, res) => {
  const startTime = Date.now();
  console.log('[API] Received request for multi-outcome markets');
  
  try {
    // Check cache first
    const cached = cacheManager.getMetadata('multi-outcome');
    const cacheAge = Date.now() - cacheManager.metadataCache.timestamp;
    
    if (cached && cacheAge < CONFIG.CACHE_TTL.METADATA) {
      cacheManager.trackAccess('multi-outcome');
      const duration = Date.now() - startTime;
      console.log(`[API] Cache hit for multi-outcome: ${cached.length} markets in ${duration}ms (age: ${Math.round(cacheAge / 1000)}s)`);
      return res.json(cached);
    }
    
    // Cache miss or expired: fetch and filter
    console.log('[API] Cache miss/expired for multi-outcome, fetching...');
    
    // Fetch all markets
    const maxPages = CONFIG.MAX_PAGES[CONFIG.FETCH_STRATEGY];
    const allMarkets = await fetchPolymarketData(maxPages);
    
    // Filter to multi-outcome only (outcomeCount > 2)
    const multiOutcomeMarkets = allMarkets.filter(m => m.isMultiOutcome === true);
    
    console.log(`[API] Found ${multiOutcomeMarkets.length} multi-outcome markets out of ${allMarkets.length} total`);
    
    // Apply quality filtering (top 600)
    const topMarkets = filterTopQualityMarkets(multiOutcomeMarkets, 600);
    
    // Cache the results
    cacheManager.setMetadata('multi-outcome', topMarkets);
    cacheManager.trackAccess('multi-outcome');
    
    const duration = Date.now() - startTime;
    console.log(`[API] Returning ${topMarkets.length} multi-outcome markets in ${duration}ms (Cache: MISS)`);
    res.json(topMarkets);
    
  } catch (error) {
    console.error('[API] Error fetching multi-outcome markets:', error.message);
    res.status(500).json({ error: 'Failed to fetch multi-outcome markets' });
  }
});

// --- NEW: Search endpoint (searches ALL markets, not just top 600) ---
app.get('/api/search', async (req, res) => {
  const query = req.query.q;
  const startTime = Date.now();
  
  console.log(`[API] Search request: "${query}"`);
  
  if (!query || query.trim().length < 2) {
    return res.status(400).json({ error: 'Search query must be at least 2 characters' });
  }
  
  try {
    const searchTerm = query.toLowerCase().trim();
    
    // Get ALL markets from cache (not just top 600)
    const allMarketsCache = cacheManager.getMetadata('All_full');
    
    if (allMarketsCache && allMarketsCache.length > 0) {
      // Search in cached full list
      const results = allMarketsCache.filter(market => 
        market.title?.toLowerCase().includes(searchTerm) ||
        market.shortTitle?.toLowerCase().includes(searchTerm) ||
        market.category?.toLowerCase().includes(searchTerm)
      );
      
      const duration = Date.now() - startTime;
      console.log(`[API] Search found ${results.length} results in ${duration}ms (searched ${allMarketsCache.length} markets)`);
      
      return res.json({
        query: query,
        results: results,
        totalSearched: allMarketsCache.length,
        resultCount: results.length
      });
    }
    
    // If no cache, fetch fresh data
    console.log('[API] No cache for search, fetching fresh data...');
    const maxPages = CONFIG.MAX_PAGES[CONFIG.FETCH_STRATEGY];
    const allMarkets = await fetchPolymarketData(maxPages);
    
    // Search in fresh data
    const results = allMarkets.filter(market => 
      market.title?.toLowerCase().includes(searchTerm) ||
      market.shortTitle?.toLowerCase().includes(searchTerm) ||
      market.category?.toLowerCase().includes(searchTerm)
    );
    
    const duration = Date.now() - startTime;
    console.log(`[API] Search found ${results.length} results in ${duration}ms (searched ${allMarkets.length} markets)`);
    
    res.json({
      query: query,
      results: results,
      totalSearched: allMarkets.length,
      resultCount: results.length
    });
    
  } catch (error) {
    console.error('[API] Search error:', error);
    res.status(500).json({ error: 'Search failed' });
  }
});

// --- NEW: Get multi-outcome markets only ---
app.get('/api/markets/multi-outcome', async (req, res) => {
  const startTime = Date.now();
  console.log('[API] Received request for multi-outcome markets');
  
  try {
    // Check cache first
    const cacheKey = 'Multi-Outcome';
    const cached = metadataCache.get(cacheKey);
    const cacheAge = cached ? Date.now() - cached.timestamp : Infinity;
    
    if (cached && cacheAge < CACHE_TTL.METADATA) {
      const duration = Date.now() - startTime;
      console.log(`[API] Cache hit for Multi-Outcome: ${cached.data.length} markets in ${duration}ms`);
      return res.json(cached.data);
    }
    
    // Cache miss: fetch from API
    console.log(`[API] Cache miss for Multi-Outcome, fetching from Polymarket...`);
    const maxPages = CONFIG.MAX_PAGES[CONFIG.FETCH_STRATEGY];
    const allMarkets = await fetchPolymarketData(maxPages);
    
    // Filter to only multi-outcome markets (3+ outcomes)
    const multiOutcomeMarkets = allMarkets.filter(m => m.isMultiOutcome === true);
    
    // Apply quality filtering
    const qualityMarkets = filterTopQualityMarkets(multiOutcomeMarkets, 600);
    
    // Cache the results
    metadataCache.set(cacheKey, {
      data: qualityMarkets,
      timestamp: Date.now()
    });
    
    const duration = Date.now() - startTime;
    console.log(`[API] Returning ${qualityMarkets.length} multi-outcome markets (${duration}ms)`);
    
    res.json(qualityMarkets);
  } catch (error) {
    console.error('[API] Error fetching multi-outcome markets:', error.message);
    res.status(500).json({ error: 'Failed to fetch multi-outcome markets' });
  }
});

// --- Get markets by category (returns top 600 quality markets) ---
app.get('/api/markets/:category', async (req, res) => {
  const category = req.params.category;
  const startTime = Date.now();
  
  console.log(`[API] Received request for category: ${category}`);
  
  try {
    // Use new smart caching system
    const markets = await getMarketsByCategory(category);
    
    const duration = Date.now() - startTime;
    const cacheStatus = cacheManager.getMetadata(category) ? 'HIT' : 'MISS';
    
    // Return ALL markets (no slice/limit)
    console.log(`[API] Returning ${markets.length} markets for ${category} in ${duration}ms (Cache: ${cacheStatus})`);
    res.json(markets);
    
  } catch (error) {
    console.error(`[API] Error fetching markets for ${category}:`, error);
    res.status(500).json({ error: 'Failed to fetch markets' });
  }
});

// --- Legacy endpoint (returns all markets, for backward compatibility) ---
app.get('/api/markets', async (req, res) => {
  console.warn('[API] DEPRECATED: /api/markets endpoint called. Use /api/markets/:category instead');
  console.log('[API] Received request for /api/markets (all)');
  
  try {
    // Use new caching system
    const allMarkets = await getMarketsByCategory('All');
    
    // Return ALL markets (no limit)
    console.log(`[API] Returning ${allMarkets.length} markets (legacy endpoint)`);
    res.json(allMarkets);
  } catch (error) {
    console.error('[API] Error fetching markets:', error);
    res.status(500).json({ error: 'Failed to fetch markets' });
  }
});

// --- NEW: Real-time price endpoint for trading ---
app.get('/api/market/:marketId/live', async (req, res) => {
  const marketId = req.params.marketId;
  const startTime = Date.now();
  
  console.log(`[API] Real-time price request for market: ${marketId}`);
  
  try {
    // Extract the actual Polymarket ID from our prefixed ID
    const polymarketId = marketId.replace('poly-', '');
    
    // Fetch live data directly from Polymarket (no cache for trading)
    const url = `https://gamma-api.polymarket.com/markets/${polymarketId}`;
    const marketData = await nativeFetch(url);
    
    if (!marketData) {
      return res.status(404).json({ error: 'Market not found' });
    }
    
    // Normalize the market data
    const normalized = normalizePolymarket(marketData);
    
    const duration = Date.now() - startTime;
    console.log(`[API] Live price fetched for ${marketId} in ${duration}ms`);
    
    res.json({
      market: normalized,
      timestamp: Date.now(),
      cached: false,
      fetchTime: duration
    });
    
  } catch (error) {
    console.error(`[API] Error fetching live price for ${marketId}:`, error);
    res.status(500).json({ error: 'Failed to fetch live market data' });
  }
});

// --- NEW: Historical price data endpoint ---
app.get('/api/market/:id/history/:timeframe', async (req, res) => {
  const { id: marketId, timeframe } = req.params;
  const startTime = Date.now();
  
  console.log(`[API] Historical data requested for ${marketId} (${timeframe})`);
  
  try {
    // Validate timeframe
    const validTimeframes = ['1H', '6H', '1D', '1W', '1Y', 'ALL'];
    if (!validTimeframes.includes(timeframe)) {
      return res.status(400).json({ error: 'Invalid timeframe. Use: 1H, 6H, 1D, 1W, 1Y, or ALL' });
    }
    
    // Extract Polymarket ID
    if (!marketId.startsWith('poly-')) {
      return res.status(400).json({ error: 'Only Polymarket historical data is supported' });
    }
    
    const polymarketId = marketId.replace('poly-', '');
    
    // Map timeframe to Polymarket interval and calculate data points
    const timeframeConfig = {
      '1H': { interval: '1m', points: 60, duration: 3600 },
      '6H': { interval: '5m', points: 72, duration: 21600 },
      '1D': { interval: '15m', points: 96, duration: 86400 },
      '1W': { interval: '1h', points: 168, duration: 604800 },
      '1Y': { interval: '1d', points: 365, duration: 31536000 },
      'ALL': { interval: '1d', points: 500, duration: 63072000 } // ~2 years
    };
    
    const config = timeframeConfig[timeframe];
    
    // For now, generate mock historical data
    // TODO: Integrate with Polymarket's historical API when available
    const now = Date.now();
    const startPrice = 0.5 + (Math.random() - 0.5) * 0.3; // Random start between 0.35-0.65
    
    const data = [];
    for (let i = 0; i < config.points; i++) {
      const timestamp = now - (config.duration * 1000) + (i * (config.duration * 1000 / config.points));
      const volatility = 0.02;
      const change = (Math.random() - 0.5) * volatility;
      const price = Math.max(0.01, Math.min(0.99, startPrice + change * i));
      
      data.push({
        timestamp: Math.floor(timestamp),
        price: parseFloat(price.toFixed(4))
      });
    }
    
    const duration = Date.now() - startTime;
    console.log(`[API] Historical data generated for ${marketId} in ${duration}ms`);
    
    res.json({
      marketId,
      timeframe,
      interval: config.interval,
      data,
      cached: false,
      fetchTime: duration
    });
    
  } catch (error) {
    console.error(`[API] Error fetching historical data for ${marketId}:`, error);
    res.status(500).json({ error: 'Failed to fetch historical data' });
  }
});

// --- Cache statistics endpoint (for monitoring) ---
app.get('/api/stats', (req, res) => {
  console.log('[API] Cache statistics requested');
  
  try {
    const stats = cacheManager.getStats();
    
    res.json({
      cache: {
        metadataSize: stats.metadataSize,
        fullDataSize: stats.fullDataSize,
        hitRate: stats.hitRate,
        missRate: stats.missRate,
        totalRequests: stats.totalRequests
      },
      access: {
        topCategories: stats.topCategories
      },
      performance: {
        cacheHits: stats.cacheHits,
        cacheMisses: stats.cacheMisses
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[API] Error fetching cache stats:', error);
    res.status(500).json({ error: 'Failed to fetch cache statistics' });
  }
});

// ====================================================================
// GRACEFUL SHUTDOWN
// ====================================================================

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('[Server] SIGTERM received, shutting down gracefully...');
  
  // Clear cleanup interval
  clearInterval(cleanupInterval);
  
  // Log final cache statistics
  const finalStats = cacheManager.getStats();
  console.log('[Cache] Final statistics:', JSON.stringify(finalStats, null, 2));
  
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('[Server] SIGINT received, shutting down gracefully...');
  
  // Clear cleanup interval
  clearInterval(cleanupInterval);
  
  // Log final cache statistics
  const finalStats = cacheManager.getStats();
  console.log('[Cache] Final statistics:', JSON.stringify(finalStats, null, 2));
  
  process.exit(0);
});

// ====================================================================
// START THE SERVER
// ====================================================================

app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`🚀 Tanner.xyz Aggregator Backend`);
  console.log(`${'='.repeat(60)}`);
  console.log(`📡 Server: http://localhost:${PORT}`);
  console.log(`📊 Stats:  http://localhost:${PORT}/api/stats`);
  console.log(`${'='.repeat(60)}`);
  console.log(`⚙️  Configuration:`);
  console.log(`   - Fetch Strategy: ${CONFIG.FETCH_STRATEGY} (${CONFIG.MAX_PAGES[CONFIG.FETCH_STRATEGY]} pages)`);
  console.log(`   - Markets per fetch: ~${CONFIG.MAX_PAGES[CONFIG.FETCH_STRATEGY] * 1000}`);
  console.log(`   - Cache TTL: ${CONFIG.CACHE_TTL.METADATA / 1000}s (metadata), ${CONFIG.CACHE_TTL.FULL_DATA / 1000}s (full)`);
  console.log(`   - Cleanup interval: ${CONFIG.CLEANUP_INTERVAL / 1000}s`);
  console.log(`${'='.repeat(60)}\n`);
});


// DEBUG: Log multi-outcome market statistics
function logMultiOutcomeStats(markets) {
  const multiOutcomeCount = markets.filter(m => m.isMultiOutcome === true).length;
  const binaryCount = markets.filter(m => m.isMultiOutcome === false).length;
  console.log(`[Multi-Outcome Stats] Total: ${markets.length}, Multi-outcome: ${multiOutcomeCount}, Binary: ${binaryCount}`);
  
  const multiExamples = markets.filter(m => m.isMultiOutcome === true).slice(0, 5);
  if (multiExamples.length > 0) {
    console.log('[Multi-Outcome Examples]:');
    multiExamples.forEach((m, i) => {
      console.log(`  ${i + 1}. "${m.shortTitle}" - ${m.outcomeCount} outcomes - Volume: $${m.volume_24h?.toLocaleString()}`);
    });
  } else {
    console.log('[WARNING] No multi-outcome markets found in dataset!');
  }
}
