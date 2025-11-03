/**
 * Unit Tests for MarketMatchingEngine
 * Tests Levenshtein distance, entity extraction, confidence scoring, and matching logic
 * 
 * Requirements: 3.1, 3.2, 3.3
 */

const MarketMatchingEngine = require('./MarketMatchingEngine');

describe('MarketMatchingEngine', () => {
  let engine;

  beforeEach(() => {
    engine = new MarketMatchingEngine();
  });

  // ====================================================================
  // TEST SUITE 1: Levenshtein Distance Calculation (Requirement 3.1)
  // ====================================================================
  describe('Levenshtein Distance Calculation', () => {
    test('should return 0 for identical strings', () => {
      const distance = engine.levenshteinDistance('hello', 'hello');
      expect(distance).toBe(0);
    });

    test('should calculate correct distance for single character difference', () => {
      const distance = engine.levenshteinDistance('hello', 'hallo');
      expect(distance).toBe(1);
    });

    test('should calculate correct distance for insertion', () => {
      const distance = engine.levenshteinDistance('cat', 'cats');
      expect(distance).toBe(1);
    });

    test('should calculate correct distance for deletion', () => {
      const distance = engine.levenshteinDistance('cats', 'cat');
      expect(distance).toBe(1);
    });

    test('should calculate correct distance for multiple edits', () => {
      const distance = engine.levenshteinDistance('kitten', 'sitting');
      expect(distance).toBe(3);
    });

    test('should handle empty strings', () => {
      expect(engine.levenshteinDistance('', 'hello')).toBe(5);
      expect(engine.levenshteinDistance('hello', '')).toBe(5);
      expect(engine.levenshteinDistance('', '')).toBe(0);
    });

    test('should handle null or undefined inputs', () => {
      expect(engine.levenshteinDistance(null, 'hello')).toBe(5);
      expect(engine.levenshteinDistance('hello', null)).toBe(5);
      expect(engine.levenshteinDistance(null, null)).toBe(0);
    });
  });

  // ====================================================================
  // TEST SUITE 2: Text Normalization and Similarity (Requirement 3.1)
  // ====================================================================
  describe('Text Normalization and Similarity', () => {
    test('should normalize text by removing punctuation', () => {
      const normalized = engine.normalizeText('Hello, World!');
      expect(normalized).not.toContain(',');
      expect(normalized).not.toContain('!');
    });

    test('should normalize text to lowercase', () => {
      const normalized = engine.normalizeText('HELLO World');
      expect(normalized).toBe('hello world');
    });

    test('should remove common words', () => {
      const normalized = engine.normalizeText('Will the president win the election?');
      expect(normalized).not.toContain('will');
      expect(normalized).not.toContain('the');
    });

    test('should calculate high similarity for identical questions', () => {
      const similarity = engine.calculateSimilarity(
        'Will Trump win 2024?',
        'Will Trump win 2024?'
      );
      expect(similarity).toBeGreaterThan(0.95);
    });

    test('should calculate high similarity for similar questions', () => {
      const similarity = engine.calculateSimilarity(
        'Will Donald Trump win the 2024 election?',
        'Will Trump win 2024 Presidential Election?'
      );
      expect(similarity).toBeGreaterThan(0.75);
    });

    test('should calculate low similarity for different questions', () => {
      const similarity = engine.calculateSimilarity(
        'Will Trump win 2024?',
        'Will Biden win 2024?'
      );
      expect(similarity).toBeLessThan(0.70);
    });

    test('should handle empty strings', () => {
      expect(engine.calculateSimilarity('', '')).toBe(1.0);
      expect(engine.calculateSimilarity('hello', '')).toBe(0.0);
      expect(engine.calculateSimilarity('', 'hello')).toBe(0.0);
    });
  });

  // ====================================================================
  // TEST SUITE 3: Entity Extraction (Requirement 3.2)
  // ====================================================================
  describe('Entity Extraction', () => {
    test('should extract person names from questions', () => {
      const entities = engine.extractEntities('Will Donald Trump win the 2024 election?');
      expect(entities.names).toContain('Donald Trump');
      expect(entities.names.length).toBeGreaterThan(0);
    });

    test('should extract multiple person names', () => {
      const entities = engine.extractEntities('Will Joe Biden or Donald Trump win?');
      expect(entities.names).toContain('Joe Biden');
      expect(entities.names).toContain('Donald Trump');
    });

    test('should extract year dates', () => {
      const entities = engine.extractEntities('Will Trump win the 2024 election?');
      expect(entities.dates).toContain('2024');
    });

    test('should extract full date formats', () => {
      const entities = engine.extractEntities('Will Bitcoin reach $100k by December 31, 2024?');
      expect(entities.dates.some(d => d.includes('December'))).toBe(true);
      expect(entities.dates.some(d => d.includes('2024'))).toBe(true);
    });

    test('should extract event keywords', () => {
      const entities = engine.extractEntities('Will Trump win the 2024 election?');
      expect(entities.events).toContain('win');
      expect(entities.events).toContain('election');
    });

    test('should extract multiple event keywords', () => {
      const entities = engine.extractEntities('Will the Lakers win the championship?');
      expect(entities.events).toContain('win');
      expect(entities.events).toContain('championship');
    });

    test('should handle questions with no entities', () => {
      const entities = engine.extractEntities('random question without entities');
      expect(entities.names).toEqual([]);
      expect(entities.dates).toEqual([]);
    });

    test('should handle empty or null input', () => {
      const entities1 = engine.extractEntities('');
      expect(entities1).toEqual({ names: [], dates: [], events: [] });
      
      const entities2 = engine.extractEntities(null);
      expect(entities2).toEqual({ names: [], dates: [], events: [] });
    });

    test('should remove duplicate entities', () => {
      const entities = engine.extractEntities('Donald Trump and Donald Trump will win in 2024 and 2024');
      expect(entities.names.filter(n => n === 'Donald Trump').length).toBe(1);
      expect(entities.dates.filter(d => d === '2024').length).toBe(1);
    });
  });

  // ====================================================================
  // TEST SUITE 4: Entity Comparison (Requirement 3.2)
  // ====================================================================
  describe('Entity Comparison', () => {
    test('should return high score for matching entities', () => {
      const entities1 = { names: ['Donald Trump'], dates: ['2024'], events: ['win', 'election'] };
      const entities2 = { names: ['Donald Trump'], dates: ['2024'], events: ['win', 'election'] };
      const score = engine.compareEntities(entities1, entities2);
      expect(score).toBeGreaterThan(0.9);
    });

    test('should return low score for different entities', () => {
      const entities1 = { names: ['Donald Trump'], dates: ['2024'], events: ['win'] };
      const entities2 = { names: ['Joe Biden'], dates: ['2025'], events: ['lose'] };
      const score = engine.compareEntities(entities1, entities2);
      expect(score).toBeLessThan(0.3);
    });

    test('should handle partial matches', () => {
      const entities1 = { names: ['Donald Trump'], dates: ['2024'], events: ['win'] };
      const entities2 = { names: ['Donald Trump'], dates: ['2025'], events: ['lose'] };
      const score = engine.compareEntities(entities1, entities2);
      expect(score).toBeGreaterThan(0.3);
      expect(score).toBeLessThan(0.7);
    });

    test('should handle empty entity sets', () => {
      const entities1 = { names: [], dates: [], events: [] };
      const entities2 = { names: [], dates: [], events: [] };
      const score = engine.compareEntities(entities1, entities2);
      expect(score).toBe(0);
    });
  });

  // ====================================================================
  // TEST SUITE 5: Confidence Scoring (Requirement 3.3)
  // ====================================================================
  describe('Confidence Scoring', () => {
    test('should calculate high confidence for identical markets', () => {
      const market1 = {
        question: 'Will Donald Trump win the 2024 US Presidential Election?',
        endDate: '2024-11-06T00:00:00Z'
      };
      const market2 = {
        question: 'Will Donald Trump win the 2024 US Presidential Election?',
        endDate: '2024-11-06T00:00:00Z'
      };
      const confidence = engine.calculateMatchConfidence(market1, market2);
      expect(confidence).toBeGreaterThan(0.90);
    });

    test('should calculate high confidence for similar markets', () => {
      const market1 = {
        question: 'Will Donald Trump win the 2024 US Presidential Election?',
        endDate: '2024-11-06T00:00:00Z'
      };
      const market2 = {
        question: 'Will Trump win the 2024 Presidential Election?',
        endDate: '2024-11-06T00:00:00Z'
      };
      const confidence = engine.calculateMatchConfidence(market1, market2);
      expect(confidence).toBeGreaterThan(0.85);
    });

    test('should calculate low confidence for different markets', () => {
      const market1 = {
        question: 'Will Trump win 2024?',
        endDate: '2024-11-06T00:00:00Z'
      };
      const market2 = {
        question: 'Will Biden win 2024?',
        endDate: '2024-11-06T00:00:00Z'
      };
      const confidence = engine.calculateMatchConfidence(market1, market2);
      expect(confidence).toBeLessThan(0.85);
    });

    test('should penalize different end dates', () => {
      const market1 = {
        question: 'Will Trump win the election?',
        endDate: '2024-11-06T00:00:00Z'
      };
      const market2 = {
        question: 'Will Trump win the election?',
        endDate: '2025-11-06T00:00:00Z'
      };
      const confidence = engine.calculateMatchConfidence(market1, market2);
      expect(confidence).toBeLessThan(0.95);
    });

    test('should handle markets with missing dates', () => {
      const market1 = {
        question: 'Will Trump win the election?'
      };
      const market2 = {
        question: 'Will Trump win the election?'
      };
      const confidence = engine.calculateMatchConfidence(market1, market2);
      expect(confidence).toBeGreaterThan(0.80);
    });

    test('should use title field if question is missing', () => {
      const market1 = {
        title: 'Will Trump win 2024?',
        endDate: '2024-11-06T00:00:00Z'
      };
      const market2 = {
        title: 'Will Trump win 2024?',
        endDate: '2024-11-06T00:00:00Z'
      };
      const confidence = engine.calculateMatchConfidence(market1, market2);
      expect(confidence).toBeGreaterThan(0.90);
    });
  });

  // ====================================================================
  // TEST SUITE 6: Match/No-Match Scenarios (Requirement 3.3)
  // ====================================================================
  describe('Match/No-Match Scenarios', () => {
    test('should match markets above threshold', () => {
      const market1 = {
        id: 'poly-1',
        platform: 'polymarket',
        question: 'Will Donald Trump win the 2024 election?',
        endDate: '2024-11-06T00:00:00Z',
        volume_24h: 100000,
        outcomes: [{ name: 'Yes', price: 0.52 }]
      };
      const market2 = {
        id: 'kalshi-1',
        platform: 'kalshi',
        question: 'Will Trump win 2024 Presidential Election?',
        endDate: '2024-11-06T00:00:00Z',
        volume_24h: 80000,
        outcomes: [{ name: 'Yes', price: 0.53 }]
      };
      
      const unified = engine.findMatches([market1, market2]);
      expect(unified.length).toBe(1);
      expect(Object.keys(unified[0].platforms).length).toBe(2);
    });

    test('should not match markets below threshold', () => {
      const market1 = {
        id: 'poly-1',
        platform: 'polymarket',
        question: 'Will Trump win 2024?',
        endDate: '2024-11-06T00:00:00Z',
        volume_24h: 100000,
        outcomes: [{ name: 'Yes', price: 0.52 }]
      };
      const market2 = {
        id: 'kalshi-1',
        platform: 'kalshi',
        question: 'Will Biden win 2024?',
        endDate: '2024-11-06T00:00:00Z',
        volume_24h: 80000,
        outcomes: [{ name: 'Yes', price: 0.48 }]
      };
      
      const unified = engine.findMatches([market1, market2]);
      expect(unified.length).toBe(2);
      expect(Object.keys(unified[0].platforms).length).toBe(1);
      expect(Object.keys(unified[1].platforms).length).toBe(1);
    });

    test('should create single unified market for multiple matches', () => {
      const market1 = {
        id: 'poly-1',
        platform: 'polymarket',
        question: 'Will Bitcoin reach $100,000 by end of 2024?',
        endDate: '2024-12-31T23:59:59Z',
        volume_24h: 500000,
        outcomes: [{ name: 'Yes', price: 0.35 }]
      };
      const market2 = {
        id: 'kalshi-1',
        platform: 'kalshi',
        question: 'Bitcoin price above $100k by December 2024?',
        endDate: '2024-12-31T23:59:59Z',
        volume_24h: 300000,
        outcomes: [{ name: 'Yes', price: 0.38 }]
      };
      
      const unified = engine.findMatches([market1, market2]);
      expect(unified.length).toBe(1);
      expect(unified[0].platforms.polymarket).toBeDefined();
      expect(unified[0].platforms.kalshi).toBeDefined();
    });

    test('should handle single market without matches', () => {
      const market1 = {
        id: 'poly-1',
        platform: 'polymarket',
        question: 'Will the Lakers win the NBA Championship?',
        endDate: '2025-06-30T00:00:00Z',
        volume_24h: 100000,
        outcomes: [{ name: 'Yes', price: 0.15 }]
      };
      
      const unified = engine.findMatches([market1]);
      expect(unified.length).toBe(1);
      expect(Object.keys(unified[0].platforms).length).toBe(1);
      expect(unified[0].platforms.polymarket).toBeDefined();
    });

    test('should not match markets from same platform', () => {
      const market1 = {
        id: 'poly-1',
        platform: 'polymarket',
        question: 'Will Trump win 2024?',
        endDate: '2024-11-06T00:00:00Z',
        volume_24h: 100000,
        outcomes: [{ name: 'Yes', price: 0.52 }]
      };
      const market2 = {
        id: 'poly-2',
        platform: 'polymarket',
        question: 'Will Trump win 2024?',
        endDate: '2024-11-06T00:00:00Z',
        volume_24h: 100000,
        outcomes: [{ name: 'Yes', price: 0.52 }]
      };
      
      const unified = engine.findMatches([market1, market2]);
      expect(unified.length).toBe(2);
    });

    test('should handle empty market array', () => {
      const unified = engine.findMatches([]);
      expect(unified).toEqual([]);
    });

    test('should handle null or undefined input', () => {
      const unified1 = engine.findMatches(null);
      expect(unified1).toEqual([]);
      
      const unified2 = engine.findMatches(undefined);
      expect(unified2).toEqual([]);
    });
  });

  // ====================================================================
  // TEST SUITE 7: Date Comparison
  // ====================================================================
  describe('Date Comparison', () => {
    test('should return 1.0 for identical dates', () => {
      const score = engine.compareDates('2024-11-06T00:00:00Z', '2024-11-06T00:00:00Z');
      expect(score).toBe(1.0);
    });

    test('should return high score for dates within 1 day', () => {
      const score = engine.compareDates('2024-11-06T00:00:00Z', '2024-11-07T00:00:00Z');
      expect(score).toBeGreaterThanOrEqual(0.9);
    });

    test('should return lower score for dates within 7 days', () => {
      const score = engine.compareDates('2024-11-06T00:00:00Z', '2024-11-10T00:00:00Z');
      expect(score).toBeGreaterThanOrEqual(0.7);
      expect(score).toBeLessThan(0.9);
    });

    test('should return 0 for dates more than 30 days apart', () => {
      const score = engine.compareDates('2024-11-06T00:00:00Z', '2025-01-06T00:00:00Z');
      expect(score).toBe(0.0);
    });

    test('should handle missing dates', () => {
      expect(engine.compareDates(null, null)).toBe(1.0);
      expect(engine.compareDates('2024-11-06T00:00:00Z', null)).toBe(0.5);
      expect(engine.compareDates(null, '2024-11-06T00:00:00Z')).toBe(0.5);
    });

    test('should handle invalid dates', () => {
      const score = engine.compareDates('invalid-date', '2024-11-06T00:00:00Z');
      expect(score).toBe(0.5);
    });
  });
});
