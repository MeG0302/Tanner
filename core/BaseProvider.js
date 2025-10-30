export class BaseProvider {
  constructor(name) {
    this.name = name;
  }

  async fetchMarkets() {
    throw new Error("fetchMarkets() not implemented");
  }

  normalizeMarket(rawData) {
    throw new Error("normalizeMarket() not implemented");
  }
}
