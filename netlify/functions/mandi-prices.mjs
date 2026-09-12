const RESOURCE_ID = '9ef84268-d588-465a-a308-a864a43d0070';
const CACHE_SECONDS = 600;

const json = (statusCode, body, cache = 'no-store') => ({
  statusCode,
  headers: {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': cache,
    'Access-Control-Allow-Origin': '*'
  },
  body: JSON.stringify(body)
});

const value = (record, ...keys) => {
  const normalized = Object.fromEntries(Object.entries(record).map(([key, item]) => [key.toLowerCase().replaceAll(/[_\s-]/g, ''), item]));
  for (const key of keys) {
    const found = normalized[key.toLowerCase().replaceAll(/[_\s-]/g, '')];
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

export default async () => {
  const apiKey = process.env.AGMARKNET_API_KEY;
  if (!apiKey) return json(503, { error: 'AGMARKNET API key has not been configured.' });

  try {
    const url = new URL(`https://api.data.gov.in/resource/${RESOURCE_ID}`);
    url.searchParams.set('api-key', apiKey);
    url.searchParams.set('format', 'json');
    url.searchParams.set('limit', '500');
    url.searchParams.set('filters[state]', 'Maharashtra');

    const response = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!response.ok) return json(502, { error: `AGMARKNET returned ${response.status}.` });

    const payload = await response.json();
    const prices = (payload.records || []).map(normalize).filter(price => price.commodity && price.market && price.modalPrice);
    return json(200, { updatedAt: new Date().toISOString(), source: 'AGMARKNET via data.gov.in', prices }, `public, max-age=${CACHE_SECONDS}, s-maxage=${CACHE_SECONDS}`);
  } catch (error) {
    console.error('AGMARKNET request failed:', error);
    return json(502, { error: 'Could not reach AGMARKNET price service.' });
  }
};
