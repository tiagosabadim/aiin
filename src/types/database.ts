// ============================================================
//  PostAI · Types TypeScript · gerado do schema Supabase
// ============================================================

export type Json = string | number | boolean | null | { [key: string]: Json } | Json[]

// ---- Enums ----
export type AssetCategory = 'pessoa' | 'produto' | 'empresa' | 'campanha'
export type PostFormat    = 'foto' | 'carrossel' | 'reels' | 'stories'
export type PostStatus    = 'pending_approval' | 'approved' | 'rejected' | 'scheduled' | 'published' | 'failed'
export type BriefingStatus = 'draft' | 'processing' | 'done' | 'error'

// ---- Tabelas ----
export interface Brand {
  id: string
  user_id: string
  name: string
  segment: string | null
  description: string | null
  tone_of_voice: string | null
  color_palette: ColorSwatch[]
  typography: Typography
  slogans: Slogan[]
  icons: string[]
  logo_urls: LogoUrls
  ai_context: string | null
  ai_context_pct: number
  instagram_account_id: string | null
  instagram_access_token: string | null
  created_at: string
  updated_at: string
}

export interface Asset {
  id: string
  brand_id: string
  user_id: string
  name: string
  storage_path: string
  public_url: string | null
  category: AssetCategory
  tags: string[]
  ai_analyzed: boolean
  performance_score: number
  times_used: number
  notes: string | null
  created_at: string
  updated_at: string
}

export interface Briefing {
  id: string
  brand_id: string
  user_id: string
  name: string
  description: string | null
  objective: string | null
  target_audience: string | null
  tone: string | null
  post_count: number
  hashtags: string[]
  asset_ids: string[]
  extra_context: string | null
  status: BriefingStatus
  n8n_execution_id: string | null
  created_at: string
  updated_at: string
}

export interface Post {
  id: string
  briefing_id: string
  brand_id: string
  user_id: string
  caption: string | null
  image_prompt: string | null
  image_url: string | null
  image_storage_path: string | null
  asset_ids_used: string[]
  format: PostFormat
  status: PostStatus
  scheduled_at: string | null
  published_at: string | null
  instagram_post_id: string | null
  ai_score: number | null
  rejection_reason: string | null
  created_at: string
  updated_at: string
}

export interface Insight {
  id: string
  post_id: string
  brand_id: string
  collected_at: string
  reach: number
  impressions: number
  likes: number
  comments: number
  saves: number
  shares: number
  profile_visits: number
  engagement_rate: number
  follows_from_post: number
  raw_meta_data: Json
}

export interface AiLearning {
  id: string
  brand_id: string
  generated_at: string
  best_days: string[]
  best_hours: string | null
  best_format: string | null
  best_tone: string | null
  best_hashtag_type: string | null
  top_patterns: Pattern[]
  patterns_to_avoid: Pattern[]
  summary: string | null
  posts_analyzed: number
  avg_engagement: number
}

// ---- Tipos auxiliares (JSONB) ----
export interface ColorSwatch {
  name: string
  hex: string
  role: 'primary' | 'secondary' | 'accent' | 'text' | 'background'
}

export interface Typography {
  title?: string
  body?: string
  label?: string
}

export interface Slogan {
  text: string
  active: boolean
}

export interface LogoUrls {
  primary?: string
  light?: string
  dark?: string
}

export interface Pattern {
  pattern: string
  impact: string
  confidence: number   // 0-1
}

// ---- View ----
export interface PostWithInsights extends Post {
  reach: number | null
  impressions: number | null
  likes: number | null
  comments: number | null
  saves: number | null
  engagement_rate: number | null
  insights_at: string | null
}
