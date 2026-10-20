const corsHeaders = {
  'Content-Type': 'application/json; charset=utf-8',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type'
};

const json = (statusCode, body) => ({ statusCode, headers: corsHeaders, body: JSON.stringify(body) });
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const cleanJson = value => String(value || '').replace(/^```json\s*|\s*```$/g, '').trim();

const supportedCrops = [
  { id: 'onion', name: 'Onion', listingName: 'Nashik Red Onion', scientificNames: ['allium cepa'], aliases: ['onion'] },
  { id: 'tomato', name: 'Tomato', listingName: 'Pune Tomato', scientificNames: ['solanum lycopersicum'], aliases: ['tomato'] },
  { id: 'brinjal', name: 'Brinjal', listingName: 'Nashik Brinjal', scientificNames: ['solanum melongena'], aliases: ['brinjal', 'eggplant', 'aubergine'] },
  { id: 'peas', name: 'Green Peas', listingName: 'Pune Green Peas', scientificNames: ['pisum sativum'], aliases: ['pea', 'peas', 'green pea'] }
];

const decodeImage = value => {
  const match = /^data:(image\/(?:jpeg|png|webp));base64,([a-z0-9+/=]+)$/i.exec(value || '');
  if (!match || value.length > 7_000_000) return null;
  return { mimeType: match[1].toLowerCase(), base64: match[2], bytes: Buffer.from(match[2], 'base64') };
};

const priceRange = (mandiPrice, grade) => {
  const multiplier = grade === 'A' ? [1.03, 1.08] : grade === 'B' ? [0.98, 1.03] : [0.90, 0.97];
  const low = Math.round(mandiPrice * multiplier[0] / 10) * 10;
  const high = Math.round(mandiPrice * multiplier[1] / 10) * 10;
  return { low, high, label: `₹${low.toLocaleString('en-IN')} - ₹${high.toLocaleString('en-IN')}/Q` };
};

const cropFromPlantNet = result => {
  const species = result?.species || {};
  const values = [species.scientificNameWithoutAuthor, species.scientificName, ...(species.commonNames || [])]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return supportedCrops.find(crop => [...crop.scientificNames, ...crop.aliases].some(term => new RegExp(`\\b${term.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}\\b`).test(values)));
};

const identifyCrop = async (image, apiKey) => {
  const form = new FormData();
  form.append('images', new Blob([image.bytes], { type: image.mimeType }), 'crop-photo.jpg');
  const response = await fetch(`https://my-api.plantnet.org/v2/identify/all?api-key=${encodeURIComponent(apiKey)}`, { method: 'POST', body: form });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.message || result.error || 'PlantNet could not identify this crop photo.');

  const match = (result.results || []).map(item => ({ item, crop: cropFromPlantNet(item) })).find(entry => entry.crop);
  if (!match) {
    const error = new Error('This photo was not identified as onion, tomato, brinjal, or peas. Upload a clear, close photo of one supported crop.');
    error.statusCode = 422;
    throw error;
  }
  return {
    ...match.crop,
    confidence: clamp(Math.round(Number(match.item.score || 0) * 100), 0, 100),
    scientificName: String(match.item.species?.scientificNameWithoutAuthor || '')
  };
};

const gradePrompt = (cropName, mandiPrice) => `You are assisting a farmer with a visual condition review of ${cropName}. Review only what is visibly supported by the photo. Do not identify diseases, make food-safety claims, or guarantee a market grade. Return a visual presentation score only.\nCurrent mandi reference price is ₹${mandiPrice}/quintal. Do not calculate or include a price.`;

const gradeSchema = {
  type: 'object',
  properties: {
    photoUsable: { type: 'boolean' },
    confidence: { type: 'string', enum: ['low', 'medium', 'high'] },
    grade: { type: 'string', enum: ['A', 'B', 'C'] },
    score: { type: 'integer', minimum: 0, maximum: 100 },
    summary: { type: 'string' },
    findings: { type: 'array', items: { type: 'string' } },
    retakeAdvice: { type: 'string' }
  },
  required: ['photoUsable', 'confidence', 'grade', 'score', 'summary', 'findings', 'retakeAdvice']
};

const gradeCrop = async (image, cropName, mandiPrice, apiKey) => {
  const response = await fetch('https://generativelanguage.googleapis.com/v1beta/interactions', {
    method: 'POST',
    headers: { 'x-goog-api-key': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: process.env.GEMINI_VISION_MODEL || 'gemini-3.8-flash',
      input: [
        { type: 'text', text: gradePrompt(cropName, mandiPrice) },
        { type: 'image', data: image.base64, mime_type: image.mimeType }
      ],
      response_format: { type: 'text', mime_type: 'application/json', schema: gradeSchema }
    })
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error?.message || result.message || 'Gemini could not analyse this photo.');
  try { return JSON.parse(cleanJson(result.output_text || result.outputText)); }
  catch { throw new Error('Gemini returned an unreadable analysis. Please try another photo.'); }
};

const mandiPriceFor = (body, cropId) => clamp(Number(body.mandiPrices?.[cropId] || body.mandiPrice) || 0, 1, 100000);

const analyze = async body => {
  const plantNetKey = process.env.PLANTNET_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;
  if (!plantNetKey || !geminiKey) {
    const missing = [!plantNetKey && 'PLANTNET_API_KEY', !geminiKey && 'GEMINI_API_KEY'].filter(Boolean).join(' and ');
    return json(503, { error: `Photo analysis is not configured. Add ${missing} to Netlify Functions environment variables.` });
  }
  const image = decodeImage(body.imageData);
  if (!image) return json(400, { error: 'Upload a PNG, JPEG, or WEBP crop photo smaller than about 5 MB.' });

  try {
    const identifiedCrop = await identifyCrop(image, plantNetKey);
    const mandiPrice = mandiPriceFor(body, identifiedCrop.id);
    if (!mandiPrice) return json(400, { error: 'A current mandi price is required for the identified crop.' });
    const analysis = await gradeCrop(image, identifiedCrop.name, mandiPrice, geminiKey);
    const grade = ['A', 'B', 'C'].includes(analysis.grade) ? analysis.grade : 'B';
    const findings = Array.isArray(analysis.findings) ? analysis.findings.slice(0, 3).map(item => String(item).slice(0, 160)) : [];
    return json(200, {
      identifiedCrop: { id: identifiedCrop.id, name: identifiedCrop.name, listingName: identifiedCrop.listingName, confidence: identifiedCrop.confidence, scientificName: identifiedCrop.scientificName },
      photoUsable: Boolean(analysis.photoUsable),
      confidence: ['low', 'medium', 'high'].includes(analysis.confidence) ? analysis.confidence : 'low',
      grade,
      score: clamp(Math.round(Number(analysis.score) || 0), 0, 100),
      summary: String(analysis.summary || 'No clear visual conclusion could be made.').slice(0, 300),
      findings,
      retakeAdvice: String(analysis.retakeAdvice || '').slice(0, 220),
      suggestedPrice: priceRange(mandiPrice, grade),
      disclaimer: 'PlantNet identification and Gemini visual guidance only—not a laboratory, disease, or final market-grade assessment.'
    });
  } catch (error) {
    return json(error.statusCode || 502, { error: error.message || 'Could not process the photo analysis request.' });
  }
};

export const handler = async event => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: corsHeaders, body: '' };
  if (event.httpMethod !== 'POST') return json(405, { error: 'Use POST for photo analysis.' });
  try { return await analyze(JSON.parse(event.body || '{}')); }
  catch { return json(400, { error: 'Invalid photo analysis request.' }); }
};

export default async request => {
  if (request.method === 'OPTIONS') return new Response('', { status: 204, headers: corsHeaders });
  if (request.method !== 'POST') return new Response(JSON.stringify({ error: 'Use POST for photo analysis.' }), { status: 405, headers: corsHeaders });
  try {
    const result = await analyze(await request.json());
    return new Response(result.body, { status: result.statusCode, headers: result.headers });
  } catch { return new Response(JSON.stringify({ error: 'Invalid photo analysis request.' }), { status: 400, headers: corsHeaders }); }
};
