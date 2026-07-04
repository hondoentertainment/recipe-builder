const SYSTEM_PROMPT = `You are a recipe transcription expert. Analyze the image and determine if it contains a recipe (cookbook page, handwritten recipe card, screenshot, food photo with recipe text, etc.).

If the image IS a recipe or contains recipe information, extract it into structured JSON matching this schema:
{
  "title": "Recipe name",
  "description": "Brief description of the dish",
  "servings": "Number of servings if visible, else null",
  "prep_time": "Prep time if visible, else null",
  "cook_time": "Cook time if visible, else null",
  "ingredients": ["ingredient with amount"],
  "instructions": ["step by step instructions"],
  "notes": "Any tips or notes, else empty string",
  "is_recipe": true
}

If the image is NOT a recipe, return:
{"is_recipe": false, "title": "", "description": "Not a recipe image", "ingredients": [], "instructions": [], "notes": ""}

Return ONLY valid JSON, no markdown fences.`;

function parseJsonResponse(text) {
  let cleaned = (text || "").trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "");
  }
  return JSON.parse(cleaned);
}

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", process.env.ALLOWED_ORIGIN || "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "API key not configured" });
  }

  try {
    const { imageBase64, mimeType = "image/jpeg", filename = "" } = req.body || {};

    if (!imageBase64 || typeof imageBase64 !== "string") {
      return res.status(400).json({ error: "Missing imageBase64" });
    }

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Extract the recipe from this image. If it's a food photo without written recipe text, infer a plausible recipe based on what you see.",
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:${mimeType};base64,${imageBase64}`,
                  detail: "high",
                },
              },
            ],
          },
        ],
        max_tokens: 2000,
        temperature: 0.2,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("[api/extract-recipe] OpenAI error:", response.status);
      return res.status(502).json({ error: "Recipe extraction failed" });
    }

    const data = await response.json();
    const raw = data.choices?.[0]?.message?.content || "{}";
    const recipe = parseJsonResponse(raw);

    return res.status(200).json({
      ...recipe,
      source_image: filename,
    });
  } catch (err) {
    console.error("[api/extract-recipe]", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};
