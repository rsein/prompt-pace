import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Cenários de reserva, usados só se não houver comentário do narrador pra se basear (ou se a IA de texto falhar)
const FALLBACK_SCENES = [
  "avenida de cidade grande ao amanhecer, prédios desfocados ao fundo, luz dourada de nascer do sol, poeira no ar",
  "hipódromo ou pista de corrida iluminada à noite, arquibancada lotada torcendo, poeira levantando do chão",
  "arraiá de festa junina brasileira à noite, fogueira acesa, bandeirinhas coloridas, barraquinhas, clima caótico e engraçado",
  "arena de estádio lotada, holofotes fortes, confete caindo, telão gigante ao fundo",
  "trilha de montanha ao entardecer, poeira e pedrinhas voando dos pés, céu alaranjado dramático",
  "pista de atletismo profissional à noite, refletores potentes, fumaça de fundo, clima de final olímpica",
];

const POSITION_LABELS = [
  "1º lugar, disparado bem na frente de todo mundo",
  "2º lugar, logo atrás, colado tentando alcançar o primeiro",
  "3º lugar, mais atrás, visivelmente exausto",
];

const POSITION_MOODS = [
  "expressão real de vitória, sorrindo, comemorando com o punho erguido, correndo em disparada",
  "expressão real de esforço máximo, cara tensa e determinada, quase alcançando quem está na frente",
  "expressão real de exaustão, suando, boca aberta ofegante, quase andando de tão cansado",
];

type RankingMember = {
  id: string;
  name: string;
  avatar_url: string | null;
  color: string;
  gender: string | null;
  ethnicity?: string | null;
  age?: number | null;
  km: number;
};

// Transforma o comentário do narrador numa descrição de CENÁRIO visual (ambiente/clima/ação de fundo) —
// o texto do narrador vira inspiração pro prompt de imagem, nunca palavras escritas na foto.
async function generateSceneFromNarrator(narratorComment: string): Promise<string | null> {
  if (!narratorComment || !process.env.OPENAI_API_KEY) return null;

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        max_tokens: 120,
        messages: [
          {
            role: "system",
            content:
              "Você transforma o comentário de um narrador esportivo brincalhão (sobre uma corrida de rua entre amigos) numa descrição de CENÁRIO fantasioso pra gerar uma imagem. Pegue as expressões, comparações e exageros usados no comentário AO PÉ DA LETRA e transforme em elementos visuais concretos e fantasiosos — por exemplo: se disser 'voou como um foguete', inclua um efeito visual literal de rastro de fogo ou fumaça de foguete atrás da pessoa; se disser 'correu que nem o vento', mostre folhas e poeira sendo levantadas ao redor; se disser 'quase morreu', exagere dramaticamente a cena com um clima quase apocalíptico; se mencionar algum lugar, animal, comida ou objeto, inclua literalmente esse elemento na cena de forma criativa. Escreva em português, 2 a 4 frases, descrevendo ambiente, iluminação e elementos fantasiosos de fundo (nunca pessoas específicas por nome, nunca texto que deve aparecer escrito na cena). Seja bem literal e criativo com as figuras de linguagem do narrador.",
          },
          {
            role: "user",
            content: `Comentário do narrador: "${narratorComment}"`,
          },
        ],
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.choices?.[0]?.message?.content?.trim() || null;
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  let journeyId: string, ranking: RankingMember[], themeA: string, themeB: string, narratorComment: string;
  try {
    const body = await request.json();
    journeyId = body.journeyId;
    ranking = body.ranking;
    themeA = body.themeA || "#29F1D6";
    themeB = body.themeB || "#8B5CF6";
    narratorComment = body.narratorComment || "";
  } catch {
    return NextResponse.json({ error: "Requisição inválida" }, { status: 400 });
  }

  if (!journeyId || !Array.isArray(ranking) || ranking.length < 2) {
    return NextResponse.json({ error: "Dados insuficientes pra gerar o pôster" }, { status: 400 });
  }

  const top = ranking.slice(0, 3);
  const scene = (await generateSceneFromNarrator(narratorComment)) ?? FALLBACK_SCENES[Math.floor(Math.random() * FALLBACK_SCENES.length)];

  // Baixa as fotos de perfil disponíveis pra usar como referência visual, em paralelo
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
  const referenceImages = fetched.filter((r): r is { name: string; blob: Blob } => r !== null);

  const GENDER_LABEL: Record<string, string> = {
    masculino: "gênero masculino (homem)",
    feminino: "gênero feminino (mulher)",
  };

  const peopleDescription = top
    .map((m, i) => {
      const hasPhoto = referenceImages.some((r) => r.name === m.name);
      const genderNote = m.gender && GENDER_LABEL[m.gender] ? ` A pessoa é do ${GENDER_LABEL[m.gender]} — mantenha esse gênero exatamente, não troque.` : "";
      const ethnicityNote = m.ethnicity && m.ethnicity !== "Prefiro não dizer" ? ` Etnia/tom de pele: ${m.ethnicity}.` : "";
      const ageNote = m.age ? ` Aparenta aproximadamente ${m.age} anos.` : "";
      const base = `${POSITION_LABELS[i]}: pessoa chamada "${m.name}", ${POSITION_MOODS[i]}.${genderNote}${ethnicityNote}${ageNote} Veste roupa de corrida (camiseta esportiva de manga curta ou regata + shorts/bermuda de corrida + tênis de corrida) — NUNCA calça comprida nem roupa do dia a dia. A camiseta tem o nome "${m.name}" estampado grande e bem legível no peito, como uma camiseta personalizada de corrida de rua.`;
      return hasPhoto
        ? `${base} Baseie o rosto REALISTICAMENTE na foto de referência dessa mesma pessoa — mantenha a semelhança física real (rosto, cabelo, barba), sem estilizar como desenho, como se fosse uma foto composta de verdade.`
        : `${base} Essa pessoa não enviou foto — represente como um(a) corredor(a) realista genérico, respeitando as características acima.`;
    })
    .join("\n");

  const prompt = `Crie uma cena FOTORREALISTA de pessoas correndo, estilo still de filme de ação/aventura hollywoodiano — mas com um tom cômico e caloroso por baixo do drama exagerado. Iluminação cinematográfica intensa, cores saturadas, alto contraste, textura de foto real (não ilustração, não desenho, não cartoon).

Cenário: ${scene}

Personagens correndo (da esquerda pra direita: 2º lugar mais atrás à esquerda, 1º lugar na frente ao centro, 3º lugar mais atrás à direita):
${peopleDescription}

Importante: o ÚNICO texto permitido na imagem é o nome de cada personagem estampado na própria camiseta dele, exatamente como descrito acima. NÃO escreva mais nenhuma outra palavra, letra, logotipo, faixa, placa ou painel em lugar nenhum da imagem. Deixe uma margem mais limpa e com menos detalhes essenciais perto do topo e da base da composição (cerca de 15% da altura em cada ponta), pra funcionar bem quando a gente sobrepuser uma faixa depois. Formato pôster vertical.`;

  try {
    let imageB64: string | null = null;

    if (referenceImages.length > 0) {
      const form = new FormData();
      form.append("model", "gpt-image-1");
      form.append("prompt", prompt);
      form.append("size", "1024x1536");
      form.append("quality", "high");
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
        body: JSON.stringify({ model: "gpt-image-1", prompt, size: "1024x1536", quality: "high", n: 1 }),
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
