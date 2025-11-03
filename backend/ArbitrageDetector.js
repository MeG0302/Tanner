/**
 * ArbitrageDetector - Detects arbitrage opportunities across prediction market platforms
 * 
 * This class analyzes unified markets to identify price discrepancies that allow
 * for risk-free profit through simultaneous buying and selling on different platforms.
 * 
 * Arbitrage exists when: (platform_A_yes_price + platform_B_no_price) < 0.95
 * The 0.95 threshold accounts for transaction fees and slippage.
 * 
 * Requirements: 10.1, 10.2, 10.3, 10.4, 10.5
 */

class ArbitrageDetector {
  constructor(options = {}) {
    // Minimum profit threshold to flag as arbitrage (default 2%)
    // This accounts for trading fees and execution risk
    this.minProfitThreshold = options.minProfitThreshold || 2.0;
    
    // Maximum combined price for arbitrage (default 0.95)
    // This is 1.00 minus typical fee structure
    this.maxCombinedPrice = options.maxCombinedPrice || 0.95;
    
    console.log('[ArbitrageDetector] Initialized with settings:', {
      minProfitThreshold: `${this.minProfitThreshold}%`,
      maxCombinedPrice: this.maxCombinedPrice
    });
  }
  
  // ====================================================================
  // ARBITRAGE DETECTION ALGORITHM (Task 5.1 - Requirements 10.1, 10.2, 10.5)
  // ====================================================================
  
  /**
   * Detect arbitrage opportunity in a unified market
   * 
   * Algorithm:
   * 1. Find lowest YES price across all platforms (best buy price)
   * 2. Find highest NO price across all platforms (best sell price)
   * 3. Check if (yes_price + no_price) < 0.95
   * 4. Calculate profit percentage
   * 5. Only flag if profit > 2% (account for fees)
   * 
   * @param {Object} unifiedMarket Unified market with multiple platform data
   * @returns {Object|null} Arbitrage opportunity details or null if none exists
   */
  detectArbitrage(unifiedMarket) {
    try {
      // Validate input
      if (!unifiedMarket || !unifiedMarket.platforms) {
        console.warn('[ArbitrageDetector] Invalid unified market provided');
        return null;
      }
      
      const platforms = Object.keys(unifiedMarket.platforms);
      
      // Need at least 2 platforms for arbitrage
      if (platforms.length < 2) {
        return null;
      }
      
      // Find best prices across platforms
      const bestPrices = this.findBestPrices(unifiedMarket);
      
      if (!bestPrices.yesBuy.platform || !bestPrices.noSell.platform) {
        // Insufficient price data
        return null;
      }
      
      // Check if arbitrage exists: (yes_price + no_price) < maxCombinedPrice
      const totalCost = bestPrices.yesBuy.price + bestPrices.noSell.price;
      
      if (totalCost >= this.maxCombinedPrice) {
        // No arbitrage opportunity
        return null;
      }
      
      // Calculate profit percentage
      // Profit = (1.00 - totalCost) / totalCost * 100
      const profitPct = ((1 - totalCost) / totalCost) * 100;
      
      // Only flag if profit exceeds minimum threshold (account for fees)
      if (profitPct < this.minProfitThreshold) {
        return null;
      }
      
      // Arbitrage opportunity detected!
      console.log(`[ArbitrageDetector] 🚨 Arbitrage detected in market: ${unifiedMarket.question}`);
      console.log(`[ArbitrageDetector] Buy YES on ${bestPrices.yesBuy.platform} at ${(bestPrices.yesBuy.price * 100).toFixed(1)}¢`);
      console.log(`[ArbitrageDetector] Sell YES on ${bestPrices.noSell.platform} at ${(bestPrices.noSell.price * 100).toFixed(1)}¢`);
      console.log(`[ArbitrageDetector] Profit: ${profitPct.toFixed(2)}%`);
      
      return {
        exists: true,
        profitPct: profitPct,
        totalCost: totalCost,
        yesBuy: bestPrices.yesBuy,
        noSell: bestPrices.noSell,
        detectedAt: Date.now()
      };
      
    } catch (error) {
      console.error('[ArbitrageDetector] Error detecting arbitrage:', error.message);
      return null;
    }
  }
  
  /**
   * Find best prices for arbitrage across all platforms
   * 
   * For arbitrage, we want:
   * - Lowest YES price (best buy price)
   * - Highest NO price (equivalent to lowest inverse YES price for selling)
   * 
   * @param {Object} unifiedMarket Unified market object
   * @returns {Object} Best prices { yesBuy, noSell }
   */
  findBestPrices(unifiedMarket) {
    let bestYesBuy = { platform: null, price: 1.0 }; // Start with max price
    let bestNoSell = { platform: null, price: 0.0 }; // Start with min price
    
    for (const [platformName, marketData] of Object.entries(unifiedMarket.platforms)) {
      if (!marketData.outcomes || !Array.isArray(marketData.outcomes)) {
        continue;
      }
      
      for (const outcome of marketData.outcomes) {
        const outcomeName = (outcome.name || '').toLowerCase();
        const price = outcome.price || 0;
        
        // Skip invalid prices
        if (price <= 0 || price >= 1) {
          continue;
        }
        
        // For arbitrage, we want to BUY YES at the LOWEST price
        if (outcomeName === 'yes' && price < bestYesBuy.price) {
          bestYesBuy = { platform: platformName, price: price };
        }
        
        // For arbitrage, we want to SELL YES (buy NO) at the HIGHEST NO price
        if (outcomeName === 'no' && price > bestNoSell.price) {
          bestNoSell = { platform: platformName, price: price };
        }
      }
    }
    
    return {
      yesBuy: bestYesBuy,
      noSell: bestNoSell
    };
  }
  
  // ====================================================================
  // ARBITRAGE INSTRUCTIONS GENERATION (Task 5.2 - Requirements 10.3, 10.4)
  // ====================================================================
  
  /**
   * Generate human-readable trading instructions for an arbitrage opportunity
   * 
   * @param {Object} arbitrageData Arbitrage opportunity data from detectArbitrage()
   * @param {Object} unifiedMarket The unified market object
   * @returns {Object} Formatted arbitrage instructions
   */
  generateInstructions(arbitrageData, unifiedMarket) {
    if (!arbitrageData || !arbitrageData.exists) {
      return null;
    }
    
    try {
      const { yesBuy, noSell, profitPct, totalCost } = arbitrageData;
      
      // Convert prices to cents for readability
      const yesBuyPriceCents = (yesBuy.price * 100).toFixed(1);
      const noSellPriceCents = (noSell.price * 100).toFixed(1);
      const profitCents = ((1 - totalCost) * 100).toFixed(1);
      
      // Generate step-by-step instructions
      const steps = [
        {
          step: 1,
          action: 'BUY',
          platform: yesBuy.platform,
          outcome: 'YES',
          price: yesBuyPriceCents,
          description: `Buy YES on ${yesBuy.platform} at ${yesBuyPriceCents}¢`
        },
        {
          step: 2,
          action: 'SELL',
          platform: noSell.platform,
          outcome: 'YES',
          price: noSellPriceCents,
          description: `Sell YES on ${noSell.platform} at ${noSellPriceCents}¢ (or buy NO at ${(100 - parseFloat(noSellPriceCents)).toFixed(1)}¢)`
        },
        {
          step: 3,
          action: 'PROFIT',
          amount: profitCents,
          percentage: profitPct.toFixed(2),
          description: `Collect profit of ${profitCents}¢ per $1 invested (${profitPct.toFixed(2)}% return)`
        }
      ];
      
      // Generate summary instruction text
      const summaryText = `Buy YES on ${yesBuy.platform} at ${yesBuyPriceCents}¢, Sell YES on ${noSell.platform} at ${noSellPriceCents}¢ for ${profitPct.toFixed(2)}% profit`;
      
      // Generate detailed explanation
      const explanation = this.generateExplanation(arbitrageData, unifiedMarket);
      
      return {
        exists: true,
        profitPct: profitPct,
        profitCents: profitCents,
        buyPlatform: yesBuy.platform,
        buyPrice: yesBuyPriceCents,
        sellPlatform: noSell.platform,
        sellPrice: noSellPriceCents,
        steps: steps,
        summary: summaryText,
        explanation: explanation,
        warnings: this.generateWarnings(arbitrageData),
        detectedAt: arbitrageData.detectedAt || Date.now()
      };
      
    } catch (error) {
      console.error('[ArbitrageDetector] Error generating instructions:', error.message);
      return null;
    }
  }
  
  /**
   * Generate detailed explanation of the arbitrage opportunity
   * 
   * @param {Object} arbitrageData Arbitrage data
   * @param {Object} unifiedMarket Unified market
   * @returns {string} Explanation text
   */
  generateExplanation(arbitrageData, unifiedMarket) {
    const { yesBuy, noSell, profitPct, totalCost } = arbitrageData;
    
    return `This arbitrage opportunity exists because the combined cost of buying YES on ${yesBuy.platform} ` +
           `(${(yesBuy.price * 100).toFixed(1)}¢) and buying NO on ${noSell.platform} ` +
           `(${((1 - noSell.price) * 100).toFixed(1)}¢) totals ${(totalCost * 100).toFixed(1)}¢, ` +
           `which is less than $1.00. Since YES and NO are complementary outcomes that must sum to $1.00 ` +
           `at resolution, you can lock in a guaranteed profit of ${((1 - totalCost) * 100).toFixed(1)}¢ ` +
           `per dollar invested (${profitPct.toFixed(2)}% return).`;
  }
  
  /**
   * Generate warnings about arbitrage execution risks
   * 
   * @param {Object} arbitrageData Arbitrage data
   * @returns {Array<string>} Array of warning messages
   */
  generateWarnings(arbitrageData) {
    const warnings = [
      '⚠️ Arbitrage opportunities may disappear quickly as other traders exploit them',
      '⚠️ Consider transaction fees on both platforms (typically 2-5% total)',
      '⚠️ Account for potential slippage if market liquidity is low',
      '⚠️ Ensure you have sufficient funds on both platforms before executing',
      '⚠️ Price may change between detection and execution'
    ];
    
    // Add specific warnings based on profit margin
    if (arbitrageData.profitPct < 3) {
      warnings.push('⚠️ Low profit margin - fees may consume most or all of the profit');
    }
    
    if (arbitrageData.profitPct > 10) {
      warnings.push('⚠️ Unusually high profit margin - verify market data accuracy before executing');
    }
    
    return warnings;
  }
  
  // ====================================================================
  // BATCH PROCESSING
  // ====================================================================
  
  /**
   * Detect arbitrage opportunities across multiple unified markets
   * 
   * @param {Array<Object>} unifiedMarkets Array of unified markets
   * @returns {Array<Object>} Array of markets with arbitrage opportunities
   */
  detectBatchArbitrage(unifiedMarkets) {
    if (!Array.isArray(unifiedMarkets)) {
      console.warn('[ArbitrageDetector] Invalid input: expected array of unified markets');
      return [];
    }
    
    console.log(`[ArbitrageDetector] Scanning ${unifiedMarkets.length} markets for arbitrage...`);
    
    const opportunities = [];
    
    for (const market of unifiedMarkets) {
      const arbitrage = this.detectArbitrage(market);
      
      if (arbitrage && arbitrage.exists) {
        const instructions = this.generateInstructions(arbitrage, market);
        
        opportunities.push({
          market: market,
          arbitrage: instructions
        });
      }
    }
    
    // Sort by profit percentage (descending)
    opportunities.sort((a, b) => b.arbitrage.profitPct - a.arbitrage.profitPct);
    
    console.log(`[ArbitrageDetector] Found ${opportunities.length} arbitrage opportunities`);
    
    if (opportunities.length > 0) {
      console.log(`[ArbitrageDetector] Best opportunity: ${opportunities[0].arbitrage.profitPct.toFixed(2)}% profit`);
    }
    
    return opportunities;
  }
  
  /**
   * Get arbitrage statistics across all opportunities
   * 
   * @param {Array<Object>} opportunities Array of arbitrage opportunities
   * @returns {Object} Statistics summary
   */
  getArbitrageStats(opportunities) {
    if (!opportunities || opportunities.length === 0) {
      return {
        count: 0,
        avgProfit: 0,
        maxProfit: 0,
        minProfit: 0,
        totalPotentialProfit: 0
      };
    }
    
    const profits = opportunities.map(opp => opp.arbitrage.profitPct);
    
    return {
      count: opportunities.length,
      avgProfit: profits.reduce((sum, p) => sum + p, 0) / profits.length,
      maxProfit: Math.max(...profits),
      minProfit: Math.min(...profits),
      totalPotentialProfit: profits.reduce((sum, p) => sum + p, 0)
    };
  }
}

// Export for use in other modules
module.exports = ArbitrageDetector;
