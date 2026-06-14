// Thay SUPABASE_URL và SUPABASE_ANON_KEY sau khi tạo project Supabase (miễn phí)
// Dashboard → Project Settings → API

const APP_CONFIG = {
  SUPABASE_URL: 'https://xhmiztaoahifnyxleqie.supabase.co',           SUPABASE_ANON_KEY:'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhobWl6dGFvYWhpZm55eGxlcWllIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEyNjA5NDYsImV4cCI6MjA5NjgzNjk0Nn0.LYE5rVPwBYpCQN_0t9VKECxTH-QPVdUT2CeT2Sm2gc8',
  AUTH_EMAIL_DOMAIN: 'booking.app.internal',
};

function isSupabaseConfigured() {
  return Boolean(APP_CONFIG.SUPABASE_URL && APP_CONFIG.SUPABASE_ANON_KEY);
}
