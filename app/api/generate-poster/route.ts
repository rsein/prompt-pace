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

// Converte a cor (hex) do perfil de cada um num nome de cor em português, pra usar como detalhe no look
function colorName(hex: string): string {
  const known: Record<string, string> = {
    "#29F1D6": "turquesa/ciano",
    "#8B5CF6": "roxo",
    "#FFC145": "amarelo dourado",
    "#FF6B9D": "rosa",
    "#5CFF8F": "verde",
    "#FF7A5C": "laranja avermelhado",
  };
  if (known[hex.toUpperCase()]) return known[hex.toUpperCase()];

  // fallback simples: converte o hex pra RGB e escolhe o nome mais próximo
  const r = parseInt(hex.slice(1, 3), 16) || 0;
  const g = parseInt(hex.slice(3, 5), 16) || 0;
  const b = parseInt(hex.slice(5, 7), 16) || 0;
  const options: [string, [number, number, number]][] = [
    ["vermelho", [255, 0, 0]],
    ["laranja", [255, 140, 0]],
    ["amarelo", [255, 220, 0]],
    ["verde", [0, 200, 80]],
    ["azul", [0, 120, 255]],
    ["roxo", [140, 60, 220]],
    ["rosa", [255, 100, 180]],
    ["ciano", [0, 220, 220]],
  ];
  let best = options[0];
  let bestDist = Infinity;
  for (const opt of options) {
    const [, [or, og, ob]] = opt;
    const dist = (r - or) ** 2 + (g - og) ** 2 + (b - ob) ** 2;
    if (dist < bestDist) {
      bestDist = dist;
      best = opt;
    }
  }
  return best[0];
}

type RankingMember = {
  id: string;
  name: string;
  avatar_url: string | null;
  color: string;
  gender: string | null;
  ethnicity?: string | null;
  age?: number | null;
  height_cm?: number | null;
  weight_kg?: number | null;
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

  let journeyId: string, ranking: RankingMember[], themeA: string, themeB: string, narratorComment: string, allMemberNames: string[];
  try {
    const body = await request.json();
    journeyId = body.journeyId;
    ranking = body.ranking;
    themeA = body.themeA || "#29F1D6";
    themeB = body.themeB || "#8B5CF6";
    narratorComment = body.narratorComment || "";
    allMemberNames = Array.isArray(body.allMemberNames) ? body.allMemberNames : [];
  } catch {
    return NextResponse.json({ error: "Requisição inválida" }, { status: 400 });
  }

  if (!journeyId || !Array.isArray(ranking) || ranking.length < 1) {
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
      const refIndex = referenceImages.findIndex((r) => r.name === m.name);
      const hasPhoto = refIndex !== -1;
      const genderNote = m.gender && GENDER_LABEL[m.gender] ? ` É do ${GENDER_LABEL[m.gender]} — mantenha esse gênero exatamente, nunca troque.` : "";
      const ethnicityNote = m.ethnicity && m.ethnicity !== "Prefiro não dizer" ? ` Etnia/tom de pele: ${m.ethnicity}.` : "";
      const ageNote = m.age ? ` Aparenta aproximadamente ${m.age} anos.` : "";
      const bodyNote = m.height_cm && m.weight_kg ? ` Porte físico compatível com ${m.height_cm}cm e ${m.weight_kg}kg (nem mais magro nem mais robusto que isso).` : "";
      const colorNote = ` Detalhe de cor ${colorName(m.color)} em algum item do look (tênis, pulseira ou faixa).`;
      const base = `${POSITION_LABELS[i]}: pessoa chamada "${m.name}", ${POSITION_MOODS[i]}.${genderNote}${ethnicityNote}${ageNote}${bodyNote}${colorNote} Veste roupa de corrida (camiseta esportiva de manga curta ou regata + shorts/bermuda de corrida + tênis de corrida) — NUNCA calça comprida nem roupa do dia a dia. A camiseta tem o nome "${m.name}" estampado grande e bem legível no peito, como uma camiseta personalizada de corrida de rua.`;
      return hasPhoto
        ? `${base} IMPORTANTE — FIDELIDADE DO ROSTO: a imagem de referência anexada NÚMERO ${refIndex + 1} (das ${referenceImages.length} anexadas, contando da primeira) é uma FOTO REAL do rosto desta pessoa específica. Use exatamente os traços faciais dessa foto de referência número ${refIndex + 1} — formato do rosto, olhos, nariz, boca, cabelo, barba (se houver) — sem estilizar, sem trocar por outra pessoa, sem misturar com os traços de nenhuma outra referência anexada. O rosto final tem que ser reconhecível como sendo o da pessoa dessa foto específica.`
        : `${base} Essa pessoa não enviou foto de perfil — represente como um(a) corredor(a) realista genérico, respeitando todas as características acima.`;
    })
    .join("\n\n");

  const refCountNote =
    referenceImages.length > 0
      ? `Foram anexadas ${referenceImages.length} foto(s) de referência de rosto nesta requisição, na ordem descrita abaixo pra cada personagem correspondente.\n\n`
      : "";

  // Lista explícita de amarração referência→pessoa, repetida antes das descrições — isso ajuda o
  // modelo a não trocar rostos entre as pessoas (problema comum quando há mais de uma foto anexada).
  const referenceMappingList =
    referenceImages.length > 0
      ? `MAPEAMENTO OBRIGATÓRIO DE REFERÊNCIAS (leia com atenção antes de continuar):\n${referenceImages
          .map((r, i) => `- Imagem de referência número ${i + 1} = rosto real de "${r.name}", e de mais ninguém.`)
          .join("\n")}\nATENÇÃO: não troque rostos entre as pessoas. Cada personagem usa APENAS a referência numerada que corresponde ao nome dele, mesmo que outra referência pareça "combinar melhor" com a expressão da posição (por exemplo: não coloque o rosto de outra referência na pessoa em 1º lugar só porque ela está sorrindo — use a referência numerada certa, do nome certo, em cada posição, sempre).\n\n`
      : "";

  const groupContext =
    allMemberNames.length > 0
      ? `Contexto do grupo: essa jornada de corrida tem ${allMemberNames.length} participante(s) ao todo — ${allMemberNames.join(", ")}. A cena mostra só ${top.length === 1 ? "essa pessoa" : "o pódio atual"}, mas é bom saber o grupo completo pro clima da ilustração.\n\n`
      : "";

  const compositionNote =
    top.length === 1
      ? "Personagem correndo, sozinho(a) em destaque no centro da cena, em pleno esforço:"
      : top.length === 2
        ? "Personagens correndo (da esquerda pra direita: 2º lugar mais atrás à esquerda, 1º lugar na frente à direita):"
        : "Personagens correndo (da esquerda pra direita: 2º lugar mais atrás à esquerda, 1º lugar na frente ao centro, 3º lugar mais atrás à direita):";

  const prompt = `Crie uma cena FOTORREALISTA de pessoas correndo, estilo still de filme de ação/aventura hollywoodiano — mas com um tom cômico e caloroso por baixo do drama exagerado. Iluminação cinematográfica intensa, cores saturadas, alto contraste, textura de foto real (não ilustração, não desenho, não cartoon).

${referenceMappingList}${groupContext}${refCountNote}Cenário: ${scene}

${compositionNote}
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
