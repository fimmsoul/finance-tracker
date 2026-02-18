import { useMemo } from 'react';
import { useStocks } from './useStocks';
import { useCash } from './useCash';
import { useAssets } from './useAssets';
import { useCurrencyContext } from './CurrencyContext';

export function useNetWorth() {
  const { stocks: generalStocks, loading: generalLoading } = useStocks('general');
  const { stocks: isaStocks, loading: isaLoading } = useStocks('isa');
  const { accounts, loading: cashLoading } = useCash();
  const { assets, loading: assetsLoading } = useAssets();
  const { convert } = useCurrencyContext();

  const stocks = [...generalStocks, ...isaStocks];
  const loading = generalLoading || isaLoading || cashLoading || assetsLoading;

  // Calculate all values converted to display currency
  const { stocksValue, stocksCost, cashTotal, assetsValue } = useMemo(() => {
    let sv = 0, sc = 0;
    for (const s of stocks) {
      sv += convert(s.quantity * s.current_price, s.currency);
      sc += convert(s.quantity * s.buy_price, s.currency);
    }

    let ct = 0;
    for (const a of accounts) {
      ct += convert(a.balance, a.currency);
    }

    let av = 0;
    for (const a of assets) {
      av += convert(a.current_value, a.currency);
    }

    return { stocksValue: sv, stocksCost: sc, cashTotal: ct, assetsValue: av };
  }, [stocks, accounts, assets, convert]);

  const netWorth = stocksValue + cashTotal + assetsValue;

  const breakdown = useMemo(() => {
    const total = netWorth || 1;
    return {
      stocks: { value: stocksValue, percent: (stocksValue / total) * 100 },
      cash: { value: cashTotal, percent: (cashTotal / total) * 100 },
      assets: { value: assetsValue, percent: (assetsValue / total) * 100 },
    };
  }, [stocksValue, cashTotal, assetsValue, netWorth]);

  const totalGain = stocksValue - stocksCost;

  return {
    netWorth,
    breakdown,
    totalGain,
    stocksCost,
    loading,
    counts: {
      stocks: stocks.length,
      cash: accounts.length,
      assets: assets.length,
    },
  };
}
