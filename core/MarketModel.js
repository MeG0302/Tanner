export class MarketModel {
  constructor({
    id,
    title,
    provider,
    yesPrice,
    noPrice,
    liquidity,
    volume24h,
    category,
    expiry
  }) {
    this.id = id;
    this.title = title;
    this.provider = provider;
    this.yesPrice = yesPrice;
    this.noPrice = noPrice;
    this.liquidity = liquidity || 0;
    this.volume24h = volume24h || 0;
    this.category = category || "General";
    this.expiry = expiry || null;
  }
}
