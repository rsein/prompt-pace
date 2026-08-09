import { NextResponse } from "next/server";

// Mapeia os códigos meteorológicos da Open-Meteo (padrão WMO) pra uma descrição curta em português
const WEATHER_CODES: Record<number, string> = {
  0: "céu limpo",
  1: "poucas nuvens",
  2: "parcialmente nublado",
  3: "nublado",
  45: "neblina",
  48: "neblina",
  51: "garoa fraca",
  53: "garoa",
  55: "garoa forte",
  56: "garoa congelante",
  57: "garoa congelante",
  61: "chuva fraca",
  63: "chuva",
  65: "chuva forte",
  66: "chuva congelante",
  67: "chuva congelante",
  71: "neve fraca",
  73: "neve",
  75: "neve forte",
  77: "neve",
  80: "pancadas de chuva",
  81: "pancadas de chuva",
  82: "pancadas de chuva forte",
  85: "pancadas de neve",
  86: "pancadas de neve",
  95: "trovoada",
  96: "trovoada com granizo",
  99: "trovoada com granizo",
};

const BAD_FOR_RUNNING = new Set([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 71, 73, 75, 77, 80, 81, 82, 85, 86, 95, 96, 99]);

async function generatePhrase(isGood: boolean, tempC: number, description: string): Promise<string | null> {
  if (!process.env.OPENAI_API_KEY) return null;

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        max_tokens: 40,
        temperature: 1,
        messages: [
          {
            role: "system",
            content:
              "Você escreve UMA frase curta (no máximo 15 palavras) em português do Brasil, incentivando a pessoa a sair pra correr hoje, com bom humor e leveza (nunca cobrança pesada ou culpa). Baseie-se no clima informado. Varie o tom e as palavras a cada vez — nunca repita a mesma estrutura. Responda só a frase, sem aspas.",
          },
          {
            role: "user",
            content: `Clima agora: ${description}, ${Math.round(tempC)}°C. ${isGood ? "Está bom pra correr." : "Não está tão bom pra correr hoje."}`,
          },
        ],
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.choices?.[0]?.message?.content?.trim().replace(/^["']|["']$/g, "") || null;
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const lat = searchParams.get("lat");
  const lon = searchParams.get("lon");

  if (!lat || !lon) {
    return NextResponse.json({ error: "lat/lon obrigatórios" }, { status: 400 });
  }

  try {
    const [weatherRes, geoRes] = await Promise.all([
      fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,precipitation,weather_code&timezone=auto`),
      fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=pt`),
    ]);

    if (!weatherRes.ok) {
      return NextResponse.json({ error: "Não consegui buscar o clima agora." }, { status: 502 });
    }

    const weatherData = await weatherRes.json();
    const geoData = geoRes.ok ? await geoRes.json() : null;

    const code = weatherData.current?.weather_code ?? 0;
    const tempC = weatherData.current?.temperature_2m ?? null;
    const description = WEATHER_CODES[code] ?? "tempo estável";
    const isGoodForRunning = !BAD_FOR_RUNNING.has(code) && tempC !== null && tempC >= 5 && tempC <= 33;
    const city = geoData?.city || geoData?.locality || geoData?.principalSubdivision || null;
    const phrase =
      tempC !== null
        ? (await generatePhrase(isGoodForRunning, tempC, description)) ??
          (isGoodForRunning ? "Bom dia pra correr, bora?" : "Clima mais difícil hoje — se cuida na rua.")
        : null;

    return NextResponse.json({
      city,
      tempC,
      description,
      isGoodForRunning,
      phrase,
    });
  } catch (e) {
    console.error("Erro ao buscar clima:", e);
    return NextResponse.json({ error: "Não consegui buscar o clima agora." }, { status: 500 });
  }
}
