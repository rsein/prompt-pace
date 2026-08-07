import { NextResponse } from "next/server";

export async function POST(request: Request) {
  let imageBase64: string, mediaType: string;
  try {
    const body = await request.json();
    imageBase64 = body.imageBase64;
    mediaType = body.mediaType;
  } catch {
    return NextResponse.json({ error: "Requisição inválida" }, { status: 400 });
  }

  if (!imageBase64 || !mediaType) {
    return NextResponse.json({ error: "Imagem faltando" }, { status: 400 });
  }

  const prompt = `Essa imagem é uma foto ou print da tela de um relógio esportivo ou app de corrida (Strava, Garmin, Apple Watch, etc). Extraia os dados da corrida que estiverem visíveis na tela:
- distância total em km
- tempo total decorrido (converta para segundos totais)
- batimentos cardíacos médios (bpm), se aparecer
- calorias, se aparecer

Responda APENAS com um objeto JSON válido, no formato exato:
{"km": number ou null, "time_sec": number ou null, "bpm": number ou null, "calories": number ou null}

Se não conseguir ler algum campo com confiança na imagem, use null nesse campo — nunca invente um valor.`;

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        max_tokens: 300,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              { type: "image_url", image_url: { url: `data:${mediaType};base64,${imageBase64}` } },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const errBody = await response.text();
      console.error("OpenAI API error em /api/scan-run:", response.status, errBody);
      return NextResponse.json(
        { error: "Não consegui ler essa imagem. Tenta outra foto ou preenche manual." },
        { status: 502 }
      );
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content ?? "";

    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (parseErr) {
      console.error("Não consegui parsear a resposta da OpenAI em /api/scan-run:", text);
      return NextResponse.json(
        { error: "Não consegui identificar os dados nessa imagem. Preenche manual abaixo." },
        { status: 200 }
      );
    }

    return NextResponse.json(parsed);
  } catch (e) {
    console.error("Erro inesperado em /api/scan-run:", e);
    return NextResponse.json({ error: "Não consegui ler essa imagem. Tenta outra foto ou preenche manual." }, { status: 500 });
  }
}
