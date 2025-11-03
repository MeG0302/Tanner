/**
 * MarketAggregator - Unified market aggregation service
 * 
 * This service orchestrates the fetching, matching, and combining of markets
 * from multiple prediction market platforms (Polymarket, Kalshi).
 * 
 * Key responsibilities:
 * 1. Parallel data fetching from multiple platforms
 * 2. Market matching using MarketMatchingEngine
 * 3. Combined metrics calculation (volume, liquidity score)
 * 4. Arbitrage detection
 * 
 * Requirements: 1.1, 1.2, 1.3, 3.1, 3.2, 3.3, 3.5, 14.1-14.5
 */

const MarketMatchingEngine = require('./MarketMatchingEngine');
const ArbitrageDetector = require('./ArbitrageDetector');

class MarketAggregator {
  constructor(polymarketFetcher, kalshiFetcher, cacheManager) {
    this.polymarketFetcher = polymarketFetcher;
    this.kalshiFetcher = kalshiFetcher;
    this.cache = cacheManager;
    this.matchingEngine = new MarketMatchingEngine();
    this.arbitrageDetector = new ArbitrageDetector({
      minProfitThreshold: 2.0,  // 2% minimum profit
      maxCombinedPrice: 0.95     // Account for fees
    });
    
    // Performance tracking
    this.performanceMetrics = {
      lastFetchDuration: 0,
      lastMatchDuration: 0,
      totalFetches: 0,
      totalMatches: 0
    };
    
    console.log('[MarketAggregator] Initialized with Polymarket and Kalshi fetchers');
  }
  
  // ====================================================================
  // PARALLEL DATA FETCHING (Task 4.1 - Requirements 1.1, 1.2, 1.3)
  // ====================================================================
  
  /**
   * Fetch markets from all platforms in parallel using Promise.allSettled()
   * Handles partial failures gracefully - continues with available platforms
   * 
   * @param {Object} options Fetch options (category, limit, etc.)
   * @returns {Promise<Object>} Object with markets from each platform
   */
  async fetchAllPlatforms(options = {}) {
    const startTime = Date.now();
    console.log('[MarketAggregator] Fetching from all platforms in parallel...');
    
    try {
      // Fetch from both platforms in parallel using Promise.allSettled
      // This ensures we get results from successful platforms even if one fails
      const results = await Promise.allSettled([
        this.fetchPolymarketMarkets(options),
        this.fetchKalshiMarkets(options)
      ]);
      
      // Extract results and handle failures
      const polymarketResult = results[0];
      const kalshiResult = results[1];
      
      // Process Polymarket results
      let polymarketMarkets = [];
      if (polymarketResult.status === 'fulfilled') {
        polymarketMarkets = polymarketResult.value || [];
        console.log(`[MarketAggregator] ✓ Polymarket: ${polymarketMarkets.length} markets`);
      } else {
        console.error(`[MarketAggregator] ✗ Polymarket failed:`, polymarketResult.reason?.message);
        this.cache.updatePlatformHealth('polymarket', 'degraded', polymarketResult.reason);
      }
      
      // Process Kalshi results
      let kalshiMarkets = [];
      if (kalshiResult.status === 'fulfilled') {
        kalshiMarkets = kalshiResult.value || [];
        console.log(`[MarketAggregator] ✓ Kalshi: ${kalshiMarkets.length} markets`);
      } else {
        console.error(`[MarketAggregator] ✗ Kalshi failed:`, kalshiResult.reason?.message);
        this.cache.updatePlatformHealth('kalshi', 'degraded', kalshiResult.reason);
      }
      
      // Check if we have data from at least one platform
      if (polymarketMarkets.length === 0 && kalshiMarkets.length === 0) {
        throw new Error('All platforms unavailable - no market data retrieved');
      }
      
      // Log performance metrics
      const duration = Date.now() - startTime;
      this.performanceMetrics.lastFetchDuration = duration;
      this.performanceMetrics.totalFetches++;
      
      console.log(`[MarketAggregator] Fetch complete in ${duration}ms`);
      console.log(`[MarketAggregator] Total markets: ${polymarketMarkets.length + kalshiMarkets.length}`);
      
      return {
        polymarket: polymarketMarkets,
        kalshi: kalshiMarkets,
        totalMarkets: polymarketMarkets.length + kalshiMarkets.length,
        fetchDuration: duration
      };
      
    } catch (error) {
      console.error('[MarketAggregator] Fatal error during parallel fetch:', error.message);
      throw error;
    }
  }
  
  /**
   * Fetch markets from Polymarket
   * 
   * @param {Object} options Fetch options
   * @returns {Promise<Array>} Array of normalized Polymarket markets
   */
  async fetchPolymarketMarkets(options = {}) {
    try {
      console.log('[MarketAggregator] Fetching Polymarket markets...');
      
      // For now, we'll use the existing fetchPolymarketData function
      // In a full implementation, this would use a PolymarketFetcher class
      // similar to KalshiFetcher
      
      // Since we don't have a separate PolymarketFetcher class yet,
      // we'll return an empty array and let the existing server.js
      // handle Polymarket fetching for now
      
      // This is a placeholder - the actual implementation would be:
      // return await this.polymarketFetcher.fetchMarkets(options);
      
      console.log('[MarketAggregator] Polymarket fetcher not yet implemented, returning empty array');
      return [];
      
    } catch (error) {
      console.error('[MarketAggregator] Polymarket fetch failed:', error.message);
      throw error;
    }
  }
  
  /**
   * Fetch markets from Kalshi
   * 
   * @param {Object} options Fetch options
   * @returns {Promise<Array>} Array of normalized Kalshi markets
   */
  async fetchKalshiMarkets(options = {}) {
    try {
      console.log('[MarketAggregator] Fetching Kalshi markets...');
      
      if (!this.kalshiFetcher) {
        console.warn('[MarketAggregator] Kalshi fetcher not available');
        return [];
      }
      
      // Fetch raw markets from Kalshi
      const rawMarkets = await this.kalshiFetcher.fetchMarkets(options);
      
      // Normalize markets to unified schema
      const normalizedMarkets = rawMarkets
        .map(market => this.kalshiFetcher.normalizeMarket(market))
        .filter(Boolean); // Remove any null results
      
      console.log(`[MarketAggregator] Normalized ${normalizedMarkets.length} Kalshi markets`);
      
      return normalizedMarkets;
      
    } catch (error) {
      console.error('[MarketAggregator] Kalshi fetch failed:', error.message);
      throw error;
    }
  }
  
  // ====================================================================
  // MARKET COMBINATION LOGIC (Task 4.2 - Requirements 3.3, 3.5)
  // ====================================================================
  
  /**
   * Combine and match markets from all platforms into UnifiedMarket objects
   * 
   * @param {Object} platformMarkets Markets from each platform
   * @returns {Promise<Array>} Array of UnifiedMarket objects
   */
  async combineMarkets(platformMarkets) {
    const startTime = Date.now();
    console.log('[MarketAggregator] Combining and matching markets...');
    
    try {
      // Combine all markets into a single array
      const allMarkets = [
        ...(platformMarkets.polymarket || []),
        ...(platformMarkets.kalshi || [])
      ];
      
      if (allMarkets.length === 0) {
        console.warn('[MarketAggregator] No markets to combine');
        return [];
      }
      
      console.log(`[MarketAggregator] Processing ${allMarkets.length} total markets`);
      
      // Use matching engine to find matches and create unified markets
      const unifiedMarkets = this.matchingEngine.findMatches(allMarkets);
      
      // Enhance unified markets with additional calculations
      const enhancedMarkets = unifiedMarkets.map(market => 
        this.enhanceUnifiedMarket(market)
      );
      
      // Log performance metrics
      const duration = Date.now() - startTime;
      this.performanceMetrics.lastMatchDuration = duration;
      this.performanceMetrics.totalMatches++;
      
      console.log(`[MarketAggregator] Matching complete in ${duration}ms`);
      console.log(`[MarketAggregator] Created ${enhancedMarkets.length} unified markets`);
      
      const multiPlatformCount = enhancedMarkets.filter(m => 
        Object.keys(m.platforms).length > 1
      ).length;
      console.log(`[MarketAggregator] Multi-platform markets: ${multiPlatformCount}`);
      
      return enhancedMarkets;
      
    } catch (error) {
      console.error('[MarketAggregator] Error combining markets:', error.message);
      throw error;
    }
  }
  
  /**
   * Enhance a unified market with additional calculations
   * 
   * @param {Object} unifiedMarket Base unified market from matching engine
   * @returns {Object} Enhanced unified market
   */
  enhanceUnifiedMarket(unifiedMarket) {
    // Calculate combined volume (sum across platforms)
    const combined_volume = this.calculateCombinedVolume(unifiedMarket);
    
    // Determine best prices for YES and NO
    const best_price = this.findBestPrices(unifiedMarket);
    
    // Calculate liquidity score (1-5 stars)
    const liquidity_score = this.calculateLiquidityScore(unifiedMarket);
    
    // Detect arbitrage opportunities
    const arbitrage = this.detectArbitrage(unifiedMarket);
    
    // Add smart routing recommendations
    const routing_recommendations = this.addRoutingRecommendations(unifiedMarket).routing_recommendations;
    
    return {
      ...unifiedMarket,
      combined_volume,
      best_price,
      liquidity_score,
      arbitrage,
      routing_recommendations
    };
  }
  
  /**
   * Calculate combined volume across all platforms
   * 
   * @param {Object} unifiedMarket Unified market object
   * @returns {number} Combined volume in USD
   */
  calculateCombinedVolume(unifiedMarket) {
    let totalVolume = 0;
    
    for (const [platform, marketData] of Object.entries(unifiedMarket.platforms)) {
      const volume = marketData.volume_24h || 0;
      totalVolume += volume;
    }
    
    return totalVolume;
  }
  
  /**
   * Find best prices across all platforms
   * 
   * @param {Object} unifiedMarket Unified market object
   * @returns {Object} Best prices { yes: { platform, price }, no: { platform, price } }
   */
  findBestPrices(unifiedMarket) {
    let bestYes = { platform: null, price: 0 };
    let bestNo = { platform: null, price: 0 };
    
    for (const [platform, marketData] of Object.entries(unifiedMarket.platforms)) {
      if (!marketData.outcomes || !Array.isArray(marketData.outcomes)) continue;
      
      for (const outcome of marketData.outcomes) {
        const outcomeName = (outcome.name || '').toLowerCase();
        const price = outcome.price || 0;
        
        // For YES, we want the highest price (best for selling)
        if (outcomeName === 'yes' && price > bestYes.price) {
          bestYes = { platform, price };
        }
        
        // For NO, we want the highest price (best for selling)
        if (outcomeName === 'no' && price > bestNo.price) {
          bestNo = { platform, price };
        }
      }
    }
    
    return { yes: bestYes, no: bestNo };
  }
  
  // ====================================================================
  // LIQUIDITY SCORING (Task 4.3 - Requirements 14.1-14.5)
  // ====================================================================
  
  /**
   * Calculate liquidity score using formula: (volume × 0.4) + (1/spread × 0.6)
   * Returns score from 1 to 5 stars
   * 
   * @param {Object} unifiedMarket Unified market object
   * @returns {number} Liquidity score (1-5)
   */
  calculateLiquidityScore(unifiedMarket) {
    try {
      // Calculate total volume across all platforms
      const totalVolume = this.calculateCombinedVolume(unifiedMarket);
      
      // Calculate average spread across platforms
      let totalSpread = 0;
      let spreadCount = 0;
      
      for (const [platform, marketData] of Object.entries(unifiedMarket.platforms)) {
        if (marketData.spread && marketData.spread > 0) {
          totalSpread += marketData.spread;
          spreadCount++;
        }
      }
      
      // Use average spread, or default to 0.1 (10 cents) if no spread data
      const avgSpread = spreadCount > 0 ? totalSpread / spreadCount : 0.1;
      
      // Normalize volume to 0-1 scale
      // Assuming max volume of $1M for normalization
      const volumeScore = Math.min(totalVolume / 1000000, 1);
      
      // Normalize spread to 0-1 scale (lower spread = better liquidity)
      // 1/spread gives us a score where lower spread = higher score
      // Multiply by 10 to scale appropriately (0.01 spread = 100, 0.1 spread = 10)
      const spreadScore = Math.min(1 / (avgSpread * 10), 1);
      
      // Apply formula: (volume × 0.4) + (1/spread × 0.6)
      const rawScore = (volumeScore * 0.4) + (spreadScore * 0.6);
      
      // Convert to 1-5 scale
      // rawScore is 0-1, so multiply by 4 and add 1 to get 1-5 range
      const liquidityScore = Math.max(1, Math.min(5, Math.round(rawScore * 4 + 1)));
      
      console.log(`[MarketAggregator] Liquidity score calculation:
        Volume: $${totalVolume.toLocaleString()} (score: ${volumeScore.toFixed(2)})
        Avg Spread: ${(avgSpread * 100).toFixed(1)}¢ (score: ${spreadScore.toFixed(2)})
        Raw Score: ${rawScore.toFixed(2)}
        Final Score: ${liquidityScore}/5`);
      
      return liquidityScore;
      
    } catch (error) {
      console.error('[MarketAggregator] Error calculating liquidity score:', error.message);
      return 1; // Default to lowest score on error
    }
  }
  
  /**
   * Detect arbitrage opportunities across platforms
   * Uses the ArbitrageDetector class for detection and instruction generation
   * 
   * @param {Object} unifiedMarket Unified market object
   * @returns {Object|null} Arbitrage info with instructions or null if no opportunity
   */
  detectArbitrage(unifiedMarket) {
    try {
      // Use ArbitrageDetector to detect opportunity
      const arbitrageData = this.arbitrageDetector.detectArbitrage(unifiedMarket);
      
      if (!arbitrageData || !arbitrageData.exists) {
        return null;
      }
      
      // Generate human-readable instructions
      const instructions = this.arbitrageDetector.generateInstructions(arbitrageData, unifiedMarket);
      
      return instructions;
      
    } catch (error) {
      console.error('[MarketAggregator] Error detecting arbitrage:', error.message);
      return null;
    }
  }
  
  // ====================================================================
  // SMART ROUTING RECOMMENDATIONS (Task 13 - Requirements 13.1-13.5)
  // ====================================================================
  
  /**
   * Calculate execution score for a platform
   * Formula: (price_quality × 0.5) + (spread_quality × 0.3) + (liquidity_quality × 0.2)
   * 
   * @param {Object} platformData Platform market data
   * @param {string} side 'buy' or 'sell'
   * @param {string} outcome 'yes' or 'no'
   * @returns {number} Execution score (0-1)
   */
  calculateExecutionScore(platformData, side, outcome) {
    try {
      if (!platformData || !platformData.outcomes) {
        return 0;
      }
      
      // Find the outcome
      const outcomeData = platformData.outcomes.find(o => 
        o.name.toLowerCase() === outcome.toLowerCase()
      );
      
      if (!outcomeData) {
        return 0;
      }
      
      // 1. Price Quality (0-1 scale)
      // For buying: lower price is better
      // For selling: higher price is better
      const price = outcomeData.price;
      const priceQuality = side === 'buy' 
        ? (1 - price)  // Lower price = higher quality for buying
        : price;        // Higher price = higher quality for selling
      
      // 2. Spread Quality (0-1 scale)
      // Lower spread is always better
      const spread = platformData.spread || 0.10; // Default to 10% if not available
      const spreadQuality = Math.max(0, 1 - (spread / 0.20)); // Normalize to 20% max spread
      
      // 3. Liquidity Quality (0-1 scale)
      // Higher liquidity is better
      const liquidity = platformData.liquidity || 0;
      const maxLiquidity = 100000; // $100k as reference max
      const liquidityQuality = Math.min(1, liquidity / maxLiquidity);
      
      // Calculate weighted score
      const executionScore = (priceQuality * 0.5) + (spreadQuality * 0.3) + (liquidityQuality * 0.2);
      
      return Math.max(0, Math.min(1, executionScore)); // Clamp to 0-1
      
    } catch (error) {
      console.error('[MarketAggregator] Error calculating execution score:', error.message);
      return 0;
    }
  }
  
  /**
   * Determine best platform for buying or selling
   * 
   * @param {Object} unifiedMarket Unified market object
   * @param {string} side 'buy' or 'sell'
   * @param {string} outcome 'yes' or 'no'
   * @returns {Object} Recommendation { platform, score, reason }
   */
  getRoutingRecommendation(unifiedMarket, side, outcome) {
    try {
      const platforms = Object.entries(unifiedMarket.platforms);
      
      if (platforms.length === 0) {
        return null;
      }
      
      // Calculate execution score for each platform
      const scores = platforms.map(([platformName, platformData]) => {
        const score = this.calculateExecutionScore(platformData, side, outcome);
        
        // Check if platform has sufficient liquidity
        const liquidity = platformData.liquidity || 0;
        const hasSufficientLiquidity = liquidity >= 1000; // $1k minimum
        
        return {
          platform: platformName,
          score,
          liquidity,
          hasSufficientLiquidity,
          spread: platformData.spread || 0,
          price: platformData.outcomes?.find(o => 
            o.name.toLowerCase() === outcome.toLowerCase()
          )?.price || 0
        };
      });
      
      // Filter out platforms with insufficient liquidity
      const viablePlatforms = scores.filter(s => s.hasSufficientLiquidity);
      
      if (viablePlatforms.length === 0) {
        // No platforms with sufficient liquidity
        return {
          platform: null,
          score: 0,
          reason: 'Insufficient liquidity on all platforms'
        };
      }
      
      // Find platform with highest execution score
      const best = viablePlatforms.reduce((prev, current) => 
        current.score > prev.score ? current : prev
      );
      
      // Generate reason
      let reason = '';
      if (side === 'buy') {
        reason = `Best price (${(best.price * 100).toFixed(1)}¢) with good liquidity`;
      } else {
        reason = `Best selling price (${(best.price * 100).toFixed(1)}¢) with good liquidity`;
      }
      
      if (best.spread < 0.05) {
        reason += ' and tight spread';
      }
      
      return {
        platform: best.platform,
        score: best.score,
        reason,
        price: best.price,
        liquidity: best.liquidity,
        spread: best.spread
      };
      
    } catch (error) {
      console.error('[MarketAggregator] Error getting routing recommendation:', error.message);
      return null;
    }
  }
  
  /**
   * Add routing recommendations to unified market
   * 
   * @param {Object} unifiedMarket Unified market object
   * @returns {Object} Unified market with routing recommendations
   */
  addRoutingRecommendations(unifiedMarket) {
    try {
      const recommendations = {
        buy_yes: this.getRoutingRecommendation(unifiedMarket, 'buy', 'yes'),
        sell_yes: this.getRoutingRecommendation(unifiedMarket, 'sell', 'yes'),
        buy_no: this.getRoutingRecommendation(unifiedMarket, 'buy', 'no'),
        sell_no: this.getRoutingRecommendation(unifiedMarket, 'sell', 'no')
      };
      
      return {
        ...unifiedMarket,
        routing_recommendations: recommendations
      };
      
    } catch (error) {
      console.error('[MarketAggregator] Error adding routing recommendations:', error.message);
      return unifiedMarket;
    }
  }
  
  // ====================================================================
  // HIGH-LEVEL API METHODS
  // ====================================================================
  
  /**
   * Get unified markets for a specific category
   * 
   * @param {string} category Category name
   * @returns {Promise<Array>} Array of unified markets
   */
  async getUnifiedMarkets(category) {
    try {
      console.log(`[MarketAggregator] Getting unified markets for category: ${category}`);
      
      // Check cache first
      const cached = this.cache.getUnifiedMarket(category);
      if (cached) {
        console.log(`[MarketAggregator] Cache hit for ${category}`);
        return cached;
      }
      
      // Fetch from all platforms
      const platformMarkets = await this.fetchAllPlatforms({ category });
      
      // Combine and match markets
      const unifiedMarkets = await this.combineMarkets(platformMarkets);
      
      // Filter by category if specified
      const filtered = category && category !== 'all'
        ? unifiedMarkets.filter(m => 
            m.category && m.category.toLowerCase() === category.toLowerCase()
          )
        : unifiedMarkets;
      
      // Cache the results
      this.cache.setUnifiedMarket(category, filtered);
      
      return filtered;
      
    } catch (error) {
      console.error(`[MarketAggregator] Error getting unified markets for ${category}:`, error.message);
      throw error;
    }
  }
  
  /**
   * Get detailed unified market by ID
   * 
   * @param {string} unifiedId Unified market ID
   * @returns {Promise<Object>} Unified market with full details
   */
  async getUnifiedMarketDetails(unifiedId) {
    try {
      console.log(`[MarketAggregator] Getting details for unified market: ${unifiedId}`);
      
      // For now, we'll need to fetch all markets and find the one we want
      // In a production system, we'd have a more efficient lookup mechanism
      const allMarkets = await this.getUnifiedMarkets('all');
      
      const market = allMarkets.find(m => m.unified_id === unifiedId);
      
      if (!market) {
        throw new Error(`Unified market not found: ${unifiedId}`);
      }
      
      return market;
      
    } catch (error) {
      console.error(`[MarketAggregator] Error getting market details for ${unifiedId}:`, error.message);
      throw error;
    }
  }
  
  /**
   * Find all arbitrage opportunities across platforms
   * Uses ArbitrageDetector's batch processing for efficient detection
   * 
   * @returns {Promise<Array>} Array of markets with arbitrage opportunities
   */
  async findArbitrageOpportunities() {
    try {
      console.log('[MarketAggregator] Finding arbitrage opportunities...');
      
      // Get all unified markets
      const allMarkets = await this.getUnifiedMarkets('all');
      
      // Use ArbitrageDetector's batch processing
      const opportunities = this.arbitrageDetector.detectBatchArbitrage(allMarkets);
      
      // Get statistics
      const stats = this.arbitrageDetector.getArbitrageStats(opportunities);
      console.log('[MarketAggregator] Arbitrage statistics:', stats);
      
      // Return markets with arbitrage data
      return opportunities.map(opp => ({
        ...opp.market,
        arbitrage: opp.arbitrage
      }));
      
    } catch (error) {
      console.error('[MarketAggregator] Error finding arbitrage opportunities:', error.message);
      throw error;
    }
  }
  
  /**
   * Get platform health status
   * 
   * @returns {Object} Health status for all platforms
   */
  getPlatformHealth() {
    return this.cache.getAllPlatformHealth();
  }
  
  /**
   * Get performance metrics
   * 
   * @returns {Object} Performance metrics
   */
  getPerformanceMetrics() {
    return {
      ...this.performanceMetrics,
      cacheStats: {
        hits: this.cache.performanceStats.cacheHits,
        misses: this.cache.performanceStats.cacheMisses
      }
    };
  }
}

// Export for use in server
module.exports = MarketAggregator;
