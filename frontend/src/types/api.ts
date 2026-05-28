export type BusinessType = "restaurant" | "retail" | "grocery" | "salon" | "gym" | "other";
export type TenantStatus = "demo" | "pending" | "active" | "archived";
export type ConversationSurface = "qr" | "tablet" | "kiosk" | "owner" | "demo";
export type MessageRole = "user" | "assistant" | "tool" | "system";

export type TenantVibe =
  | "fine-dining"
  | "casual-modern"
  | "rustic-warm"
  | "street-fast"
  | "cafe-bright"
  | "bar-night";

export type TenantLayout = "split-hero" | "centered-hero" | "full-bleed-hero";

export interface TenantThemePalette {
  primary?: string | null;
  accent?: string | null;
  surface?: string | null;
  ink?: string | null;
}

export interface TenantThemeFonts {
  display?: string | null;
  body?: string | null;
}

export interface TenantTheme {
  palette?: TenantThemePalette | null;
  fonts?: TenantThemeFonts | null;
  hero_url?: string | null;
  vibe?: TenantVibe | null;
  layout?: TenantLayout | null;
}

export interface TenantBrand {
  primary_color?: string | null;
  accent_color?: string | null;
  background_color?: string | null;
  logo_url?: string | null;
  voice?: string | null;
  theme?: TenantTheme | null;
}

export interface TenantContact {
  phone?: string | null;
  email?: string | null;
  address?: string | null;
}

export interface TenantHours {
  [day: string]: Array<{ open: string; close: string }> | undefined;
}

export interface TenantAIConfig {
  persona?: string | null;
  tagline?: string | null;
}

export interface Tenant {
  provenance?: Record<string, { source: string; fetched_at?: string }> | null;
  id: string;
  slug: string;
  name: string;
  business_type: BusinessType;
  status?: TenantStatus;
  source_url?: string | null;
  brand: TenantBrand;
  contact: TenantContact;
  hours: TenantHours;
  ai_config?: TenantAIConfig;
  ai_persona?: string | null;
  tagline?: string | null;
  pos_provider?: string | null;
  created_at?: string;
  activated_at?: string | null;
}

export interface MenuItem {
  id: string;
  name: string;
  description?: string | null;
  price_cents?: number | null;
  image_url?: string | null;
  image_path?: string | null;
  provenance?: Record<string, { source: string; fetched_at?: string }> | null;
  tags: string[];
  ingredients: string[];
  allergens: string[];
  is_available: boolean;
}

export interface MenuCategory {
  id: string;
  name: string;
  description?: string | null;
  items: MenuItem[];
}

export interface MenuResponse {
  tenant: Tenant;
  categories: MenuCategory[];
}

export interface GenerateDemoRequest {
  url: string;
  slug?: string;
}

export interface GenerateDemoResponse {
  tenant_id: string;
  slug: string;
  name: string;
  business_type: BusinessType;
  pos_provider?: string | null;
  menu_url: string;
  chat_endpoint: string;
}

export interface ChatStreamEvent {
  text?: string;
  conversation_id?: string;
  error?: string;
  done?: boolean;
}

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  createdAt: Date;
  status: "pending" | "streaming" | "complete" | "error";
}

export interface ConversationSummary {
  id: string;
  session_id?: string | null;
  surface: ConversationSurface;
  table_number?: number | null;
  created_at: string;
  ended_at?: string | null;
  message_count: number;
  last_message_at?: string | null;
  last_message_preview?: string | null;
}

export interface ConversationMessage {
  id: string;
  role: MessageRole;
  content: string;
  created_at: string;
  input_tokens?: number | null;
  output_tokens?: number | null;
}

export interface ConversationThread {
  id: string;
  tenant_id: string;
  surface: ConversationSurface;
  created_at: string;
  messages: ConversationMessage[];
}

export interface MetricsResponse {
  tenant: string;
  conversations_7d: number;
  conversations_30d: number;
  messages_7d: number;
  messages_30d: number;
  avg_messages_per_conversation: number;
  top_items?: Array<{ name: string; mentions: number }>;
  daily: Array<{ date: string; conversations: number; messages: number }>;
}
