import { PolymarketProvider } from "./providers/PolymarketProvider.js";
import { KalshiProvider } from "./providers/KalshiProvider.js";
import { LimitlessProvider } from "./providers/LimitlessProvider.js";

export class TannerAggregator {
  constructor() {
    this.providers = [
      new PolymarketProvider(),
      new KalshiProvider(),
      new LimitlessProvider()
    ];
  }

  async fetchAllMarkets() {
    const results = await Promise.allSettled(
      this.providers.map(p => p.fetchMarkets())
    );

    const allMarkets = results.flatMap(r => (r.value ? r.value : []));
    return allMarkets.sort((a, b) => b.liquidity - a.liquidity);
  }
}
