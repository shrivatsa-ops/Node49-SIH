# Enable crop identification and visual grading

The photo feature keeps both API keys on the server. PlantNet identifies the uploaded crop; Gemini assesses only the visible presentation quality. The browser never receives either key.

## Netlify configuration

In **Project configuration → Environment variables**, add both values:

```text
PLANTNET_API_KEY = your PlantNet API key
GEMINI_API_KEY = your Google AI Studio Gemini API key
```

For each variable, turn on **Contains secret values** and ensure its scope includes **Functions**. Trigger a new deploy after saving them.

Optional: set `GEMINI_VISION_MODEL` if your Gemini project uses a different vision-capable model. The function defaults to `gemini-3.8-flash`.

## How it works

1. The user captures or uploads a JPEG, PNG, or WEBP photo up to about 5 MB.
2. The Netlify function sends the photo to PlantNet and accepts only Onion, Tomato, Brinjal, or Green Peas.
3. It sends the same photo and the PlantNet-confirmed crop name to Gemini for a visual presentation score and an indicative A/B/C grade.
4. The server calculates the listing range from the current mandi reference price and grade. Gemini does not invent a crop price.

## Important limits

This is visual guidance, not a laboratory test, disease diagnosis, food-safety decision, or guaranteed market grade. Ask farmers for sharp, well-lit photos of a representative sample, and confirm final grading during inspection.
