/**
 * Simple test runner for MarketMatchingEngine unit tests
 * This validates the test file works without requiring Jest to be installed
 */

const MarketMatchingEngine = require('./MarketMatchingEngine');

// Simple test framework
class TestRunner {
  constructor() {
    this.tests = [];
    this.currentSuite = null;
    this.passed = 0;
    this.failed = 0;
    this.errors = [];
  }

  describe(name, fn) {
    this.currentSuite = name;
    console.log(`\n${'='.repeat(80)}`);
    console.log(`TEST SUITE: ${name}`);
    console.log('='.repeat(80));
    fn();
    this.currentSuite = null;
  }

  test(name, fn) {
    try {
      fn();
      this.passed++;
      console.log(`✓ ${name}`);
    } catch (error) {
      this.failed++;
      this.errors.push({ suite: this.currentSuite, test: name, error: error.message });
      console.log(`✗ ${name}`);
      console.log(`  Error: ${error.message}`);
    }
  }

  expect(value) {
    return {
      toBe: (expected) => {
        if (value !== expected) {
          throw new Error(`Expected ${value} to be ${expected}`);
        }
      },
      toEqual: (expected) => {
        if (JSON.stringify(value) !== JSON.stringify(expected)) {
          throw new Error(`Expected ${JSON.stringify(value)} to equal ${JSON.stringify(expected)}`);
        }
      },
      toBeGreaterThan: (expected) => {
        if (value <= expected) {
          throw new Error(`Expected ${value} to be greater than ${expected}`);
        }
      },
      toBeLessThan: (expected) => {
        if (value >= expected) {
          throw new Error(`Expected ${value} to be less than ${expected}`);
        }
      },
      toBeGreaterThanOrEqual: (expected) => {
        if (value < expected) {
          throw new Error(`Expected ${value} to be greater than or equal to ${expected}`);
        }
      },
      toContain: (expected) => {
        if (!value.includes(expected)) {
          throw new Error(`Expected ${value} to contain ${expected}`);
        }
      },
      toBeDefined: () => {
        if (value === undefined) {
          throw new Error(`Expected value to be defined`);
        }
      },
      not: {
        toContain: (expected) => {
          if (value.includes(expected)) {
            throw new Error(`Expected ${value} not to contain ${expected}`);
          }
        }
      }
    };
  }

  beforeEach(fn) {
    // Simple implementation - just run before each test
    this.beforeEachFn = fn;
  }

  summary() {
    console.log(`\n${'='.repeat(80)}`);
    console.log('TEST SUMMARY');
    console.log('='.repeat(80));
    console.log(`Total: ${this.passed + this.failed}`);
    console.log(`Passed: ${this.passed}`);
    console.log(`Failed: ${this.failed}`);
    
    if (this.failed > 0) {
      console.log(`\nFailed Tests:`);
      this.errors.forEach(err => {
        console.log(`  - ${err.suite}: ${err.test}`);
        console.log(`    ${err.error}`);
      });
    }
    
    return this.failed === 0;
  }
}

// Create test runner
const runner = new TestRunner();
const describe = runner.describe.bind(runner);
const test = runner.test.bind(runner);
const expect = runner.expect.bind(runner);
const beforeEach = runner.beforeEach.bind(runner);

// Run a subset of critical tests
let engine;

beforeEach(() => {
  engine = new MarketMatchingEngine();
});

// ====================================================================
// Critical Tests for Levenshtein Distance
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

  test('should calculate correct distance for multiple edits', () => {
    const distance = engine.levenshteinDistance('kitten', 'sitting');
    expect(distance).toBe(3);
  });

  test('should handle empty strings', () => {
    expect(engine.levenshteinDistance('', 'hello')).toBe(5);
    expect(engine.levenshteinDistance('hello', '')).toBe(5);
  });
});

// ====================================================================
// Critical Tests for Entity Extraction
// ====================================================================
describe('Entity Extraction', () => {
  test('should extract person names from questions', () => {
    const entities = engine.extractEntities('Will Donald Trump win the 2024 election?');
    expect(entities.names).toContain('Donald Trump');
  });

  test('should extract year dates', () => {
    const entities = engine.extractEntities('Will Trump win the 2024 election?');
    expect(entities.dates).toContain('2024');
  });

  test('should extract event keywords', () => {
    const entities = engine.extractEntities('Will Trump win the 2024 election?');
    expect(entities.events).toContain('win');
    expect(entities.events).toContain('election');
  });

  test('should handle empty input', () => {
    const entities = engine.extractEntities('');
    expect(entities).toEqual({ names: [], dates: [], events: [] });
  });
});

// ====================================================================
// Critical Tests for Confidence Scoring
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
});

// ====================================================================
// Critical Tests for Match/No-Match Scenarios
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
  });

  test('should handle empty market array', () => {
    const unified = engine.findMatches([]);
    expect(unified).toEqual([]);
  });
});

// Run summary
const success = runner.summary();
process.exit(success ? 0 : 1);
