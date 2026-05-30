// ============================================================
//  aiin · Types TypeScript v2
// ============================================================

export type Json = string | number | boolean | null | { [key: string]: Json } | Json[]

// ---- Enums ----
export type WorkspaceMemberRole = 'owner' | 'admin' | 'member'
export type SubscriptionStatus  = 'active' | 'canceled' | 'past_due' | 'trialing'
export type CreditType          = 'monthly_grant' | 'extra_purchase' | 'usage' | 'refund' | 'adjustment' | 'expiration'
export type AssetType           = 'logo' | 'foto_produto' | 'foto_equipe' | 'referencia_visual' | 'ilustracao' | 'icone' | 'fonte' | 'outro'
export type AssetCategory       = 'pessoa' | 'produto' | 'empresa' | 'campanha' | 'identidade'
export type ContentType         = 'post_simples' | 'post_premium' | 'carrossel_5' | 'carrossel_7' | 'story' | 'story_sequencia' | 'capa_reels' | 'campanha' | 'kit_campanha'
export type JobStatus           = 'pending' | 'processing' | 'waiting_approval' | 'revision_requested' | 'approved' | 'scheduled' | 'published' | 'error'
export type OutputStatus        = 'pending' | 'approved' | 'rejected' | 'scheduled' | 'published'
export type BriefStatus         = 'draft' | 'confirmed' | 'processing' | 'done' | 'error'
export type ScheduledPostStatus = 'scheduled' | 'publishing' | 'published' | 'failed'
export type LearningType        = 'approval' | 'rejection' | 'revision' | 'performance'
export type ConversationState   = 'idle' | 'awaiting_format' | 'awaiting_objective' | 'awaiting_credit_confirmation' | 'generating' | 'awaiting_approval' | 'awaiting_revision_note' | 'awaiting_schedule_datetime' | 'scheduled'
export type BriefSource         = 'painel' | 'whatsapp'

// ---- Plans ----
export interface Plan {
  id: string
  name: string
  monthly_price: number
  monthly_credits: number
  suggested_frequency: string | null
  max_workspaces: number
  max_users: number
  has_whatsapp: boolean
  has_calendar: boolean
  priority_level: number
  active: boolean
  created_at: string
}

// ---- Workspaces ----
export interface Workspace {
  id: string
  owner_id: string
  name: string
  slug: string | null
  plan_id: string | null
  active: boolean
  created_at: string
  updated_at: string
}

export interface WorkspaceMember {
  id: string
  workspace_id: string
  user_id: string
  role: WorkspaceMemberRole
  created_at: string
}

// ---- Subscriptions ----
export interface Subscription {
  id: string
  workspace_id: string
  plan_id: string
  status: SubscriptionStatus
  current_period_start: string
  current_period_end: string
  monthly_credits_available: number
  extra_credits_available: number
  created_at: string
  updated_at: string
}

// ---- Credit Ledger ----
export interface CreditLedgerEntry {
  id: string
  workspace_id: string
  subscription_id: string | null
  job_id: string | null
  type: CreditType
  amount: number
  balance_after: number
  description: string | null
  created_at: string
}

// ---- Brand Profile ----
export interface BrandProfile {
  id: string
  workspace_id: string
  name: string
  segment: string | null
  city: string | null
  target_audience: string | null
  main_objective: string | null
  tone_of_voice: string | null
  products: string | null
  color_palette: ColorSwatch[]
  typography: Typography
  slogans: Slogan[]
  icons: string[]
  logo_urls: LogoUrls
  visual_references: string[]
  forbidden_words: string[]
  design_rules: string | null
  ai_brand_dna: string | null
  ai_context_pct: number
  instagram_handle: string | null
  instagram_account_id: string | null
  instagram_access_token: string | null
  onboarding_completed: boolean
  created_at: string
  updated_at: string
}

// ---- Brand Asset ----
export interface BrandAsset {
  id: string
  workspace_id: string
  brand_id: string
  name: string
  storage_path: string
  public_url: string | null
  asset_type: AssetType
  category: AssetCategory | null
  tags: string[]
  ai_analyzed: boolean
  performance_score: number
  times_used: number
  created_at: string
  updated_at: string
}

// ---- Brand Learnings ----
export interface BrandLearning {
  id: string
  workspace_id: string
  brand_id: string
  learning_type: LearningType
  content: string
  job_id: string | null
  created_at: string
}

// ---- Content Brief ----
export interface ContentBrief {
  id: string
  workspace_id: string
  brand_id: string
  created_by: string | null
  title: string | null
  objective: string | null
  content_type: ContentType
  quantity: number
  tone: string | null
  hashtags: string[]
  asset_ids: string[]
  extra_context: string | null
  source: BriefSource
  required_credits: number
  status: BriefStatus
  created_at: string
  updated_at: string
}

// ---- Content Job ----
export interface ContentJob {
  id: string
  workspace_id: string
  brief_id: string | null
  brand_id: string | null
  job_type: string
  status: JobStatus
  required_credits: number
  credits_debited: boolean
  attempts_used: number
  max_attempts: number
  revision_count: number
  max_included_revisions: number
  input_payload: Json
  output_payload: Json
  error_message: string | null
  n8n_execution_id: string | null
  idempotency_key: string | null
  created_at: string
  updated_at: string
}

// ---- Creative Output ----
export interface CreativeOutput {
  id: string
  workspace_id: string
  job_id: string
  brand_id: string | null
  format: string
  variation_number: number
  storage_path: string | null
  public_url: string | null
  caption: string | null
  hashtags: string[]
  image_prompt: string | null
  status: OutputStatus
  approval_notes: string | null
  ai_score: number | null
  scheduled_at: string | null
  published_at: string | null
  instagram_post_id: string | null
  image_response_id: string | null
  edit_count: number
  created_at: string
  updated_at: string
}

// ---- Carousel Page ----
export interface CarouselPage {
  id: string
  creative_output_id: string
  page_number: number
  headline: string | null
  body: string | null
  visual_prompt: string | null
  storage_path: string | null
  public_url: string | null
  created_at: string
}

// ---- Approval Event ----
export interface ApprovalEvent {
  id: string
  workspace_id: string
  output_id: string
  user_id: string | null
  action: 'approved' | 'rejected' | 'revision_requested' | 'scheduled'
  notes: string | null
  created_at: string
}

// ---- Scheduled Post ----
export interface ScheduledPost {
  id: string
  workspace_id: string
  output_id: string
  brand_id: string | null
  scheduled_at: string
  status: ScheduledPostStatus
  instagram_post_id: string | null
  error_message: string | null
  published_at: string | null
  created_at: string
  updated_at: string
}

// ---- WhatsApp ----
export interface WhatsAppContact {
  id: string
  workspace_id: string
  phone: string
  name: string | null
  role: string
  is_authorized: boolean
  created_at: string
}

export interface WhatsAppMessage {
  id: string
  workspace_id: string | null
  phone: string
  direction: 'inbound' | 'outbound'
  message_type: string | null
  body: string | null
  payload: Json
  created_at: string
}

export interface WhatsAppConversationState {
  id: string
  workspace_id: string
  phone: string
  state: ConversationState
  context: Json
  expires_at: string
  created_at: string
  updated_at: string
}

// ---- Helpers JSONB ----
export interface ColorSwatch {
  name: string; hex: string; role: string
}
export interface Typography {
  title?: string; body?: string; label?: string
}
export interface Slogan {
  text: string; active: boolean
}
export interface LogoUrls {
  primary?: string; light?: string; dark?: string
}

// ---- Créditos por tipo ----
export const CREDIT_COSTS: Record<ContentType, number> = {
  post_simples:    1,
  post_premium:    2,
  capa_reels:      1,
  story:           1,
  story_sequencia: 2,
  carrossel_5:     3,
  carrossel_7:     4,
  campanha:        2,
  kit_campanha:    6,
}
