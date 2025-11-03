/**
 * PollingService - Real-time data synchronization service
 * 
 * This service manages polling intervals for different platforms:
 * - Polymarket: 5 seconds (fast updates)
 * - Kalshi: 10 seconds (respects rate limits)
 * 
 * Automatically updates unified markets when platform data changes
 * and tracks platform health for staleness warnings.
 * 
 * Requirements: 11.1, 11.2, 11.3, 11.4, 11.5
 */

class PollingService {
  constructor(marketAggregator, cacheManager) {
    this.marketAggregator = marketAggregator;
    this.cache = cacheManager;
    
    // Polling intervals
    this.polymarketInterval = null;
    this.kalshiInterval = null;
    
    // Polling configuration
    this.config = {
      polymarket: {
        interval: 5000,  // 5 seconds
        enabled: true
      },
      kalshi: {
        interval: 10000, // 10 seconds
        enabled: true
      }
    };
    
    // Track last fetch times
    this.lastFetch = {
      polymarket: null,
      kalshi: null
    };
    
    // Track polling statistics
    this.stats = {
      polymarket: {
        totalPolls: 0,
        successfulPolls: 0,
        failedPolls: 0,
        lastError: null
      },
      kalshi: {
        totalPolls: 0,
        successfulPolls: 0,
        failedPolls: 0,
        lastError: null
      }
    };
    
    console.log('[PollingService] Initialized with intervals: Polymarket=5s, Kalshi=10s');
  }
  
  // ====================================================================
  // POLLING CONTROL (Task 12.1 - Requirements 11.1, 11.2)
  // ====================================================================
  
  /**
   * Start polling for all platforms
   */
  start() {
    console.log('[PollingService] Starting polling service...');
    
    // Start Polymarket polling (5 seconds)
    if (this.config.polymarket.enabled) {
      this.startPolymarketPolling();
    }
    
    // Start Kalshi polling (10 seconds)
    if (this.config.kalshi.enabled) {
      this.startKalshiPolling();
    }
    
    console.log('[PollingService] Polling service started');
  }
  
  /**
   * Stop polling for all platforms
   * Handles cleanup on component unmount
   */
  stop() {
    console.log('[PollingService] Stopping polling service...');
    
    // Clear Polymarket interval
    if (this.polymarketInterval) {
      clearInterval(this.polymarketInterval);
      this.polymarketInterval = null;
      console.log('[PollingService] Polymarket polling stopped');
    }
    
    // Clear Kalshi interval
    if (this.kalshiInterval) {
      clearInterval(this.kalshiInterval);
      this.kalshiInterval = null;
      console.log('[PollingService] Kalshi polling stopped');
    }
    
    console.log('[PollingService] Polling service stopped');
  }
  
  /**
   * Start Polymarket polling (5 second interval)
   */
  startPolymarketPolling() {
    console.log('[PollingService] Starting Polymarket polling (5s interval)');
    
    // Initial fetch
    this.pollPolymarket();
    
    // Set up interval
    this.polymarketInterval = setInterval(() => {
      this.pollPolymarket();
    }, this.config.polymarket.interval);
  }
  
  /**
   * Start Kalshi polling (10 second interval)
   */
  startKalshiPolling() {
    console.log('[PollingService] Starting Kalshi polling (10s interval)');
    
    // Initial fetch
    this.pollKalshi();
    
    // Set up interval
    this.kalshiInterval = setInterval(() => {
      this.pollKalshi();
    }, this.config.kalshi.interval);
  }
  
  // ====================================================================
  // POLLING EXECUTION (Task 12.2 - Requirements 11.3)
  // ====================================================================
  
  /**
   * Poll Polymarket for updated market data
   */
  async pollPolymarket() {
    const startTime = Date.now();
    this.stats.polymarket.totalPolls++;
    
    try {
      console.log('[PollingService] Polling Polymarket...');
      
      // Fetch markets from Polymarket
      const markets = await this.marketAggregator.fetchPolymarketMarkets();
      
      // Update last fetch time
      this.lastFetch.polymarket = Date.now();
      
      // Update platform health
      this.cache.updatePlatformHealth('polymarket', 'healthy');
      
      // Update statistics
      this.stats.polymarket.successfulPolls++;
      this.stats.polymarket.lastError = null;
      
      // Compare with cached data and update if changed
      await this.updateCachedMarkets('polymarket', markets);
      
      const duration = Date.now() - startTime;
      console.log(`[PollingService] Polymarket poll complete in ${duration}ms (${markets.length} markets)`);
      
    } catch (error) {
      console.error('[PollingService] Polymarket poll failed:', error.message);
      
      // Update platform health
      this.cache.updatePlatformHealth('polymarket', 'degraded', error);
      
      // Update statistics
      this.stats.polymarket.failedPolls++;
      this.stats.polymarket.lastError = error.message;
    }
  }
  
  /**
   * Poll Kalshi for updated market data
   */
  async pollKalshi() {
    const startTime = Date.now();
    this.stats.kalshi.totalPolls++;
    
    try {
      console.log('[PollingService] Polling Kalshi...');
      
      // Fetch markets from Kalshi
      const markets = await this.marketAggregator.fetchKalshiMarkets();
      
      // Update last fetch time
      this.lastFetch.kalshi = Date.now();
      
      // Update platform health
      this.cache.updatePlatformHealth('kalshi', 'healthy');
      
      // Update statistics
      this.stats.kalshi.successfulPolls++;
      this.stats.kalshi.lastError = null;
      
      // Compare with cached data and update if changed
      await this.updateCachedMarkets('kalshi', markets);
      
      const duration = Date.now() - startTime;
      console.log(`[PollingService] Kalshi poll complete in ${duration}ms (${markets.length} markets)`);
      
    } catch (error) {
      console.error('[PollingService] Kalshi poll failed:', error.message);
      
      // Update platform health
      this.cache.updatePlatformHealth('kalshi', 'degraded', error);
      
      // Update statistics
      this.stats.kalshi.failedPolls++;
      this.stats.kalshi.lastError = error.message;
    }
  }
  
  /**
   * Update cached markets with new data
   * Compares new data with cached data and updates only changed markets
   * Triggers re-render on price changes
   * 
   * @param {string} platform Platform name ('polymarket' or 'kalshi')
   * @param {Array} newMarkets Array of new market data
   */
  async updateCachedMarkets(platform, newMarkets) {
    try {
      console.log(`[PollingService] Updating cached markets for ${platform}...`);
      
      // Get all unified markets from cache
      const cachedUnifiedMarkets = this.cache.getAllUnifiedMarkets();
      
      if (cachedUnifiedMarkets.length === 0) {
        console.log('[PollingService] No cached unified markets to update');
        return;
      }
      
      let updatedCount = 0;
      
      // Update each unified market with new platform data
      for (const unifiedMarket of cachedUnifiedMarkets) {
        // Check if this unified market has data from the current platform
        if (!unifiedMarket.platforms[platform]) {
          continue;
        }
        
        // Find the corresponding new market data
        const platformMarketId = unifiedMarket.platforms[platform].id;
        const newMarket = newMarkets.find(m => m.id === platformMarketId);
        
        if (!newMarket) {
          console.log(`[PollingService] Market ${platformMarketId} not found in new data`);
          continue;
        }
        
        // Compare prices to detect changes
        const hasChanged = this.hasMarketChanged(
          unifiedMarket.platforms[platform],
          newMarket
        );
        
        if (hasChanged) {
          // Update the platform data in the unified market
          unifiedMarket.platforms[platform] = newMarket;
          
          // Recalculate combined metrics
          const enhancedMarket = this.marketAggregator.enhanceUnifiedMarket(unifiedMarket);
          
          // Update cache
          this.cache.setUnifiedMarket(unifiedMarket.unified_id, enhancedMarket);
          
          updatedCount++;
          
          console.log(`[PollingService] Updated unified market ${unifiedMarket.unified_id}`);
        }
      }
      
      console.log(`[PollingService] Updated ${updatedCount} markets for ${platform}`);
      
    } catch (error) {
      console.error(`[PollingService] Error updating cached markets for ${platform}:`, error.message);
    }
  }
  
  /**
   * Check if market data has changed (price comparison)
   * 
   * @param {Object} oldMarket Old market data
   * @param {Object} newMarket New market data
   * @returns {boolean} True if market has changed
   */
  hasMarketChanged(oldMarket, newMarket) {
    // Compare outcome prices
    if (!oldMarket.outcomes || !newMarket.outcomes) {
      return false;
    }
    
    // Check if any outcome price has changed
    for (let i = 0; i < oldMarket.outcomes.length; i++) {
      const oldOutcome = oldMarket.outcomes[i];
      const newOutcome = newMarket.outcomes[i];
      
      if (!oldOutcome || !newOutcome) {
        continue;
      }
      
      // Compare prices with tolerance (0.0001 difference)
      const priceDiff = Math.abs(oldOutcome.price - newOutcome.price);
      if (priceDiff > 0.0001) {
        console.log(`[PollingService] Price change detected: ${oldOutcome.name} ${oldOutcome.price} -> ${newOutcome.price}`);
        return true;
      }
    }
    
    // Compare volume
    if (oldMarket.volume_24h !== newMarket.volume_24h) {
      console.log(`[PollingService] Volume change detected: ${oldMarket.volume_24h} -> ${newMarket.volume_24h}`);
      return true;
    }
    
    return false;
  }
  
  // ====================================================================
  // STALENESS DETECTION (Task 12.3 - Requirements 11.5, 12.4)
  // ====================================================================
  
  /**
   * Check if platform data is stale (> 60 seconds since last successful fetch)
   * 
   * @param {string} platform Platform name ('polymarket' or 'kalshi')
   * @returns {boolean} True if data is stale
   */
  isDataStale(platform) {
    const lastFetchTime = this.lastFetch[platform];
    
    if (!lastFetchTime) {
      return true; // No data fetched yet
    }
    
    const timeSinceLastFetch = Date.now() - lastFetchTime;
    const isStale = timeSinceLastFetch > 60000; // 60 seconds
    
    if (isStale) {
      console.warn(`[PollingService] ${platform} data is stale (${Math.round(timeSinceLastFetch / 1000)}s since last fetch)`);
    }
    
    return isStale;
  }
  
  /**
   * Get staleness status for all platforms
   * 
   * @returns {Object} Staleness status for each platform
   */
  getStalenessStatus() {
    return {
      polymarket: {
        isStale: this.isDataStale('polymarket'),
        lastFetch: this.lastFetch.polymarket,
        timeSinceLastFetch: this.lastFetch.polymarket 
          ? Date.now() - this.lastFetch.polymarket 
          : null
      },
      kalshi: {
        isStale: this.isDataStale('kalshi'),
        lastFetch: this.lastFetch.kalshi,
        timeSinceLastFetch: this.lastFetch.kalshi 
          ? Date.now() - this.lastFetch.kalshi 
          : null
      }
    };
  }
  
  /**
   * Get polling statistics
   * 
   * @returns {Object} Polling statistics for all platforms
   */
  getStats() {
    return {
      polymarket: {
        ...this.stats.polymarket,
        lastFetch: this.lastFetch.polymarket,
        isStale: this.isDataStale('polymarket'),
        successRate: this.stats.polymarket.totalPolls > 0
          ? ((this.stats.polymarket.successfulPolls / this.stats.polymarket.totalPolls) * 100).toFixed(2)
          : 0
      },
      kalshi: {
        ...this.stats.kalshi,
        lastFetch: this.lastFetch.kalshi,
        isStale: this.isDataStale('kalshi'),
        successRate: this.stats.kalshi.totalPolls > 0
          ? ((this.stats.kalshi.successfulPolls / this.stats.kalshi.totalPolls) * 100).toFixed(2)
          : 0
      }
    };
  }
  
  /**
   * Enable or disable polling for a specific platform
   * 
   * @param {string} platform Platform name ('polymarket' or 'kalshi')
   * @param {boolean} enabled Whether to enable polling
   */
  setPlatformEnabled(platform, enabled) {
    if (!this.config[platform]) {
      console.error(`[PollingService] Unknown platform: ${platform}`);
      return;
    }
    
    this.config[platform].enabled = enabled;
    
    if (enabled) {
      console.log(`[PollingService] Enabling polling for ${platform}`);
      if (platform === 'polymarket') {
        this.startPolymarketPolling();
      } else if (platform === 'kalshi') {
        this.startKalshiPolling();
      }
    } else {
      console.log(`[PollingService] Disabling polling for ${platform}`);
      if (platform === 'polymarket' && this.polymarketInterval) {
        clearInterval(this.polymarketInterval);
        this.polymarketInterval = null;
      } else if (platform === 'kalshi' && this.kalshiInterval) {
        clearInterval(this.kalshiInterval);
        this.kalshiInterval = null;
      }
    }
  }
}

// Export for use in server
module.exports = PollingService;
