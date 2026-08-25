import { randomUUID } from "crypto";
import {
  pgTable,
  text,
  timestamp,
  integer,
  boolean,
  pgEnum,
  jsonb,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";

const id = () =>
  text("id")
    .primaryKey()
    .$defaultFn(() => randomUUID());

// ---------------------------------------------------------------------------
// ENUMS
// ---------------------------------------------------------------------------

export const userRoleEnum = pgEnum("user_role", [
  "admin",
  "coordinator",
  "sdr",
]);

export const userStatusEnum = pgEnum("user_status", ["active", "inactive"]);

export const leadStatusEnum = pgEnum("lead_status", [
  "novo",
  "em_trabalho",
  "reuniao_marcada",
  "oportunidade",
  "perdido",
]);

export const riskLevelEnum = pgEnum("risk_level", ["baixo", "medio", "alto"]);

export const meetingStatusEnum = pgEnum("meeting_status", [
  "agendado",
  "aguardando_confirmacao",
  "confirmado",
  "em_risco",
  "cancelado",
  "remarcado",
  "no_show",
  "compareceu",
  "realizada",
]);

export const meetingTypeEnum = pgEnum("meeting_type", [
  "self_booking",
  "outro",
]);

export const interactionChannelEnum = pgEnum("interaction_channel", [
  "whatsapp",
  "ligacao",
  "email",
  "sistema",
  "outro",
]);

export const interactionResultEnum = pgEnum("interaction_result", [
  "sem_resposta",
  "respondeu",
  "confirmou",
  "pediu_remarcar",
  "cancelou",
  "neutro",
]);

export const taskTypeEnum = pgEnum("task_type", [
  "confirmar_self_booking",
  "confirmacao_d1",
  "lembrete_d0",
  "recuperacao_no_show",
  "outro",
]);

export const taskPriorityEnum = pgEnum("task_priority", [
  "baixa",
  "media",
  "alta",
  "critica",
]);

export const taskStatusEnum = pgEnum("task_status", [
  "pendente",
  "concluida",
  "adiada",
  "cancelada",
]);

export const noShowReasonEnum = pgEnum("no_show_reason", [
  "esqueceu",
  "problema_pessoal",
  "reuniao_interna",
  "falta_interesse",
  "nao_respondeu",
  "conflito_agenda",
  "problema_tecnico",
  "outro",
]);

export const recoveryStageEnum = pgEnum("recovery_stage", [
  "nenhuma",
  "contato_imediato",
  "nova_tentativa",
  "follow_up",
  "encerrado_perdido",
  "recuperado",
]);

export const scriptCategoryEnum = pgEnum("script_category", [
  "primeiro_contato",
  "confirmacao",
  "lembrete",
  "nao_respondeu",
  "pediu_remarcar",
  "cancelou",
  "no_show",
  "recuperacao",
  "confirmacao_ultima_hora",
]);

export const cadenceStageEnum = pgEnum("cadence_stage", [
  "imediato",
  "d1",
  "d0",
  "proximo_horario",
]);

export const notificationTypeEnum = pgEnum("notification_type", [
  "novo_self_booking",
  "reuniao_em_risco",
  "tarefa_atrasada",
  "lead_confirmou",
  "lead_cancelou",
  "lead_no_show",
  "outro",
]);

// ---------------------------------------------------------------------------
// USERS
// ---------------------------------------------------------------------------

export const users = pgTable("users", {
  id: id(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  passwordHash: text("password_hash").notNull(),
  role: userRoleEnum("role").notNull().default("sdr"),
  status: userStatusEnum("status").notNull().default("active"),
  phone: text("phone"),
  avatarColor: text("avatar_color").default("#6366f1"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
}, (t) => ({
  emailIdx: uniqueIndex("users_email_idx").on(t.email),
}));

// ---------------------------------------------------------------------------
// GOOGLE INTEGRATION (conta central conectada via OAuth)
// ---------------------------------------------------------------------------

export const googleIntegration = pgTable("google_integration", {
  id: id(),
  connectedEmail: text("connected_email").notNull(),
  accessTokenEnc: text("access_token_enc"),
  refreshTokenEnc: text("refresh_token_enc"),
  scope: text("scope"),
  expiryDate: timestamp("expiry_date", { withTimezone: true }),
  connectedByUserId: text("connected_by_user_id").references(() => users.id),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// Agendas dos closers compartilhadas com a conta central conectada
export const calendarSources = pgTable("calendar_sources", {
  id: id(),
  label: text("label").notNull(), // ex: "João Gabriel - Closer"
  calendarId: text("calendar_id").notNull(), // normalmente o e-mail do closer
  sdrUserId: text("sdr_user_id").references(() => users.id),
  integrationId: text("integration_id").references(() => googleIntegration.id),
  active: boolean("active").notNull().default(true),
  lastSyncAt: timestamp("last_sync_at", { withTimezone: true }),
  syncToken: text("sync_token"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ---------------------------------------------------------------------------
// REGRAS DE IDENTIFICAÇÃO DE SELF BOOKING
// ---------------------------------------------------------------------------

export const selfBookingRules = pgTable("self_booking_rules", {
  id: id(),
  name: text("name").notNull(),
  calendarSourceId: text("calendar_source_id").references(() => calendarSources.id),
  titleKeywords: text("title_keywords"), // CSV de palavras-chave
  attendeeEmailPattern: text("attendee_email_pattern"), // ex: "*@*" ou domínio
  meetingTypeMatch: text("meeting_type_match"),
  responsibleMatch: text("responsible_match"),
  priority: integer("priority").notNull().default(0),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ---------------------------------------------------------------------------
// LEADS
// ---------------------------------------------------------------------------

export const leads = pgTable("leads", {
  id: id(),
  name: text("name").notNull(),
  company: text("company"),
  email: text("email"),
  phone: text("phone"),
  whatsapp: text("whatsapp"),
  role: text("role"), // cargo
  source: text("source").default("self_booking"),
  sdrUserId: text("sdr_user_id").references(() => users.id),
  riskScore: integer("risk_score").notNull().default(0),
  riskLevel: riskLevelEnum("risk_level").notNull().default("baixo"),
  status: leadStatusEnum("status").notNull().default("novo"),
  lastContactAt: timestamp("last_contact_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
}, (t) => ({
  emailIdx: index("leads_email_idx").on(t.email),
  sdrIdx: index("leads_sdr_idx").on(t.sdrUserId),
}));

// ---------------------------------------------------------------------------
// MEETINGS (reuniões)
// ---------------------------------------------------------------------------

export const meetings = pgTable("meetings", {
  id: id(),
  leadId: text("lead_id").notNull().references(() => leads.id, { onDelete: "cascade" }),
  googleEventId: text("google_event_id"),
  calendarSourceId: text("calendar_source_id").references(() => calendarSources.id),
  scheduledAt: timestamp("scheduled_at", { withTimezone: true }).notNull(),
  durationMinutes: integer("duration_minutes").notNull().default(30),
  sdrUserId: text("sdr_user_id").references(() => users.id),
  meetingType: meetingTypeEnum("meeting_type").notNull().default("self_booking"),
  status: meetingStatusEnum("status").notNull().default("agendado"),
  riskScore: integer("risk_score").notNull().default(0),
  riskLevel: riskLevelEnum("risk_level").notNull().default("baixo"),
  meetingLink: text("meeting_link"),
  confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
  attendedAt: timestamp("attended_at", { withTimezone: true }),
  noShowAt: timestamp("no_show_at", { withTimezone: true }),
  noShowReason: noShowReasonEnum("no_show_reason"),
  noShowReasonNote: text("no_show_reason_note"),
  cancelReason: text("cancel_reason"),
  canceledAt: timestamp("canceled_at", { withTimezone: true }),
  rescheduledFromId: text("rescheduled_from_id"),
  recoveryStage: recoveryStageEnum("recovery_stage").notNull().default("nenhuma"),
  recoveryAttempts: integer("recovery_attempts").notNull().default(0),
  recoveredMeetingId: text("recovered_meeting_id"),
  isDeletedInCalendar: boolean("is_deleted_in_calendar").notNull().default(false),
  rawTitle: text("raw_title"),
  rawDescription: text("raw_description"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
}, (t) => ({
  googleEventIdx: uniqueIndex("meetings_google_event_idx").on(t.googleEventId),
  leadIdx: index("meetings_lead_idx").on(t.leadId),
  sdrIdx: index("meetings_sdr_idx").on(t.sdrUserId),
  statusIdx: index("meetings_status_idx").on(t.status),
  scheduledIdx: index("meetings_scheduled_idx").on(t.scheduledAt),
}));

// ---------------------------------------------------------------------------
// INTERAÇÕES
// ---------------------------------------------------------------------------

export const interactions = pgTable("interactions", {
  id: id(),
  leadId: text("lead_id").notNull().references(() => leads.id, { onDelete: "cascade" }),
  meetingId: text("meeting_id").references(() => meetings.id, { onDelete: "set null" }),
  sdrUserId: text("sdr_user_id").references(() => users.id),
  channel: interactionChannelEnum("channel").notNull().default("sistema"),
  type: text("type").notNull(), // texto livre curto, ex: "Primeiro contato"
  result: interactionResultEnum("result").notNull().default("neutro"),
  note: text("note"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
}, (t) => ({
  leadIdx: index("interactions_lead_idx").on(t.leadId),
  meetingIdx: index("interactions_meeting_idx").on(t.meetingId),
}));

// ---------------------------------------------------------------------------
// TAREFAS
// ---------------------------------------------------------------------------

export const tasks = pgTable("tasks", {
  id: id(),
  leadId: text("lead_id").references(() => leads.id, { onDelete: "cascade" }),
  meetingId: text("meeting_id").references(() => meetings.id, { onDelete: "cascade" }),
  assignedToId: text("assigned_to_id").references(() => users.id),
  type: taskTypeEnum("type").notNull().default("outro"),
  title: text("title").notNull(),
  dueAt: timestamp("due_at", { withTimezone: true }).notNull(),
  priority: taskPriorityEnum("priority").notNull().default("media"),
  status: taskStatusEnum("status").notNull().default("pendente"),
  note: text("note"),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
}, (t) => ({
  assignedIdx: index("tasks_assigned_idx").on(t.assignedToId),
  statusIdx: index("tasks_status_idx").on(t.status),
  dueIdx: index("tasks_due_idx").on(t.dueAt),
}));

// ---------------------------------------------------------------------------
// SCORE DE RISCO (fatores configuráveis)
// ---------------------------------------------------------------------------

export const riskFactors = pgTable("risk_factors", {
  id: id(),
  key: text("key").notNull().unique(),
  label: text("label").notNull(),
  points: integer("points").notNull(), // positivo aumenta risco, negativo reduz
  active: boolean("active").notNull().default(true),
  order: integer("order").notNull().default(0),
});

export const riskThresholds = pgTable("risk_thresholds", {
  id: id(),
  lowMax: integer("low_max").notNull().default(30),
  mediumMax: integer("medium_max").notNull().default(60),
});

// ---------------------------------------------------------------------------
// CADÊNCIA DE CONFIRMAÇÃO
// ---------------------------------------------------------------------------

export const cadenceSteps = pgTable("cadence_steps", {
  id: id(),
  stage: cadenceStageEnum("stage").notNull(),
  label: text("label").notNull(),
  objective: text("objective").notNull(),
  offsetHoursFromMeeting: integer("offset_hours_from_meeting").notNull(), // negativo = antes da reunião
  channelSuggestion: text("channel_suggestion").default("whatsapp"),
  active: boolean("active").notNull().default(true),
  order: integer("order").notNull().default(0),
});

// ---------------------------------------------------------------------------
// SCRIPTS
// ---------------------------------------------------------------------------

export const scripts = pgTable("scripts", {
  id: id(),
  category: scriptCategoryEnum("category").notNull(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  updatedByUserId: text("updated_by_user_id").references(() => users.id),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ---------------------------------------------------------------------------
// METAS
// ---------------------------------------------------------------------------

export const goals = pgTable("goals", {
  id: id(),
  key: text("key").notNull().unique(), // attendance_rate | no_show_rate | confirmation_rate | first_contact_minutes
  label: text("label").notNull(),
  targetValue: integer("target_value").notNull(),
  unit: text("unit").notNull().default("%"),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ---------------------------------------------------------------------------
// AUDITORIA
// ---------------------------------------------------------------------------

export const auditLogs = pgTable("audit_logs", {
  id: id(),
  userId: text("user_id").references(() => users.id),
  action: text("action").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id"),
  before: jsonb("before"),
  after: jsonb("after"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
}, (t) => ({
  entityIdx: index("audit_entity_idx").on(t.entityType, t.entityId),
  createdIdx: index("audit_created_idx").on(t.createdAt),
}));

// ---------------------------------------------------------------------------
// NOTIFICAÇÕES
// ---------------------------------------------------------------------------

export const notifications = pgTable("notifications", {
  id: id(),
  userId: text("user_id").references(() => users.id), // null = broadcast (todos)
  type: notificationTypeEnum("type").notNull().default("outro"),
  title: text("title").notNull(),
  message: text("message").notNull(),
  relatedEntityType: text("related_entity_type"),
  relatedEntityId: text("related_entity_id"),
  read: boolean("read").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
}, (t) => ({
  userIdx: index("notifications_user_idx").on(t.userId),
}));

// ---------------------------------------------------------------------------
// SESSÕES (autenticação)
// ---------------------------------------------------------------------------

export const sessions = pgTable("sessions", {
  id: id(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull(),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});

// ---------------------------------------------------------------------------
// RELATIONS
// ---------------------------------------------------------------------------

export const usersRelations = relations(users, ({ many }) => ({
  leads: many(leads),
  meetings: many(meetings),
  tasks: many(tasks),
}));

export const leadsRelations = relations(leads, ({ one, many }) => ({
  sdr: one(users, { fields: [leads.sdrUserId], references: [users.id] }),
  meetings: many(meetings),
  interactions: many(interactions),
  tasks: many(tasks),
}));

export const meetingsRelations = relations(meetings, ({ one, many }) => ({
  lead: one(leads, { fields: [meetings.leadId], references: [leads.id] }),
  sdr: one(users, { fields: [meetings.sdrUserId], references: [users.id] }),
  interactions: many(interactions),
  tasks: many(tasks),
  calendarSource: one(calendarSources, {
    fields: [meetings.calendarSourceId],
    references: [calendarSources.id],
  }),
}));

export const interactionsRelations = relations(interactions, ({ one }) => ({
  lead: one(leads, { fields: [interactions.leadId], references: [leads.id] }),
  meeting: one(meetings, { fields: [interactions.meetingId], references: [meetings.id] }),
  sdr: one(users, { fields: [interactions.sdrUserId], references: [users.id] }),
}));

export const tasksRelations = relations(tasks, ({ one }) => ({
  lead: one(leads, { fields: [tasks.leadId], references: [leads.id] }),
  meeting: one(meetings, { fields: [tasks.meetingId], references: [meetings.id] }),
  assignedTo: one(users, { fields: [tasks.assignedToId], references: [users.id] }),
}));

export const calendarSourcesRelations = relations(calendarSources, ({ one, many }) => ({
  sdr: one(users, { fields: [calendarSources.sdrUserId], references: [users.id] }),
  integration: one(googleIntegration, {
    fields: [calendarSources.integrationId],
    references: [googleIntegration.id],
  }),
  meetings: many(meetings),
}));
