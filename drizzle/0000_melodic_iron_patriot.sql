CREATE TYPE "public"."cadence_stage" AS ENUM('imediato', 'd1', 'd0', 'proximo_horario');--> statement-breakpoint
CREATE TYPE "public"."interaction_channel" AS ENUM('whatsapp', 'ligacao', 'email', 'sistema', 'outro');--> statement-breakpoint
CREATE TYPE "public"."interaction_result" AS ENUM('sem_resposta', 'respondeu', 'confirmou', 'pediu_remarcar', 'cancelou', 'neutro');--> statement-breakpoint
CREATE TYPE "public"."lead_status" AS ENUM('novo', 'em_trabalho', 'reuniao_marcada', 'oportunidade', 'perdido');--> statement-breakpoint
CREATE TYPE "public"."meeting_status" AS ENUM('agendado', 'aguardando_confirmacao', 'confirmado', 'em_risco', 'cancelado', 'remarcado', 'no_show', 'compareceu', 'realizada');--> statement-breakpoint
CREATE TYPE "public"."meeting_type" AS ENUM('self_booking', 'outro');--> statement-breakpoint
CREATE TYPE "public"."no_show_reason" AS ENUM('esqueceu', 'problema_pessoal', 'reuniao_interna', 'falta_interesse', 'nao_respondeu', 'conflito_agenda', 'problema_tecnico', 'outro');--> statement-breakpoint
CREATE TYPE "public"."notification_type" AS ENUM('novo_self_booking', 'reuniao_em_risco', 'tarefa_atrasada', 'lead_confirmou', 'lead_cancelou', 'lead_no_show', 'outro');--> statement-breakpoint
CREATE TYPE "public"."recovery_stage" AS ENUM('nenhuma', 'contato_imediato', 'nova_tentativa', 'follow_up', 'encerrado_perdido', 'recuperado');--> statement-breakpoint
CREATE TYPE "public"."risk_level" AS ENUM('baixo', 'medio', 'alto');--> statement-breakpoint
CREATE TYPE "public"."script_category" AS ENUM('primeiro_contato', 'confirmacao', 'lembrete', 'nao_respondeu', 'pediu_remarcar', 'cancelou', 'no_show', 'recuperacao', 'confirmacao_ultima_hora');--> statement-breakpoint
CREATE TYPE "public"."task_priority" AS ENUM('baixa', 'media', 'alta', 'critica');--> statement-breakpoint
CREATE TYPE "public"."task_status" AS ENUM('pendente', 'concluida', 'adiada', 'cancelada');--> statement-breakpoint
CREATE TYPE "public"."task_type" AS ENUM('confirmar_self_booking', 'confirmacao_d1', 'lembrete_d0', 'recuperacao_no_show', 'outro');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('admin', 'coordinator', 'sdr');--> statement-breakpoint
CREATE TYPE "public"."user_status" AS ENUM('active', 'inactive');--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text,
	"before" jsonb,
	"after" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cadence_steps" (
	"id" text PRIMARY KEY NOT NULL,
	"stage" "cadence_stage" NOT NULL,
	"label" text NOT NULL,
	"objective" text NOT NULL,
	"offset_hours_from_meeting" integer NOT NULL,
	"channel_suggestion" text DEFAULT 'whatsapp',
	"active" boolean DEFAULT true NOT NULL,
	"order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "calendar_sources" (
	"id" text PRIMARY KEY NOT NULL,
	"label" text NOT NULL,
	"calendar_id" text NOT NULL,
	"sdr_user_id" text,
	"integration_id" text,
	"active" boolean DEFAULT true NOT NULL,
	"last_sync_at" timestamp with time zone,
	"sync_token" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "goals" (
	"id" text PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"label" text NOT NULL,
	"target_value" integer NOT NULL,
	"unit" text DEFAULT '%' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "goals_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "google_integration" (
	"id" text PRIMARY KEY NOT NULL,
	"connected_email" text NOT NULL,
	"access_token_enc" text,
	"refresh_token_enc" text,
	"scope" text,
	"expiry_date" timestamp with time zone,
	"connected_by_user_id" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "interactions" (
	"id" text PRIMARY KEY NOT NULL,
	"lead_id" text NOT NULL,
	"meeting_id" text,
	"sdr_user_id" text,
	"channel" "interaction_channel" DEFAULT 'sistema' NOT NULL,
	"type" text NOT NULL,
	"result" "interaction_result" DEFAULT 'neutro' NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "leads" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"company" text,
	"email" text,
	"phone" text,
	"whatsapp" text,
	"role" text,
	"source" text DEFAULT 'self_booking',
	"sdr_user_id" text,
	"risk_score" integer DEFAULT 0 NOT NULL,
	"risk_level" "risk_level" DEFAULT 'baixo' NOT NULL,
	"status" "lead_status" DEFAULT 'novo' NOT NULL,
	"last_contact_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "meetings" (
	"id" text PRIMARY KEY NOT NULL,
	"lead_id" text NOT NULL,
	"google_event_id" text,
	"calendar_source_id" text,
	"scheduled_at" timestamp with time zone NOT NULL,
	"duration_minutes" integer DEFAULT 30 NOT NULL,
	"sdr_user_id" text,
	"meeting_type" "meeting_type" DEFAULT 'self_booking' NOT NULL,
	"status" "meeting_status" DEFAULT 'agendado' NOT NULL,
	"meeting_link" text,
	"confirmed_at" timestamp with time zone,
	"attended_at" timestamp with time zone,
	"no_show_at" timestamp with time zone,
	"no_show_reason" "no_show_reason",
	"no_show_reason_note" text,
	"cancel_reason" text,
	"canceled_at" timestamp with time zone,
	"rescheduled_from_id" text,
	"recovery_stage" "recovery_stage" DEFAULT 'nenhuma' NOT NULL,
	"recovery_attempts" integer DEFAULT 0 NOT NULL,
	"recovered_meeting_id" text,
	"is_deleted_in_calendar" boolean DEFAULT false NOT NULL,
	"raw_title" text,
	"raw_description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text,
	"type" "notification_type" DEFAULT 'outro' NOT NULL,
	"title" text NOT NULL,
	"message" text NOT NULL,
	"related_entity_type" text,
	"related_entity_id" text,
	"read" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "risk_factors" (
	"id" text PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"label" text NOT NULL,
	"points" integer NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "risk_factors_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "risk_thresholds" (
	"id" text PRIMARY KEY NOT NULL,
	"low_max" integer DEFAULT 30 NOT NULL,
	"medium_max" integer DEFAULT 60 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scripts" (
	"id" text PRIMARY KEY NOT NULL,
	"category" "script_category" NOT NULL,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"updated_by_user_id" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "self_booking_rules" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"calendar_source_id" text,
	"title_keywords" text,
	"attendee_email_pattern" text,
	"meeting_type_match" text,
	"responsible_match" text,
	"priority" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"token_hash" text NOT NULL,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" text PRIMARY KEY NOT NULL,
	"lead_id" text,
	"meeting_id" text,
	"assigned_to_id" text,
	"type" "task_type" DEFAULT 'outro' NOT NULL,
	"title" text NOT NULL,
	"due_at" timestamp with time zone NOT NULL,
	"priority" "task_priority" DEFAULT 'media' NOT NULL,
	"status" "task_status" DEFAULT 'pendente' NOT NULL,
	"note" text,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" "user_role" DEFAULT 'sdr' NOT NULL,
	"status" "user_status" DEFAULT 'active' NOT NULL,
	"phone" text,
	"avatar_color" text DEFAULT '#6366f1',
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_sources" ADD CONSTRAINT "calendar_sources_sdr_user_id_users_id_fk" FOREIGN KEY ("sdr_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_sources" ADD CONSTRAINT "calendar_sources_integration_id_google_integration_id_fk" FOREIGN KEY ("integration_id") REFERENCES "public"."google_integration"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "google_integration" ADD CONSTRAINT "google_integration_connected_by_user_id_users_id_fk" FOREIGN KEY ("connected_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interactions" ADD CONSTRAINT "interactions_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interactions" ADD CONSTRAINT "interactions_meeting_id_meetings_id_fk" FOREIGN KEY ("meeting_id") REFERENCES "public"."meetings"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interactions" ADD CONSTRAINT "interactions_sdr_user_id_users_id_fk" FOREIGN KEY ("sdr_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_sdr_user_id_users_id_fk" FOREIGN KEY ("sdr_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meetings" ADD CONSTRAINT "meetings_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meetings" ADD CONSTRAINT "meetings_calendar_source_id_calendar_sources_id_fk" FOREIGN KEY ("calendar_source_id") REFERENCES "public"."calendar_sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meetings" ADD CONSTRAINT "meetings_sdr_user_id_users_id_fk" FOREIGN KEY ("sdr_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scripts" ADD CONSTRAINT "scripts_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "self_booking_rules" ADD CONSTRAINT "self_booking_rules_calendar_source_id_calendar_sources_id_fk" FOREIGN KEY ("calendar_source_id") REFERENCES "public"."calendar_sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_meeting_id_meetings_id_fk" FOREIGN KEY ("meeting_id") REFERENCES "public"."meetings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_assigned_to_id_users_id_fk" FOREIGN KEY ("assigned_to_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_entity_idx" ON "audit_logs" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "audit_created_idx" ON "audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "interactions_lead_idx" ON "interactions" USING btree ("lead_id");--> statement-breakpoint
CREATE INDEX "interactions_meeting_idx" ON "interactions" USING btree ("meeting_id");--> statement-breakpoint
CREATE INDEX "leads_email_idx" ON "leads" USING btree ("email");--> statement-breakpoint
CREATE INDEX "leads_sdr_idx" ON "leads" USING btree ("sdr_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "meetings_google_event_idx" ON "meetings" USING btree ("google_event_id");--> statement-breakpoint
CREATE INDEX "meetings_lead_idx" ON "meetings" USING btree ("lead_id");--> statement-breakpoint
CREATE INDEX "meetings_sdr_idx" ON "meetings" USING btree ("sdr_user_id");--> statement-breakpoint
CREATE INDEX "meetings_status_idx" ON "meetings" USING btree ("status");--> statement-breakpoint
CREATE INDEX "meetings_scheduled_idx" ON "meetings" USING btree ("scheduled_at");--> statement-breakpoint
CREATE INDEX "notifications_user_idx" ON "notifications" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "tasks_assigned_idx" ON "tasks" USING btree ("assigned_to_id");--> statement-breakpoint
CREATE INDEX "tasks_status_idx" ON "tasks" USING btree ("status");--> statement-breakpoint
CREATE INDEX "tasks_due_idx" ON "tasks" USING btree ("due_at");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_idx" ON "users" USING btree ("email");