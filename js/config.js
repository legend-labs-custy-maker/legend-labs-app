// ============================================================
// Configuration — la clé "anon" est prévue pour être publique
// (elle est protégée par les règles RLS côté base de données).
// Ne JAMAIS mettre ici la clé "service_role" ou le token du bot.
// ============================================================

export const SUPABASE_URL = 'https://qjovvggrpjlbvhlfsvrm.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFqb3Z2Z2dycGpsYnZobGZzdnJtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ1NjY4MjMsImV4cCI6MjEwMDE0MjgyM30.879RGhtNiqsjpl_4pM3B5raqPgQRtljauPMJkfQzZKQ';

// Edge Functions : colle ici les URL exactes affichées dans Supabase.
export const TELEGRAM_AUTH_URL = `${SUPABASE_URL}/functions/v1/smooth-processor`; // fonction "telegram-auth"
export const ADMIN_API_URL = `${SUPABASE_URL}/functions/v1/admin-api`;
export const VALIDATE_PROMO_URL = `${SUPABASE_URL}/functions/v1/validate-promo`;
export const GLOBAL_PASSWORD_AUTH_URL = `${SUPABASE_URL}/functions/v1/global-password-auth`; // à ajuster selon le nom réel affiché dans Supabase

// Nombre de taps sur le logo pour révéler l'accès admin (discrétion)
export const ADMIN_TAP_TRIGGER_COUNT = 5;
