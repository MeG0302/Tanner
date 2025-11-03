/**
 * KalshiFetcher - Kalshi API integration
 * 
 * Handles authentication, rate limiting, and data fetching from Kalshi API.
 * Implements exponential backoff retry and normalizes data to unified schema.
 * 
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 2.1, 2.2, 2.3, 2.4, 2.5
 */

const https = require('https');

class KalshiFetcher {
  constructor(apiEndpoint, apiKey, cacheManager) {
    this.apiEndpoint = apiEndpoint || 'https://api.elections.kalshi.com/trade-api/v2';
    this.apiKey = apiKey || process.env.KALSHI_API_KEY;
    this.cache = cacheManager;
    this.rateLimit = 50; // requests per minute
    this.requestQueue = [];
    this.authToken = null;
    this.tokenExpiration = null;
    this.healthStatus = {
      status: 'healthy',
      lastAttempt: null,
      lastError: null,
      lastSuccessfulFetch: null
    };
    
    console.log('[KalshiFetcher] Initialized with endpoint:', this.apiEndpoint);
  }
  
  /**
   * Authenticate with Kalshi API and obtain auth token
   * @returns {Promise<string>} Authentication token
   */
  async authenticate() {
    try {
      console.log('[KalshiFetcher] Authenticating with Kalshi API...');
      
      // Check if we have a valid token
      if (this.authToken && this.tokenExpiration && Date.now() < this.tokenExpiration) {
        console.log('[KalshiFetcher] Using cached auth token');
        return this.authToken;
      }
      
      // Check if API key is available
      if (!this.apiKey) {
        console.warn('[KalshiFetcher] No API key provided, skipping authentication');
        return null;
      }
      
      // For now, we'll use the API key directly in headers
      // Kalshi API uses API key authentication in the Authorization header
      this.authToken = this.apiKey;
      // Set expiration to 1 hour from now
      this.tokenExpiration = Date.now() + (60 * 60 * 1000);
      
      console.log('[KalshiFetcher] Authentication successful');
      return this.authToken;
      
    } catch (error) {
      console.error('[KalshiFetcher] Authentication failed:', error.message);
      this.updateHealthStatus('degraded', error);
      throw error;
    }
  }
  
  /**
   * Fetch markets from Kalshi with authentication and rate limiting
   * @param {Object} options Fetch options (limit, status, etc.)
   * @returns {Promise<Array>} Array of raw Kalshi markets
   */
  async fetchMarkets(options = {}) {
    try {
      console.log('[KalshiFetcher] Fetching markets...');
      
      // Authenticate first
      await this.authenticate();
      
      // Apply rate limiting
      await this.throttle();
      
      // Build URL with query parameters
      const params = new URLSearchParams({
        status: options.status || 'open',
        limit: options.limit || 500,
        ...options
      });
      
      const url = `${this.apiEndpoint}/markets?${params.toString()}`;
      console.log('[KalshiFetcher] Fetching from:', url);
      
      // Fetch with retry logic
      const data = await this.fetchWithRetry(url);
      
      if (!data || !Array.isArray(data.markets)) {
        console.error('[KalshiFetcher] Invalid response structure:', data);
        throw new Error('Invalid Kalshi markets response structure');
      }
      
      console.log(`[KalshiFetcher] Fetched ${data.markets.length} markets`);
      this.updateHealthStatus('healthy');
      
      // Log request/response for debugging
      this.logRequest('fetchMarkets', url, data.markets.length);
      
      return data.markets;
      
    } catch (error) {
      console.error('[KalshiFetcher] Failed to fetch markets:', error.message);
      this.updateHealthStatus('degraded', error);
      throw error;
    }
  }
  
  /**
   * Fetch detailed market data for a specific market
   * @param {string} marketId Kalshi market ticker
   * @returns {Promise<Object>} Detailed market data
   */
  async fetchMarketDetails(marketId) {
    try {
      console.log(`[KalshiFetcher] Fetching details for market: ${marketId}`);
      
      // Authenticate first
      await this.authenticate();
      
      // Apply rate limiting
      await this.throttle();
      
      const url = `${this.apiEndpoint}/markets/${marketId}`;
      
      // Fetch with retry logic
      const data = await this.fetchWithRetry(url);
      
      if (!data || !data.market) {
        console.error('[KalshiFetcher] Invalid market details response:', data);
        throw new Error('Invalid Kalshi market details response');
      }
      
      console.log(`[KalshiFetcher] Fetched details for ${marketId}`);
      this.updateHealthStatus('healthy');
      
      // Log request/response
      this.logRequest('fetchMarketDetails', url, 1);
      
      return data.market;
      
    } catch (error) {
      console.error(`[KalshiFetcher] Failed to fetch market details for ${marketId}:`, error.message);
      this.updateHealthStatus('degraded', error);
      throw error;
    }
  }
  
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
        // Use native fetch with authentication headers
        const data = await this.nativeFetchWithAuth(url);
        this.updateHealthStatus('healthy');
        return data;
        
      } catch (error) {
        lastError = error;
        console.error(`[KalshiFetcher] Fetch attempt ${attempt}/${maxRetries} failed:`, error.message);
        
        if (attempt < maxRetries) {
          // Exponential backoff: 2^attempt * 1000ms
          const delay = Math.pow(2, attempt) * 1000;
          console.log(`[KalshiFetcher] Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    // All retries failed
    this.updateHealthStatus('degraded', lastError);
    throw new Error(`Failed to fetch from Kalshi after ${maxRetries} attempts: ${lastError.message}`);
  }
  
  /**
   * Native fetch with Kalshi authentication headers
   * @param {string} url URL to fetch
   * @returns {Promise<any>} Parsed JSON response
   */
  async nativeFetchWithAuth(url) {
    return new Promise((resolve, reject) => {
      const urlObj = new URL(url);
      const options = {
        hostname: urlObj.hostname,
        port: urlObj.port || 443,
        path: urlObj.pathname + urlObj.search,
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      };
      
      // Add authentication header if we have a token
      if (this.authToken) {
        options.headers['Authorization'] = `Bearer ${this.authToken}`;
      }
      
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
              console.error(`[KalshiFetcher] JSON Parse Error: ${e.message}. Raw data: ${data.substring(0, 500)}...`);
              reject(new Error(`Failed to parse JSON response. Status: ${res.statusCode}`));
            }
          } else {
            console.error(`[KalshiFetcher] HTTP Error: Status ${res.statusCode}. Raw data: ${data.substring(0, 500)}...`);
            reject(new Error(`HTTP Error Status: ${res.statusCode} for ${url}`));
          }
        });
      });
      
      req.on('error', (err) => {
        reject(new Error(`Kalshi Fetch Error: ${err.message}`));
      });
      
      req.end();
    });
  }
  
  /**
   * Rate limiting throttle (50 requests per minute)
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
      
      console.log(`[KalshiFetcher] Rate limit reached (${this.rateLimit}/min), waiting ${waitTime}ms...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
      
      // Remove the oldest request after waiting
      this.requestQueue.shift();
    }
    
    // Add current request to queue
    this.requestQueue.push(now);
  }
  
  /**
   * Normalize Kalshi market to unified schema
   * Note: This method requires helper functions from server.js
   * (cleanMarketTitle, getAdvancedCategory, optimizeTitle, generateMarketHistory)
   * 
   * @param {Object} rawMarket Raw Kalshi market object
   * @returns {Object} Normalized market object
   */
  normalizeMarket(rawMarket, helpers = {}) {
    try {
      const { cleanMarketTitle, getAdvancedCategory, optimizeTitle, generateMarketHistory } = helpers;
      
      // Extract question from title or subtitle
      const rawTitle = rawMarket.title || rawMarket.subtitle || rawMarket.ticker_name;
      const cleanedTitle = cleanMarketTitle ? cleanMarketTitle(rawTitle) : rawTitle;
      
      // Extract category from Kalshi metadata
      const category = getAdvancedCategory ? getAdvancedCategory(cleanedTitle, rawMarket.category) : 'Other';
      
      // Convert Kalshi prices (cents) to decimal format (0.00-1.00)
      const yesPrice = (rawMarket.yes_ask || rawMarket.yes_bid || 50) / 100.0;
      const noPrice = (rawMarket.no_ask || rawMarket.no_bid || 50) / 100.0;
      
      // Extract volume and convert to USD
      const volume = parseFloat(rawMarket.volume || rawMarket.volume_24h || 0);
      
      // Extract liquidity
      const liquidity = parseFloat(rawMarket.open_interest || rawMarket.liquidity || 0);
      
      return {
        id: `kalshi-${rawMarket.ticker_name || rawMarket.ticker}`,
        title: cleanedTitle,
        shortTitle: optimizeTitle ? optimizeTitle(rawTitle) : rawTitle,
        platform: 'Kalshi',
        category: category,
        volume_24h: volume,
        liquidity: liquidity,
        outcomes: [
          { 
            name: 'Yes', 
            price: yesPrice, 
            history: generateMarketHistory ? generateMarketHistory(yesPrice) : [], 
            color: '#10B981', 
            image: null,
            rank: 1
          },
          { 
            name: 'No', 
            price: noPrice, 
            history: generateMarketHistory ? generateMarketHistory(noPrice) : [], 
            color: '#EF4444', 
            image: null,
            rank: 2
          },
        ],
        closed: rawMarket.status === 'closed' || rawMarket.status === 'settled',
        resolved: rawMarket.status === 'settled',
        endDate: rawMarket.close_time || rawMarket.expiration_time || null,
        startDate: rawMarket.open_time || null,
        // Additional Kalshi-specific metadata
        kalshiUrl: rawMarket.ticker_name ? `https://kalshi.com/markets/${rawMarket.ticker_name}` : null,
        isMultiOutcome: false,
        outcomeCount: 2,
        marketType: 'binary'
      };
      
    } catch (error) {
      console.error('[KalshiFetcher] Error normalizing market:', error.message, rawMarket);
      return null;
    }
  }
  
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
      this.cache.updatePlatformHealth('kalshi', status, error);
    }
  }
  
  /**
   * Log request for debugging
   * @param {string} method Method name
   * @param {string} url Request URL
   * @param {number} resultCount Number of results
   */
  logRequest(method, url, resultCount) {
    console.log(`[KalshiFetcher] ${method}: ${url} -> ${resultCount} results`);
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
module.exports = KalshiFetcher;
