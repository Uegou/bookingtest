const app = document.getElementById('app');

const ACTION_LABELS = {
  create: 'Thêm',
  update: 'Sửa',
  delete: 'Xóa',
  complete: 'Xong',
};

let selectedDate = todayStr();
let currentTab = 'bookings';
let bookings = [];
let tlgNames = [];
let activityLogs = [];
let realtimeChannel = null;
let editingBooking = null;

// ── Theme ──────────────────────────────────────────────
(function () {
  const saved = localStorage.getItem('theme') || 'dark';
  document.documentElement.setAttribute('data-theme', saved);
})();

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'dark';
  const next = current === 'dark' ? 'light' : 'dark';
  localStorage.setItem('theme', next);
  document.documentElement.setAttribute('data-theme', next);
  const btn = document.getElementById('btn-theme');
  if (btn) btn.textContent = next === 'dark' ? '☀️ Light' : '🌙 Dark';
}
// ───────────────────────────────────────────────────────

function todayStr() {
  return new Date().toISOString().split('T')[0];
}

function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function formatDateDisplay(dateStr) {
  const [y, m, d] = dateStr.split('-');
  const days = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
  const dt = new Date(`${dateStr}T12:00:00`);
  return `${days[dt.getDay()]}, ${d}/${m}/${y}`;
}

function shiftDate(dateStr, delta) {
  const dt = new Date(`${dateStr}T12:00:00`);
  dt.setDate(dt.getDate() + delta);
  return dt.toISOString().split('T')[0];
}

function showToast(message, isError) {
  const el = document.createElement('div');
  el.className = `toast ${isError ? 'toast-error' : 'toast-success'}`;
  el.textContent = message;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3200);
}

function renderSetup() {
  app.innerHTML = `
    <div class="login-page">
      <div class="login-card setup-card">
        <h1>Cấu hình Supabase</h1>
        <p class="subtitle">Cần kết nối Supabase để đồng bộ nhiều thiết bị và nhiều tài khoản.</p>
        <ol class="setup-steps">
          <li>Tạo project miễn phí tại <a href="https://supabase.com" target="_blank" rel="noopener">supabase.com</a></li>
          <li>Chạy file <code>supabase/schema.sql</code> trong SQL Editor</li>
          <li>Tạo user admin: Authentication → Users → Add user<br>
            Email: <code>admin@booking.app.internal</code>, Password: <code>123456</code><br>
            User Metadata: <code>{"username":"admin","display_name":"Admin","is_admin":true}</code>
          </li>
          <li>Copy <strong>Project URL</strong> và <strong>anon key</strong> vào <code>js/config.js</code></li>
          <li>Tải lại trang</li>
        </ol>
      </div>
    </div>
  `;
}

function renderLogin(message, isSuccess) {
  app.innerHTML = `
    <div class="login-page">
      <div class="login-card">
        <h1>Booking Tâm Lý</h1>
        ${message ? `<div class="${isSuccess ? 'success-msg' : 'error-msg'}">${escapeHtml(message)}</div>` : ''}
        <form id="login-form">
          <div class="form-group">
            <label for="username">Username</label>
            <input type="text" id="username" required autocomplete="username">
          </div>
          <div class="form-group">
            <label for="password">Password</label>
            <input type="password" id="password" required autocomplete="current-password">
          </div>
          <button type="submit" class="btn btn-primary">Log in</button>
        </form>
      </div>
    </div>
  `;

  document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button[type=submit]');
    btn.disabled = true;
    const result = await signIn(
      document.getElementById('username').value,
      document.getElementById('password').value
    );
    btn.disabled = false;
    if (result.ok) {
      await bootApp();
    } else {
      renderLogin(result.error, false);
    }
  });
}

async function loadData() {
  tlgNames = await fetchTlgNames();
  bookings = await fetchBookingsByDate(selectedDate);
  if (currentTab === 'history') {
    activityLogs = await fetchActivityLogs();
  }
}

function tabButton(id, label) {
  return `<button class="tab-btn ${currentTab === id ? 'active' : ''}" data-tab="${id}">${label}</button>`;
}

function renderShell() {
  const profile = getCurrentProfile();
  const isAdminUser = isAdmin();

  app.innerHTML = `
    <div class="dashboard">
      <header class="header">
        <div class="header-left">
          <h1>Booking Tâm Lý</h1>
          <p>${escapeHtml(profile.display_name || profile.username)}</p>
        </div>
        <div class="header-actions">
          <button class="btn btn-secondary btn-sm" id="btn-theme">${(document.documentElement.getAttribute('data-theme') || 'dark') === 'dark' ? '☀️ Light' : '🌙 Dark'}</button>
          <button class="btn btn-secondary btn-sm" id="btn-change-password">Change Password</button>
          ${isAdminUser ? '<button class="btn btn-secondary btn-sm" id="btn-admin">Manage</button>' : ''}
          <button class="btn btn-secondary btn-sm" id="btn-logout">Log out</button>
        </div>
      </header>

      <div class="date-bar">
        <button class="btn btn-secondary btn-icon" id="btn-prev-day" title="Ngày trước">‹</button>
        <div class="date-display">
          <span class="date-label">Ngày</span>
          <strong id="current-date-text">${escapeHtml(formatDateDisplay(selectedDate))}</strong>
          <input type="date" id="date-picker" class="date-picker" value="${selectedDate}">
        </div>
        <button class="btn btn-secondary btn-icon" id="btn-next-day" title="Ngày sau">›</button>
        <button class="btn btn-secondary btn-sm" id="btn-today">Hôm nay</button>
        <button class="btn btn-primary" id="btn-new-booking">+ Thêm booking</button>
      </div>

      <nav class="tab-nav">
        ${tabButton('bookings', 'Danh sách')}
        ${tabButton('stats', 'Thống kê')}
        ${tabButton('history', 'Lịch sử')}
      </nav>

      <main class="main-content" id="tab-content"></main>
    </div>
  `;

  document.getElementById('btn-theme').addEventListener('click', toggleTheme);

  document.getElementById('btn-logout').addEventListener('click', async () => {
    unsubscribeChannel(realtimeChannel);
    realtimeChannel = null;
    await signOut();
    renderLogin();
  });

  document.getElementById('btn-change-password').addEventListener('click', showPasswordModal);
  document.getElementById('btn-new-booking').addEventListener('click', () => {
    editingBooking = null;
    showBookingModal();
  });

  document.getElementById('btn-prev-day').addEventListener('click', async () => {
    selectedDate = shiftDate(selectedDate, -1);
    await refreshBookings();
  });

  document.getElementById('btn-next-day').addEventListener('click', async () => {
    selectedDate = shiftDate(selectedDate, 1);
    await refreshBookings();
  });

  document.getElementById('btn-today').addEventListener('click', async () => {
    selectedDate = todayStr();
    await refreshBookings();
  });

  document.getElementById('date-picker').addEventListener('change', async (e) => {
    selectedDate = e.target.value;
    await refreshBookings();
  });

  document.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      currentTab = btn.dataset.tab;
      renderShell();
      await renderTabContent();
    });
  });

  if (isAdminUser) {
    document.getElementById('btn-admin').addEventListener('click', showAdminModal);
  }

  renderTabContent();
}

async function refreshBookings() {
  bookings = await fetchBookingsByDate(selectedDate);
  document.getElementById('current-date-text').textContent = formatDateDisplay(selectedDate);
  document.getElementById('date-picker').value = selectedDate;
  await renderTabContent();
}

async function renderTabContent() {
  const container = document.getElementById('tab-content');
  if (!container) return;

  if (currentTab === 'bookings') {
    container.innerHTML = renderBookingsTab();
    bindBookingActions();
  } else if (currentTab === 'stats') {
    container.innerHTML = renderStatsTab();
  } else if (currentTab === 'history') {
    activityLogs = await fetchActivityLogs();
    container.innerHTML = renderHistoryTab();
  }
}

function renderBookingsTab() {
  if (bookings.length === 0) {
    return `
      <div class="empty-state">
        <h3>Chưa có ca trong ngày này</h3>
        <p>Nhấn "Thêm booking" để tạo ca mới.</p>
      </div>
    `;
  }

  const rows = sortByTimeSlot(bookings).map((b) => `
    <tr class="${b.status === 'completed' ? 'row-completed' : ''}" data-id="${b.id}">
      <td class="col-time">${escapeHtml(b.time_slot)}</td>
      <td>${escapeHtml(b.customer_name)}</td>
      <td>${b.chi_dinh_cls ? `<span class="tlg-tag">${escapeHtml(b.chi_dinh_cls)}</span>` : '<span class="col-muted">—</span>'}</td>
      <td><span class="tlg-tag">${escapeHtml(b.tlg_name)}</span></td>
      <td class="col-muted">${escapeHtml(b.entered_by)}</td>
      <td>
        <span class="status-badge status-${b.status === 'completed' ? 'completed' : 'pending'}">
          ${b.status === 'completed' ? 'Hoàn thành' : 'Chưa hoàn thành'}
        </span>
      </td>
      <td class="col-actions">
        ${b.status !== 'completed' ? `<button class="btn btn-secondary btn-sm" data-action="complete" data-id="${b.id}">Hoàn thành</button>` : ''}
        <button class="btn btn-secondary btn-sm" data-action="edit" data-id="${b.id}">Sửa</button>
        <button class="btn btn-danger btn-sm" data-action="delete" data-id="${b.id}">Xóa</button>
      </td>
    </tr>
  `).join('');

  return `
    <div class="table-wrap">
      <table class="data-table">
        <thead>
          <tr>
            <th>Khung giờ</th>
            <th>Tên</th>
            <th>Chỉ định CLS</th>
            <th>TLG</th>
            <th>Người nhập</th>
            <th>Trạng thái</th>
            <th>Thao tác</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

function renderStatsTab() {
  const grouped = {};
  sortByTimeSlot(bookings).forEach((b) => {
    if (!grouped[b.tlg_name]) grouped[b.tlg_name] = [];
    grouped[b.tlg_name].push(b);
  });

  const tlgList = tlgNames.map((t) => t.name);
  const allTlg = [...new Set([...tlgList, ...Object.keys(grouped)])];

  if (allTlg.length === 0) {
    return `<div class="empty-state"><h3>Chưa có TLG</h3><p>Admin cần thêm danh sách TLG.</p></div>`;
  }

  const cards = allTlg.map((name) => {
    const list = grouped[name] || [];
    const completed = list.filter((b) => b.status === 'completed').length;
    const items = list.map((b, i) => `
      <div class="stats-item ${b.status === 'completed' ? 'done' : ''}">
        <span class="stats-order">#${i + 1}</span>
        <span class="stats-time">${escapeHtml(b.time_slot)}</span>
        <span class="stats-name">${escapeHtml(b.customer_name)}</span>
        <span class="stats-status">${b.status === 'completed' ? '✓ Hoàn thành' : '○ Chưa hoàn thành'}</span>
      </div>
    `).join('');

    return `
      <div class="stats-card">
        <div class="stats-card-header">
          <h3>${escapeHtml(name)}</h3>
          <span class="stats-count">${list.length} ca · ${completed} hoàn thành</span>
        </div>
        <div class="stats-list">
          ${list.length ? items : '<p class="stats-empty">Không có ca</p>'}
        </div>
      </div>
    `;
  }).join('');

  return `<div class="stats-grid">${cards}</div>`;
}

function renderHistoryTab() {
  if (!activityLogs.length) {
    return `<div class="empty-state"><h3>Chưa có lịch sử</h3></div>`;
  }

  const rows = activityLogs.map((log) => {
    const time = new Date(log.created_at).toLocaleString('vi-VN');
    return `
      <tr>
        <td class="col-muted">${escapeHtml(time)}</td>
        <td><span class="action-tag action-${log.action}">${ACTION_LABELS[log.action] || log.action}</span></td>
        <td>${escapeHtml(log.description)}</td>
        <td class="col-muted">${escapeHtml(log.username)}</td>
      </tr>
    `;
  }).join('');

  return `
    <div class="table-wrap">
      <table class="data-table">
        <thead>
          <tr>
            <th>Thời gian</th>
            <th>Trạng thái</th>
            <th>Chi tiết</th>
            <th>Người nhập</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

function bindBookingActions() {
  document.querySelectorAll('[data-action]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id;
      const action = btn.dataset.action;
      const booking = bookings.find((b) => b.id === id);
      if (!booking) return;

      if (action === 'edit') {
        editingBooking = booking;
        showBookingModal(booking);
      } else if (action === 'delete') {
        if (confirm('Xóa ca này?')) {
          await deleteBooking(id, booking);
          showToast('Đã xóa ca');
          await refreshBookings();
        }
      } else if (action === 'complete') {
        await completeBooking(id, booking);
        showToast('Đã đánh dấu hoàn thành');
        await refreshBookings();
      }
    });
  });
}

function showBookingModal(booking) {
  const isEdit = !!booking;
  const profile = getCurrentProfile();
  const enteredBy = profile.display_name || profile.username;

  const tlgOptions = tlgNames.map((t) =>
    `<option value="${escapeHtml(t.name)}" ${booking?.tlg_name === t.name ? 'selected' : ''}>${escapeHtml(t.name)}</option>`
  ).join('');

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal">
      <div class="modal-header">
        <h2>${isEdit ? 'Sửa booking' : 'Thêm booking'}</h2>
        <button class="modal-close" type="button">&times;</button>
      </div>
      <form id="booking-form">
        <div class="modal-body">
          <div class="form-group">
            <label>TLG *</label>
            <select id="tlgName" required>${tlgOptions}</select>
          </div>
          <div class="form-group">
            <label>Khung giờ *</label>
            <input type="time" id="timeSlot" required value="${booking?.time_slot || '09:00'}">
          </div>
          <div class="form-group">
            <label>Tên *</label>
            <input type="text" id="customerName" required value="${booking ? escapeHtml(booking.customer_name) : ''}">
          </div>
          <div class="form-group">
            <label>Chỉ định CLS</label>
            <select id="chiDinhCls">
              <option value="">— Không có —</option>
              <option value="WISC" ${booking?.chi_dinh_cls === 'WISC' ? 'selected' : ''}>WISC</option>
              <option value="NEMI" ${booking?.chi_dinh_cls === 'NEMI' ? 'selected' : ''}>NEMI</option>
              <option value="Can thiệp tâm lý" ${booking?.chi_dinh_cls === 'Can thiệp tâm lý' ? 'selected' : ''}>Can thiệp tâm lý</option>
            </select>
          </div>
          <div class="form-group">
            <label>Người nhập</label>
            <input type="text" id="enteredBy" readonly value="${escapeHtml(enteredBy)}">
          </div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary modal-cancel">Hủy</button>
          <button type="submit" class="btn btn-primary">${isEdit ? 'Cập nhật' : 'Tạo booking'}</button>
        </div>
      </form>
    </div>
  `;

  document.body.appendChild(overlay);
  const close = () => overlay.remove();
  overlay.querySelector('.modal-close').addEventListener('click', close);
  overlay.querySelector('.modal-cancel').addEventListener('click', close);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

  overlay.querySelector('#booking-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = overlay.querySelector('button[type=submit]');
    submitBtn.disabled = true;

    try {
      const timeSlot = overlay.querySelector('#timeSlot').value;
      const customerName = overlay.querySelector('#customerName').value;
      const tlgName = overlay.querySelector('#tlgName').value;
      const chiDinhCls = overlay.querySelector('#chiDinhCls').value;

      if (isEdit) {
        await updateBooking(booking.id, {
          time_slot: timeSlot,
          customer_name: customerName,
          tlg_name: tlgName,
          chi_dinh_cls: chiDinhCls || null,
        }, booking);
        showToast('Đã cập nhật ca');
      } else {
        await createBooking({
          bookingDate: selectedDate,
          timeSlot,
          customerName,
          tlgName,
          chiDinhCls: chiDinhCls || null,
        });
        showToast('Đã tạo booking');
      }
      close();
      await refreshBookings();
    } catch (err) {
      showToast(err.message || 'Lỗi khi lưu', true);
      submitBtn.disabled = false;
    }
  });
}

function showPasswordModal() {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal">
      <div class="modal-header">
        <h2>Đổi mật khẩu</h2>
        <button class="modal-close" type="button">&times;</button>
      </div>
      <form id="password-form">
        <div class="modal-body">
          <div id="password-msg"></div>
          <div class="form-group">
            <label>Mật khẩu mới</label>
            <input type="password" id="newPassword" required minlength="4">
          </div>
          <div class="form-group">
            <label>Xác nhận mật khẩu</label>
            <input type="password" id="confirmPassword" required minlength="4">
          </div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary modal-cancel">Hủy</button>
          <button type="submit" class="btn btn-primary">Lưu</button>
        </div>
      </form>
    </div>
  `;

  document.body.appendChild(overlay);
  const close = () => overlay.remove();
  overlay.querySelector('.modal-close').addEventListener('click', close);
  overlay.querySelector('.modal-cancel').addEventListener('click', close);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

  overlay.querySelector('#password-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const msgEl = overlay.querySelector('#password-msg');
    const newPw = overlay.querySelector('#newPassword').value;
    const confirmPw = overlay.querySelector('#confirmPassword').value;
    if (newPw !== confirmPw) {
      msgEl.className = 'error-msg';
      msgEl.textContent = 'Mật khẩu không khớp.';
      return;
    }
    const result = await changePassword(newPw);
    if (result.ok) {
      msgEl.className = 'success-msg';
      msgEl.textContent = 'Đã đổi mật khẩu!';
      setTimeout(close, 1200);
    } else {
      msgEl.className = 'error-msg';
      msgEl.textContent = result.error;
    }
  });
}

async function showAdminModal() {
  const allTlg = await fetchAllTlgNames();
  const users = await listUsers();

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal modal-lg">
      <div class="modal-header">
        <h2>Quản lý (Admin)</h2>
        <button class="modal-close" type="button">&times;</button>
      </div>
      <div class="modal-body admin-body">
        <section>
          <h3>Danh sách TLG</h3>
          <form id="add-tlg-form" class="inline-form">
            <input type="text" id="newTlgName" placeholder="Tên TLG mới" required>
            <button type="submit" class="btn btn-primary btn-sm">Thêm</button>
          </form>
          <ul class="admin-list" id="tlg-list">
            ${allTlg.map((t) => `
              <li>
                <span>${escapeHtml(t.name)} ${t.active ? '' : '(ẩn)'}</span>
                <button class="btn btn-secondary btn-sm" data-toggle-tlg="${t.id}" data-active="${t.active}">
                  ${t.active ? 'Ẩn' : 'Hiện'}
                </button>
              </li>
            `).join('')}
          </ul>
        </section>
        <section>
          <h3>Tạo tài khoản</h3>
          <form id="add-user-form">
            <div class="form-row">
              <div class="form-group">
                <label>Username</label>
                <input type="text" id="newUsername" required>
              </div>
              <div class="form-group">
                <label>Tên hiển thị</label>
                <input type="text" id="newDisplayName">
              </div>
            </div>
            <div class="form-group">
              <label>Mật khẩu</label>
              <input type="password" id="newUserPassword" required minlength="4">
            </div>
            <button type="submit" class="btn btn-primary btn-sm">Tạo tài khoản</button>
          </form>
          <ul class="admin-list">
            ${users.map((u) => `<li>${escapeHtml(u.display_name)} <span class="col-muted">(${escapeHtml(u.username)})${u.is_admin ? ' · admin' : ''}</span></li>`).join('')}
          </ul>
        </section>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  const close = () => overlay.remove();
  overlay.querySelector('.modal-close').addEventListener('click', close);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

  overlay.querySelector('#add-tlg-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = overlay.querySelector('#newTlgName');
    try {
      await addTlgName(input.value);
      input.value = '';
      showToast('Đã thêm TLG');
      tlgNames = await fetchTlgNames();
      close();
    } catch (err) {
      showToast(err.message, true);
    }
  });

  overlay.querySelectorAll('[data-toggle-tlg]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.toggleTlg;
      const active = btn.dataset.active === 'true';
      await toggleTlgActive(id, !active);
      showToast('Đã cập nhật TLG');
      close();
      showAdminModal();
    });
  });

  overlay.querySelector('#add-user-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = overlay.querySelector('#newUsername').value;
    const displayName = overlay.querySelector('#newDisplayName').value;
    const password = overlay.querySelector('#newUserPassword').value;
    const result = await createUserAccount(username, password, displayName);
    if (result.ok) {
      showToast('Đã tạo tài khoản');
      close();
      showAdminModal();
    } else {
      showToast(result.error, true);
    }
  });
}

async function bootApp() {
  await loadData();

  // Guard: nếu profile vẫn null thì không thể render dashboard
  if (!getCurrentProfile()) {
    console.error('Profile not found, redirecting to login');
    await signOut();
    renderLogin('Không tải được thông tin tài khoản. Vui lòng đăng nhập lại.');
    return;
  }

  renderShell();

  realtimeChannel = subscribeToChanges(
    async () => {
      bookings = await fetchBookingsByDate(selectedDate);
      if (currentTab === 'bookings' || currentTab === 'stats') {
        await renderTabContent();
      }
    },
    async () => {
      if (currentTab === 'history') {
        activityLogs = await fetchActivityLogs();
        await renderTabContent();
      }
    }
  );
}

async function init() {
  if (!isSupabaseConfigured()) {
    renderSetup();
    return;
  }

  const client = window.supabase.createClient(
    APP_CONFIG.SUPABASE_URL,
    APP_CONFIG.SUPABASE_ANON_KEY
  );
  initAuth(client);

  const session = await loadSession();
  if (session) {
    await bootApp();
  } else {
    renderLogin();
  }
}

init();