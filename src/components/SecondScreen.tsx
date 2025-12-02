import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import {
  Box,
  Typography,
  Paper,
  Checkbox,
  FormControlLabel,
  CircularProgress,
  IconButton,
  Chip,
  Alert,
  Switch,
} from '@mui/material';
import { ArrowBack } from '@mui/icons-material';
import type { CryptoOption, ParsedMarket, PolymarketEvent, PricePoint, SelectedBet, ChartDataPoint } from '../types';
import { fetchPriceHistory } from '../api/polymarket';
import { fetchCryptoPriceHistory } from '../api/binance';
import { PriceChart } from './PriceChart';

interface SecondScreenProps {
  event: PolymarketEvent;
  markets: ParsedMarket[];
  crypto: CryptoOption;
  onBack: () => void;
}

const BET_COLORS: Record<string, string> = {
  yes: '#22C55E',
  no: '#EF4444',
};

const CRYPTO_COLORS: Record<Exclude<CryptoOption, 'NONE'>, string> = {
  BTC: '#F7931A',
  ETH: '#627EEA',
  SOL: '#9945FF',
};

function generateBetKey(marketId: string, type: 'YES' | 'NO'): string {
  return `${marketId}-${type}`;
}

function findNearestPrice(
  history: PricePoint[],
  targetTimestamp: number,
  maxDeltaSeconds: number = 270 // 4.5 minutes
): number | null {
  if (history.length === 0) return null;

  // Binary search to find insertion point
  let left = 0;
  let right = history.length;

  while (left < right) {
    const mid = Math.floor((left + right) / 2);
    if (history[mid].t < targetTimestamp) {
      left = mid + 1;
    } else {
      right = mid;
    }
  }

  // Check candidates: element at insertion point and the one before it
  const candidates: PricePoint[] = [];
  if (left < history.length) candidates.push(history[left]);
  if (left > 0) candidates.push(history[left - 1]);

  let nearest: PricePoint | null = null;
  let minDelta = Infinity;

  for (const point of candidates) {
    const delta = Math.abs(point.t - targetTimestamp);
    if (delta < minDelta && delta <= maxDeltaSeconds) {
      minDelta = delta;
      nearest = point;
    }
  }

  return nearest ? nearest.p : null;
}

export function SecondScreen({
  event,
  markets,
  crypto,
  onBack,
}: SecondScreenProps) {
  const [selectedBets, setSelectedBets] = useState<Map<string, SelectedBet>>(
    new Map()
  );
  const [priceHistories, setPriceHistories] = useState<
    Map<string, PricePoint[]>
  >(new Map());
  const [cryptoPrices, setCryptoPrices] = useState<PricePoint[]>([]);
  const [loadingBets, setLoadingBets] = useState<Set<string>>(new Set());
  const [loadingCrypto, setLoadingCrypto] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSum, setShowSum] = useState(true);
  const [showCryptoLine, setShowCryptoLine] = useState(true);

  // Track cached crypto data range and which crypto it belongs to
  const cryptoCacheRef = useRef<{
    crypto: CryptoOption;
    min: number;
    max: number;
  } | null>(null);

  const handleBetToggle = useCallback(
    async (market: ParsedMarket, type: 'YES' | 'NO') => {
      const betKey = generateBetKey(market.id, type);
      const tokenId = type === 'YES' ? market.yesTokenId : market.noTokenId;

      setSelectedBets((prev) => {
        const newMap = new Map(prev);
        if (newMap.has(betKey)) {
          newMap.delete(betKey);
        } else {
          newMap.set(betKey, {
            marketId: market.id,
            question: market.question,
            groupItemTitle: market.groupItemTitle,
            startDate: market.startDate,
            type,
            tokenId,
          });
        }
        return newMap;
      });

      // If we're adding a bet and don't have its history, fetch it
      if (!selectedBets.has(betKey) && !priceHistories.has(betKey)) {
        setLoadingBets((prev) => new Set(prev).add(betKey));
        setError(null);

        try {
          const history = await fetchPriceHistory(tokenId, market.startDate.toString(), 10);
          setPriceHistories((prev) => {
            const newMap = new Map(prev);
            const sortedHistory = [...history.history].sort((a, b) => a.t - b.t);
            newMap.set(betKey, sortedHistory);
            return newMap;
          });
        } catch (err) {
          console.error('Failed to fetch price history:', err);
          setError(
            `Failed to fetch price history for ${market.question} (${type})`
          );
          // Remove the bet from selection if fetch failed
          setSelectedBets((prev) => {
            const newMap = new Map(prev);
            newMap.delete(betKey);
            return newMap;
          });
        } finally {
          setLoadingBets((prev) => {
            const newSet = new Set(prev);
            newSet.delete(betKey);
            return newSet;
          });
        }
      }
    },
    [selectedBets, priceHistories]
  );

  // Get time range from all selected bets
  const timeRange = useMemo(() => {
    let minTime = Infinity;
    let maxTime = -Infinity;

    for (const [betKey] of selectedBets) {
      const history = priceHistories.get(betKey);
      if (history && history.length > 0) {
        minTime = Math.min(minTime, history[0].t);
        maxTime = Math.max(maxTime, history[history.length - 1].t);
      }
    }

    if (minTime === Infinity || maxTime === -Infinity) {
      return null;
    }

    return { min: minTime, max: maxTime };
  }, [selectedBets, priceHistories]);

  // Fetch crypto prices when time range changes (with smart caching)
  useEffect(() => {
    if (crypto === 'NONE' || !timeRange) {
      if (cryptoPrices.length > 0) {
        setCryptoPrices([]);
      }
      cryptoCacheRef.current = null;
      return;
    }

    const fetchCrypto = async () => {
      const cache = cryptoCacheRef.current;

      // If crypto changed or no cache exists, fetch entire range
      if (!cache || cache.crypto !== crypto || cryptoPrices.length === 0) {
        setLoadingCrypto(true);
        try {
          const prices = await fetchCryptoPriceHistory(
            crypto,
            timeRange.min,
            timeRange.max
          );
          setCryptoPrices(prices);
          cryptoCacheRef.current = {
            crypto,
            min: timeRange.min,
            max: timeRange.max,
          };
        } catch (err) {
          console.error('Failed to fetch crypto prices:', err);
          setError(`Failed to fetch ${crypto} price data`);
        } finally {
          setLoadingCrypto(false);
        }
        return;
      }

      // Check if new range is fully covered by cached data
      if (timeRange.min >= cache.min && timeRange.max <= cache.max) {
        return; // Already have all the data
      }

      // Determine what ranges need to be fetched
      const fetchRanges: Array<{ min: number; max: number }> = [];

      if (timeRange.min < cache.min) {
        // Need to fetch data before cached range
        fetchRanges.push({ min: timeRange.min, max: cache.min });
      }

      if (timeRange.max > cache.max) {
        // Need to fetch data after cached range
        fetchRanges.push({ min: cache.max, max: timeRange.max });
      }

      if (fetchRanges.length === 0) {
        return;
      }

      setLoadingCrypto(true);
      try {
        const newPricesArrays = await Promise.all(
          fetchRanges.map((range) =>
            fetchCryptoPriceHistory(crypto, range.min, range.max)
          )
        );

        // Merge all prices and sort
        const allPrices = [...cryptoPrices, ...newPricesArrays.flat()];
        allPrices.sort((a, b) => a.t - b.t);

        // Remove duplicates (same timestamp)
        const dedupedPrices = allPrices.filter(
          (price, index, arr) => index === 0 || price.t !== arr[index - 1].t
        );

        setCryptoPrices(dedupedPrices);
        cryptoCacheRef.current = {
          crypto,
          min: Math.min(timeRange.min, cache.min),
          max: Math.max(timeRange.max, cache.max),
        };
      } catch (err) {
        console.error('Failed to fetch crypto prices:', err);
        setError(`Failed to fetch ${crypto} price data`);
      } finally {
        setLoadingCrypto(false);
      }
    };

    fetchCrypto();
  }, [crypto, timeRange]);

  // Build chart data
  const chartData = useMemo(() => {
    const dataMap = new Map<number, ChartDataPoint>();
    const betKeys = Array.from(selectedBets.keys());

    // Collect all unique timestamps
    for (const betKey of betKeys) {
      const history = priceHistories.get(betKey);
      if (history) {
        for (const point of history) {
          if (!dataMap.has(point.t)) {
            dataMap.set(point.t, { timestamp: point.t });
          }
        }
      }
    }

    // Add crypto timestamps if available
    if (crypto !== 'NONE' && cryptoPrices.length > 0) {
      for (const point of cryptoPrices) {
        if (!dataMap.has(point.t)) {
          dataMap.set(point.t, { timestamp: point.t });
        }
      }
    }

    // Fill in prices for each timestamp
    const timestamps = Array.from(dataMap.keys()).sort((a, b) => a - b);

    for (const timestamp of timestamps) {
      const dataPoint = dataMap.get(timestamp)!;
      let sum = 0;
      let validBetsForSum = 0;

      for (const betKey of betKeys) {
        const history = priceHistories.get(betKey);
        if (history) {
          const price = findNearestPrice(history, timestamp);
          if (price !== null) {
            dataPoint[betKey] = price;
            sum += price;
            validBetsForSum++;
          }
        }
      }

      // Add sum if we have multiple bets
      if (betKeys.length > 1 && validBetsForSum === betKeys.length) {
        dataPoint['sum'] = sum;
      }

      // Add crypto price
      if (crypto !== 'NONE' && cryptoPrices.length > 0) {
        const cryptoPrice = findNearestPrice(cryptoPrices, timestamp, 120); // 2 minutes for crypto
        if (cryptoPrice !== null) {
          dataPoint[crypto] = cryptoPrice;
        }
      }
    }

    return timestamps.map((t) => dataMap.get(t)!);
  }, [selectedBets, priceHistories, crypto, cryptoPrices]);

  // Get crypto price range for secondary Y axis
  const cryptoPriceRange = useMemo(() => {
    if (crypto === 'NONE' || cryptoPrices.length === 0) return null;
    const prices = cryptoPrices.map((p) => p.p);
    return {
      min: Math.min(...prices),
      max: Math.max(...prices),
    };
  }, [crypto, cryptoPrices]);

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        p: 3,
        gap: 3,
      }}
    >
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <IconButton
          onClick={onBack}
          sx={{
            bgcolor: 'rgba(139, 157, 195, 0.1)',
            '&:hover': { bgcolor: 'rgba(139, 157, 195, 0.2)' },
          }}
        >
          <ArrowBack />
        </IconButton>
        <Box sx={{ flex: 1 }}>
          <Typography
            variant="h4"
            sx={{
              fontWeight: 700,
              background: 'linear-gradient(90deg, #E8EDF5 0%, #00D1FF 100%)',
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            {event.title}
          </Typography>
          {crypto !== 'NONE' && (
            <Chip
              label={`Comparing with ${crypto}`}
              size="small"
              sx={{
                mt: 1,
                bgcolor: `${CRYPTO_COLORS[crypto]}20`,
                color: CRYPTO_COLORS[crypto],
                border: `1px solid ${CRYPTO_COLORS[crypto]}40`,
              }}
            />
          )}
        </Box>
      </Box>

      {error && (
        <Alert
          severity="error"
          onClose={() => setError(null)}
          sx={{
            bgcolor: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
          }}
        >
          {error}
        </Alert>
      )}

      {/* Chart */}
      <Paper
        elevation={0}
        sx={{
          flex: 1,
          minHeight: 500,
          p: 3,
          border: '1px solid rgba(139, 157, 195, 0.15)',
        }}
      >
        {selectedBets.size === 0 ? (
          <Box
            sx={{
              height: '100%',
              minHeight: 440,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'column',
              gap: 2,
              color: 'text.secondary',
            }}
          >
            <Typography variant="h6">No bets selected</Typography>
            <Typography variant="body2">
              Select bets below to visualize their price history
            </Typography>
          </Box>
        ) : loadingBets.size > 0 || loadingCrypto ? (
          <Box
            sx={{
              height: '100%',
              minHeight: 440,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <CircularProgress />
          </Box>
        ) : (
          <PriceChart
            chartData={chartData}
            selectedBets={selectedBets}
            crypto={crypto}
            cryptoPricesCount={cryptoPrices.length}
            cryptoPriceRange={cryptoPriceRange}
            showSum={showSum}
            showCryptoLine={showCryptoLine}
          />
        )}

        {/* Chart toggles */}
        {selectedBets.size > 0 && (selectedBets.size > 1 || (crypto !== 'NONE' && cryptoPrices.length > 0)) && (
          <Box
            sx={{
              display: 'flex',
              gap: 3,
              mt: 2,
              pt: 2,
              borderTop: '1px solid rgba(139, 157, 195, 0.1)',
              justifyContent: 'center',
              flexWrap: 'wrap',
            }}
          >
            {selectedBets.size > 1 && (
              <FormControlLabel
                control={
                  <Switch
                    checked={showSum}
                    onChange={(e) => setShowSum(e.target.checked)}
                    sx={{
                      '& .MuiSwitch-switchBase.Mui-checked': {
                        color: '#00D1FF',
                      },
                      '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                        backgroundColor: '#00D1FF',
                      },
                    }}
                  />
                }
                label={
                  <Typography sx={{ color: '#00D1FF', fontWeight: 500 }}>
                    Показывать сумму
                  </Typography>
                }
              />
            )}
            {crypto !== 'NONE' && cryptoPrices.length > 0 && (
              <FormControlLabel
                control={
                  <Switch
                    checked={showCryptoLine}
                    onChange={(e) => setShowCryptoLine(e.target.checked)}
                    sx={{
                      '& .MuiSwitch-switchBase.Mui-checked': {
                        color: CRYPTO_COLORS[crypto],
                      },
                      '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                        backgroundColor: CRYPTO_COLORS[crypto],
                      },
                    }}
                  />
                }
                label={
                  <Typography sx={{ color: CRYPTO_COLORS[crypto], fontWeight: 500 }}>
                    Показывать цену {crypto}
                  </Typography>
                }
              />
            )}
          </Box>
        )}
      </Paper>

      {/* Markets Selection */}
      <Paper
        elevation={0}
        sx={{
          p: 3,
          border: '1px solid rgba(139, 157, 195, 0.15)',
        }}
      >
        <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
          Select Markets to Display
        </Typography>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))',
            gap: 2,
          }}
        >
          {markets.map((market) => {
            const yesKey = generateBetKey(market.id, 'YES');
            const noKey = generateBetKey(market.id, 'NO');
            const isYesLoading = loadingBets.has(yesKey);
            const isNoLoading = loadingBets.has(noKey);

            return (
              <Paper
                key={market.id}
                elevation={0}
                sx={{
                  p: 2,
                  bgcolor: 'rgba(10, 14, 23, 0.5)',
                  border: '1px solid rgba(139, 157, 195, 0.1)',
                  borderRadius: 2,
                }}
              >
                <Typography
                  variant="body1"
                  sx={{ fontWeight: 500, mb: 1.5 }}
                >
                  {market.groupItemTitle ? market.groupItemTitle : market.question}
                </Typography>
                <Box sx={{ display: 'flex', gap: 3 }}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={selectedBets.has(yesKey)}
                        onChange={() => handleBetToggle(market, 'YES')}
                        disabled={isYesLoading}
                        sx={{
                          '&.Mui-checked': { color: BET_COLORS.yes },
                        }}
                      />
                    }
                    label={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <span style={{ color: BET_COLORS.yes }}>YES</span>
                        {isYesLoading && <CircularProgress size={16} />}
                      </Box>
                    }
                  />
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={selectedBets.has(noKey)}
                        onChange={() => handleBetToggle(market, 'NO')}
                        disabled={isNoLoading}
                        sx={{
                          '&.Mui-checked': { color: BET_COLORS.no },
                        }}
                      />
                    }
                    label={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <span style={{ color: BET_COLORS.no }}>NO</span>
                        {isNoLoading && <CircularProgress size={16} />}
                      </Box>
                    }
                  />
                </Box>
              </Paper>
            );
          })}
        </Box>
      </Paper>
    </Box>
  );
}

