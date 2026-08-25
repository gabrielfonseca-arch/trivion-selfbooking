export const MEETING_STATUS_LABEL: Record<string, string> = {
  agendado: "Agendado",
  aguardando_confirmacao: "Aguardando confirmação",
  confirmado: "Confirmado",
  em_risco: "Em risco",
  cancelado: "Cancelado",
  remarcado: "Remarcado",
  no_show: "No-show",
  compareceu: "Compareceu",
  realizada: "Realizada",
};

export const MEETING_STATUS_COLOR: Record<string, string> = {
  agendado: "bg-blue-50 text-blue-700 ring-blue-600/20",
  aguardando_confirmacao: "bg-amber-50 text-amber-700 ring-amber-600/20",
  confirmado: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  em_risco: "bg-orange-50 text-orange-700 ring-orange-600/20",
  cancelado: "bg-gray-100 text-gray-600 ring-gray-500/20",
  remarcado: "bg-purple-50 text-purple-700 ring-purple-600/20",
  no_show: "bg-red-50 text-red-700 ring-red-600/20",
  compareceu: "bg-teal-50 text-teal-700 ring-teal-600/20",
  realizada: "bg-slate-100 text-slate-700 ring-slate-600/20",
};

export const RISK_LABEL: Record<string, string> = {
  baixo: "Baixo risco",
  medio: "Médio risco",
  alto: "Alto risco",
};

export const RISK_ICON: Record<string, string> = {
  baixo: "🟢",
  medio: "🟡",
  alto: "🔴",
};

export const PRIORITY_LABEL: Record<string, string> = {
  baixa: "Baixa",
  media: "Média",
  alta: "Alta",
  critica: "Crítica",
};

export const PRIORITY_COLOR: Record<string, string> = {
  baixa: "bg-gray-100 text-gray-600",
  media: "bg-blue-50 text-blue-700",
  alta: "bg-orange-50 text-orange-700",
  critica: "bg-red-50 text-red-700",
};

export const CHANNEL_LABEL: Record<string, string> = {
  whatsapp: "WhatsApp",
  ligacao: "Ligação",
  email: "E-mail",
  sistema: "Sistema",
  outro: "Outro",
};

export const RESULT_LABEL: Record<string, string> = {
  sem_resposta: "Sem resposta",
  respondeu: "Respondeu",
  confirmou: "Confirmou",
  pediu_remarcar: "Pediu para remarcar",
  cancelou: "Cancelou",
  neutro: "Neutro",
};

export const NO_SHOW_REASON_LABEL: Record<string, string> = {
  esqueceu: "Esqueceu",
  problema_pessoal: "Problema pessoal",
  reuniao_interna: "Reunião interna",
  falta_interesse: "Falta de interesse",
  nao_respondeu: "Não respondeu",
  conflito_agenda: "Conflito de agenda",
  problema_tecnico: "Problema técnico",
  outro: "Outro",
};

export const LEAD_STATUS_LABEL: Record<string, string> = {
  novo: "Novo",
  em_trabalho: "Em trabalho",
  reuniao_marcada: "Reunião marcada",
  oportunidade: "Oportunidade",
  perdido: "Perdido",
};

export const TASK_TYPE_LABEL: Record<string, string> = {
  confirmar_self_booking: "Confirmar Self Booking",
  confirmacao_d1: "Confirmação D-1",
  lembrete_d0: "Lembrete D0",
  recuperacao_no_show: "Recuperação de No-show",
  outro: "Outro",
};

export const ROLE_LABEL: Record<string, string> = {
  admin: "Administrador",
  coordinator: "Coordenador",
  sdr: "SDR",
};

export const RECOVERY_STAGE_LABEL: Record<string, string> = {
  nenhuma: "—",
  contato_imediato: "Contato imediato",
  nova_tentativa: "Nova tentativa",
  follow_up: "Follow-up",
  encerrado_perdido: "Encerrado (perdido)",
  recuperado: "Recuperado",
};

export const SCRIPT_CATEGORY_LABEL: Record<string, string> = {
  primeiro_contato: "Primeiro contato",
  confirmacao: "Confirmação",
  lembrete: "Lembrete",
  nao_respondeu: "Lead não respondeu",
  pediu_remarcar: "Lead pediu para remarcar",
  cancelou: "Lead cancelou",
  no_show: "No-show",
  recuperacao: "Recuperação",
  confirmacao_ultima_hora: "Confirmação de última hora",
};
