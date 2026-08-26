import {
  LayoutDashboard,
  CalendarClock,
  CalendarDays,
  ListChecks,
  Users,
  UserX,
  FileBarChart,
  TrendingUp,
  MessagesSquare,
  Settings,
} from "lucide-react";

/**
 * Navegação única do app — usada no menu lateral (desktop) e no menu mobile,
 * para os dois nunca saírem de sincronia.
 *
 * Os itens são agrupados por *momento de uso* em vez de virem numa lista
 * corrida: primeiro o que se usa no dia a dia ("Operação"), depois o que se
 * olha de tempos em tempos ("Análise") e por último o que quase não se mexe
 * ("Configuração"). Cada item tem uma dica curta em `hint`, que aparece ao
 * passar o mouse, para o nome nunca ser a única explicação do que é a tela.
 */
export const NAV_GROUPS = [
  {
    title: "Operação",
    items: [
      {
        href: "/dashboard",
        label: "Visão geral",
        icon: LayoutDashboard,
        hint: "O resumo do dia e o que precisa da sua atenção agora",
        roles: ["admin", "coordinator", "sdr"],
      },
      {
        href: "/self-bookings",
        label: "Reuniões",
        icon: CalendarClock,
        hint: "Todas as reuniões agendadas pelo self booking",
        roles: ["admin", "coordinator", "sdr"],
      },
      {
        href: "/agenda",
        label: "Agenda",
        icon: CalendarDays,
        hint: "As reuniões distribuídas no calendário",
        roles: ["admin", "coordinator", "sdr"],
      },
      {
        href: "/tasks",
        label: "Tarefas",
        icon: ListChecks,
        hint: "Sua fila de confirmações, lembretes e follow-ups",
        roles: ["admin", "coordinator", "sdr"],
      },
      {
        href: "/leads",
        label: "Leads",
        icon: Users,
        hint: "Cadastro e histórico de cada lead",
        roles: ["admin", "coordinator", "sdr"],
      },
      {
        href: "/no-shows",
        label: "No-shows",
        icon: UserX,
        hint: "Quem faltou e o que fazer para recuperar",
        roles: ["admin", "coordinator", "sdr"],
      },
    ],
  },
  {
    title: "Análise",
    items: [
      {
        href: "/reports",
        label: "Relatórios",
        icon: FileBarChart,
        hint: "Números do período e comparativos",
        roles: ["admin", "coordinator"],
      },
      {
        href: "/performance",
        label: "Performance",
        icon: TrendingUp,
        hint: "Resultado por SDR e evolução das metas",
        roles: ["admin", "coordinator", "sdr"],
      },
    ],
  },
  {
    title: "Configuração",
    items: [
      {
        href: "/scripts",
        label: "Scripts",
        icon: MessagesSquare,
        hint: "Modelos de mensagem prontos para copiar",
        roles: ["admin", "coordinator", "sdr"],
      },
      {
        href: "/settings",
        label: "Ajustes",
        icon: Settings,
        hint: "Integrações, usuários, metas e regras",
        roles: ["admin", "coordinator"],
      },
    ],
  },
] as const;
