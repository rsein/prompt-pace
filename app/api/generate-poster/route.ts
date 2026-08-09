import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Cenários variam a cada geração pra nunca sair a mesma imagem duas vezes.
const SCENES = [
  "uma pista de corrida de desenho animado, num parque ensolarado, com faixas coloridas e confete no ar",
  "uma corrida de rua estilo quadrinho de super-herói, prédios ao fundo, poeira saindo dos pés de quem lidera",
  "uma pista de atletismo de olimpíada bem exagerada, arquibancada lotada torcendo",
  "uma trilha de montanha íngreme, clima de corrida de aventura, pôr do sol dramático ao fundo",
  "um circuito de corrida noturno com luzes neon, clima de videogame arcade",
  "uma maratona de cidade grande, faixa de chegada estourando confete, helicóptero de TV ao fundo",
  "uma pista de corrida futurista, tipo desenho animado de robôs, fumaça saindo dos tênis",
  "uma praia ao entardecer, corrida na areia com o mar ao fundo, gaivotas voando assustadas",
];

const POSITION_LABELS = [
  "1º lugar, disparado bem na frente de todo mundo",
  "2º lugar, logo atrás, colado tentando alcançar o primeiro",
  "3º lugar, mais atrás, visivelmente cansado",
];

const POSITION_MOODS = [
  "cara super alegre, sorrindo largo, sensação de vitória, braços meio erguidos comemorando, correndo em disparada",
  "expressão de esforço cômica, quase caindo de tanto tentar alcançar quem está na frente, cara de determinação exagerada",
  "expressão de cansaço bem-humorada, mão apoiada no joelho, quase andando de tão exausto, suando muito mas sorrindo de boa vontade",
];

type RankingMember = { id: string; name: string; avatar_url: string | null; color: string; km: number };

export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  let journeyId: string, ranking: RankingMember[], themeA: string, themeB: string;
  try {
    const body = await request.json();
    journeyId = body.journeyId;
    ranking = body.ranking;
    themeA = body.themeA || "#29F1D6";
    themeB = body.themeB || "#8B5CF6";
  } catch {
    return NextResponse.json({ error: "Requisição inválida" }, { status: 400 });
  }

  if (!journeyId || !Array.isArray(ranking) || ranking.length < 2) {
    return NextResponse.json({ error: "Dados insuficientes pra gerar o pôster" }, { status: 400 });
  }

  const top = ranking.slice(0, 3);
  const scene = SCENES[Math.floor(Math.random() * SCENES.length)];

  // Baixa as fotos de perfil disponíveis pra usar como referência visual na geração (em paralelo, pra ganhar tempo)
  const referenceImages: { name: string; blob: Blob }[] = [];
  const withPhoto = top.filter((m) => m.avatar_url);
  const fetched = await Promise.all(
    withPhoto.map(async (m) => {
      try {
        const res = await fetch(m.avatar_url!);
        return res.ok ? { name: m.name, blob: await res.blob() } : null;
      } catch {
        return null;
      }
    })
  );
  fetched.forEach((r) => {
    if (r) referenceImages.push(r);
  });

  const peopleDescription = top
    .map((m, i) => {
      const hasPhoto = referenceImages.some((r) => r.name === m.name);
      const base = `${POSITION_LABELS[i]}: personagem chamado "${m.name}", ${POSITION_MOODS[i]}`;
      return hasPhoto
        ? `${base}. Baseie o rosto desse personagem na foto de referência enviada dessa mesma pessoa, mas em estilo ilustrado/cartoon — mantenha os traços reconhecíveis, não copie a foto literalmente.`
        : `${base}. Essa pessoa não enviou foto de perfil — desenhe um corredor(a) ilustrado genérico, roupa na cor ${m.color}, com um número de peito mostrando as iniciais "${m.name.slice(0, 2).toUpperCase()}".`;
    })
    .join("\n");

  const prompt = `Crie um pôster ilustrado, estilo cartoon divertido e vibrante, tipo capa de revista esportiva de humor, retratando uma disputa de corrida entre amigos.

Cenário: ${scene}.

Personagens (da esquerda pra direita: 2º lugar mais atrás à esquerda, 1º lugar na frente ao centro, 3º lugar mais atrás à direita, como um pódio em movimento):
${peopleDescription}

Composição: deixe uma margem mais limpa e com menos detalhes essenciais perto do topo e da base da imagem (cerca de 15% da altura em cada ponta) — depois vamos sobrepor uma faixa com o nome do app e um placar ali, então evite desenhar rostos ou elementos importantes da cena colados nessas bordas.

Estilo: ilustração colorida, traços expressivos e exagerados tipo animação, bem-humorado e caloroso (nunca zombeteiro ou constrangedor), sem nenhum texto ou palavra escrita na imagem, formato pôster vertical, cores vibrantes com tons próximos de ${themeA} e ${themeB} no fundo.`;

  try {
    let imageB64: string | null = null;

    if (referenceImages.length > 0) {
      const form = new FormData();
      form.append("model", "gpt-image-1");
      form.append("prompt", prompt);
      form.append("size", "1024x1536");
      form.append("quality", "medium");
      referenceImages.forEach((r, i) => form.append("image[]", r.blob, `ref-${i}.jpg`));

      const res = await fetch("https://api.openai.com/v1/images/edits", {
        method: "POST",
        headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
        body: form,
      });

      if (res.ok) {
        const data = await res.json();
        imageB64 = data.data?.[0]?.b64_json ?? null;
      } else {
        console.error("OpenAI images/edits error:", res.status, await res.text());
      }
    }

    if (!imageB64) {
      const res = await fetch("https://api.openai.com/v1/images/generations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({ model: "gpt-image-1", prompt, size: "1024x1536", quality: "medium", n: 1 }),
      });

      if (!res.ok) {
        console.error("OpenAI images/generations error:", res.status, await res.text());
        return NextResponse.json(
          { error: "Não consegui gerar a imagem agora. Tenta de novo em instantes." },
          { status: 502 }
        );
      }
      const data = await res.json();
      imageB64 = data.data?.[0]?.b64_json ?? null;
    }

    if (!imageB64) {
      return NextResponse.json({ error: "Não consegui gerar a imagem agora. Tenta de novo." }, { status: 502 });
    }

    const buffer = Buffer.from(imageB64, "base64");
    const path = `${journeyId}/${Date.now()}-${Math.round(Math.random() * 1e6)}.png`;
    const admin = createAdminClient();
    const { error: uploadError } = await admin.storage
      .from("posters")
      .upload(path, buffer, { contentType: "image/png", upsert: false });

    if (uploadError) {
      console.error("Erro ao salvar pôster no storage:", uploadError);
      return NextResponse.json({ error: "Gerei a imagem mas não consegui salvar. Tenta de novo." }, { status: 500 });
    }

    const { data: publicUrlData } = admin.storage.from("posters").getPublicUrl(path);
    return NextResponse.json({ url: publicUrlData.publicUrl });
  } catch (e) {
    console.error("Erro inesperado em /api/generate-poster:", e);
    return NextResponse.json({ error: "Não consegui gerar a imagem agora. Tenta de novo." }, { status: 500 });
  }
}
