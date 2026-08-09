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

function motivationalPhrase(isGood: boolean, tempC: number, description: string): string {
  if (isGood && tempC >= 12 && tempC <= 28) {
    const options = [
      `Hoje está ótimo pra correr, ${description} — sua jornada não anda sozinha 👟`,
      `Dia perfeito lá fora, ${description}. Bora garantir uns quilômetros antes que o dia acabe?`,
      `Sem desculpa hoje: ${description} e clima ideal pra rua.`,
    ];
    return options[Math.floor(Math.random() * options.length)];
  }
  if (!isGood) {
    return `Tá ${description} por aí — se a rua não rolar, bora de esteira pra não ficar pra trás na jornada.`;
  }
  if (tempC > 28) {
    return `Tá quente (${Math.round(tempC)}°C) — hidrata bem e considera correr mais cedo ou mais tarde hoje.`;
  }
  return `Tá friozinho (${Math.round(tempC)}°C) lá fora — bom pra correr sem esquentar demais.`;
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

    return NextResponse.json({
      city,
      tempC,
      description,
      isGoodForRunning,
      phrase: tempC !== null ? motivationalPhrase(isGoodForRunning, tempC, description) : null,
    });
  } catch (e) {
    console.error("Erro ao buscar clima:", e);
    return NextResponse.json({ error: "Não consegui buscar o clima agora." }, { status: 500 });
  }
}
