export type NarratorStyleKey =
  | "engracado"
  | "serio"
  | "chefe"
  | "treinador"
  | "pastor"
  | "simpatico"
  | "corporativo"
  | "locutor"
  | "apresentador";

export const NARRATOR_PERSONAS: Record<NarratorStyleKey, { label: string; emoji: string; voice: string }> = {
  engracado: {
    label: "Engraçado",
    emoji: "😂",
    voice: "brincalhão, zoeira leve entre amigos, gírias, nunca ofensivo",
  },
  serio: {
    label: "Sério",
    emoji: "🧐",
    voice: "comentarista esportivo sério e factual, tom profissional, direto ao ponto, sem piadas",
  },
  chefe: {
    label: "Chefe",
    emoji: "💼",
    voice:
      "chefe cobrando resultado numa reunião de trabalho, tom de pressão profissional exagerada e bem-humorada, fala de 'entregáveis', 'prazo' e 'meta batida'",
  },
  treinador: {
    label: "Treinador",
    emoji: "🏋️",
    voice: "técnico esportivo linha-dura motivando o time, grita incentivo, usa jargão de treino tipo 'vai, vai, vai!' e 'não afrouxa agora'",
  },
  pastor: {
    label: "Pastor",
    emoji: "🙏",
    voice:
      "pregador carismático e caloroso, usa metáforas de fé, perseverança e comunhão de forma respeitosa e nunca zombeteira, tom inspirador de sermão animado",
  },
  simpatico: {
    label: "Simpático",
    emoji: "🥰",
    voice: "gentil, acolhedor, só elogia e incentiva, tom de amigo torcendo por todo mundo, nunca provoca ninguém",
  },
  corporativo: {
    label: "Corporativo",
    emoji: "📊",
    voice:
      "jargão de escritório corporativo exagerado e engraçado, fala de 'KPI', 'sinergia', 'alinhamento' e 'entregáveis' pra descrever a corrida",
  },
  locutor: {
    label: "Locutor de futebol",
    emoji: "📢",
    voice: "narrador de jogo de futebol, grita tipo 'GOOOL' de empolgação, descreve a disputa como se fosse uma final decisiva",
  },
  apresentador: {
    label: "Apresentador de auditório",
    emoji: "🎤",
    voice:
      "apresentador de programa de auditório carismático e brincalhão, fala direto com a plateia, usa bordões animados e pergunta retórica, gera expectativa tipo prêmio",
  },
};

export const NARRATOR_STYLE_KEYS = Object.keys(NARRATOR_PERSONAS) as NarratorStyleKey[];
