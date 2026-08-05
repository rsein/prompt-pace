import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const { standings, goalKm, totalKm, daysLeft } = await request.json();

  const prompt = `Você é o narrador bem-humorado do app de corrida "Prompt & Pace". Gere UMA mensagem curta (máximo 2 frases), engraçada e motivadora, em português do Brasil, comentando a disputa atual entre os corredores de um grupo de amigos. Classificação atual: ${standings}. Meta do mês: ${goalKm}km, total já feito: ${totalKm}km, faltam ${daysLeft} dias. Pode provocar levemente quem está atrás, tom de zoeira entre amigos, nunca ofensivo. Responda APENAS com a mensagem, sem aspas, sem preâmbulo.`;

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
        messages: [{ role: "user", content: prompt }],
      }),
    });

    const data = await response.json();
    const text = (data.content ?? []).map((c: { text?: string }) => c.text ?? "").join("").trim();
    return NextResponse.json({ comment: text || "A disputa está pegando fogo." });
  } catch {
    return NextResponse.json({ comment: "A disputa está pegando fogo." });
  }
}
