// Supabase Edge Function: daily-snapshot
// 매일 자정에 실행되어 모든 사용자의 자산 스냅샷을 기록합니다.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const EXCHANGE_RATE_API = 'https://api.exchangerate-api.com/v4/latest/USD';

interface ExchangeRates {
  rates: Record<string, number>;
}

interface Stock {
  user_id: string;
  quantity: number;
  current_price: number;
  currency: string;
}

interface CashAccount {
  user_id: string;
  balance: number;
  currency: string;
}

interface Asset {
  user_id: string;
  current_value: number;
  currency: string;
  category: string;
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

    // Supabase 클라이언트 생성 (서비스 역할 키 사용)
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. 환율 가져오기
    console.log('Fetching exchange rates...');
    const ratesResponse = await fetch(EXCHANGE_RATE_API);
    const ratesData: ExchangeRates = await ratesResponse.json();
    const rates = ratesData.rates;
    console.log('Exchange rates fetched successfully');

    // 2. 모든 사용자 ID 가져오기
    const { data: users, error: usersError } = await supabase
      .from('stocks')
      .select('user_id')
      .limit(1000);

    if (usersError) {
      throw new Error(`Failed to fetch users: ${usersError.message}`);
    }

    // 다른 테이블에서도 user_id 수집
    const { data: cashUsers } = await supabase.from('cash_accounts').select('user_id').limit(1000);
    const { data: assetUsers } = await supabase.from('assets').select('user_id').limit(1000);

    // 고유 user_id 목록 생성
    const userIdSet = new Set<string>();
    users?.forEach((u) => userIdSet.add(u.user_id));
    cashUsers?.forEach((u) => userIdSet.add(u.user_id));
    assetUsers?.forEach((u) => userIdSet.add(u.user_id));
    const userIds = Array.from(userIdSet);

    console.log(`Processing ${userIds.length} users...`);

    // 3. 각 사용자별 스냅샷 계산
    const today = todayString();
    const snapshots: Array<{
      user_id: string;
      snapshot_date: string;
      stocks_value: number;
      cash_value: number;
      gold_value: number;
      crypto_value: number;
      bonds_value: number;
      real_estate_value: number;
      total_value: number;
    }> = [];

    for (const userId of userIds) {
      // Stocks
      const { data: stocks } = await supabase
        .from('stocks')
        .select('quantity, current_price, currency')
        .eq('user_id', userId);

      let stocksValue = 0;
      if (stocks) {
        for (const s of stocks as Stock[]) {
          stocksValue += convertToUsd(s.quantity * s.current_price, s.currency, rates);
        }
      }

      // Cash accounts
      const { data: cashAccounts } = await supabase
        .from('cash_accounts')
        .select('balance, currency')
        .eq('user_id', userId);

      let cashValue = 0;
      if (cashAccounts) {
        for (const c of cashAccounts as CashAccount[]) {
          cashValue += convertToUsd(c.balance, c.currency, rates);
        }
      }

      // Assets
      const { data: assets } = await supabase
        .from('assets')
        .select('current_value, currency, category')
        .eq('user_id', userId);

      let goldValue = 0;
      let cryptoValue = 0;
      let bondsValue = 0;
      let realEstateValue = 0;
      let otherAssetsValue = 0;

      if (assets) {
        for (const a of assets as Asset[]) {
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
      }

      const totalValue = stocksValue + cashValue + goldValue + cryptoValue + bondsValue + realEstateValue + otherAssetsValue;

      snapshots.push({
        user_id: userId,
        snapshot_date: today,
        stocks_value: Math.round(stocksValue * 100) / 100,
        cash_value: Math.round(cashValue * 100) / 100,
        gold_value: Math.round(goldValue * 100) / 100,
        crypto_value: Math.round(cryptoValue * 100) / 100,
        bonds_value: Math.round(bondsValue * 100) / 100,
        real_estate_value: Math.round(realEstateValue * 100) / 100,
        total_value: Math.round(totalValue * 100) / 100,
      });
    }

    // 4. 스냅샷 저장 (upsert)
    if (snapshots.length > 0) {
      const { error: upsertError } = await supabase
        .from('daily_snapshots')
        .upsert(snapshots, { onConflict: 'user_id,snapshot_date' });

      if (upsertError) {
        throw new Error(`Failed to upsert snapshots: ${upsertError.message}`);
      }
    }

    console.log(`Successfully recorded ${snapshots.length} snapshots for ${today}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Recorded ${snapshots.length} snapshots for ${today}`,
        date: today,
        usersProcessed: snapshots.length,
      }),
      {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
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
