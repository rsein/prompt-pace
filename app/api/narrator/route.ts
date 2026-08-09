import { NextResponse } from "next/server";

const STYLES = [
  "manchete de jornal esportivo, bem dramática",
  "comentarista de corrida gritando emocionado, tipo narração de gol",
  "mensagem solta num grupo de WhatsApp de amigos, casual e com gíria",
  "conselho de treinador debochado pra quem está por último",
  "placar de jogo de videogame, linguagem de game/streamer",
  "fofoca de condomínio sobre quem anda sumido da corrida",
  "previsão de meteorologista, mas sobre a 'tempestade' no ranking",
  "trailer de filme de ação, tom épico e exagerado",
];

export async function POST(request: Request) {
  const { standings, goalKm, totalKm, daysLeft, previousComment } = await request.json();

  const style = STYLES[Math.floor(Math.random() * STYLES.length)];

  const prompt = `Você é o narrador bem-humorado do app de corrida "Prompt & Pace". Gere UMA mensagem curta (máximo 2 frases), engraçada e motivadora, em português do Brasil, comentando a disputa atual entre os corredores de um grupo de amigos.

Classificação atual: ${standings}. Meta do período: ${goalKm}km, total já feito: ${totalKm}km, faltam ${daysLeft} dias.

Estilo dessa vez: escreva como se fosse ${style}. Varie bastante o jeito de começar a frase — não comece sempre com o nome de quem está em 1º.

Pode provocar levemente quem está atrás, tom de zoeira entre amigos, nunca ofensivo.
${previousComment ? `Não repita a mesma ideia ou frase parecida com essa, que já foi usada: "${previousComment}"` : ""}

Responda APENAS com a mensagem, sem aspas, sem preâmbulo, sem mencionar o estilo escolhido.`;

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
        temperature: 1,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) {
      const errBody = await response.text();
      console.error("Anthropic API error em /api/narrator:", response.status, errBody);
      return NextResponse.json({ comment: "A disputa está pegando fogo." });
    }

    const data = await response.json();
    const text = (data.content ?? []).map((c: { text?: string }) => c.text ?? "").join("").trim();
    return NextResponse.json({ comment: text || "A disputa está pegando fogo." });
  } catch (e) {
    console.error("Erro inesperado em /api/narrator:", e);
    return NextResponse.json({ comment: "A disputa está pegando fogo." });
  }
}
