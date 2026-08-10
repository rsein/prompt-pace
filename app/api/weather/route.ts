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

type Mode = "rest" | "recovery" | "normal";

async function generatePhrase(params: {
  mode: Mode;
  isGood: boolean;
  isDaylight: boolean;
  tempC: number;
  description: string;
  localHour: number;
  hoursSinceLastRun: number | null;
}): Promise<string | null> {
  if (!process.env.OPENAI_API_KEY) return null;
  const { mode, isGood, isDaylight, tempC, description, localHour, hoursSinceLastRun } = params;

  const contextLines = [
    `Hora local agora: ${localHour}h.`,
    `Clima: ${description}, ${Math.round(tempC)}°C, ${isDaylight ? "de dia (sol no céu, se aplicável à condição)" : "de noite/escuro (nunca mencione sol ou 'dia ensolarado' agora)"}.`,
    mode === "normal" ? (isGood ? "Condições boas pra correr agora." : "Condições ruins pra correr agora (chuva ou temperatura extrema).") : "",
    hoursSinceLastRun !== null ? `A pessoa correu pela última vez há ${Math.round(hoursSinceLastRun)}h.` : "A pessoa ainda não tem corrida registrada recentemente.",
    mode === "rest" ? "MODO: horário de descanso (noite/madrugada) — não incentive a correr agora." : "",
    mode === "recovery" ? "MODO: recuperação — a pessoa correu muito recentemente, foque em descanso e recuperação, não peça pra correr de novo hoje." : "",
    mode === "normal" ? "MODO: incentivo normal — pode encorajar a pessoa a correr hoje, usando o clima real informado." : "",
  ]
    .filter(Boolean)
    .join(" ");

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        max_tokens: 50,
        temperature: 1,
        messages: [
          {
            role: "system",
            content:
              "Você escreve UMA frase curta (máximo 20 palavras) em português do Brasil, mostrada na tela inicial do app de corrida Prompt & Pace. Siga o MODO indicado no contexto: em modo de descanso, deseje boa noite e fale de dormir bem pra correr melhor amanhã (nunca incentive correr agora); em modo de recuperação, parabenize brevemente e fale de hidratação/descanso/alongamento (nunca peça pra correr de novo hoje); em modo de incentivo normal, motive a pessoa a correr hoje usando o clima real informado. NUNCA contradiga as informações de clima/horário passadas (ex: nunca fale de sol se for noite ou estiver nublado/chovendo). Tom leve e caloroso, nunca cobrança pesada ou culpa. Varie a estrutura da frase a cada vez. Responda só a frase, sem aspas.",
          },
          {
            role: "user",
            content: contextLines,
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
  const hoursSinceLastRunParam = searchParams.get("hoursSinceLastRun");
  const hoursSinceLastRun = hoursSinceLastRunParam ? parseFloat(hoursSinceLastRunParam) : null;

  if (!lat || !lon) {
    return NextResponse.json({ error: "lat/lon obrigatórios" }, { status: 400 });
  }

  try {
    const [weatherRes, geoRes] = await Promise.all([
      fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,precipitation,weather_code,is_day&timezone=auto`
      ),
      fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=pt`),
    ]);

    if (!weatherRes.ok) {
      return NextResponse.json({ error: "Não consegui buscar o clima agora." }, { status: 502 });
    }

    const weatherData = await weatherRes.json();
    const geoData = geoRes.ok ? await geoRes.json() : null;

    const code = weatherData.current?.weather_code ?? 0;
    const tempC = weatherData.current?.temperature_2m ?? null;
    const isDaylight = weatherData.current?.is_day === 1;
    // "current.time" já vem no horário local do lugar (timezone=auto) — formato "2026-08-09T22:15"
    const localHour = weatherData.current?.time ? new Date(weatherData.current.time).getHours() : new Date().getHours();
    const description = WEATHER_CODES[code] ?? "tempo estável";
    const isGoodForRunning = !BAD_FOR_RUNNING.has(code) && tempC !== null && tempC >= 5 && tempC <= 33;
    const city = geoData?.city || geoData?.locality || geoData?.principalSubdivision || null;

    const isRestTime = localHour >= 22 || localHour < 5;
    const mode: Mode = isRestTime ? "rest" : hoursSinceLastRun !== null && hoursSinceLastRun < 18 ? "recovery" : "normal";

    const phrase =
      tempC !== null
        ? (await generatePhrase({ mode, isGood: isGoodForRunning, isDaylight, tempC, description, localHour, hoursSinceLastRun })) ??
          (mode === "rest" ? "Boa noite — descansa bem pra correr melhor amanhã." : mode === "recovery" ? "Boa corrida hoje! Agora é hora de recuperar." : isGoodForRunning ? "Bom dia pra correr, bora?" : "Clima mais difícil hoje — se cuida na rua.")
        : null;

    return NextResponse.json({
      city,
      tempC,
      description,
      isGoodForRunning,
      mode,
      phrase,
    });
  } catch (e) {
    console.error("Erro ao buscar clima:", e);
    return NextResponse.json({ error: "Não consegui buscar o clima agora." }, { status: 500 });
  }
}
