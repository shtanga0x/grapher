import axios from 'axios';
import type { CryptoOption, PricePoint } from '../types';

const BINANCE_API_BASE = 'https://api.binance.com/api/v3';

const CRYPTO_SYMBOLS: Record<Exclude<CryptoOption, 'NONE'>, string> = {
  BTC: 'BTCUSDT',
  ETH: 'ETHUSDT',
  SOL: 'SOLUSDT',
};

export async function fetchCryptoPriceHistory(
  crypto: Exclude<CryptoOption, 'NONE'>,
  startTime: number,
  endTime: number
): Promise<PricePoint[]> {
  const symbol = CRYPTO_SYMBOLS[crypto];
  
  // Binance returns max 1000 candles per request
  // Using 1m interval for fine granularity
  const allKlines: PricePoint[] = [];
  let currentStartTime = startTime * 1000; // Convert to milliseconds
  const endTimeMs = endTime * 1000;
  
  while (currentStartTime < endTimeMs) {
    const response = await axios.get(`${BINANCE_API_BASE}/klines`, {
      params: {
        symbol,
        // we use 10 fidelity on polymarket data anyway
        interval: '5m',
        startTime: currentStartTime,
        endTime: endTimeMs,
        limit: 1000,
      },
    });
    
    const klines = response.data as Array<(string | number)[]>;
    
    if (klines.length === 0) break;
    
    for (const kline of klines) {
      allKlines.push({
        t: Math.floor((kline[0] as number) / 1000), // Convert back to seconds
        p: parseFloat(kline[4] as string), // Close price
      });
    }
    
    // Move start time to last candle time + 1 minute
    const lastKlineTime = klines[klines.length - 1][0] as number;
    currentStartTime = lastKlineTime + 60000;
  }
  
  return allKlines.sort((a, b) => a.t - b.t);
}

