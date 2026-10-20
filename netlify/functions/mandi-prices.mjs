const RESOURCE_ID = '9ef84268-d588-465a-a308-a864a43d0070';
const CACHE_SECONDS = 600;
const FEATURED = [
  { key: 'onion', commodities: ['Onion'], markets: ['Nashik', 'Lasalgaon', 'Pimpalgaon'] },
  { key: 'tomato', commodities: ['Tomato'], markets: ['Pune', 'Pimpri', 'Mumbai'] },
  { key: 'brinjal', commodities: ['Brinjal'], markets: ['Nashik', 'Pune', 'Mumbai'] },
  { key: 'peas', commodities: ['Peas', 'Green Peas'], markets: ['Pune', 'Nashik', 'Mumbai'] }
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
  if (filters.state) url.searchParams.set('filters[state]', filters.state);
  if (filters.commodity) url.searchParams.set('filters[commodity]', filters.commodity);

  const response = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error(`AGMARKNET returned ${response.status}`);

  const payload = await response.json();
  if (!Array.isArray(payload.records)) throw new Error(payload.error || payload.message || 'AGMARKNET returned no records array.');
  return payload.records.map(normalize).filter(isUsable);
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
    const requests = FEATURED.flatMap(crop => crop.commodities.map(commodity => fetchRecords(apiKey, { commodity, state: 'Maharashtra', limit: '80' })));
    const batches = await Promise.allSettled(requests);
    let prices = uniquePrices(batches.flatMap(result => result.status === 'fulfilled' ? result.value : []));

    // Some data.gov.in deployments do not apply the server-side state filter consistently.
    // Retry the same four commodities without it, then keep Maharashtra rows locally.
    if (!prices.length) {
      const fallbackRequests = FEATURED.flatMap(crop => crop.commodities.map(commodity => fetchRecords(apiKey, { commodity, limit: '1000' })));
      const fallbackBatches = await Promise.allSettled(fallbackRequests);
      prices = uniquePrices(fallbackBatches
        .flatMap(result => result.status === 'fulfilled' ? result.value : [])
        .filter(price => String(price.state || '').trim().toLowerCase() === 'maharashtra'));
      batches.push(...fallbackBatches);
    }

    if (!prices.length) {
      const failures = batches
        .filter(result => result.status === 'rejected')
        .map(result => result.reason?.message)
        .filter(Boolean)
        .slice(0, 2);
      return jsonBody(502, { error: 'AGMARKNET returned no usable Maharashtra prices for onions, tomatoes, brinjal, or peas.', details: failures.length ? failures : undefined });
    }
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
