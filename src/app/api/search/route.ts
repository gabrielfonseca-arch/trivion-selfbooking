import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { leads, meetings } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { and, desc, ilike, inArray, notInArray, or, sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

/**
 * Busca rápida global (a caixa no topo do app).
 *
 * Procura o texto em nome, empresa, e-mail, telefone e WhatsApp do lead. O
 * telefone é comparado só pelos dígitos, para que "(11) 99999-8888",
 * "11999998888" e "99999 8888" encontrem o mesmo lead.
 *
 * Devolve, junto de cada lead, a reunião ativa mais próxima dele — assim o
 * resultado já responde "quando é a reunião dessa pessoa?" sem precisar abrir
 * a ficha.
 */
export async function GET(req: NextRequest) {
  await requireUser();

  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  if (q.length < 2) {
    return NextResponse.json({ results: [] });
  }

  const like = `%${q}%`;
  const digits = q.replace(/\D/g, "");

  const conditions = [
    ilike(leads.name, like),
    ilike(leads.company, like),
    ilike(leads.email, like),
  ];

  // Só compara telefone quando o usuário digitou algo que parece número —
  // senão qualquer letra casaria com a string vazia de dígitos.
  if (digits.length >= 3) {
    const digitPattern = `%${digits}%`;
    conditions.push(
      sql`regexp_replace(coalesce(${leads.phone}, ''), '[^0-9]', '', 'g') LIKE ${digitPattern}`,
      sql`regexp_replace(coalesce(${leads.whatsapp}, ''), '[^0-9]', '', 'g') LIKE ${digitPattern}`
    );
  }

  const rows = await db
    .select({
      id: leads.id,
      name: leads.name,
      company: leads.company,
      email: leads.email,
      phone: leads.phone,
      status: leads.status,
      riskLevel: leads.riskLevel,
    })
    .from(leads)
    .where(or(...conditions))
    .orderBy(desc(leads.updatedAt))
    .limit(8);

  if (rows.length === 0) {
    return NextResponse.json({ results: [] });
  }

  // Próxima reunião de cada lead encontrado — uma consulta só, não uma por lead.
  const upcoming = await db
    .select({
      leadId: meetings.leadId,
      scheduledAt: meetings.scheduledAt,
      status: meetings.status,
    })
    .from(meetings)
    .where(
      and(
        inArray(
          meetings.leadId,
          rows.map((r) => r.id)
        ),
        notInArray(meetings.status, ["cancelado", "no_show"])
      )
    )
    .orderBy(meetings.scheduledAt);

  const nextByLead = new Map<string, { scheduledAt: Date; status: string }>();
  for (const m of upcoming) {
    if (!nextByLead.has(m.leadId)) {
      nextByLead.set(m.leadId, { scheduledAt: m.scheduledAt, status: m.status });
    }
  }

  return NextResponse.json({
    results: rows.map((r) => ({
      ...r,
      nextMeeting: nextByLead.get(r.id) ?? null,
    })),
  });
}
