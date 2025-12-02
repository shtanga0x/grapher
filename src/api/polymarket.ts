import axios from 'axios';
import type { PolymarketEvent, PriceHistory, ParsedMarket } from '../types';
import { API_CONFIG } from './config';

const { GAMMA_API_BASE, CLOB_API_BASE } = API_CONFIG;

/** Parse ISO 8601 date string to Unix timestamp (seconds) */
function parseTimestamp(isoString: string): number {
  return Math.floor(new Date(isoString).getTime() / 1000);
}

export async function fetchEventBySlug(slug: string): Promise<PolymarketEvent> {
  const response = await axios.get<PolymarketEvent>(
    `${GAMMA_API_BASE}/events/slug/${slug}`
  );
  const data = response.data;
  
  // Parse date strings to Unix timestamps
  return {
    ...data,
    startDate: parseTimestamp(data.startDate as unknown as string),
    endDate: parseTimestamp(data.endDate as unknown as string),
    markets: data.markets
      .map((market) => ({
        ...market,
        startDate: parseTimestamp(market.startDate as unknown as string),
        endDate: parseTimestamp(market.endDate as unknown as string),
      }))
      .sort((a, b) => {
        if (a.groupItemThreshold && b.groupItemThreshold) {
          return a.groupItemThreshold - b.groupItemThreshold;
        }
        
        if (a.groupItemTitle && b.groupItemTitle) {
          return a.groupItemTitle.localeCompare(b.groupItemTitle);
        }

        return a.question.localeCompare(b.question);
      }),
  };
}

export async function fetchPriceHistory(
  tokenId: string,
  startTs: string,
  fidelity: number = 10
): Promise<PriceHistory> {
  const response = await axios.get<PriceHistory>(
    `${CLOB_API_BASE}/prices-history`,
    {
      params: {
        market: tokenId,
        startTs,
        fidelity,
      },
    }
  );
  return response.data;
}

export function parseMarkets(markets: PolymarketEvent['markets']): ParsedMarket[] {
  return markets.map((market) => {
    const tokenIds = JSON.parse(market.clobTokenIds) as string[];
    return {
      id: market.id,
      question: market.question,
      groupItemTitle: market.groupItemTitle,
      groupItemThreshold: market.groupItemThreshold,
      endDate: market.endDate,
      startDate: market.startDate,
      yesTokenId: tokenIds[0],
      noTokenId: tokenIds[1],
    };
  });
}

export function extractSlugFromUrl(url: string): string | null {
  const regex = /^https?:\/\/(?:www\.)?polymarket\.com\/event\/([a-zA-Z0-9-]+)\/?.*$/;
  const match = url.match(regex);
  return match ? match[1] : null;
}

export function isValidPolymarketUrl(url: string): boolean {
  return extractSlugFromUrl(url) !== null;
}

