import { MessageCircle } from "lucide-react";
import type { leads } from "@/db/schema";

type Lead = typeof leads.$inferSelect;

const HORA_FMT = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

/**
 * Normaliza um telefone brasileiro para o formato que o wa.me espera:
 * só dígitos, com o código do país na frente.
 *
 * Números salvos no sistema costumam vir como "(11) 99999-8888" ou
 * "11999999888" — sem o 55. Como acrescentar o 55 num número que já tem
 * daria um número inválido, só adicionamos quando o tamanho indica que ele
 * está faltando (10 dígitos = fixo com DDD, 11 = celular com DDD).
 */
function toWhatsAppNumber(raw: string | null): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  if (digits.length === 12 || digits.length === 13) return digits;
  return null;
}

/**
 * Abre o WhatsApp já com uma mensagem de confirmação escrita — o contato mais
 * comum da operação deixa de ser "copiar número, abrir o WhatsApp, achar a
 * conversa, escrever" e passa a ser um clique.
 */
export function WhatsAppButton({
  lead,
  scheduledAt,
  className = "",
}: {
  lead: Lead;
  scheduledAt?: Date | null;
  className?: string;
}) {
  const numero = toWhatsAppNumber(lead.whatsapp ?? lead.phone);
  if (!numero) return null;

  const primeiroNome = lead.name.split(" ")[0];
  const quando = scheduledAt ? HORA_FMT.format(new Date(scheduledAt)) : null;

  const texto = quando
    ? `Olá, ${primeiroNome}! Aqui é do Grupo Trivion. Passando para confirmar nossa reunião em ${quando}. Podemos manter?`
    : `Olá, ${primeiroNome}! Aqui é do Grupo Trivion.`;

  return (
    <a
      href={`https://wa.me/${numero}?text=${encodeURIComponent(texto)}`}
      target="_blank"
      rel="noreferrer"
      title={`Chamar ${primeiroNome} no WhatsApp`}
      className={`inline-flex items-center gap-1 rounded-lg bg-brand/15 text-brand-strong ring-1 ring-inset ring-brand-dark/25 px-2 py-1.5 text-xs font-medium hover:bg-brand/25 whitespace-nowrap ${className}`}
    >
      <MessageCircle size={13} /> WhatsApp
    </a>
  );
}
