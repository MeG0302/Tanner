/**
 * PolymarketFetcher - Polymarket API integration
 * 
 * This class handles fetching and normalizing market data from the Polymarket Gamma API.
 * 
 * Key responsibilities:
 * 1. Fetch markets from Polymarket with pagination support
 * 2. Rate limiting (100 requests per minute)
 * 3. Error handling with exponential backoff retry
 * 4. Data normalization to unified schema
 * 
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 2.1, 2.2, 2.3, 2.4, 2.5
 */

const https = require('https');

class PolymarketFetcher {
  constructor(apiEndpoint, cacheManager) {
    this.apiEndpoint = apiEndpoint || 'https://gamma-api.polymarket.com';
    this.cache = cacheManager;
    this.rateLimit = 100; // requests per minute
    this.requestQueue = [];
    this.healthStatus = {
      status: 'healthy',
      lastAttempt: null,
      lastError: null,
      lastSuccessfulFetch: null
    };
    
    console.log('[PolymarketFetcher] Initialized with endpoint:', this.apiEndpoint);
  }
  
  // ====================================================================
  // MARKET FETCHING (Task 19.2 - Requirements 1.2, 1.3, 1.5)
  // ====================================================================
  
  /**
   * Fetch markets from Polymarket with pagination support
   * @param {Object} options Fetch options (limit, offset, active, closed, etc.)
   * @returns {Promise<Array>} Array of raw Polymarket markets
   */
  async fetchMarkets(options = {}) {
    try {
      console.log('[PolymarketFetcher] Fetching markets...');
      
      const limit = options.limit || 1000;
      const maxPages = options.maxPages || 10;
      let allMarkets = [];
      let pagesFetched = 0;
      let offset = options.offset || 0;
      
      // Fetch pages up to maxPages limit
      while (pagesFetched < maxPages) {
        // Apply rate limiting
        await this.throttle();
        
        // Build URL with query parameters
        const params = new URLSearchParams({
          active: options.active !== undefined ? options.active : true,
          closed: options.closed !== undefined ? options.closed : false,
          limit: limit,
          offset: offset
        });
        
        const url = `${this.apiEndpoint}/markets?${params.toString()}`;
        console.log(`[PolymarketFetcher] Fetching page ${pagesFetched + 1}/${maxPages} at offset ${offset}...`);
        
        // Fetch with retry logic
        const data = await this.fetchWithRetry(url);
        
        // Polymarket returns markets directly as an array
        const marketArray = Array.isArray(data) ? data : [];
        
        if (marketArray.length === 0) {
          console.log(`[PolymarketFetcher] Reached last page (no more markets)`);
          break;
        }
        
        console.log(`[PolymarketFetcher] Fetched ${marketArray.length} markets at offset ${offset}`);
        
        // Add to collection
        allMarkets = allMarkets.concat(marketArray);
        
        // Update offset for next page
        offset += limit;
        pagesFetched++;
        
        // If we got fewer markets than the limit, we've reached the end
        if (marketArray.length < limit) {
          console.log(`[PolymarketFetcher] Got ${marketArray.length} markets (less than ${limit}), stopping pagination`);
          break;
        }
      }
      
      console.log(`[PolymarketFetcher] Total fetched: ${allMarkets.length} markets from ${pagesFetched} page(s)`);
      this.updateHealthStatus('healthy');
      
      // Log request/response for debugging
      this.logRequest('fetchMarkets', allMarkets.length);
      
      return allMarkets;
      
    } catch (error) {
      console.error('[PolymarketFetcher] Failed to fetch markets:', error.message);
      this.updateHealthStatus('degraded', error);
      throw error;
    }
  }
  
  /**
   * Fetch detailed market data for a specific market
   * @param {string} marketId Polymarket market ID
   * @returns {Promise<Object>} Detailed market data
   */
  async fetchMarketDetails(marketId) {
    try {
      console.log(`[PolymarketFetcher] Fetching details for market: ${marketId}`);
      
      // Apply rate limiting
      await this.throttle();
      
      const url = `${this.apiEndpoint}/markets/${marketId}`;
      
      // Fetch with retry logic
      const data = await this.fetchWithRetry(url);
      
      if (!data) {
        console.error('[PolymarketFetcher] Invalid market details response:', data);
        throw new Error('Invalid Polymarket market details response');
      }
      
      console.log(`[PolymarketFetcher] Fetched details for ${marketId}`);
      this.updateHealthStatus('healthy');
      
      // Log request/response
      this.logRequest('fetchMarketDetails', 1);
      
      return data;
      
    } catch (error) {
      console.error(`[PolymarketFetcher] Failed to fetch market details for ${marketId}:`, error.message);
      this.updateHealthStatus('degraded', error);
      throw error;
    }
  }
  
  // ====================================================================
  // ERROR HANDLING & RETRY (Task 19.1 - Requirements 1.3)
  // ====================================================================
  
  /**
   * Fetch with exponential backoff retry
   * @param {string} url URL to fetch
   * @param {number} maxRetries Maximum number of retry attempts
   * @returns {Promise<any>} Parsed JSON response
   */
  async fetchWithRetry(url, maxRetries = 3) {
    let lastError;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const data = await this.nativeFetch(url);
        this.updateHealthStatus('healthy');
        return data;
        
      } catch (error) {
        lastError = error;
        console.error(`[PolymarketFetcher] Fetch attempt ${attempt}/${maxRetries} failed:`, error.message);
        
        if (attempt < maxRetries) {
          // Exponential backoff: 2^attempt * 1000ms
          const delay = Math.pow(2, attempt) * 1000;
          console.log(`[PolymarketFetcher] Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    // All retries failed
    this.updateHealthStatus('degraded', lastError);
    throw new Error(`Failed to fetch from Polymarket after ${maxRetries} attempts: ${lastError.message}`);
  }
  
  /**
   * Native fetch using Node's https module
   * @param {string} url URL to fetch
   * @returns {Promise<any>} Parsed JSON response
   */
  async nativeFetch(url) {
    return new Promise((resolve, reject) => {
      const urlObj = new URL(url);
      const options = {
        hostname: urlObj.hostname,
        port: urlObj.port || 443,
        path: urlObj.pathname + urlObj.search,
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'User-Agent': 'Tanner.xyz-Aggregator/1.0'
        }
      };
      
      const req = https.request(options, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            try {
              resolve(JSON.parse(data));
            } catch (e) {
              console.error(`[PolymarketFetcher] JSON Parse Error: ${e.message}. Raw data: ${data.substring(0, 500)}...`);
              reject(new Error(`Failed to parse JSON response. Status: ${res.statusCode}`));
            }
          } else {
            console.error(`[PolymarketFetcher] HTTP Error: Status ${res.statusCode}. Raw data: ${data.substring(0, 500)}...`);
            reject(new Error(`HTTP Error Status: ${res.statusCode} for ${url}`));
          }
        });
      });
      
      req.on('error', (err) => {
        reject(new Error(`Polymarket Fetch Error: ${err.message}`));
      });
      
      req.end();
    });
  }
  
  // ====================================================================
  // RATE LIMITING (Task 19.1 - Requirements 1.5)
  // ====================================================================
  
  /**
   * Rate limiting throttle (100 requests per minute)
   * @returns {Promise<void>}
   */
  async throttle() {
    const now = Date.now();
    const oneMinute = 60 * 1000;
    
    // Remove requests older than 1 minute
    this.requestQueue = this.requestQueue.filter(time => now - time < oneMinute);
    
    // Check if we've hit the rate limit
    if (this.requestQueue.length >= this.rateLimit) {
      // Calculate wait time until oldest request expires
      const oldestRequest = this.requestQueue[0];
      const waitTime = oneMinute - (now - oldestRequest);
      
      console.log(`[PolymarketFetcher] Rate limit reached (${this.rateLimit}/min), waiting ${waitTime}ms...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
      
      // Remove the oldest request after waiting
      this.requestQueue.shift();
    }
    
    // Add current request to queue
    this.requestQueue.push(now);
  }

  
  // ====================================================================
  // DATA NORMALIZATION (Task 19.3 - Requirements 2.1-2.5)
  // ====================================================================
  
  /**
   * Normalize Polymarket market to unified schema
   * Converts Polymarket format to standardized format with:
   * - question, outcomes, volume, liquidity
   * - prices in 0.00-1.00 decimal format
   * - category extraction
   * - multi-outcome market support
   * 
   * @param {Object} rawMarket Raw Polymarket market object
   * @returns {Object} Normalized market object
   */
  normalizeMarket(rawMarket) {
    try {
      // Extract question
      const question = rawMarket.question || rawMarket.title || '';
      
      if (!question) {
        console.warn('[PolymarketFetcher] Market missing question, skipping');
        return null;
      }
      
      // Extract category from Polymarket metadata
      const category = this.extractCategory(rawMarket);
      
      // Extract volume and convert to USD
      const volume = this.extractVolume(rawMarket);
      
      // Extract liquidity
      const liquidity = this.extractLiquidity(rawMarket);
      
      // Extract and normalize outcomes
      const outcomes = this.extractOutcomes(rawMarket);
      
      if (!outcomes || outcomes.length === 0) {
        console.warn('[PolymarketFetcher] Market has no valid outcomes, skipping');
        return null;
      }
      
      // Determine if multi-outcome market
      const isMultiOutcome = outcomes.length > 2;
      
      // Build normalized market object
      const normalized = {
        id: `poly-${rawMarket.id || rawMarket.condition_id}`,
        platform: 'polymarket',
        question: question,
        outcomes: outcomes,
        volume_24h: volume,
        liquidity: liquidity,
        endDate: rawMarket.end_date_iso || rawMarket.endDate || null,
        category: category,
        image: rawMarket.image || rawMarket.icon || null,
        orderbook: null, // Orderbook data would be fetched separately if needed
        spread: this.calculateSpread(outcomes),
        lastUpdate: Date.now(),
        // Additional metadata
        closed: rawMarket.closed || false,
        resolved: rawMarket.resolved || false,
        isMultiOutcome: isMultiOutcome,
        outcomeCount: outcomes.length,
        marketType: isMultiOutcome ? 'multi-outcome' : 'binary'
      };
      
      return normalized;
      
    } catch (error) {
      console.error('[PolymarketFetcher] Error normalizing market:', error.message, rawMarket);
      return null;
    }
  }
  
  /**
   * Extract category from Polymarket market data
   * @param {Object} rawMarket Raw market object
   * @returns {string} Category name
   */
  extractCategory(rawMarket) {
    // Try to get category from various fields
    if (rawMarket.category) {
      return rawMarket.category;
    }
    
    if (rawMarket.tags && Array.isArray(rawMarket.tags) && rawMarket.tags.length > 0) {
      return rawMarket.tags[0];
    }
    
    // Try to infer category from question
    const question = (rawMarket.question || '').toLowerCase();
    
    if (question.includes('election') || question.includes('president') || question.includes('senate')) {
      return 'Politics';
    }
    if (question.includes('crypto') || question.includes('bitcoin') || question.includes('ethereum')) {
      return 'Crypto';
    }
    if (question.includes('sports') || question.includes('nfl') || question.includes('nba')) {
      return 'Sports';
    }
    if (question.includes('economy') || question.includes('gdp') || question.includes('inflation')) {
      return 'Economics';
    }
    
    return 'Other';
  }
  
  /**
   * Extract volume from Polymarket market data
   * @param {Object} rawMarket Raw market object
   * @returns {number} Volume in USD
   */
  extractVolume(rawMarket) {
    // Try multiple field names that Polymarket uses
    const volume = parseFloat(
      rawMarket.volume || 
      rawMarket.volume24hr || 
      rawMarket.volume_24h ||
      rawMarket.volumeNum ||
      0
    );
    
    return volume;
  }
  
  /**
   * Extract liquidity from Polymarket market data
   * @param {Object} rawMarket Raw market object
   * @returns {number} Liquidity in USD
   */
  extractLiquidity(rawMarket) {
    const liquidity = parseFloat(
      rawMarket.liquidity || 
      rawMarket.liquidityNum ||
      rawMarket.open_interest ||
      0
    );
    
    return liquidity;
  }
  
  /**
   * Extract and normalize outcomes from Polymarket market data
   * Handles both binary and multi-outcome markets
   * Converts prices to 0.00-1.00 decimal format
   * 
   * @param {Object} rawMarket Raw market object
   * @returns {Array} Array of normalized outcome objects
   */
  extractOutcomes(rawMarket) {
    const outcomes = [];
    
    // Check if this is a multi-outcome market (has tokens array)
    if (rawMarket.tokens && Array.isArray(rawMarket.tokens) && rawMarket.tokens.length > 0) {
      // Multi-outcome market
      rawMarket.tokens.forEach((token, index) => {
        const price = this.normalizePrice(token.price);
        
        outcomes.push({
          name: token.outcome || token.token_id || `Outcome ${index + 1}`,
          price: price,
          volume: parseFloat(token.volume || 0),
          image: token.image || null,
          rank: index + 1
        });
      });
    } else {
      // Binary market - create Yes/No outcomes
      // Polymarket typically provides outcome_prices array or individual price fields
      const yesPrice = this.normalizePrice(
        rawMarket.outcome_prices?.[0] || 
        rawMarket.yes_price || 
        rawMarket.price ||
        0.5
      );
      
      const noPrice = this.normalizePrice(
        rawMarket.outcome_prices?.[1] || 
        rawMarket.no_price ||
        (1 - yesPrice)
      );
      
      outcomes.push(
        {
          name: 'Yes',
          price: yesPrice,
          volume: this.extractVolume(rawMarket) / 2, // Split volume between outcomes
          image: null,
          rank: 1
        },
        {
          name: 'No',
          price: noPrice,
          volume: this.extractVolume(rawMarket) / 2,
          image: null,
          rank: 2
        }
      );
    }
    
    return outcomes;
  }
  
  /**
   * Normalize price to 0.00-1.00 decimal format
   * Handles various price formats (decimal, percentage, cents)
   * 
   * @param {number|string} price Raw price value
   * @returns {number} Normalized price (0.00-1.00)
   */
  normalizePrice(price) {
    if (price === null || price === undefined) {
      return 0.5; // Default to 50% if no price available
    }
    
    let numPrice = parseFloat(price);
    
    if (isNaN(numPrice)) {
      return 0.5;
    }
    
    // If price is greater than 1, assume it's in cents or percentage
    if (numPrice > 1) {
      numPrice = numPrice / 100;
    }
    
    // Clamp to 0-1 range
    return Math.max(0, Math.min(1, numPrice));
  }
  
  /**
   * Calculate spread from outcomes
   * For binary markets, spread is the difference between Yes and No prices
   * For multi-outcome markets, use average spread across outcomes
   * 
   * @param {Array} outcomes Array of outcome objects
   * @returns {number} Spread value
   */
  calculateSpread(outcomes) {
    if (!outcomes || outcomes.length === 0) {
      return 0.1; // Default 10% spread
    }
    
    if (outcomes.length === 2) {
      // Binary market - simple spread calculation
      const yesPrice = outcomes[0].price;
      const noPrice = outcomes[1].price;
      
      // Spread is how far the sum is from 1.0
      const sum = yesPrice + noPrice;
      return Math.abs(1 - sum);
    } else {
      // Multi-outcome market - use average deviation from fair price
      const fairPrice = 1 / outcomes.length;
      const avgDeviation = outcomes.reduce((sum, outcome) => {
        return sum + Math.abs(outcome.price - fairPrice);
      }, 0) / outcomes.length;
      
      return avgDeviation;
    }
  }
  
  // ====================================================================
  // HEALTH & LOGGING (Task 19.1)
  // ====================================================================
  
  /**
   * Update health status
   * @param {string} status 'healthy' or 'degraded'
   * @param {Error} error Optional error object
   */
  updateHealthStatus(status, error = null) {
    this.healthStatus = {
      status,
      lastAttempt: Date.now(),
      lastError: error ? error.message : null,
      lastSuccessfulFetch: status === 'healthy' ? Date.now() : this.healthStatus.lastSuccessfulFetch
    };
    
    // Update cache manager's platform health if available
    if (this.cache && this.cache.updatePlatformHealth) {
      this.cache.updatePlatformHealth('polymarket', status, error);
    }
  }
  
  /**
   * Log request for debugging
   * @param {string} method Method name
   * @param {number} resultCount Number of results
   */
  logRequest(method, resultCount) {
    console.log(`[PolymarketFetcher] ${method}: ${resultCount} results`);
  }
  
  /**
   * Get health status
   * @returns {Object} Health status object
   */
  getHealthStatus() {
    return {
      ...this.healthStatus,
      timeSinceLastSuccess: this.healthStatus.lastSuccessfulFetch 
        ? Date.now() - this.healthStatus.lastSuccessfulFetch 
        : null
    };
  }
}

// Export for use in server
module.exports = PolymarketFetcher;
