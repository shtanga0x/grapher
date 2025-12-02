import { useState, useCallback } from 'react';
import {
  Box,
  TextField,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Typography,
  Alert,
  CircularProgress,
  Paper,
} from '@mui/material';
import { TrendingUp, ShowChart } from '@mui/icons-material';
import type { SelectChangeEvent } from '@mui/material';
import type { CryptoOption, ParsedMarket, PolymarketEvent } from '../types';
import {
  isValidPolymarketUrl,
  extractSlugFromUrl,
  fetchEventBySlug,
  parseMarkets,
} from '../api/polymarket';

interface FirstScreenProps {
  onNavigateToChart: (
    event: PolymarketEvent,
    markets: ParsedMarket[],
    crypto: CryptoOption
  ) => void;
}

export function FirstScreen({ onNavigateToChart }: FirstScreenProps) {
  const [url, setUrl] = useState('');
  const [crypto, setCrypto] = useState<CryptoOption>('NONE');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const isValidUrl = isValidPolymarketUrl(url);

  const handleUrlChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setUrl(e.target.value);
      setError(null);
    },
    []
  );

  const handleCryptoChange = useCallback((e: SelectChangeEvent) => {
    setCrypto(e.target.value as CryptoOption);
  }, []);

  const handleSubmit = useCallback(async () => {
    const slug = extractSlugFromUrl(url);
    if (!slug) {
      setError('Invalid Polymarket URL');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const eventData = await fetchEventBySlug(slug);
      const parsedMarkets = parseMarkets(eventData.markets);
      onNavigateToChart(eventData, parsedMarkets, crypto);
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Failed to fetch event data. Please check the URL and try again.');
      }
    } finally {
      setLoading(false);
    }
  }, [url, crypto, onNavigateToChart]);

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        p: 3,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Background decorations */}
      <Box
        sx={{
          position: 'absolute',
          top: '-20%',
          left: '-10%',
          width: '60%',
          height: '60%',
          background:
            'radial-gradient(ellipse at center, rgba(0, 209, 255, 0.08) 0%, transparent 70%)',
          pointerEvents: 'none',
        }}
      />
      <Box
        sx={{
          position: 'absolute',
          bottom: '-20%',
          right: '-10%',
          width: '50%',
          height: '50%',
          background:
            'radial-gradient(ellipse at center, rgba(255, 107, 53, 0.06) 0%, transparent 70%)',
          pointerEvents: 'none',
        }}
      />

      <Paper
        elevation={0}
        sx={{
          maxWidth: 600,
          width: '100%',
          p: 5,
          border: '1px solid rgba(139, 157, 195, 0.15)',
          position: 'relative',
          zIndex: 1,
        }}
      >
        {/* Logo/Header */}
        <Box sx={{ textAlign: 'center', mb: 5 }}>
          <Box
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 72,
              height: 72,
              borderRadius: '16px',
              background: 'linear-gradient(135deg, #00D1FF 0%, #00A3CC 100%)',
              mb: 3,
              boxShadow: '0 8px 32px rgba(0, 209, 255, 0.3)',
            }}
          >
            <ShowChart sx={{ fontSize: 40, color: '#0A0E17' }} />
          </Box>
          <Typography
            variant="h3"
            sx={{
              fontWeight: 700,
              background: 'linear-gradient(90deg, #E8EDF5 0%, #00D1FF 100%)',
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              mb: 1,
            }}
          >
            Polymarket Grapher
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Visualize prediction market prices alongside crypto trends
          </Typography>
        </Box>

        {/* Form */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <TextField
            fullWidth
            label="Polymarket Event URL"
            placeholder="https://polymarket.com/event/bitcoin-above-on-december-1"
            value={url}
            onChange={handleUrlChange}
            error={url.length > 0 && !isValidUrl}
            helperText={
              url.length > 0 && !isValidUrl
                ? 'Enter a valid Polymarket event URL'
                : 'Paste the full URL of any Polymarket event'
            }
            InputProps={{
              startAdornment: (
                <TrendingUp
                  sx={{ mr: 1.5, color: 'text.secondary', fontSize: 20 }}
                />
              ),
            }}
          />

          <FormControl fullWidth>
            <InputLabel id="crypto-select-label">
              Compare with Cryptocurrency
            </InputLabel>
            <Select
              labelId="crypto-select-label"
              value={crypto}
              label="Compare with Cryptocurrency"
              onChange={handleCryptoChange}
            >
              <MenuItem value="NONE">Don't show crypto price</MenuItem>
              <MenuItem value="BTC">
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Box
                    sx={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      bgcolor: '#F7931A',
                    }}
                  />
                  Bitcoin (BTC)
                </Box>
              </MenuItem>
              <MenuItem value="ETH">
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Box
                    sx={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      bgcolor: '#627EEA',
                    }}
                  />
                  Ethereum (ETH)
                </Box>
              </MenuItem>
              <MenuItem value="SOL">
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Box
                    sx={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      bgcolor: '#9945FF',
                    }}
                  />
                  Solana (SOL)
                </Box>
              </MenuItem>
            </Select>
          </FormControl>

          {error && (
            <Alert
              severity="error"
              sx={{
                bgcolor: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
              }}
            >
              {error}
            </Alert>
          )}

          <Button
            variant="contained"
            size="large"
            disabled={!isValidUrl || loading}
            onClick={handleSubmit}
            sx={{
              mt: 1,
              py: 1.5,
              fontSize: '1.1rem',
              background: isValidUrl
                ? 'linear-gradient(135deg, #00D1FF 0%, #00A3CC 100%)'
                : undefined,
            }}
          >
            {loading ? (
              <CircularProgress size={24} sx={{ color: 'inherit' }} />
            ) : (
              'Visualize Event'
            )}
          </Button>
        </Box>
      </Paper>
    </Box>
  );
}

