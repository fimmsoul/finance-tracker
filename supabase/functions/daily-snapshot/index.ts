// Supabase Edge Function: daily-snapshot
// Runs daily via pg_cron to record asset snapshots for all users.
// Fetches live stock/crypto prices from Yahoo Finance before computing totals.
// Produces per-member snapshots AND a combined (member_id = NULL) snapshot per user.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const EXCHANGE_RATE_API = 'https://api.exchangerate-api.com/v4/latest/USD';
const YAHOO_CHART_API = 'https://query1.finance.yahoo.com/v8/finance/chart';

interface ExchangeRates {
  rates: Record<string, number>;
}

interface StockRow {
  id: string;
  user_id: string;
  ticker: string;
  quantity: number;
  current_price: number;
  currency: string;
  member_id: string | null;
}

interface CryptoRow {
  id: string;
  user_id: string;
  symbol: string;
  quantity: number;
  current_price: number;
  currency: string;
  member_id: string | null;
}

interface CashAccount {
  user_id: string;
  balance: number;
  currency: string;
  member_id: string | null;
}

interface Asset {
  user_id: string;
  current_value: number;
  currency: string;
  category: string;
  member_id: string | null;
}

interface FamilyMember {
  id: string;
  user_id: string;
}

interface SnapshotRow {
  user_id: string;
  snapshot_date: string;
  member_id: string | null;
  stocks_value: number;
  cash_value: number;
  gold_value: number;
  crypto_value: number;
  bonds_value: number;
  real_estate_value: number;
  total_value: number;
}

function todayString(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function convertToUsd(amount: number, fromCurrency: string, rates: Record<string, number>): number {
  if (fromCurrency === 'USD') return amount;
  const rate = rates[fromCurrency] || 1;
  return amount / rate;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// Compute snapshot totals from filtered data arrays
function computeTotals(
  userStocks: StockRow[],
  userCash: CashAccount[],
  userAssets: Asset[],
  userCryptos: CryptoRow[],
  rates: Record<string, number>,
) {
  let stocksValue = 0;
  for (const s of userStocks) {
    stocksValue += convertToUsd(s.quantity * s.current_price, s.currency, rates);
  }

  let cashValue = 0;
  for (const c of userCash) {
    cashValue += convertToUsd(c.balance, c.currency, rates);
  }

  let cryptoValueFromTable = 0;
  for (const cr of userCryptos) {
    cryptoValueFromTable += convertToUsd(cr.quantity * cr.current_price, cr.currency, rates);
  }

  let goldValue = 0;
  let cryptoValue = 0;
  let bondsValue = 0;
  let realEstateValue = 0;
  let otherAssetsValue = 0;

  for (const a of userAssets) {
    const usdValue = convertToUsd(a.current_value, a.currency, rates);
    switch (a.category) {
      case 'gold':
        goldValue += usdValue;
        break;
      case 'crypto':
        cryptoValue += usdValue;
        break;
      case 'bonds':
        bondsValue += usdValue;
        break;
      case 'real_estate':
        realEstateValue += usdValue;
        break;
      default:
        otherAssetsValue += usdValue;
        break;
    }
  }

  const totalCrypto = cryptoValueFromTable + cryptoValue;
  const totalValue = stocksValue + cashValue + goldValue + totalCrypto + bondsValue + realEstateValue + otherAssetsValue;

  return {
    stocks_value: round2(stocksValue),
    cash_value: round2(cashValue),
    gold_value: round2(goldValue),
    crypto_value: round2(totalCrypto),
    bonds_value: round2(bondsValue),
    real_estate_value: round2(realEstateValue),
    total_value: round2(totalValue),
  };
}

// Fetch live price for a single symbol using Yahoo Finance v8 chart API
async function fetchYahooPrice(symbol: string): Promise<{ price: number; currency: string } | null> {
  try {
    const response = await fetch(
      `${YAHOO_CHART_API}/${encodeURIComponent(symbol)}?interval=1d&range=1d`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
        },
      }
    );

    if (!response.ok) {
      console.error(`Yahoo Finance chart API returned ${response.status} for ${symbol}`);
      return null;
    }

    const data = await response.json();
    const meta = data?.chart?.result?.[0]?.meta;
    if (meta && meta.regularMarketPrice) {
      return {
        price: meta.regularMarketPrice,
        currency: meta.currency || 'USD',
      };
    }
    return null;
  } catch (err) {
    console.error(`Failed to fetch price for ${symbol}:`, err);
    return null;
  }
}

// Fetch live quotes for all symbols with concurrency control
async function fetchYahooQuotes(symbols: string[]): Promise<Record<string, { price: number; currency: string }>> {
  const results: Record<string, { price: number; currency: string }> = {};
  if (symbols.length === 0) return results;

  const concurrency = 10;
  for (let i = 0; i < symbols.length; i += concurrency) {
    const batch = symbols.slice(i, i + concurrency);
    const promises = batch.map(async (symbol) => {
      const result = await fetchYahooPrice(symbol);
      if (result) {
        results[symbol] = result;
      }
    });
    await Promise.all(promises);

    if (i + concurrency < symbols.length) {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  return results;
}

// Upsert a single snapshot using manual select + insert/update
// (because the unique index uses COALESCE for member_id)
async function upsertSnapshot(
  supabase: ReturnType<typeof createClient>,
  snapshot: SnapshotRow,
) {
  let existingQuery = supabase
    .from('daily_snapshots')
    .select('id')
    .eq('user_id', snapshot.user_id)
    .eq('snapshot_date', snapshot.snapshot_date);

  if (snapshot.member_id) {
    existingQuery = existingQuery.eq('member_id', snapshot.member_id);
  } else {
    existingQuery = existingQuery.is('member_id', null);
  }

  const { data: existing } = await existingQuery.maybeSingle();

  const totals = {
    stocks_value: snapshot.stocks_value,
    cash_value: snapshot.cash_value,
    gold_value: snapshot.gold_value,
    crypto_value: snapshot.crypto_value,
    bonds_value: snapshot.bonds_value,
    real_estate_value: snapshot.real_estate_value,
    total_value: snapshot.total_value,
  };

  if (existing) {
    const { error } = await supabase
      .from('daily_snapshots')
      .update(totals)
      .eq('id', existing.id);
    if (error) console.error(`Error updating snapshot for member ${snapshot.member_id}:`, error.message);
  } else {
    const { error } = await supabase
      .from('daily_snapshots')
      .insert(snapshot);
    if (error) console.error(`Error inserting snapshot for member ${snapshot.member_id}:`, error.message);
  }
}

Deno.serve(async (req) => {
  try {
    // CORS headers
    if (req.method === 'OPTIONS') {
      return new Response('ok', {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Fetch exchange rates
    console.log('Fetching exchange rates...');
    const ratesResponse = await fetch(EXCHANGE_RATE_API);
    const ratesData: ExchangeRates = await ratesResponse.json();
    const rates = ratesData.rates;
    console.log('Exchange rates fetched successfully');

    // 2. Fetch all data including member_id
    const { data: allStocks, error: stocksError } = await supabase
      .from('stocks')
      .select('id, user_id, ticker, quantity, current_price, currency, member_id')
      .limit(5000);

    if (stocksError) throw new Error(`Failed to fetch stocks: ${stocksError.message}`);

    const { data: allCryptos, error: cryptosError } = await supabase
      .from('cryptos')
      .select('id, user_id, symbol, quantity, current_price, currency, member_id')
      .limit(5000);

    if (cryptosError) {
      console.warn(`Failed to fetch cryptos: ${cryptosError.message}`);
    }

    // 3. Fetch live prices from Yahoo Finance
    const stockTickers = [...new Set((allStocks || []).map((s: StockRow) => s.ticker))];
    const cryptoSymbols = [...new Set((allCryptos || []).map((c: CryptoRow) => {
      return `${c.symbol.toUpperCase()}-${(c.currency || 'USD').toUpperCase()}`;
    }))];
    const allSymbols = [...stockTickers, ...cryptoSymbols];

    console.log(`Fetching live prices for ${stockTickers.length} stocks and ${cryptoSymbols.length} cryptos...`);
    const liveQuotes = await fetchYahooQuotes(allSymbols);
    console.log(`Got live prices for ${Object.keys(liveQuotes).length} symbols`);

    // 4. Update current_price in stocks table
    const stockUpdates: Array<{ id: string; current_price: number }> = [];
    for (const stock of (allStocks || []) as StockRow[]) {
      const quote = liveQuotes[stock.ticker];
      if (quote) {
        stockUpdates.push({ id: stock.id, current_price: quote.price });
        stock.current_price = quote.price;
      }
    }

    if (stockUpdates.length > 0) {
      for (const update of stockUpdates) {
        await supabase
          .from('stocks')
          .update({ current_price: update.current_price })
          .eq('id', update.id);
      }
      console.log(`Updated ${stockUpdates.length} stock prices in DB`);
    }

    // 5. Update current_price in cryptos table
    const cryptoUpdates: Array<{ id: string; current_price: number }> = [];
    for (const crypto of (allCryptos || []) as CryptoRow[]) {
      const yahooTicker = `${crypto.symbol.toUpperCase()}-${(crypto.currency || 'USD').toUpperCase()}`;
      const quote = liveQuotes[yahooTicker];
      if (quote) {
        cryptoUpdates.push({ id: crypto.id, current_price: quote.price });
        crypto.current_price = quote.price;
      }
    }

    if (cryptoUpdates.length > 0) {
      for (const update of cryptoUpdates) {
        await supabase
          .from('cryptos')
          .update({ current_price: update.current_price })
          .eq('id', update.id);
      }
      console.log(`Updated ${cryptoUpdates.length} crypto prices in DB`);
    }

    // 6. Fetch remaining data with member_id
    const { data: cashAccounts } = await supabase
      .from('cash_accounts')
      .select('user_id, balance, currency, member_id')
      .limit(5000);

    const { data: assets } = await supabase
      .from('assets')
      .select('user_id, current_value, currency, category, member_id')
      .limit(5000);

    // 7. Fetch family members
    const { data: familyMembers } = await supabase
      .from('family_members')
      .select('id, user_id')
      .limit(5000);

    // Collect unique user IDs
    const userIdSet = new Set<string>();
    (allStocks || []).forEach((s: StockRow) => userIdSet.add(s.user_id));
    (allCryptos || []).forEach((c: CryptoRow) => userIdSet.add(c.user_id));
    (cashAccounts || []).forEach((c: CashAccount) => userIdSet.add(c.user_id));
    (assets || []).forEach((a: Asset) => userIdSet.add(a.user_id));
    const userIds = Array.from(userIdSet);

    console.log(`Processing ${userIds.length} users...`);

    // 8. Compute and upsert snapshots per user (combined + per-member)
    const today = todayString();
    let totalSnapshots = 0;

    for (const userId of userIds) {
      const userStocks = ((allStocks || []) as StockRow[]).filter((s) => s.user_id === userId);
      const userCash = ((cashAccounts || []) as CashAccount[]).filter((c) => c.user_id === userId);
      const userAssets = ((assets || []) as Asset[]).filter((a) => a.user_id === userId);
      const userCryptos = ((allCryptos || []) as CryptoRow[]).filter((c) => c.user_id === userId);

      // Combined snapshot (member_id = NULL)
      const combinedTotals = computeTotals(userStocks, userCash, userAssets, userCryptos, rates);
      await upsertSnapshot(supabase, {
        user_id: userId,
        snapshot_date: today,
        member_id: null,
        ...combinedTotals,
      });
      totalSnapshots++;

      // Per-member snapshots
      const userMembers = ((familyMembers || []) as FamilyMember[]).filter((m) => m.user_id === userId);
      for (const member of userMembers) {
        const mStocks = userStocks.filter((s) => s.member_id === member.id);
        const mCash = userCash.filter((c) => c.member_id === member.id);
        const mAssets = userAssets.filter((a) => a.member_id === member.id);
        const mCryptos = userCryptos.filter((c) => c.member_id === member.id);

        const memberTotals = computeTotals(mStocks, mCash, mAssets, mCryptos, rates);
        await upsertSnapshot(supabase, {
          user_id: userId,
          snapshot_date: today,
          member_id: member.id,
          ...memberTotals,
        });
        totalSnapshots++;
      }
    }

    const summary = {
      success: true,
      message: `Recorded ${totalSnapshots} snapshots for ${today}`,
      date: today,
      usersProcessed: userIds.length,
      snapshotsRecorded: totalSnapshots,
      stockPricesUpdated: stockUpdates.length,
      cryptoPricesUpdated: cryptoUpdates.length,
      liveQuotesFetched: Object.keys(liveQuotes).length,
    };
    console.log(JSON.stringify(summary));

    return new Response(JSON.stringify(summary), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error) {
    console.error('Error in daily-snapshot function:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  }
});
