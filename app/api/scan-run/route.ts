import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const { imageBase64, mediaType } = await request.json();

  if (!imageBase64 || !mediaType) {
    return NextResponse.json({ error: "Imagem faltando" }, { status: 400 });
  }

  const prompt = `Essa imagem é uma foto ou print da tela de um relógio esportivo ou app de corrida (Strava, Garmin, Apple Watch, etc). Extraia os dados da corrida que estiverem visíveis na tela:
- distância total em km
- tempo total decorrido (converta para segundos totais)
- batimentos cardíacos médios (bpm), se aparecer
- calorias, se aparecer

Responda APENAS com um objeto JSON válido, sem nenhum texto antes ou depois, sem marcação de código, no formato exato:
{"km": number ou null, "time_sec": number ou null, "bpm": number ou null, "calories": number ou null}

Se não conseguir ler algum campo com confiança na imagem, use null nesse campo — nunca invente um valor.`;

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY!,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 300,
        messages: [
          {
            role: "user",
            content: [
              { type: "image", source: { type: "base64", media_type: mediaType, data: imageBase64 } },
              { type: "text", text: prompt },
            ],
          },
        ],
      }),
    });

    const data = await response.json();
    const text = (data.content ?? []).map((c: { text?: string }) => c.text ?? "").join("").trim();
    const cleaned = text.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(cleaned);

    return NextResponse.json(parsed);
  } catch (e) {
    return NextResponse.json({ error: "Não consegui ler essa imagem. Tenta outra foto ou preenche manual." }, { status: 500 });
  }
}
