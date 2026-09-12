const RESOURCE_ID = '9ef84268-d588-465a-a308-a864a43d0070';
const CACHE_SECONDS = 600;
const FEATURED = [
  { key: 'onion', commodities: ['Onion'], markets: ['Nashik', 'Lasalgaon', 'Pimpalgaon'] },
  { key: 'tomato', commodities: ['Tomato'], markets: ['Pune', 'Pimpri', 'Mumbai'] },
  { key: 'cotton', commodities: ['Cotton'], markets: ['Nagpur', 'Yavatmal', 'Akola'] },
  { key: 'soybean', commodities: ['Soyabean', 'Soybean'], markets: ['Latur', 'Washim', 'Akola'] }
];

const corsHeaders = {
  'Content-Type': 'application/json; charset=utf-8',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type'
};

const jsonBody = (statusCode, body, cache = 'no-store') => ({
  statusCode,
  headers: { ...corsHeaders, 'Cache-Control': cache },
  body: JSON.stringify(body)
});

const compact = value => String(value || '').toLowerCase().replaceAll(/[_\s-]/g, '');

const value = (record, ...keys) => {
  const normalized = Object.fromEntries(Object.entries(record).map(([key, item]) => [compact(key), item]));
  for (const key of keys) {
    const found = normalized[compact(key)];
    if (found !== undefined && found !== null && found !== '') return found;
  }
  return null;
};

const normalize = record => ({
  commodity: value(record, 'commodity', 'commodity_name'),
  variety: value(record, 'variety'),
  market: value(record, 'market', 'market_name'),
  district: value(record, 'district'),
  state: value(record, 'state', 'state_name'),
  minPrice: Number(value(record, 'min_price', 'minprice')) || null,
  maxPrice: Number(value(record, 'max_price', 'maxprice')) || null,
  modalPrice: Number(value(record, 'modal_price', 'modalprice')) || null,
  date: value(record, 'arrival_date', 'arrivaldate')
});

const isUsable = price => price.commodity && price.market && price.modalPrice;

const fetchRecords = async (apiKey, filters = {}) => {
  const url = new URL(`https://api.data.gov.in/resource/${RESOURCE_ID}`);
  url.searchParams.set('api-key', apiKey);
  url.searchParams.set('format', 'json');
  url.searchParams.set('limit', filters.limit || '200');
  url.searchParams.set('filters[state]', 'Maharashtra');
  if (filters.commodity) url.searchParams.set('filters[commodity]', filters.commodity);

  const response = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error(`AGMARKNET returned ${response.status}`);

  const payload = await response.json();
  return (payload.records || []).map(normalize).filter(isUsable);
};

const nameHas = (value, needles) => needles.some(needle => compact(value).includes(compact(needle)));

const pickFeatured = (prices, crop) => {
  const matches = prices.filter(price => nameHas(price.commodity, crop.commodities));
  return matches.find(price => nameHas(price.market, crop.markets)) || matches[0] || null;
};

const uniquePrices = prices => {
  const seen = new Set();
  return prices.filter(price => {
    const key = [compact(price.commodity), compact(price.market), compact(price.date), price.modalPrice].join('|');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const loadPrices = async () => {
  const apiKey = process.env.AGMARKNET_API_KEY || process.env.DATA_GOV_API_KEY || process.env.DATA_GOV_IN_API_KEY;
  if (!apiKey) return jsonBody(503, { error: 'AGMARKNET API key has not been configured.' });

  try {
    const requests = [
      fetchRecords(apiKey, { limit: '400' }),
      ...FEATURED.flatMap(crop => crop.commodities.map(commodity => fetchRecords(apiKey, { commodity, limit: '80' })))
    ];
    const batches = await Promise.allSettled(requests);
    const prices = uniquePrices(batches.flatMap(result => result.status === 'fulfilled' ? result.value : []));
    if (!prices.length) return jsonBody(502, { error: 'AGMARKNET did not return usable Maharashtra prices.' });
    const featured = Object.fromEntries(FEATURED.map(crop => [crop.key, pickFeatured(prices, crop)]));

    return jsonBody(
      200,
      { updatedAt: new Date().toISOString(), source: 'AGMARKNET via data.gov.in', featured, prices },
      `public, max-age=${CACHE_SECONDS}, s-maxage=${CACHE_SECONDS}`
    );
  } catch (error) {
    console.error('AGMARKNET request failed:', error);
    return jsonBody(502, { error: 'Could not reach AGMARKNET price service.' });
  }
};

export const handler = async event => {
  if (event?.httpMethod === 'OPTIONS') return { statusCode: 204, headers: corsHeaders, body: '' };
  return loadPrices();
};

export default async () => {
  const result = await loadPrices();
  return new Response(result.body, { status: result.statusCode, headers: result.headers });
};
