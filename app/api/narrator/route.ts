import { NextResponse } from "next/server";
import { NARRATOR_PERSONAS, type NarratorStyleKey } from "@/lib/narratorPersonas";

export async function POST(request: Request) {
  const { standings, goalKm, totalKm, daysLeft, previousComment, narratorStyle, soloMode } = await request.json();

  const persona = NARRATOR_PERSONAS[(narratorStyle as NarratorStyleKey) ?? "engracado"] ?? NARRATOR_PERSONAS.engracado;

  const modeInstructions = soloMode
    ? "IMPORTANTE: essa jornada tem só UMA pessoa correndo — ela está competindo consigo mesma (contra a própria meta e o próprio histórico), não existe ninguém pra comparar. NUNCA mencione 'primeiro lugar', ranking, ou compare com outras pessoas. Foque 100% em incentivar essa pessoa: celebre o progresso dela, motive a continuar, comente a evolução em relação à meta."
    : "Compare o desempenho das pessoas dentro do tom de voz da personalidade, sempre de forma respeitosa mesmo brincando.";

  const prompt = `Você é o narrador do app de corrida "Prompt & Pace". Sua personalidade fixa nessa jornada é: ${persona.voice}.

Gere UMA mensagem curta (máximo 2 frases), em português do Brasil, comentando o progresso ${soloMode ? "dessa pessoa" : "da disputa atual entre os corredores de um grupo de amigos"} — sempre mantendo esse tom de voz específico, do início ao fim da frase.

${modeInstructions}

Classificação atual: ${standings}. Meta do período: ${goalKm}km, total já feito: ${totalKm}km, faltam ${daysLeft} dias.

Varie bastante o jeito de começar a frase a cada vez.
${previousComment ? `Não repita a mesma ideia ou frase parecida com essa, que já foi usada: "${previousComment}"` : ""}

Responda APENAS com a mensagem, sem aspas, sem preâmbulo, sem mencionar o nome do estilo/personagem.`;

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 1,
        max_tokens: 150,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) {
      const errBody = await response.text();
      console.error("OpenAI API error em /api/narrator:", response.status, errBody);
      return NextResponse.json({ comment: "A disputa está pegando fogo." });
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content?.trim();
    return NextResponse.json({ comment: text || "A disputa está pegando fogo." });
  } catch (e) {
    console.error("Erro inesperado em /api/narrator:", e);
    return NextResponse.json({ comment: "A disputa está pegando fogo." });
  }
}
