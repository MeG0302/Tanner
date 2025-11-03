/**
 * MarketMatchingEngine - Intelligent fuzzy matching for cross-platform market identification
 * 
 * This engine uses multiple techniques to identify identical markets across platforms:
 * 1. Levenshtein distance for text similarity
 * 2. Entity extraction (names, dates, events)
 * 3. Weighted confidence scoring
 * 
 * Requirements: 3.1, 3.2, 3.3, 3.4
 */

class MarketMatchingEngine {
  constructor() {
    this.similarityThreshold = 0.85; // 85% similarity required for match
    
    // Event keywords for entity extraction
    this.eventKeywords = [
      'election', 'championship', 'award', 'price', 'rate', 'win', 'lose',
      'reach', 'exceed', 'below', 'above', 'pass', 'fail', 'approve', 'reject',
      'launch', 'release', 'announce', 'resign', 'appoint', 'nominate', 'vote',
      'trade', 'close', 'open', 'hit', 'break', 'record', 'defeat', 'beat'
    ];
    
    console.log('[MarketMatchingEngine] Initialized with threshold:', this.similarityThreshold);
  }
  
  // ====================================================================
  // TEXT SIMILARITY CALCULATION (Requirement 3.1)
  // ====================================================================
  
  /**
   * Calculate Levenshtein distance between two strings
   * Measures the minimum number of single-character edits required to change one string into another
   * 
   * @param {string} str1 First string
   * @param {string} str2 Second string
   * @returns {number} Edit distance
   */
  levenshteinDistance(str1, str2) {
    // Handle edge cases
    if (!str1 || !str2) return Math.max(str1?.length || 0, str2?.length || 0);
    if (str1 === str2) return 0;
    
    const len1 = str1.length;
    const len2 = str2.length;
    
    // Create matrix
    const matrix = Array(len2 + 1).fill(null).map(() => Array(len1 + 1).fill(0));
    
    // Initialize first row and column
    for (let i = 0; i <= len1; i++) matrix[0][i] = i;
    for (let j = 0; j <= len2; j++) matrix[j][0] = j;
    
    // Fill matrix
    for (let j = 1; j <= len2; j++) {
      for (let i = 1; i <= len1; i++) {
        const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j - 1][i] + 1,     // deletion
          matrix[j][i - 1] + 1,     // insertion
          matrix[j - 1][i - 1] + cost // substitution
        );
      }
    }
    
    return matrix[len2][len1];
  }
  
  /**
   * Normalize text for comparison
   * - Convert to lowercase
   * - Remove punctuation
   * - Standardize whitespace
   * - Remove common words
   * 
   * @param {string} text Text to normalize
   * @returns {string} Normalized text
   */
  normalizeText(text) {
    if (!text) return '';
    
    let normalized = text.toLowerCase();
    
    // Remove punctuation (keep spaces and alphanumeric)
    normalized = normalized.replace(/[^\w\s]/g, ' ');
    
    // Standardize whitespace
    normalized = normalized.replace(/\s+/g, ' ').trim();
    
    // Remove common words that don't add meaning
    const commonWords = ['will', 'the', 'a', 'an', 'be', 'to', 'of', 'in', 'on', 'at', 'for', 'by'];
    const words = normalized.split(' ');
    const filtered = words.filter(word => !commonWords.includes(word));
    
    return filtered.join(' ');
  }
  
  /**
   * Calculate similarity score between two strings (0.0 to 1.0)
   * Uses normalized Levenshtein distance
   * 
   * @param {string} str1 First string
   * @param {string} str2 Second string
   * @returns {number} Similarity score (0.0 = completely different, 1.0 = identical)
   */
  calculateSimilarity(str1, str2) {
    // Normalize both strings
    const normalized1 = this.normalizeText(str1);
    const normalized2 = this.normalizeText(str2);
    
    // Handle edge cases
    if (!normalized1 && !normalized2) return 1.0;
    if (!normalized1 || !normalized2) return 0.0;
    if (normalized1 === normalized2) return 1.0;
    
    // Calculate Levenshtein distance
    const distance = this.levenshteinDistance(normalized1, normalized2);
    
    // Normalize to 0-1 scale (1 - distance/maxLength)
    const maxLength = Math.max(normalized1.length, normalized2.length);
    const similarity = 1 - (distance / maxLength);
    
    return Math.max(0, Math.min(1, similarity)); // Clamp to [0, 1]
  }
  
  // ====================================================================
  // ENTITY EXTRACTION (Requirement 3.2)
  // ====================================================================
  
  /**
   * Extract entities (names, dates, events) from market question
   * 
   * @param {string} question Market question text
   * @returns {Object} Extracted entities { names: [], dates: [], events: [] }
   */
  extractEntities(question) {
    if (!question) {
      return { names: [], dates: [], events: [] };
    }
    
    const entities = {
      names: [],
      dates: [],
      events: []
    };
    
    // Extract person names (capitalized words, 2+ words)
    // Pattern: Capitalized word followed by another capitalized word
    const namePattern = /\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+\b/g;
    const nameMatches = question.match(namePattern);
    if (nameMatches) {
      entities.names = [...new Set(nameMatches)]; // Remove duplicates
    }
    
    // Extract dates in multiple formats
    // Format 1: 4-digit year (e.g., "2024")
    const yearPattern = /\b(19|20)\d{2}\b/g;
    const yearMatches = question.match(yearPattern);
    
    // Format 2: Month Day, Year (e.g., "November 5, 2024")
    const fullDatePattern = /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+(19|20)\d{2}\b/gi;
    const fullDateMatches = question.match(fullDatePattern);
    
    // Format 3: Month Year (e.g., "November 2024")
    const monthYearPattern = /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(19|20)\d{2}\b/gi;
    const monthYearMatches = question.match(monthYearPattern);
    
    // Combine all date matches
    const allDates = [
      ...(yearMatches || []),
      ...(fullDateMatches || []),
      ...(monthYearMatches || [])
    ];
    entities.dates = [...new Set(allDates)]; // Remove duplicates
    
    // Extract key event keywords
    const questionLower = question.toLowerCase();
    entities.events = this.eventKeywords.filter(keyword => 
      questionLower.includes(keyword)
    );
    
    return entities;
  }
  
  /**
   * Compare two entity sets and calculate match score
   * 
   * @param {Object} entities1 First entity set
   * @param {Object} entities2 Second entity set
   * @returns {number} Entity match score (0.0 to 1.0)
   */
  compareEntities(entities1, entities2) {
    let totalScore = 0;
    let weights = 0;
    
    // Compare names (weight: 0.4)
    if (entities1.names.length > 0 || entities2.names.length > 0) {
      const nameScore = this.compareArrays(entities1.names, entities2.names);
      totalScore += nameScore * 0.4;
      weights += 0.4;
    }
    
    // Compare dates (weight: 0.4)
    if (entities1.dates.length > 0 || entities2.dates.length > 0) {
      const dateScore = this.compareArrays(entities1.dates, entities2.dates);
      totalScore += dateScore * 0.4;
      weights += 0.4;
    }
    
    // Compare events (weight: 0.2)
    if (entities1.events.length > 0 || entities2.events.length > 0) {
      const eventScore = this.compareArrays(entities1.events, entities2.events);
      totalScore += eventScore * 0.2;
      weights += 0.2;
    }
    
    // Return weighted average (or 0 if no entities found)
    return weights > 0 ? totalScore / weights : 0;
  }
  
  /**
   * Compare two arrays and calculate overlap score
   * 
   * @param {Array} arr1 First array
   * @param {Array} arr2 Second array
   * @returns {number} Overlap score (0.0 to 1.0)
   */
  compareArrays(arr1, arr2) {
    if (!arr1.length && !arr2.length) return 1.0;
    if (!arr1.length || !arr2.length) return 0.0;
    
    // Normalize strings for comparison
    const normalized1 = arr1.map(s => s.toLowerCase());
    const normalized2 = arr2.map(s => s.toLowerCase());
    
    // Count matches
    let matches = 0;
    for (const item1 of normalized1) {
      for (const item2 of normalized2) {
        // Check for exact match or substring match
        if (item1 === item2 || item1.includes(item2) || item2.includes(item1)) {
          matches++;
          break;
        }
      }
    }
    
    // Calculate Jaccard similarity
    const union = Math.max(arr1.length, arr2.length);
    return matches / union;
  }
  
  // ====================================================================
  // CONFIDENCE SCORING (Requirement 3.3)
  // ====================================================================
  
  /**
   * Calculate match confidence between two markets using weighted scoring
   * 
   * Weights:
   * - Text similarity: 50%
   * - Entity matching: 30%
   * - Date matching: 20%
   * 
   * @param {Object} market1 First market object
   * @param {Object} market2 Second market object
   * @returns {number} Confidence score (0.0 to 1.0)
   */
  calculateMatchConfidence(market1, market2) {
    // Extract questions
    const question1 = market1.question || market1.title || '';
    const question2 = market2.question || market2.title || '';
    
    // Calculate text similarity (50% weight)
    const textSimilarity = this.calculateSimilarity(question1, question2);
    
    // Extract and compare entities (30% weight)
    const entities1 = this.extractEntities(question1);
    const entities2 = this.extractEntities(question2);
    const entityScore = this.compareEntities(entities1, entities2);
    
    // Compare end dates (20% weight)
    const dateScore = this.compareDates(
      market1.endDate || market1.resolution_date,
      market2.endDate || market2.resolution_date
    );
    
    // Calculate weighted confidence
    const confidence = (textSimilarity * 0.5) + (entityScore * 0.3) + (dateScore * 0.2);
    
    // Log detailed scoring for debugging
    console.log(`[MarketMatchingEngine] Match confidence calculation:
      Question 1: "${question1.substring(0, 60)}..."
      Question 2: "${question2.substring(0, 60)}..."
      Text Similarity: ${(textSimilarity * 100).toFixed(1)}%
      Entity Score: ${(entityScore * 100).toFixed(1)}%
      Date Score: ${(dateScore * 100).toFixed(1)}%
      Final Confidence: ${(confidence * 100).toFixed(1)}%`);
    
    return confidence;
  }
  
  /**
   * Compare two dates and return similarity score
   * 
   * @param {string|Date} date1 First date
   * @param {string|Date} date2 Second date
   * @returns {number} Date similarity score (0.0 to 1.0)
   */
  compareDates(date1, date2) {
    // Handle missing dates
    if (!date1 && !date2) return 1.0; // Both missing = match
    if (!date1 || !date2) return 0.5; // One missing = neutral
    
    try {
      const d1 = new Date(date1);
      const d2 = new Date(date2);
      
      // Check if dates are valid
      if (isNaN(d1.getTime()) || isNaN(d2.getTime())) {
        return 0.5; // Invalid dates = neutral
      }
      
      // Calculate difference in days
      const diffMs = Math.abs(d1.getTime() - d2.getTime());
      const diffDays = diffMs / (1000 * 60 * 60 * 24);
      
      // Score based on difference
      // Same day = 1.0
      // Within 1 day = 0.9
      // Within 7 days = 0.7
      // Within 30 days = 0.5
      // More than 30 days = 0.0
      if (diffDays === 0) return 1.0;
      if (diffDays <= 1) return 0.9;
      if (diffDays <= 7) return 0.7;
      if (diffDays <= 30) return 0.5;
      return 0.0;
      
    } catch (error) {
      console.error('[MarketMatchingEngine] Error comparing dates:', error.message);
      return 0.5; // Error = neutral
    }
  }
  
  // ====================================================================
  // MARKET MATCHING LOGIC (Requirement 3.4)
  // ====================================================================
  
  /**
   * Find matches across all markets and create unified markets
   * 
   * @param {Array} markets Array of normalized markets from all platforms
   * @returns {Array} Array of UnifiedMarket objects
   */
  findMatches(markets) {
    console.log(`[MarketMatchingEngine] Finding matches for ${markets.length} markets...`);
    
    if (!Array.isArray(markets) || markets.length === 0) {
      console.warn('[MarketMatchingEngine] No markets provided');
      return [];
    }
    
    const unifiedMarkets = [];
    const processedMarkets = new Set();
    
    // Group markets by platform
    const marketsByPlatform = this.groupByPlatform(markets);
    
    // Compare markets across platforms
    for (let i = 0; i < markets.length; i++) {
      if (processedMarkets.has(markets[i].id)) continue;
      
      const market1 = markets[i];
      const matches = [market1];
      processedMarkets.add(market1.id);
      
      // Find matching markets from other platforms
      for (let j = i + 1; j < markets.length; j++) {
        if (processedMarkets.has(markets[j].id)) continue;
        
        const market2 = markets[j];
        
        // Skip if same platform
        if (market1.platform === market2.platform) continue;
        
        // Calculate match confidence
        const confidence = this.calculateMatchConfidence(market1, market2);
        
        // If confidence exceeds threshold, add to matches
        if (confidence >= this.similarityThreshold) {
          matches.push(market2);
          processedMarkets.add(market2.id);
          
          console.log(`[MarketMatchingEngine] Match found! Confidence: ${(confidence * 100).toFixed(1)}%
            Platform 1: ${market1.platform} - "${market1.question || market1.title}"
            Platform 2: ${market2.platform} - "${market2.question || market2.title}"`);
        }
      }
      
      // Create unified market
      const unifiedMarket = this.createUnifiedMarket(matches);
      unifiedMarkets.push(unifiedMarket);
    }
    
    console.log(`[MarketMatchingEngine] Created ${unifiedMarkets.length} unified markets from ${markets.length} source markets`);
    console.log(`[MarketMatchingEngine] Multi-platform markets: ${unifiedMarkets.filter(m => Object.keys(m.platforms).length > 1).length}`);
    
    return unifiedMarkets;
  }
  
  /**
   * Group markets by platform
   * 
   * @param {Array} markets Array of markets
   * @returns {Object} Markets grouped by platform
   */
  groupByPlatform(markets) {
    const grouped = {};
    
    for (const market of markets) {
      const platform = market.platform || 'unknown';
      if (!grouped[platform]) {
        grouped[platform] = [];
      }
      grouped[platform].push(market);
    }
    
    return grouped;
  }
  
  /**
   * Create a unified market from matched markets
   * 
   * @param {Array} matches Array of matched markets
   * @returns {Object} UnifiedMarket object
   */
  createUnifiedMarket(matches) {
    if (!matches || matches.length === 0) {
      throw new Error('Cannot create unified market from empty matches');
    }
    
    // Use first market as base
    const baseMarket = matches[0];
    
    // Generate unified ID
    const unified_id = this.generateUnifiedId(matches);
    
    // Determine canonical question (longest, most descriptive)
    const question = this.selectCanonicalQuestion(matches);
    
    // Extract category (prefer most specific)
    const category = this.selectCategory(matches);
    
    // Extract resolution date (prefer earliest)
    const resolution_date = this.selectResolutionDate(matches);
    
    // Build platforms object
    const platforms = {};
    for (const market of matches) {
      const platformKey = (market.platform || 'unknown').toLowerCase();
      platforms[platformKey] = market;
    }
    
    // Calculate match confidence (average if multiple matches)
    let match_confidence = 1.0;
    if (matches.length > 1) {
      const confidences = [];
      for (let i = 0; i < matches.length - 1; i++) {
        for (let j = i + 1; j < matches.length; j++) {
          confidences.push(this.calculateMatchConfidence(matches[i], matches[j]));
        }
      }
      match_confidence = confidences.reduce((a, b) => a + b, 0) / confidences.length;
    }
    
    // Calculate combined metrics
    const combined_volume = this.calculateCombinedVolume(matches);
    const best_price = this.findBestPrices(matches);
    const liquidity_score = this.calculateLiquidityScore(matches);
    
    // Check for arbitrage opportunities
    const arbitrage = this.detectArbitrage(matches);
    
    // Check for criteria mismatches
    const criteria_mismatch = this.checkCriteriaMismatch(matches);
    
    return {
      unified_id,
      question,
      category,
      resolution_date,
      platforms,
      match_confidence,
      combined_volume,
      best_price,
      liquidity_score,
      arbitrage,
      criteria_mismatch
    };
  }
  
  /**
   * Generate a unique ID for unified market
   * 
   * @param {Array} matches Array of matched markets
   * @returns {string} Unified ID
   */
  generateUnifiedId(matches) {
    // Sort platform IDs for consistency
    const platformIds = matches
      .map(m => m.id)
      .sort()
      .join('-');
    
    // Create hash-like ID (simplified)
    const hash = platformIds.split('').reduce((acc, char) => {
      return ((acc << 5) - acc) + char.charCodeAt(0);
    }, 0);
    
    return `unified-${Math.abs(hash)}`;
  }
  
  /**
   * Select the most descriptive question as canonical
   * 
   * @param {Array} matches Array of matched markets
   * @returns {string} Canonical question
   */
  selectCanonicalQuestion(matches) {
    // Prefer longest question (usually most descriptive)
    return matches
      .map(m => m.question || m.title || '')
      .sort((a, b) => b.length - a.length)[0];
  }
  
  /**
   * Select the most specific category
   * 
   * @param {Array} matches Array of matched markets
   * @returns {string} Category
   */
  selectCategory(matches) {
    // Prefer non-generic categories
    const categories = matches
      .map(m => m.category)
      .filter(c => c && c !== 'Other' && c !== 'Miscellaneous');
    
    return categories[0] || matches[0].category || 'Other';
  }
  
  /**
   * Select the earliest resolution date
   * 
   * @param {Array} matches Array of matched markets
   * @returns {string|null} Resolution date
   */
  selectResolutionDate(matches) {
    const dates = matches
      .map(m => m.endDate || m.resolution_date)
      .filter(d => d)
      .map(d => new Date(d))
      .filter(d => !isNaN(d.getTime()))
      .sort((a, b) => a - b);
    
    return dates.length > 0 ? dates[0].toISOString() : null;
  }
  
  /**
   * Calculate combined volume across all platforms
   * 
   * @param {Array} matches Array of matched markets
   * @returns {number} Combined volume in USD
   */
  calculateCombinedVolume(matches) {
    return matches.reduce((total, market) => {
      return total + (market.volume_24h || 0);
    }, 0);
  }
  
  /**
   * Find best prices across all platforms
   * 
   * @param {Array} matches Array of matched markets
   * @returns {Object} Best prices { yes: { platform, price }, no: { platform, price } }
   */
  findBestPrices(matches) {
    let bestYes = { platform: null, price: 0 };
    let bestNo = { platform: null, price: 0 };
    
    for (const market of matches) {
      if (!market.outcomes || !Array.isArray(market.outcomes)) continue;
      
      for (const outcome of market.outcomes) {
        const outcomeName = (outcome.name || '').toLowerCase();
        const price = outcome.price || 0;
        
        if (outcomeName === 'yes' && price > bestYes.price) {
          bestYes = { platform: market.platform, price };
        }
        if (outcomeName === 'no' && price > bestNo.price) {
          bestNo = { platform: market.platform, price };
        }
      }
    }
    
    return { yes: bestYes, no: bestNo };
  }
  
  /**
   * Calculate liquidity score (1-5 stars)
   * Formula: (volume × 0.4) + (1/spread × 0.6)
   * 
   * @param {Array} matches Array of matched markets
   * @returns {number} Liquidity score (1-5)
   */
  calculateLiquidityScore(matches) {
    const totalVolume = this.calculateCombinedVolume(matches);
    
    // Calculate average spread
    let totalSpread = 0;
    let spreadCount = 0;
    for (const market of matches) {
      if (market.spread && market.spread > 0) {
        totalSpread += market.spread;
        spreadCount++;
      }
    }
    const avgSpread = spreadCount > 0 ? totalSpread / spreadCount : 0.1;
    
    // Normalize volume to 0-1 scale (assuming max volume of $1M)
    const volumeScore = Math.min(totalVolume / 1000000, 1);
    
    // Normalize spread to 0-1 scale (lower spread = better)
    const spreadScore = Math.min(1 / (avgSpread * 10), 1);
    
    // Calculate weighted score
    const score = (volumeScore * 0.4) + (spreadScore * 0.6);
    
    // Convert to 1-5 scale
    return Math.max(1, Math.min(5, Math.round(score * 5)));
  }
  
  /**
   * Detect arbitrage opportunities
   * 
   * @param {Array} matches Array of matched markets
   * @returns {Object|null} Arbitrage info or null
   */
  detectArbitrage(matches) {
    if (matches.length < 2) return null;
    
    // Find best YES and NO prices across platforms
    let bestYesBuy = { platform: null, price: 1 };
    let bestNoSell = { platform: null, price: 0 };
    
    for (const market of matches) {
      if (!market.outcomes) continue;
      
      for (const outcome of market.outcomes) {
        const name = (outcome.name || '').toLowerCase();
        const price = outcome.price || 0;
        
        // For arbitrage, we want to buy YES at lowest price
        if (name === 'yes' && price < bestYesBuy.price) {
          bestYesBuy = { platform: market.platform, price };
        }
        // And sell NO at highest price (or buy NO at lowest)
        if (name === 'no' && price > bestNoSell.price) {
          bestNoSell = { platform: market.platform, price };
        }
      }
    }
    
    // Check if arbitrage exists: (yes_price + no_price) < 0.95
    const totalCost = bestYesBuy.price + bestNoSell.price;
    
    if (totalCost < 0.95) {
      const profit_pct = ((1 - totalCost) / totalCost) * 100;
      
      // Only flag if profit > 2% (to account for fees)
      if (profit_pct > 2) {
        return {
          exists: true,
          profit_pct,
          instructions: `Buy YES on ${bestYesBuy.platform} at ${(bestYesBuy.price * 100).toFixed(1)}¢, Sell YES on ${bestNoSell.platform} at ${(bestNoSell.price * 100).toFixed(1)}¢`
        };
      }
    }
    
    return null;
  }
  
  /**
   * Check if resolution criteria differ between platforms
   * 
   * @param {Array} matches Array of matched markets
   * @returns {boolean} True if criteria mismatch detected
   */
  checkCriteriaMismatch(matches) {
    // This is a simplified check - in production, would need more sophisticated analysis
    // For now, we'll check if end dates differ significantly
    if (matches.length < 2) return false;
    
    const dates = matches
      .map(m => m.endDate || m.resolution_date)
      .filter(d => d)
      .map(d => new Date(d))
      .filter(d => !isNaN(d.getTime()));
    
    if (dates.length < 2) return false;
    
    // Check if dates differ by more than 7 days
    const maxDiff = Math.max(...dates) - Math.min(...dates);
    const daysDiff = maxDiff / (1000 * 60 * 60 * 24);
    
    return daysDiff > 7;
  }
}

// Export for use in server
module.exports = MarketMatchingEngine;
