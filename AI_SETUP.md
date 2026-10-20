# Enable real crop-photo analysis

The crop-quality feature sends a farmer-selected photo to a server-side OpenAI vision request. The browser never receives the API key.

## Netlify configuration

In **Project configuration → Environment variables**, add:

```text
OPENAI_API_KEY = your OpenAI API key
```

Mark it **Contains secret values** and ensure its scope includes **Functions**. Then trigger a new deploy.

Optional: set `OPENAI_VISION_MODEL` to a vision-capable model available to your OpenAI project. The function defaults to `gpt-5-mini`.

## How it works

1. The user captures or uploads a JPEG, PNG, or WEBP crop photo (up to about 5 MB).
2. `/.netlify/functions/crop-analysis` sends the image to the model for visible-condition observations only.
3. The model returns a visual score, an indicative A/B/C grade, confidence, and visible findings.
4. The server calculates the listing range from the current mandi reference price and the grade. The model does not invent a crop price.

## Important limits

This is visual guidance, not a laboratory test, disease diagnosis, food-safety decision, or guaranteed market grade. Ask farmers for sharp, well-lit photos of a representative sample, and confirm final grading during inspection.
