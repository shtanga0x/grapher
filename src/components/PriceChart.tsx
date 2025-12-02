import { memo, useMemo, useCallback } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import type { CryptoOption, ChartDataPoint, SelectedBet } from '../types';

// Distinctive green shades for YES bets
const YES_SHADES = [
  '#22C55E', // emerald green
  '#10B981', // teal green
  '#84CC16', // lime green
  '#14B8A6', // cyan-green
  '#4ADE80', // light green
  '#16A34A', // forest green
  '#A3E635', // yellow-green
  '#34D399', // mint green
];

// Distinctive red shades for NO bets
const NO_SHADES = [
  '#FF0000', // red
  '#702963', // byzantium
  '#EC4899', // pink
  '#F43F5E', // rose
  '#FB7185', // light rose
  '#DC2626', // dark red
  '#E11D48', // crimson
  '#800020', // burgundy
];

const SUM_COLOR = '#00D1FF';

// Simple hash function to get consistent color index from bet key
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 6) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

function getBetColor(betKey: string, betType: 'YES' | 'NO'): string {
  const shades = betType === 'YES' ? YES_SHADES : NO_SHADES;
  const index = hashString(betKey) % shades.length;
  return shades[index];
}

const CRYPTO_COLORS: Record<Exclude<CryptoOption, 'NONE'>, string> = {
  BTC: '#F7931A',
  ETH: '#627EEA',
  SOL: '#9945FF',
};

interface PriceChartProps {
  chartData: ChartDataPoint[];
  selectedBets: Map<string, SelectedBet>;
  crypto: CryptoOption;
  cryptoPricesCount: number;
  cryptoPriceRange: { min: number; max: number } | null;
  showSum: boolean;
  showCryptoLine: boolean;
}

function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp * 1000);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

// Static objects to avoid recreating on each render
const CHART_MARGIN = { top: 20, right: 80, bottom: 20, left: 20 };
const GRID_STYLE = { strokeDasharray: '3 3', stroke: 'rgba(139, 157, 195, 0.1)' };
const TOOLTIP_STYLE = {
  backgroundColor: 'rgba(19, 26, 42, 0.95)',
  border: '1px solid rgba(139, 157, 195, 0.3)',
  borderRadius: 8,
};
const LEGEND_WRAPPER_STYLE = { paddingTop: 20 };
const LEFT_Y_AXIS_LABEL = {
  value: 'Probability',
  angle: -90,
  position: 'insideLeft' as const,
  style: { fill: '#8B9DC3' },
};
const REFERENCE_LINE_STYLE = { stroke: 'rgba(139, 157, 195, 0.3)', strokeDasharray: '5 5' };
const ACTIVE_DOT = { r: 4 };

function PriceChartComponent({
  chartData,
  selectedBets,
  crypto,
  cryptoPricesCount,
  cryptoPriceRange,
  showSum,
  showCryptoLine,
}: PriceChartProps) {
  // Memoize Y-axis formatters
  const formatYAxisPercent = useCallback((v: number) => `${(v * 100).toFixed(0)}%`, []);
  const formatYAxisDollar = useCallback((v: number) => `$${v.toLocaleString()}`, []);

  // Memoize tooltip formatter - depends on crypto
  const tooltipFormatter = useCallback(
    (value: number, name: string) => {
      if (name.startsWith(crypto)) {
        return [`$${value.toLocaleString()}`, name];
      }
      return [`${(value * 100).toFixed(2)}%`, name];
    },
    [crypto]
  );

  // Memoize legend formatter
  const legendFormatter = useCallback((value: string) => value, []);

  // Memoize right Y-axis label - depends on crypto
  const rightYAxisLabel = useMemo(
    () =>
      crypto !== 'NONE'
        ? {
            value: `${crypto} Price`,
            angle: 90,
            position: 'right' as const,
            offset: 25,
            style: { fill: CRYPTO_COLORS[crypto] },
          }
        : null,
    [crypto]
  );

  // Memoize right Y-axis domain - depends on cryptoPriceRange
  const rightYAxisDomain = useMemo(
    () =>
      cryptoPriceRange
        ? [cryptoPriceRange.min * 0.99, cryptoPriceRange.max * 1.01]
        : undefined,
    [cryptoPriceRange]
  );

  // Memoize bet lines to prevent recreation
  const betLines = useMemo(
    () =>
      Array.from(selectedBets.entries()).map(([betKey, bet]) => {
        let name = `${bet.question} (${bet.type})`;
        if (bet.groupItemTitle) {
          name = `${bet.groupItemTitle} (${bet.type})`;
        }
        const color = getBetColor(betKey, bet.type);
        return (
          <Line
            key={betKey}
            yAxisId="left"
            type="monotone"
            dataKey={betKey}
            name={name}
            stroke={color}
            strokeWidth={2}
            dot={false}
            activeDot={ACTIVE_DOT}
            connectNulls
          />
      )
    }),
    [selectedBets]
  );

  const shouldShowSum = showSum && selectedBets.size > 1;
  const shouldShowCrypto = showCryptoLine && crypto !== 'NONE' && cryptoPricesCount > 0;

  return (
    <ResponsiveContainer width="100%" minHeight={600}>
      <LineChart data={chartData} margin={CHART_MARGIN}>
        <CartesianGrid {...GRID_STYLE} />
        <XAxis
          dataKey="timestamp"
          tickFormatter={formatTimestamp}
          stroke="#8B9DC3"
          fontSize={12}
          tickMargin={10}
          minTickGap={35}
        />
        <YAxis
          yAxisId="left"
          domain={[0, 1]}
          tickFormatter={formatYAxisPercent}
          stroke="#8B9DC3"
          fontSize={12}
          label={LEFT_Y_AXIS_LABEL}
        />
        {crypto !== 'NONE' && cryptoPriceRange && (
          <YAxis
            yAxisId="right"
            orientation="right"
            domain={rightYAxisDomain}
            tickFormatter={formatYAxisDollar}
            stroke={CRYPTO_COLORS[crypto]}
            fontSize={12}
            width={80}
            label={rightYAxisLabel!}
          />
        )}
        <Tooltip
          contentStyle={TOOLTIP_STYLE}
          labelFormatter={formatTimestamp}
          formatter={tooltipFormatter}
        />
        <Legend
          layout="vertical"
          align="center"
          verticalAlign="bottom"
          wrapperStyle={LEGEND_WRAPPER_STYLE}
          formatter={legendFormatter}
        />
        <ReferenceLine yAxisId="left" y={0.5} {...REFERENCE_LINE_STYLE} />
        {betLines}
        {shouldShowSum && (
          <Line
            yAxisId="left"
            type="monotone"
            dataKey="sum"
            name="Sum"
            stroke={SUM_COLOR}
            strokeWidth={3}
            dot={false}
            activeDot={ACTIVE_DOT}
            connectNulls
          />
        )}
        {shouldShowCrypto && (
          <Line
            yAxisId="right"
            type="monotone"
            dataKey={crypto}
            name={`${crypto} Price`}
            stroke={CRYPTO_COLORS[crypto]}
            strokeWidth={2}
            dot={false}
            activeDot={ACTIVE_DOT}
            connectNulls
          />
        )}
      </LineChart>
    </ResponsiveContainer>
  );
}

// Custom comparison function for React.memo
function arePropsEqual(
  prevProps: PriceChartProps,
  nextProps: PriceChartProps
): boolean {
  // Simple value comparisons
  if (prevProps.crypto !== nextProps.crypto) return false;
  if (prevProps.cryptoPricesCount !== nextProps.cryptoPricesCount) return false;
  if (prevProps.showSum !== nextProps.showSum) return false;
  if (prevProps.showCryptoLine !== nextProps.showCryptoLine) return false;

  // Compare chartData by reference (it's already memoized in parent)
  if (prevProps.chartData !== nextProps.chartData) return false;

  // Compare selectedBets map
  if (prevProps.selectedBets !== nextProps.selectedBets) {
    if (prevProps.selectedBets.size !== nextProps.selectedBets.size) return false;
    for (const [key, value] of prevProps.selectedBets) {
      const nextValue = nextProps.selectedBets.get(key);
      if (!nextValue || nextValue !== value) return false;
    }
  }

  // Compare cryptoPriceRange
  if (prevProps.cryptoPriceRange !== nextProps.cryptoPriceRange) {
    if (!prevProps.cryptoPriceRange || !nextProps.cryptoPriceRange) return false;
    if (
      prevProps.cryptoPriceRange.min !== nextProps.cryptoPriceRange.min ||
      prevProps.cryptoPriceRange.max !== nextProps.cryptoPriceRange.max
    ) {
      return false;
    }
  }

  return true;
}

export const PriceChart = memo(PriceChartComponent, arePropsEqual);

