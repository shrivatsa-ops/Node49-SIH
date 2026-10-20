# KrishiSetu

KrishiSetu is a farmer-first marketplace prototype that helps growers list produce, check indicative mandi prices, identify a crop from a photo, and receive visual quality guidance before publishing a lot.

The current prototype intentionally supports only four vegetables: **Onion, Tomato, Brinjal, and Green Peas**.

## Highlights

- Farmer and buyer dashboard flows with a demo mobile login and account creation flow.
- Crop listings, buyer marketplace, orders, negotiations, profile page, and Marathi/Hindi language switching.
- Maharashtra mandi prices through AGMARKNET/data.gov.in, with an honest demo fallback when the service is unavailable.
- Photo workflow that:
  1. uses **PlantNet** to identify the crop;
  2. accepts only Onion, Tomato, Brinjal, or Green Peas;
  3. uses **Gemini** to assess visible presentation quality and return an indicative A/B/C grade;
  4. calculates a suggested price range from the matching mandi price.
- Netlify Functions keep PlantNet and Gemini keys out of browser code.
- Optional Supabase persistence for marketplace lots and demo data.

## Tech stack

| Area | Technology |
| --- | --- |
| Front end | HTML, CSS, vanilla JavaScript |
| Serverless APIs | Netlify Functions (Node.js) |
| Crop identification | PlantNet API |
| Visual grading | Google Gemini API |
| Mandi-price source | AGMARKNET / data.gov.in |
| Optional data layer | Supabase |

## Run locally

The static interface can be opened from `index.html`, but use Netlify Dev to test the serverless API routes:

```bash
npx netlify-cli dev
```

Open the local URL printed by Netlify. The crop-photo flow needs the environment variables below.

## Configure API keys

For a deployed site, add these under **Netlify → Project configuration → Environment variables**. Mark both as secret values and scope them to **Functions**.

```text
PLANTNET_API_KEY=your_plantnet_api_key
GEMINI_API_KEY=your_gemini_api_key
```

Optional:

```text
GEMINI_VISION_MODEL=gemini-3.8-flash
```

Copy `.env.example` to `.env` only for local development. Never commit `.env` or an API key. Detailed setup notes are in [AI_SETUP.md](AI_SETUP.md).

## Deploy with Netlify

1. Push this repository to GitHub.
2. Create a Netlify site from the GitHub repository.
3. Keep the included build settings: publish directory `.` and functions directory `netlify/functions`.
4. Add the PlantNet and Gemini environment variables.
5. Deploy the site.

Netlify redirects `/api/mandi-prices` and `/api/crop-analysis` to their matching serverless functions.

## Supabase (optional)

The application works with local demo data if Supabase is not configured. To enable shared lots and messages, follow [SUPABASE_SETUP.md](SUPABASE_SETUP.md).

`supabase-config.js` contains a publishable/anon browser key, which is expected to be public. Never place a Supabase `service_role` key in this project. Enable Row Level Security in Supabase before using it beyond a demo.

## Important limitations

The photo result is visual guidance only. It is **not** a laboratory test, disease diagnosis, food-safety decision, official grade, or price guarantee. Photos should be sharp, well-lit, and show a representative sample; final quality and price must be confirmed during inspection.

AGMARKNET/data.gov.in can be temporarily unavailable. In that case, the app clearly labels its demo-price fallback instead of presenting it as live market data.

## Project structure

```text
├── index.html                         # App interface
├── app.js                             # Client-side interactions and state
├── style.css                          # Responsive presentation
├── netlify/functions/
│   ├── mandi-prices.mjs               # AGMARKNET/data.gov.in price proxy
│   └── crop-analysis.mjs              # PlantNet + Gemini photo workflow
├── netlify.toml                       # Netlify build, functions, and API routes
├── AI_SETUP.md                        # AI key configuration guide
└── SUPABASE_SETUP.md                  # Optional Supabase setup guide
```

## For a portfolio post

When sharing the project, describe it accurately as a prototype with PlantNet-assisted crop identification, Gemini visual guidance, and AGMARKNET-backed price integration. Do not describe the AI result as an official agricultural grade.
