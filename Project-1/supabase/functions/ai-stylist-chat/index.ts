declare const Deno: {
  env: {
    get(name: string): string | undefined;
  };
  serve(handler: (req: Request) => Response | Promise<Response>): void;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type ProductContext = {
  name: string;
  price: number;
  category?: string | null;
  color?: string | null;
  size?: string | null;
  occasion?: string | null;
  material?: string | null;
};

type CartContext = {
  name?: string;
  price?: number;
  color?: string | null;
  size?: string | null;
  quantity?: number;
};

type HistoryItem = {
  role?: string;
  content?: string;
};

const extractJsonObject = (value: string) => {
  const match = value.match(/\{[\s\S]*\}/);

  if (!match) {
    return null;
  }

  try {
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get("GEMINI_API_KEY");
    const model = Deno.env.get("GEMINI_MODEL") || "gemini-3.1-flash-lite";

    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "GEMINI_API_KEY is not configured.", code: "GEMINI_KEY_MISSING" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();

    if (body.task === "body-shape-analysis") {
      const imageBase64 = String(body.imageBase64 || "");
      const mimeType = String(body.mimeType || "image/jpeg");

      if (!imageBase64) {
        return new Response(
          JSON.stringify({ error: "imageBase64 is required.", code: "IMAGE_MISSING" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const bodyShapePrompt =
        "Analyze this full-body fashion photo only for outfit recommendation. Do not identify the person. Estimate body shape and styling audience category. Return JSON only with keys: shape, audience, confidence, notes. shape must be one of Hourglass, Pear, Apple, Rectangle, Inverted Triangle. audience must be one of Men, Women, Kids. Use Kids when the person appears to be a child or young teen and should receive kidswear recommendations. Use Men for masculine adult/teen styling and Women for feminine adult/teen styling. confidence must be a number from 0 to 100. notes must be 2 to 3 short styling notes. Avoid sensitive identity claims; this is only for product category matching.";

      const imageResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [
                { text: bodyShapePrompt },
                {
                  inlineData: {
                    mimeType,
                    data: imageBase64,
                  },
                },
              ],
            },
          ],
          generationConfig: {
            maxOutputTokens: 260,
            temperature: 0.2,
          },
        }),
      });

      const imageData = await imageResponse.json();

      if (!imageResponse.ok) {
        const errorMessage = imageData.error?.message || "Gemini image request failed.";
        const isQuotaError =
          imageResponse.status === 429 ||
          /quota|billing|rate limit/i.test(errorMessage);

        return new Response(JSON.stringify({
          error: errorMessage,
          code: isQuotaError ? "GEMINI_QUOTA_EXCEEDED" : "GEMINI_REQUEST_FAILED",
        }), {
          status: imageResponse.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const rawReply =
        imageData.candidates?.[0]?.content?.parts
          ?.map((part: { text?: string }) => part.text || "")
          .join("")
          .trim() || "";
      const parsed = extractJsonObject(rawReply);

      return new Response(JSON.stringify({
        analysis: parsed || {
          shape: "Rectangle",
          audience: "Women",
          confidence: 70,
          notes: [
            "Full-body styling category estimated.",
            "Choose balanced tops and bottoms.",
          ],
        },
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (body.task === "skin-tone-analysis") {
      const imageBase64 = String(body.imageBase64 || "");
      const mimeType = String(body.mimeType || "image/jpeg");

      if (!imageBase64) {
        return new Response(
          JSON.stringify({ error: "imageBase64 is required.", code: "IMAGE_MISSING" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const skinTonePrompt =
        "Analyze this selfie only for fashion color recommendation. Do not identify the person. Estimate skin tone depth and undertone for clothing color styling. Return JSON only with keys: skinTone, undertone, explanation, recommendedColors, avoidColors, stylingTips. undertone must be one of Warm, Cool, Neutral, Olive. recommendedColors and avoidColors must be arrays of objects with exactly these keys: name and hex. name must be a short clothing color name. hex must be a valid 6-digit hex color like #C2410C that visually matches the color name. Keep explanation short and friendly.";

      const imageResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [
                { text: skinTonePrompt },
                {
                  inlineData: {
                    mimeType,
                    data: imageBase64,
                  },
                },
              ],
            },
          ],
          generationConfig: {
            maxOutputTokens: 320,
            temperature: 0.25,
          },
        }),
      });

      const imageData = await imageResponse.json();

      if (!imageResponse.ok) {
        const errorMessage = imageData.error?.message || "Gemini image request failed.";
        const isQuotaError =
          imageResponse.status === 429 ||
          /quota|billing|rate limit/i.test(errorMessage);

        return new Response(JSON.stringify({
          error: errorMessage,
          code: isQuotaError ? "GEMINI_QUOTA_EXCEEDED" : "GEMINI_REQUEST_FAILED",
        }), {
          status: imageResponse.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const rawReply =
        imageData.candidates?.[0]?.content?.parts
          ?.map((part: { text?: string }) => part.text || "")
          .join("")
          .trim() || "";
      const parsed = extractJsonObject(rawReply);

      return new Response(JSON.stringify({
        analysis: parsed || {
          skinTone: "Medium",
          undertone: "Neutral",
          explanation: rawReply || "A neutral palette should work well for balanced styling.",
          recommendedColors: [
            { name: "Ivory", hex: "#FFF8E7" },
            { name: "Navy", hex: "#1E3A8A" },
            { name: "Emerald", hex: "#047857" },
            { name: "Dusty Pink", hex: "#D8A7B1" },
            { name: "Charcoal", hex: "#374151" },
          ],
          avoidColors: [
            { name: "Neon Yellow", hex: "#DFFF00" },
            { name: "Harsh Orange", hex: "#F97316" },
          ],
          stylingTips: ["Use balanced contrast.", "Try one statement color with neutral basics."],
        },
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const message = String(body.message || "").slice(0, 1000);
    const products = (body.products || []) as ProductContext[];
    const cartItems = (body.cartItems || []) as CartContext[];
    const history = ((body.history || []) as HistoryItem[])
      .slice(-10)
      .map((item) => {
        const role = item.role === "assistant" ? "AI Stylist" : "Customer";
        return `${role}: ${String(item.content || "").slice(0, 500)}`;
      })
      .join("\n");
    const cartContext =
      String(body.cartContext || "") ||
      (cartItems.length
        ? cartItems
            .slice(0, 12)
            .map(
              (item) =>
                `- ${item.name || "Cart item"} | ${item.color || "-"} | ${item.size || "-"} | qty ${item.quantity || 1} | RM ${Number(item.price || 0).toFixed(2)}`
            )
            .join("\n")
        : "Cart is empty.");
    const productContext = products
      .slice(0, 20)
      .map(
        (product) =>
          `- ${product.name} | RM ${Number(product.price || 0).toFixed(2)} | ${product.category || "Fashion"} | ${product.color || "-"} | ${product.size || "-"} | ${product.occasion || "-"} | ${product.material || "-"}`
      )
      .join("\n");

    const systemInstruction =
      "You are SmartFash AI Stylist, a ChatGPT-like assistant for this fashion shopping system. Remember and use the recent conversation context provided in the input. Answer only about fashion styling, outfit matching, SmartFash products, cart outfit matching, sizes, colors, occasions, weather-friendly styling, orders, payment, delivery, receipts, and how to contact an admin agent. Start by understanding what the customer wants: style advice, cart matching, product search, or order help. If the user asks for outfit recommendations but has not given style gender, size, color, or occasion, ask for those preferences first before recommending. If the user asks to check cart, use cart context and say clearly if the cart is empty. If the user asks unrelated topics, politely say you can only help with SmartFash fashion or order questions. Keep replies short, friendly, and practical. Recommend products only from the provided product context when possible.";

    const prompt = `Recent AI Stylist conversation:
${history || "No previous AI messages yet."}

Available SmartFash products:
${productContext || "No product context available."}

Customer cart:
${cartContext}

Customer question: ${message}`;

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: systemInstruction }],
        },
        contents: [
          {
            role: "user",
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          maxOutputTokens: 220,
          temperature: 0.7,
        },
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      const errorMessage = data.error?.message || "Gemini request failed.";
      const isQuotaError =
        response.status === 429 ||
        /quota|billing|rate limit/i.test(errorMessage);

      return new Response(JSON.stringify({
        error: errorMessage,
        code: isQuotaError ? "GEMINI_QUOTA_EXCEEDED" : "GEMINI_REQUEST_FAILED",
      }), {
        status: response.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const reply =
      data.candidates?.[0]?.content?.parts
        ?.map((part: { text?: string }) => part.text || "")
        .join("")
        .trim() ||
      "I can help with fashion styling and SmartFash product questions.";

    return new Response(JSON.stringify({ reply }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
