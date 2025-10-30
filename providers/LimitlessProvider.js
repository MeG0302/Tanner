import { BaseProvider } from "../core/BaseProvider.js";
import { MarketModel } from "../core/MarketModel.js";

export class LimitlessProvider extends BaseProvider {
  constructor() {
    super("Limitless");
    this.endpoint = "https://api.limitless.exchange/v1/markets";
  }

  async fetchMarkets() {
    try {
      const res = await fetch(this.endpoint);
      const { data } = await res.json();
      return data.map(m => this.normalizeMarket(m));
    } catch (err) {
      console.error("Limitless fetch error:", err);
      return [];
    }
  }

  normalizeMarket(m) {
    return new MarketModel({
      id: m.id,
      title: m.question,
      provider: this.name,
      yesPrice: parseFloat(m.odds?.yes || 0),
      noPrice: parseFloat(m.odds?.no || 0),
      liquidity: m.liquidity,
      volume24h: m.volume,
      category: m.category,
      expiry: m.expiry
    });
  }
}
