/**
 * Tanner.xyz Aggregator Backend
 * 
 * This Node.js server acts as a proxy and data aggregator.
 * It fetches market data from multiple prediction market APIs (Polymarket, Kalshi),
 * normalizes the data into a consistent format, and provides a single endpoint
 * for the React frontend to consume.
 * 
 * This approach is CRITICAL to bypass browser CORS (Cross-Origin Resource Sharing)
 * limitations, as browsers would block the frontend from calling these APIs directly.
 */

const express = require('express');
const https = require('https');
const http = require('http');
const cors = require('cors');
const path = require('path');

// Import unified market aggregation components
const PolymarketFetcher = require('./PolymarketFetcher');
const KalshiFetcher = require('./KalshiFetcher');
const MarketMatchingEngine = require('./MarketMatchingEngine');
const MarketAggregator = require('./MarketAggregator');
const ArbitrageDetector = require('./ArbitrageDetector');
const PollingService = require('./PollingService');

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
    
    // Unified Market Cache (for multi-platform aggregation)
    this.unifiedMarketCache = {
      timestamp: Date.now(),
      ttl: 300000, // 5 minutes
      data: {} // { 'unified-id': {...UnifiedMarket} }
    };
    
    // Match Confidence Cache (for fuzzy matching results)
    this.matchCache = {
      timestamp: Date.now(),
      ttl: 600000, // 10 minutes
      data: {} // { 'poly-id:kalshi-id': confidence_score }
    };
    
    // Platform Health Tracking
    this.platformHealth = {
      polymarket: {
        status: 'unknown', // 'healthy', 'degraded', 'unknown'
        lastSuccessfulFetch: null,
        lastError: null,
        requestsPerMinute: 0,
        lastAttempt: null
      },
      kalshi: {
        status: 'unknown',
        lastSuccessfulFetch: null,
        lastError: null,
        requestsPerMinute: 0,
        lastAttempt: null
      }
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
    
    console.log('[Cache] SmartCacheManager initialized with unified market support');
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
    
    // Check unified market cache
    const unifiedMarketAge = now - this.unifiedMarketCache.timestamp;
    if (unifiedMarketAge > this.unifiedMarketCache.ttl) {
      const unifiedCount = Object.keys(this.unifiedMarketCache.data).length;
      this.unifiedMarketCache.data = {};
      this.unifiedMarketCache.timestamp = now;
      deletedCount += unifiedCount;
      console.log(`[Cache] Deleted ${unifiedCount} expired unified market entries`);
    }
    
    // Check match confidence cache
    const matchCacheAge = now - this.matchCache.timestamp;
    if (matchCacheAge > this.matchCache.ttl) {
      const matchCount = Object.keys(this.matchCache.data).length;
      this.matchCache.data = {};
      this.matchCache.timestamp = now;
      deletedCount += matchCount;
      console.log(`[Cache] Deleted ${matchCount} expired match confidence entries`);
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
   * Get unified market from cache
   * @param {string} unified_id The unified market ID
   * @returns {Object|null} Unified market object or null if expired/missing
   */
  getUnifiedMarket(unified_id) {
    try {
      const now = Date.now();
      const cached = this.unifiedMarketCache.data[unified_id];
      
      if (!cached) {
        this.performanceStats.cacheMisses++;
        return null;
      }
      
      // Check if cache is expired
      const cacheAge = now - this.unifiedMarketCache.timestamp;
      if (cacheAge > this.unifiedMarketCache.ttl) {
        console.log(`[Cache] Unified market cache expired (age: ${Math.round(cacheAge / 1000)}s)`);
        this.performanceStats.cacheMisses++;
        return null;
      }
      
      this.performanceStats.cacheHits++;
      console.log(`[Cache] Unified market hit for ${unified_id}`);
      return cached;
      
    } catch (error) {
      console.error('[Cache] Unified market cache corruption detected:', error);
      this.unifiedMarketCache.data[unified_id] = null;
      return null;
    }
  }
  
  /**
   * Store unified market in cache
   * @param {string} unified_id The unified market ID
   * @param {Object} market The unified market object
   */
  setUnifiedMarket(unified_id, market) {
    if (!market || typeof market !== 'object') {
      console.error('[Cache] Invalid unified market object for setUnifiedMarket');
      return;
    }
    
    this.unifiedMarketCache.data[unified_id] = market;
    this.unifiedMarketCache.timestamp = Date.now();
    
    console.log(`[Cache] Stored unified market ${unified_id} in cache`);
  }
  
  /**
   * Get all unified markets from cache
   * @returns {Array} Array of unified market objects
   */
  getAllUnifiedMarkets() {
    const now = Date.now();
    const cacheAge = now - this.unifiedMarketCache.timestamp;
    
    // Check if cache is expired
    if (cacheAge > this.unifiedMarketCache.ttl) {
      console.log(`[Cache] Unified market cache expired (age: ${Math.round(cacheAge / 1000)}s)`);
      return [];
    }
    
    return Object.values(this.unifiedMarketCache.data).filter(m => m !== null);
  }
  
  /**
   * Get match confidence from cache
   * @param {string} platform1_id First platform market ID
   * @param {string} platform2_id Second platform market ID
   * @returns {number|null} Confidence score (0.0 to 1.0) or null if not cached
   */
  getMatchConfidence(platform1_id, platform2_id) {
    try {
      const now = Date.now();
      const cacheKey = `${platform1_id}:${platform2_id}`;
      const reverseCacheKey = `${platform2_id}:${platform1_id}`;
      
      // Check both directions
      const cached = this.matchCache.data[cacheKey] || this.matchCache.data[reverseCacheKey];
      
      if (cached === undefined) {
        return null;
      }
      
      // Check if cache is expired
      const cacheAge = now - this.matchCache.timestamp;
      if (cacheAge > this.matchCache.ttl) {
        console.log(`[Cache] Match confidence cache expired (age: ${Math.round(cacheAge / 1000)}s)`);
        return null;
      }
      
      console.log(`[Cache] Match confidence hit for ${cacheKey}: ${cached}`);
      return cached;
      
    } catch (error) {
      console.error('[Cache] Match confidence cache error:', error);
      return null;
    }
  }
  
  /**
   * Store match confidence in cache
   * @param {string} platform1_id First platform market ID
   * @param {string} platform2_id Second platform market ID
   * @param {number} confidence Confidence score (0.0 to 1.0)
   */
  setMatchConfidence(platform1_id, platform2_id, confidence) {
    if (typeof confidence !== 'number' || confidence < 0 || confidence > 1) {
      console.error('[Cache] Invalid confidence score for setMatchConfidence');
      return;
    }
    
    const cacheKey = `${platform1_id}:${platform2_id}`;
    this.matchCache.data[cacheKey] = confidence;
    this.matchCache.timestamp = Date.now();
    
    console.log(`[Cache] Stored match confidence ${cacheKey}: ${confidence}`);
  }
  
  /**
   * Update platform health status
   * @param {string} platform Platform name ('polymarket' or 'kalshi')
   * @param {string} status Status ('healthy', 'degraded', 'unknown')
   * @param {Error|null} error Error object if failed
   */
  updatePlatformHealth(platform, status, error = null) {
    if (!this.platformHealth[platform]) {
      console.error(`[Cache] Unknown platform: ${platform}`);
      return;
    }
    
    const now = Date.now();
    this.platformHealth[platform].status = status;
    this.platformHealth[platform].lastAttempt = now;
    
    if (status === 'healthy') {
      this.platformHealth[platform].lastSuccessfulFetch = now;
      this.platformHealth[platform].lastError = null;
    } else if (error) {
      this.platformHealth[platform].lastError = error.message || String(error);
    }
    
    console.log(`[Cache] Platform health updated: ${platform} = ${status}`);
  }
  
  /**
   * Get platform health status
   * @param {string} platform Platform name ('polymarket' or 'kalshi')
   * @returns {Object|null} Platform health object or null if unknown platform
   */
  getPlatformHealth(platform) {
    if (!this.platformHealth[platform]) {
      console.error(`[Cache] Unknown platform: ${platform}`);
      return null;
    }
    
    const health = this.platformHealth[platform];
    const now = Date.now();
    
    // Calculate if platform is degraded based on time since last successful fetch
    if (health.lastSuccessfulFetch) {
      const timeSinceSuccess = now - health.lastSuccessfulFetch;
      
      // Mark as degraded if no successful fetch in last 60 seconds
      if (timeSinceSuccess > 60000 && health.status === 'healthy') {
        health.status = 'degraded';
        console.log(`[Cache] Platform ${platform} marked as degraded (${Math.round(timeSinceSuccess / 1000)}s since last success)`);
      }
    }
    
    return {
      ...health,
      timeSinceLastSuccess: health.lastSuccessfulFetch ? now - health.lastSuccessfulFetch : null
    };
  }
  
  /**
   * Get all platform health statuses
   * @returns {Object} Object with health status for all platforms
   */
  getAllPlatformHealth() {
    return {
      polymarket: this.getPlatformHealth('polymarket'),
      kalshi: this.getPlatformHealth('kalshi')
    };
  }
  
  /**
   * Get cache statistics
   * @returns {Object} Cache statistics
   */
  getStats() {
    const metadataSize = Object.keys(this.metadataCache.data).length;
    const fullDataSize = Object.keys(this.fullDataCache.data).length;
    const unifiedMarketSize = Object.keys(this.unifiedMarketCache.data).length;
    const matchCacheSize = Object.keys(this.matchCache.data).length;
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
      unifiedMarketSize,
      matchCacheSize,
      hitRate: parseFloat(hitRate),
      missRate: parseFloat(missRate),
      totalRequests,
      topCategories,
      cacheHits: this.performanceStats.cacheHits,
      cacheMisses: this.performanceStats.cacheMisses,
      platformHealth: this.getAllPlatformHealth()
    };
  }
  
  /**
   * Clear all caches (for debugging/forcing refresh)
   */
  clearAll() {
    this.metadataCache.data = {};
    this.metadataCache.timestamp = Date.now();
    this.fullDataCache.data = {};
    this.fullDataCache.timestamp = Date.now();
    this.unifiedMarketCache.data = {};
    this.unifiedMarketCache.timestamp = Date.now();
    this.matchCache.data = {};
    this.matchCache.timestamp = Date.now();
    this.accessTracker = {};
    console.log('[Cache] All caches cleared (including unified markets and match confidence)');
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
// PLATFORM FETCHERS INITIALIZATION
// ====================================================================

// Initialize Polymarket Fetcher
const polymarketFetcher = new PolymarketFetcher(
  'https://gamma-api.polymarket.com',
  cacheManager
);

console.log('[PolymarketFetcher] Initialized');

// Initialize Kalshi Fetcher
const kalshiFetcher = new KalshiFetcher(
  API_ENDPOINTS.KALSHI_MARKETS.split('?')[0].replace('/markets', ''),
  process.env.KALSHI_API_KEY,
  cacheManager
);

console.log('[KalshiFetcher] Initialized');

// ====================================================================
// UNIFIED MARKET AGGREGATION COMPONENTS
// ====================================================================

// Initialize Market Matching Engine
const matchingEngine = new MarketMatchingEngine();
console.log('[MatchingEngine] Initialized');

// Initialize Arbitrage Detector
const arbitrageDetector = new ArbitrageDetector();
console.log('[ArbitrageDetector] Initialized');

// Initialize Market Aggregator with both fetchers
const marketAggregator = new MarketAggregator(polymarketFetcher, kalshiFetcher, cacheManager);
console.log('[MarketAggregator] Initialized');

// Initialize Polling Service for real-time data synchronization
const pollingService = new PollingService(marketAggregator, cacheManager);
console.log('[PollingService] Initialized');

// Start polling service
pollingService.start();
console.log('[PollingService] Started polling (Polymarket: 5s, Kalshi: 10s)');

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
  const MAX_LENGTH = 50;
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
  return outcomes.sort((a, b) => b.price - a.price).slice(0, 3);
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
  if (lowerTitle.includes('trump') || lowerTitle.includes('biden') || 
      lowerTitle.includes('election') || lowerTitle.includes('president') || 
      lowerTitle.includes('mayor') || lowerTitle.includes('governor') ||
      lowerTitle.includes('senate') || lowerTitle.includes('congress')) {
    return 'Politics';
  }

  // Geopolitics (New)
  if (lowerTitle.includes('russia') || lowerTitle.includes('china') || 
      lowerTitle.includes('taiwan') || lowerTitle.includes('gaza') || 
      lowerTitle.includes('war')) {
    return 'Geopolitics';
  }

  // Crypto
  if (lowerTitle.includes('btc') || lowerTitle.includes('bitcoin') || 
      lowerTitle.includes('eth') || lowerTitle.includes('solana') || 
      lowerTitle.includes('crypto')) {
    return 'Crypto';
  }

  // Economics
  if (lowerTitle.includes('fed') || lowerTitle.includes('inflation') || 
      lowerTitle.includes('interest rate') || lowerTitle.includes('gdp') || 
      lowerTitle.includes('cpi')) {
    return 'Economics';
  }

  // Sports (Enhanced with player names and teams)
  if (lowerTitle.includes('nba') || lowerTitle.includes('nfl') || 
      lowerTitle.includes('lakers') || lowerTitle.includes('world cup') ||
      lowerTitle.includes('mahomes') || lowerTitle.includes('josh allen') || 
      lowerTitle.includes('james cook') ||
      lowerTitle.includes('touchdown') || lowerTitle.includes('quarterback') || 
      lowerTitle.includes('yards') ||
      lowerTitle.includes('chiefs') || lowerTitle.includes('bills') || 
      lowerTitle.includes('cowboys') ||
      lowerTitle.includes('packers') || lowerTitle.includes('broncos') || 
      lowerTitle.includes('rams')) {
    return 'Sports';
  }

  // World (New)
  if (lowerTitle.includes('india') || lowerTitle.includes('uk') || 
      lowerTitle.includes('prime minister')) {
    return 'World';
  }

  // Culture (New)
  if (lowerTitle.includes('movie') || lowerTitle.includes('box office') || 
      lowerTitle.includes('taylor swift') || lowerTitle.includes('grammy')) {
    return 'Culture';
  }

  // Fallback
  return 'Other';
}

/**
 * Generates a realistic (but fake) 7-day price history for an outcome.
 * @param {number} startPrice The starting price (probability) for this outcome.
 * @returns {Array<Object>} An array of data points for the chart.
 */
function generateMarketHistory(startPrice) {
  let history = [];
  let price = startPrice;
  const now = Math.floor(Date.now() / 1000);
  const sevenDaysAgo = now - (7 * 24 * 60 * 60);
  const dataPoints = 168;
  const timeStep = (7 * 24 * 60 * 60) / dataPoints;

  for (let i = 0; i < dataPoints; i++) {
    const change = (Math.random() - 0.5) * 0.02;
    price += change;
    if (price > 0.99) price = 0.99;
    if (price < 0.01) price = 0.01;
    
    history.push({ 
      time: sevenDaysAgo + (i * timeStep), 
      value: price 
    });
  }

  history.push({ time: now, value: startPrice });
  return history;
}

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
    priceCompetitiveness = 1 + (1 - priceDiff);
  }

  // 5. Recency Boost (new markets get priority) - 15% weight
  let recencyBoost = 1.0;
  if (market.startDate) {
    try {
      const hoursSinceStart = (now - new Date(market.startDate).getTime()) / (1000 * 60 * 60);
      if (hoursSinceStart < 48) {
        recencyBoost = 1.5;
      } else if (hoursSinceStart < 168) {
        recencyBoost = 1.2;
      }
    } catch (e) {
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

  // Boost multi-outcome markets (they're more interesting!)
  if (market.isMultiOutcome) {
    const originalScore = score;
    score *= 1.2;
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
    
    const allMarkets = await fetchPolymarketData(2);
    if (!allMarkets || allMarkets.length === 0) {
      console.warn('[Trending] No markets fetched');
      return [];
    }

    console.log(`[Trending] Calculating trending scores for ${allMarkets.length} markets...`);

    const marketsWithScores = allMarkets.map(market => ({
      ...market,
      trendingScore: calculateTrendingScore(market)
    }));

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
        recencyScore = 2.0;
      } else if (daysSinceStart < 30) {
        recencyScore = 1.5;
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
    competitivenessScore = 1 + (1 - priceDiff);
  }

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

  const marketsWithScores = markets.map(market => ({
    ...market,
    qualityScore: calculateQualityScore(market)
  }));

  const topMarkets = marketsWithScores
    .sort((a, b) => b.qualityScore - a.qualityScore)
    .slice(0, limit);

  console.log(`[Filter] Top 5 quality markets:`);
  topMarkets.slice(0, 5).forEach((m, i) => {
    console.log(`  ${i + 1}. ${m.shortTitle?.substring(0, 40)} - Score: ${m.qualityScore.toFixed(2)}, Volume: $${m.volume_24h?.toLocaleString()}`);
  });

  return topMarkets;
}

/**
 * Fetches market data from Polymarket with smart pagination.
 */
async function fetchPolymarketData(maxPages = 10) {
  try {
    console.log(`[Polymarket] Fetching markets (max ${maxPages} pages)...`);
    
    let allMarkets = [];
    let offset = 0;
    const limit = 1000;
    let pagesFetched = 0;

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
      allMarkets.push(...marketArray);
      pagesFetched++;

      if (marketArray.length === 0) {
        console.log(`[Polymarket] Reached last page (no more markets)`);
        break;
      }

      if (marketArray.length < limit) {
        console.log(`[Polymarket] Got ${marketArray.length} markets (less than ${limit}), continuing...`);
      }

      offset += limit;
    }

    console.log(`[Polymarket] Total fetched: ${allMarkets.length} markets from ${pagesFetched} page(s)`);

    const normalized = allMarkets
      .map(normalizePolymarket)
      .filter(Boolean)
      .filter(isMarketCurrentlyOpen)
      .sort((a, b) => b.volume_24h - a.volume_24h);

    const filtered = allMarkets.length - normalized.length;
    console.log(`[Polymarket] Normalized ${normalized.length} markets (removed ${filtered} closed/invalid)`);

    if (normalized.length > 0) {
      console.log('[Polymarket] Sample volumes (top 5):');
      normalized.slice(0, 5).forEach((m, i) => {
        console.log(`  ${i + 1}. ${m.shortTitle?.substring(0, 40)} - Volume: $${m.volume_24h?.toLocaleString() || 0}`);
      });
    }

    logMultiOutcomeStats(normalized);
    return normalized;
  } catch (error) {
    console.error('[Polymarket] Failed to fetch markets:', error.message);
    return [];
  }
}

/**
 * Fetches market data from Kalshi using the new KalshiFetcher class
 */
async function fetchKalshiData() {
  try {
    console.log('[Kalshi] Fetching data using KalshiFetcher...');

    const rawMarkets = await kalshiFetcher.fetchMarkets({
      status: 'open',
      limit: 500
    });

    if (!rawMarkets || rawMarkets.length === 0) {
      console.warn('[Kalshi] No markets returned');
      return [];
    }

    console.log(`[Kalshi] Fetched ${rawMarkets.length} markets`);

    const normalized = rawMarkets
      .map(market => kalshiFetcher.normalizeMarket(market))
      .filter(Boolean)
      .filter(isMarketCurrentlyOpen)
      .sort((a, b) => b.volume_24h - a.volume_24h)
      .slice(0, 50);

    console.log(`[Kalshi] Normalized ${normalized.length} markets`);
    return normalized;
  } catch (error) {
    console.error('[Kalshi] Failed to fetch markets:', error.message);
    return [];
  }
}

/**
 * Converts a Polymarket market object to our standard multi-outcome format.
 */
function normalizePolymarket(market) {
  try {
    const rawTitle = market.question;
    const cleanedTitle = cleanMarketTitle(rawTitle);

    const marketVolume = parseFloat(market.volume || market.volume24hr || market.volume_24h || market.volumeNum || 0);
    
    let tokenVolume = 0;
    if (market.tokens && Array.isArray(market.tokens)) {
      tokenVolume = market.tokens.reduce((sum, token) => {
        return sum + parseFloat(token.volume || token.volume24hr || token.volume_24h || 0);
      }, 0);
    }

    const totalVolume = Math.max(marketVolume, tokenVolume);
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
      image: market.image || market.icon || null,
      startDate: market.start_date_iso || market.startDate || market.created_at || null,
      polymarketUrl: market.id ? `https://polymarket.com/event/${market.slug || market.id}` : null,
      totalVolume: totalVolume,
    };

    const outcomeColors = ['#3B82F6', '#EF4444', '#F59E0B', '#10B981', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316'];

    if (market.tokens && market.tokens.length > 0) {
      commonData.outcomes = market.tokens.map((token, index) => {
        const price = parseFloat(token.price || 0);
        return {
          name: token.outcome,
          price: price,
          history: generateMarketHistory(price),
          color: outcomeColors[index % outcomeColors.length],
          image: token.image || null,
          rank: index + 1,
        };
      });
    } else {
      const yesPrice = parseFloat(market.lastTradePrice || 0.5);
      const noPrice = 1 - yesPrice;
      commonData.outcomes = [
        { name: 'Yes', price: yesPrice, history: generateMarketHistory(yesPrice), color: '#10B981', image: null, rank: 1 },
        { name: 'No', price: noPrice, history: generateMarketHistory(noPrice), color: '#EF4444', image: null, rank: 2 },
      ];
    }

    commonData.outcomes.sort((a, b) => b.price - a.price);
    commonData.outcomes.forEach((outcome, index) => {
      outcome.rank = index + 1;
    });

    commonData.allOutcomes = [...commonData.outcomes];

    const outcomeCount = commonData.outcomes.length;
    const isMultiOutcome = outcomeCount > 2;
    commonData.isMultiOutcome = isMultiOutcome;
    commonData.outcomeCount = outcomeCount;
    commonData.marketType = isMultiOutcome ? 'multi-outcome' : 'binary';

    if (isMultiOutcome && Math.random() < 0.01) {
      console.log(`[Multi-Outcome] Detected: "${commonData.shortTitle}" with ${outcomeCount} outcomes`);
    }

    commonData.outcomes = limitOutcomesForCard(commonData.outcomes);
    return commonData;
  } catch (err) {
    console.error("Error normalizing Polymarket market:", err.message, market);
    return null;
  }
}

/**
 * Get markets by category with smart caching
 * @param {string} category The category to filter by (or 'All' for all markets)
 * @returns {Promise<Array>} Array of market objects
 */
async function getMarketsByCategory(category) {
  const startTime = Date.now();
  try {
    const cached = cacheManager.getMetadata(category);
    if (cached) {
      cacheManager.trackAccess(category);
      const duration = Date.now() - startTime;
      console.log(`[API] Cache hit for ${category}: ${cached.length} markets in ${duration}ms`);
      return cached;
    }

    console.log(`[API] Cache miss for ${category}, fetching from Polymarket...`);
    const maxPages = CONFIG.MAX_PAGES[CONFIG.FETCH_STRATEGY];
    const allMarkets = await fetchPolymarketData(maxPages);

    let filteredMarkets;
    if (category.toLowerCase() === 'all') {
      filteredMarkets = allMarkets;
    } else {
      filteredMarkets = allMarkets.filter(m => m.category.toLowerCase() === category.toLowerCase());
    }

    const topQualityMarkets = filterTopQualityMarkets(filteredMarkets, 600);

    cacheManager.setMetadata(category + '_full', filteredMarkets);
    cacheManager.setMetadata(category, topQualityMarkets);
    cacheManager.trackAccess(category);

    const duration = Date.now() - startTime;
    console.log(`[API] Fetched and cached ${topQualityMarkets.length} top markets (from ${filteredMarkets.length} total) for ${category} in ${duration}ms`);

    return topQualityMarkets;
  } catch (error) {
    console.error(`[API] Error fetching markets for ${category}:`, error.message);
    
    const staleCache = cacheManager.getAllMetadata();
    if (staleCache && staleCache.length > 0) {
      console.log(`[API] Returning stale cache as fallback (${staleCache.length} markets)`);
      if (category.toLowerCase() === 'all') {
        return staleCache;
      } else {
        return staleCache.filter(m => m.category.toLowerCase() === category.toLowerCase());
      }
    }

    console.error(`[API] No fallback cache available for ${category}`);
    return [];
  }
}

/**
 * DEBUG: Log multi-outcome market statistics
 */
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

// ====================================================================
// API ENDPOINTS
// ====================================================================

// Get trending markets
app.get('/api/markets/trending', async (req, res) => {
  const startTime = Date.now();
  console.log('[API] Received request for trending markets');

  try {
    const cached = cacheManager.getMetadata('trending');
    const cacheAge = Date.now() - cacheManager.metadataCache.timestamp;
    const TRENDING_CACHE_TTL = 5 * 60 * 1000;

    if (cached && cacheAge < TRENDING_CACHE_TTL) {
      cacheManager.trackAccess('trending');
      const duration = Date.now() - startTime;
      console.log(`[API] Cache hit for trending: ${cached.length} markets in ${duration}ms (age: ${Math.round(cacheAge / 1000)}s)`);
      return res.json(cached);
    }

    console.log('[API] Cache miss/expired for trending, calculating with custom algorithm...');
    const trendingMarkets = await fetchTrendingMarkets();
    console.log(`[API] Calculated ${trendingMarkets.length} trending markets`);

    cacheManager.setMetadata('trending', trendingMarkets);
    cacheManager.trackAccess('trending');

    const duration = Date.now() - startTime;
    console.log(`[API] Returning ${trendingMarkets.length} trending markets in ${duration}ms (Cache: MISS)`);
    res.json(trendingMarkets);
  } catch (error) {
    console.error('[API] Error fetching trending markets:', error);
    
    const staleCache = cacheManager.getMetadata('trending');
    if (staleCache && staleCache.length > 0) {
      console.log('[API] Returning stale cache as fallback');
      return res.json(staleCache);
    }
    res.status(500).json({ error: 'Failed to fetch trending markets' });
  }
});

// Multi-Outcome Markets endpoint
app.get('/api/markets/multi-outcome', async (req, res) => {
  const startTime = Date.now();
  console.log('[API] Received request for multi-outcome markets');

  try {
    const cached = cacheManager.getMetadata('multi-outcome');
    const cacheAge = Date.now() - cacheManager.metadataCache.timestamp;

    if (cached && cacheAge < CONFIG.CACHE_TTL.METADATA) {
      cacheManager.trackAccess('multi-outcome');
      const duration = Date.now() - startTime;
      console.log(`[API] Cache hit for multi-outcome: ${cached.length} markets in ${duration}ms (age: ${Math.round(cacheAge / 1000)}s)`);
      return res.json(cached);
    }

    console.log('[API] Cache miss/expired for multi-outcome, fetching...');
    const maxPages = CONFIG.MAX_PAGES[CONFIG.FETCH_STRATEGY];
    const allMarkets = await fetchPolymarketData(maxPages);

    const multiOutcomeMarkets = allMarkets.filter(m => m.isMultiOutcome === true);
    console.log(`[API] Found ${multiOutcomeMarkets.length} multi-outcome markets out of ${allMarkets.length} total`);

    const topMarkets = filterTopQualityMarkets(multiOutcomeMarkets, 600);

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

// Search endpoint
app.get('/api/search', async (req, res) => {
  const query = req.query.q;
  const startTime = Date.now();
  console.log(`[API] Search request: "${query}"`);

  if (!query || query.trim().length < 2) {
    return res.status(400).json({ error: 'Search query must be at least 2 characters' });
  }

  try {
    const searchTerm = query.toLowerCase().trim();
    const allMarketsCache = cacheManager.getMetadata('All_full');

    if (allMarketsCache && allMarketsCache.length > 0) {
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

    console.log('[API] No cache for search, fetching fresh data...');
    const maxPages = CONFIG.MAX_PAGES[CONFIG.FETCH_STRATEGY];
    const allMarkets = await fetchPolymarketData(maxPages);

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

// Cache management endpoints
app.post('/api/cache/clear', (req, res) => {
  console.log('[API] Cache clear requested');
  cacheManager.clearAll();
  res.json({ success: true, message: 'Cache cleared successfully' });
});

app.get('/api/cache/stats', (req, res) => {
  const stats = cacheManager.getStats();
  res.json(stats);
});

// Get markets by category
app.get('/api/markets/:category', async (req, res) => {
  const category = req.params.category;
  const startTime = Date.now();
  console.log(`[API] Received request for category: ${category}`);

  try {
    const markets = await getMarketsByCategory(category);
    const duration = Date.now() - startTime;
    const cacheStatus = cacheManager.getMetadata(category) ? 'HIT' : 'MISS';

    console.log(`[API] Returning ${markets.length} markets for ${category} in ${duration}ms (Cache: ${cacheStatus})`);
    res.json(markets);
  } catch (error) {
    console.error(`[API] Error fetching markets for ${category}:`, error);
    res.status(500).json({ error: 'Failed to fetch markets' });
  }
});

// Legacy endpoint
app.get('/api/markets', async (req, res) => {
  console.warn('[API] DEPRECATED: /api/markets endpoint called. Use /api/markets/:category instead');
  console.log('[API] Received request for /api/markets (all)');

  try {
    const allMarkets = await getMarketsByCategory('All');
    console.log(`[API] Returning ${allMarkets.length} markets (legacy endpoint)`);
    res.json(allMarkets);
  } catch (error) {
    console.error('[API] Error fetching markets:', error);
    res.status(500).json({ error: 'Failed to fetch markets' });
  }
});

// Real-time price endpoint for trading
app.get('/api/market/:marketId/live', async (req, res) => {
  const marketId = req.params.marketId;
  const startTime = Date.now();
  console.log(`[API] Real-time price request for market: ${marketId}`);

  try {
    const polymarketId = marketId.replace('poly-', '');
    const url = `https://gamma-api.polymarket.com/markets/${polymarketId}`;
    const marketData = await nativeFetch(url);

    if (!marketData) {
      return res.status(404).json({ error: 'Market not found' });
    }

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

// Cache statistics endpoint
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
// UNIFIED MARKET AGGREGATION API ENDPOINTS
// ====================================================================

// Get unified markets by category
app.get('/api/unified-markets/:category', async (req, res) => {
  const category = req.params.category;
  const startTime = Date.now();
  console.log(`[API] Received request for unified markets in category: ${category}`);

  try {
    const unifiedMarkets = await marketAggregator.getUnifiedMarkets(category);

    let polymarketCount = 0;
    let kalshiCount = 0;
    let bothCount = 0;

    unifiedMarkets.forEach(market => {
      const platforms = Object.keys(market.platforms || {});
      const hasPolymarket = platforms.includes('polymarket');
      const hasKalshi = platforms.includes('kalshi');

      if (hasPolymarket && hasKalshi) {
        bothCount++;
      } else if (hasPolymarket) {
        polymarketCount++;
      } else if (hasKalshi) {
        kalshiCount++;
      }
    });

    const duration = Date.now() - startTime;
    console.log(`[API] Returning ${unifiedMarkets.length} unified markets for ${category} in ${duration}ms`);
    console.log(`[API] Platform distribution: ${polymarketCount} Polymarket, ${kalshiCount} Kalshi, ${bothCount} Both`);

    res.json({
      category,
      markets: unifiedMarkets,
      count: unifiedMarkets.length,
      platformDistribution: {
        polymarket: polymarketCount,
        kalshi: kalshiCount,
        both: bothCount
      },
      timestamp: Date.now(),
      fetchTime: duration
    });
  } catch (error) {
    console.error(`[API] Error fetching unified markets for ${category}:`, error);
    res.status(500).json({ 
      error: 'Failed to fetch unified markets',
      message: error.message 
    });
  }
});

// Get single unified market with full details
app.get('/api/unified-market/:id', async (req, res) => {
  const unifiedId = req.params.id;
  const startTime = Date.now();
  console.log(`[API] Received request for unified market: ${unifiedId}`);

  try {
    const market = await marketAggregator.getUnifiedMarketDetails(unifiedId);

    if (!market) {
      return res.status(404).json({ 
        error: 'Market not found',
        unifiedId 
      });
    }

    const duration = Date.now() - startTime;
    console.log(`[API] Returning unified market ${unifiedId} in ${duration}ms`);

    res.json({
      market,
      timestamp: Date.now(),
      fetchTime: duration
    });
  } catch (error) {
    console.error(`[API] Error fetching unified market ${unifiedId}:`, error);
    res.status(500).json({ 
      error: 'Failed to fetch unified market details',
      message: error.message 
    });
  }
});

// Get arbitrage opportunities
app.get('/api/arbitrage-opportunities', async (req, res) => {
  const startTime = Date.now();
  console.log('[API] Received request for arbitrage opportunities');

  try {
    const opportunities = await marketAggregator.findArbitrageOpportunities();
    opportunities.sort((a, b) => b.arbitrage.profit_pct - a.arbitrage.profit_pct);

    const duration = Date.now() - startTime;
    console.log(`[API] Returning ${opportunities.length} arbitrage opportunities in ${duration}ms`);

    res.json({
      opportunities,
      count: opportunities.length,
      timestamp: Date.now(),
      fetchTime: duration
    });
  } catch (error) {
    console.error('[API] Error fetching arbitrage opportunities:', error);
    res.status(500).json({ 
      error: 'Failed to fetch arbitrage opportunities',
      message: error.message 
    });
  }
});

// Get platform health status
app.get('/api/platform-health', async (req, res) => {
  const startTime = Date.now();
  console.log('[API] Received request for platform health');

  try {
    const health = cacheManager.getAllPlatformHealth();
    const duration = Date.now() - startTime;
    console.log(`[API] Returning platform health in ${duration}ms`);

    res.json({
      platforms: health,
      timestamp: Date.now(),
      fetchTime: duration
    });
  } catch (error) {
    console.error('[API] Error fetching platform health:', error);
    res.status(500).json({ 
      error: 'Failed to fetch platform health',
      message: error.message 
    });
  }
});

// Get polling statistics
app.get('/api/polling-stats', async (req, res) => {
  const startTime = Date.now();
  console.log('[API] Received request for polling statistics');

  try {
    const stats = pollingService.getStats();
    const duration = Date.now() - startTime;
    console.log(`[API] Returning polling stats in ${duration}ms`);

    res.json({
      stats,
      timestamp: Date.now(),
      fetchTime: duration
    });
  } catch (error) {
    console.error('[API] Error fetching polling stats:', error);
    res.status(500).json({ 
      error: 'Failed to fetch polling statistics',
      message: error.message 
    });
  }
});

// Get staleness status
app.get('/api/staleness-status', async (req, res) => {
  const startTime = Date.now();
  console.log('[API] Received request for staleness status');

  try {
    const status = pollingService.getStalenessStatus();
    const duration = Date.now() - startTime;
    console.log(`[API] Returning staleness status in ${duration}ms`);

    res.json({
      status,
      timestamp: Date.now(),
      fetchTime: duration
    });
  } catch (error) {
    console.error('[API] Error fetching staleness status:', error);
    res.status(500).json({ 
      error: 'Failed to fetch staleness status',
      message: error.message 
    });
  }
});

// ====================================================================
// SERVE FRONTEND STATIC FILES
// ====================================================================

// Serve static files from the frontend/dist directory
const frontendDistPath = path.join(__dirname, '..', 'frontend', 'dist');
app.use(express.static(frontendDistPath));

// Serve index.html for all non-API routes (SPA support)
app.get('*', (req, res) => {
  // Skip API routes
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'API endpoint not found' });
  }
  
  res.sendFile(path.join(frontendDistPath, 'index.html'));
});

console.log('[Server] Static file serving configured for:', frontendDistPath);

// ====================================================================
// GRACEFUL SHUTDOWN
// ====================================================================

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('[Server] SIGTERM received, shutting down gracefully...');
  
  // Stop polling service
  pollingService.stop();
  
  // Clear cleanup interval
  clearInterval(cleanupInterval);
  
  // Log final cache statistics
  const finalStats = cacheManager.getStats();
  console.log('[Cache] Final statistics:', JSON.stringify(finalStats, null, 2));
  
  // Log final polling statistics
  const finalPollingStats = pollingService.getStats();
  console.log('[PollingService] Final statistics:', JSON.stringify(finalPollingStats, null, 2));
  
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('[Server] SIGINT received, shutting down gracefully...');
  
  // Stop polling service
  pollingService.stop();
  
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
