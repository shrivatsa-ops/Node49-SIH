const corsHeaders = {
  'Content-Type': 'application/json; charset=utf-8',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type'
};

const json = (statusCode, body) => ({ statusCode, headers: corsHeaders, body: JSON.stringify(body) });
const validImage = value => /^data:image\/(jpeg|png|webp);base64,[a-z0-9+/=]+$/i.test(value || '');
const cleanJson = value => String(value || '').replace(/^```json\s*|\s*```$/g, '').trim();
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const priceRange = (mandiPrice, grade) => {
  const multiplier = grade === 'A' ? [1.03, 1.08] : grade === 'B' ? [0.98, 1.03] : [0.90, 0.97];
  const low = Math.round(mandiPrice * multiplier[0] / 10) * 10;
  const high = Math.round(mandiPrice * multiplier[1] / 10) * 10;
  return { low, high, label: `₹${low.toLocaleString('en-IN')} - ₹${high.toLocaleString('en-IN')}/Q` };
};

const prompt = (cropName, mandiPrice) => `You are assisting a farmer with a visual condition review of ${cropName}. Review only what is visibly supported by the photo. Do not identify diseases, make food-safety claims, or guarantee a market grade. Return ONLY valid JSON with this exact shape:
{"photoUsable":true,"confidence":"low|medium|high","grade":"A|B|C","score":0,"summary":"short plain-language visual observation","findings":["up to three concise visible observations"],"retakeAdvice":"short advice or empty string"}
The score is a visual presentation score from 0 to 100, not a laboratory quality measurement. Current mandi reference price is ₹${mandiPrice}/quintal; do not calculate or include a price.`;

const analyze = async body => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return json(503, { error: 'Photo analysis is not configured. Add OPENAI_API_KEY to Netlify Functions environment variables.' });
  if (!validImage(body.imageData) || body.imageData.length > 7_000_000) return json(400, { error: 'Upload a PNG, JPEG, or WEBP crop photo smaller than about 5 MB.' });

  const cropName = String(body.cropName || '').slice(0, 80);
  const mandiPrice = clamp(Number(body.mandiPrice) || 0, 1, 100000);
  if (!cropName || !mandiPrice) return json(400, { error: 'Crop name and current mandi price are required.' });

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: process.env.OPENAI_VISION_MODEL || 'gpt-5-mini',
      input: [{ role: 'user', content: [
        { type: 'input_text', text: prompt(cropName, mandiPrice) },
        { type: 'input_image', image_url: body.imageData, detail: 'high' }
      ] }],
      max_output_tokens: 300
    })
  });

  const result = await response.json().catch(() => ({}));
  if (!response.ok) return json(response.status, { error: result.error?.message || 'The AI service could not analyse this photo.' });

  let analysis;
  try { analysis = JSON.parse(cleanJson(result.output_text)); } catch { return json(502, { error: 'The AI service returned an unreadable analysis. Please try another photo.' }); }

  const grade = ['A', 'B', 'C'].includes(analysis.grade) ? analysis.grade : 'B';
  const findings = Array.isArray(analysis.findings) ? analysis.findings.slice(0, 3).map(item => String(item).slice(0, 160)) : [];
  const suggested = priceRange(mandiPrice, grade);
  return json(200, {
    photoUsable: Boolean(analysis.photoUsable),
    confidence: ['low', 'medium', 'high'].includes(analysis.confidence) ? analysis.confidence : 'low',
    grade,
    score: clamp(Math.round(Number(analysis.score) || 0), 0, 100),
    summary: String(analysis.summary || 'No clear visual conclusion could be made.').slice(0, 300),
    findings,
    retakeAdvice: String(analysis.retakeAdvice || '').slice(0, 220),
    suggestedPrice: suggested,
    disclaimer: 'Visual guidance only—not a laboratory, disease, or final market-grade assessment.'
  });
};

export const handler = async event => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: corsHeaders, body: '' };
  if (event.httpMethod !== 'POST') return json(405, { error: 'Use POST for photo analysis.' });
  try { return await analyze(JSON.parse(event.body || '{}')); } catch (error) { return json(500, { error: 'Could not process the photo analysis request.' }); }
};

export default async request => {
  if (request.method === 'OPTIONS') return new Response('', { status: 204, headers: corsHeaders });
  if (request.method !== 'POST') return new Response(JSON.stringify({ error: 'Use POST for photo analysis.' }), { status: 405, headers: corsHeaders });
  const result = await analyze(await request.json());
  return new Response(result.body, { status: result.statusCode, headers: result.headers });
};
