let supabaseClient = null;
let currentUser = null;
let currentProfile = null;

function usernameToEmail(username) {
  return `${username.toLowerCase().trim()}@${APP_CONFIG.AUTH_EMAIL_DOMAIN}`;
}

function initAuth(client) {
  supabaseClient = client;
}

function getSupabase() {
  return supabaseClient;
}

function getCurrentUser() {
  return currentUser;
}

function getCurrentProfile() {
  return currentProfile;
}

function isAdmin() {
  return currentProfile?.is_admin === true;
}

async function loadSession() {
  if (!supabaseClient) return null;
  const { data } = await supabaseClient.auth.getSession();
  if (!data.session) {
    currentUser = null;
    currentProfile = null;
    return null;
  }
  currentUser = data.session.user;
  await loadProfile();
  return data.session;
}

async function loadProfile() {
  if (!currentUser) return null;
  const { data, error } = await supabaseClient
    .from('profiles')
    .select('*')
    .eq('id', currentUser.id)
    .maybeSingle();
  if (error) {
    console.error('loadProfile', error);
    return null;
  }
  if (!data) {
    // Profile chưa tồn tại — tự tạo từ metadata
    const meta = currentUser.user_metadata || {};
    const username = meta.username || currentUser.email?.split('@')[0] || 'user';
    const display_name = meta.display_name || username;
    const is_admin = meta.is_admin === true;
    const { data: created, error: insertErr } = await supabaseClient
      .from('profiles')
      .insert({ id: currentUser.id, username, display_name, is_admin })
      .select()
      .single();
    if (insertErr) {
      console.error('loadProfile insert', insertErr);
      // Fallback: dùng metadata trực tiếp
      currentProfile = { id: currentUser.id, username, display_name, is_admin };
      return currentProfile;
    }
    currentProfile = created;
    return created;
  }
  currentProfile = data;
  return data;
}

async function signIn(username, password) {
  const email = usernameToEmail(username);
  const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
  if (error) {
    return { ok: false, error: 'Tên đăng nhập hoặc mật khẩu không đúng.' };
  }
  currentUser = data.user;
  await loadProfile();
  return { ok: true };
}

async function signOut() {
  await supabaseClient.auth.signOut();
  currentUser = null;
  currentProfile = null;
}

async function changePassword(newPassword) {
  const { error } = await supabaseClient.auth.updateUser({ password: newPassword });
  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

async function createUserAccount(username, password, displayName) {
  if (!isAdmin()) {
    return { ok: false, error: 'Chỉ admin mới tạo tài khoản.' };
  }
  const email = usernameToEmail(username);
  const { data, error } = await supabaseClient.auth.signUp({
    email,
    password,
    options: {
      data: {
        username: username.trim(),
        display_name: displayName.trim() || username.trim(),
        is_admin: false,
      },
    },
  });
  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true, user: data.user };
}

async function listUsers() {
  const { data, error } = await supabaseClient
    .from('profiles')
    .select('id, username, display_name, is_admin, created_at')
    .order('username');
  if (error) throw error;
  return data;
}
