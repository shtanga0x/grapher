export interface Market {
  id: string;
  question: string;
  groupItemTitle: string;
  groupItemThreshold: number;
  endDate: number; // Unix timestamp (seconds)
  startDate: number; // Unix timestamp (seconds)
  clobTokenIds: string; // JSON-encoded string
}

export interface PolymarketEvent {
  id: string;
  slug: string;
  title: string;
  description: string;
  startDate: number; // Unix timestamp (seconds)
  endDate: number; // Unix timestamp (seconds)
  markets: Market[];
}

export interface PricePoint {
  t: number; // Unix timestamp
  p: number; // Price
}

export interface PriceHistory {
  history: PricePoint[];
}

export interface ParsedMarket {
  id: string;
  question: string;
  groupItemTitle: string;
  groupItemThreshold: number;
  endDate: number; // Unix timestamp (seconds)
  startDate: number; // Unix timestamp (seconds)
  yesTokenId: string;
  noTokenId: string;
}

export type CryptoOption = 'BTC' | 'ETH' | 'SOL' | 'NONE';

export interface ChartDataPoint {
  timestamp: number;
  [key: string]: number;
}

export interface SelectedBet {
  marketId: string;
  question: string;
  groupItemTitle: string;
  startDate: number; // Unix timestamp (seconds)
  type: 'YES' | 'NO';
  tokenId: string;
}

export interface BinanceKline {
  openTime: number;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
  closeTime: number;
  quoteAssetVolume: string;
  numberOfTrades: number;
  takerBuyBaseAssetVolume: string;
  takerBuyQuoteAssetVolume: string;
}

