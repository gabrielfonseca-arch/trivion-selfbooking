import "dotenv/config";
import { db } from "./index";
import {
  users,
  scripts,
  goals,
  selfBookingRules,
  calendarSources,
} from "./schema";
import { hashPassword } from "@/lib/password";
import { ensureDefaultRiskConfig } from "@/lib/risk-score";
import { ensureDefaultCadence } from "@/lib/tasks";
import { eq } from "drizzle-orm";

const DEFAULT_SCRIPTS: { category: string; title: string; content: string }[] = [
  {
    category: "primeiro_contato",
    title: "Primeiro contato — boas-vindas",
    content:
      "Oi {{nome}}! Aqui é o João, do Grupo Trivion 👋\nVi que você agendou uma conversa com a gente para {{data}} às {{hora}}. Fico muito feliz com seu interesse!\nSó pra confirmar: nesse papo vamos entender o momento da {{empresa}} e mostrar como podemos acelerar seus resultados comerciais. Faz sentido pra você?",
  },
  {
    category: "confirmacao",
    title: "Confirmação de presença",
    content:
      "{{nome}}, tudo certo para nossa reunião de {{data}} às {{hora}}? Consegue confirmar sua presença por aqui? 🙏",
  },
  {
    category: "lembrete",
    title: "Lembrete D-1",
    content:
      "Passando pra lembrar da nossa conversa amanhã, {{data}} às {{hora}}! Vai ser rápido e direto ao ponto. Até lá, {{nome}}! 🚀",
  },
  {
    category: "nao_respondeu",
    title: "Lead não respondeu",
    content:
      "{{nome}}, tudo bem? Não tive retorno sobre nossa reunião de {{data}}. Ainda faz sentido pra você? Se precisar reagendar, é só me avisar.",
  },
  {
    category: "pediu_remarcar",
    title: "Lead pediu para remarcar",
    content:
      "Sem problema, {{nome}}! Vamos encontrar um novo horário. Você tem disponibilidade nos próximos dias? Me manda 2-3 opções de horário que eu já ajusto por aqui.",
  },
  {
    category: "cancelou",
    title: "Lead cancelou",
    content:
      "Entendido, {{nome}}. Fico à disposição caso queira remarcar em outro momento. Posso te ajudar com alguma dúvida rápida agora mesmo?",
  },
  {
    category: "no_show",
    title: "Recuperação após no-show",
    content:
      "Oi {{nome}}, senti sua falta na nossa reunião de hoje! Imagino que tenha surgido algum imprevisto. Consegue me passar um novo horário essa semana?",
  },
  {
    category: "recuperacao",
    title: "Follow-up de recuperação",
    content:
      "{{nome}}, ainda não conseguimos nos falar. O momento de estruturar o comercial da {{empresa}} continua fazendo sentido? Se sim, vamos remarcar rapidinho.",
  },
  {
    category: "confirmacao_ultima_hora",
    title: "Confirmação de última hora",
    content:
      "{{nome}}, nossa reunião começa em instantes! Aqui está o link: {{link}}. Te espero lá! 🙌",
  },
];

const DEFAULT_GOALS = [
  { key: "attendance_rate", label: "Meta de comparecimento", targetValue: 95, unit: "%" },
  { key: "no_show_rate", label: "Meta de no-show (máximo)", targetValue: 5, unit: "%" },
  { key: "confirmation_rate", label: "Meta de confirmação", targetValue: 90, unit: "%" },
  { key: "first_contact_minutes", label: "Tempo máximo de primeiro contato", targetValue: 5, unit: "min" },
];

export async function seedBaseData() {
  console.log("Seed: usuários base...");

  const adminEmail = "admin@grupotrivion.com";
  const coordEmail = "coordenador@grupotrivion.com";
  const sdrEmail = "joao.gabriel@grupotrivion.com";

  const defaultPassword = await hashPassword("trivion123");

  async function upsertUser(name: string, email: string, role: "admin" | "coordinator" | "sdr", color: string) {
    const [existing] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (existing) return existing;
    const [created] = await db
      .insert(users)
      .values({ name, email, role, passwordHash: defaultPassword, avatarColor: color })
      .returning();
    return created;
  }

  const admin = await upsertUser("Administrador Trivion", adminEmail, "admin", "#312e81");
  const coordinator = await upsertUser("Camila Ribeiro", coordEmail, "coordinator", "#0891b2");
  const joao = await upsertUser("João Gabriel", sdrEmail, "sdr", "#4338ca");

  console.log("Seed: score de risco e cadência padrão...");
  await ensureDefaultRiskConfig();
  await ensureDefaultCadence();

  console.log("Seed: scripts...");
  const existingScripts = await db.select().from(scripts).limit(1);
  if (existingScripts.length === 0) {
    await db.insert(scripts).values(
      DEFAULT_SCRIPTS.map((s) => ({ ...s, category: s.category as never, updatedByUserId: admin.id }))
    );
  }

  console.log("Seed: metas...");
  const existingGoals = await db.select().from(goals).limit(1);
  if (existingGoals.length === 0) {
    await db.insert(goals).values(DEFAULT_GOALS);
  }

  console.log("Seed: agenda de calendário (simulada) e regra de self booking...");
  let [source] = await db
    .select()
    .from(calendarSources)
    .where(eq(calendarSources.label, "João Gabriel - Closer (simulado)"))
    .limit(1);
  if (!source) {
    [source] = await db
      .insert(calendarSources)
      .values({
        label: "João Gabriel - Closer (simulado)",
        calendarId: "joao.gabriel@grupotrivion.com",
        sdrUserId: joao.id,
        active: true,
      })
      .returning();
  }

  const existingRules = await db.select().from(selfBookingRules).limit(1);
  if (existingRules.length === 0) {
    await db.insert(selfBookingRules).values({
      name: "Self Booking — agenda do closer",
      calendarSourceId: source.id,
      titleKeywords: "self booking,reunião,diagnóstico",
      priority: 1,
    });
  }

  return { admin, coordinator, joao, source };
}

async function main() {
  const { admin, coordinator, joao } = await seedBaseData();
  console.log("\nUsuários criados/existentes:");
  console.log(`  Admin:       ${admin.email} / trivion123`);
  console.log(`  Coordenador: ${coordinator.email} / trivion123`);
  console.log(`  SDR (João):  ${joao.email} / trivion123`);
  process.exit(0);
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
