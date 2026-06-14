function sortByTimeSlot(bookings) {
  return [...bookings].sort((a, b) => a.time_slot.localeCompare(b.time_slot));
}

async function logActivity(action, description, bookingId, metadata = {}) {
  const profile = getCurrentProfile();
  if (!profile) return;
  const { error } = await getSupabase().from('activity_logs').insert({
    user_id: profile.id,
    username: profile.display_name || profile.username,
    action,
    booking_id: bookingId || null,
    description,
    metadata,
  });
  if (error) console.error('logActivity', error);
}

async function fetchTlgNames() {
  const { data, error } = await getSupabase()
    .from('tlg_names')
    .select('*')
    .eq('active', true)
    .order('sort_order')
    .order('name');
  if (error) throw error;
  return data;
}

async function fetchAllTlgNames() {
  const { data, error } = await getSupabase()
    .from('tlg_names')
    .select('*')
    .order('sort_order')
    .order('name');
  if (error) throw error;
  return data;
}

async function addTlgName(name) {
  const trimmed = name.trim();
  if (!trimmed) throw new Error('Tên TLG không được trống.');
  const { data, error } = await getSupabase()
    .from('tlg_names')
    .insert({ name: trimmed })
    .select()
    .single();
  if (error) throw error;
  await logActivity('create', `Thêm TLG: ${trimmed}`, null, { tlg_name: trimmed });
  return data;
}

async function toggleTlgActive(id, active) {
  const { data, error } = await getSupabase()
    .from('tlg_names')
    .update({ active })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function fetchBookingsByDate(date) {
  const { data, error } = await getSupabase()
    .from('bookings')
    .select('*')
    .eq('booking_date', date)
    .order('time_slot');
  if (error) throw error;
  return data;
}

async function createBooking({ bookingDate, timeSlot, customerName, tlgName, chiDinhCls }) {
  const profile = getCurrentProfile();
  const row = {
    booking_date: bookingDate,
    time_slot: timeSlot,
    customer_name: customerName.trim(),
    tlg_name: tlgName,
    chi_dinh_cls: chiDinhCls || null,
    entered_by: profile.display_name || profile.username,
    entered_by_id: profile.id,
    status: 'pending',
  };
  const { data, error } = await getSupabase().from('bookings').insert(row).select().single();
  if (error) throw error;
  await logActivity(
    'create',
    `Thêm ca ${timeSlot} — Tên: ${row.customer_name}, TLG: ${row.tlg_name}${chiDinhCls ? ', CLS: ' + chiDinhCls : ''}`,
    data.id,
    { booking: data }
  );
  return data;
}

async function updateBooking(id, updates, oldBooking) {
  const { data, error } = await getSupabase()
    .from('bookings')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;

  const parts = [];
  if (updates.time_slot && updates.time_slot !== oldBooking.time_slot) {
    parts.push(`giờ ${oldBooking.time_slot} → ${updates.time_slot}`);
  }
  if (updates.customer_name && updates.customer_name !== oldBooking.customer_name) {
    parts.push(`tên ${oldBooking.customer_name} → ${updates.customer_name}`);
  }
  if (updates.tlg_name && updates.tlg_name !== oldBooking.tlg_name) {
    parts.push(`TLG ${oldBooking.tlg_name} → ${updates.tlg_name}`);
  }
  if ('chi_dinh_cls' in updates && updates.chi_dinh_cls !== oldBooking.chi_dinh_cls) {
    parts.push(`CLS ${oldBooking.chi_dinh_cls || '—'} → ${updates.chi_dinh_cls || '—'}`);
  }
  const desc = parts.length
    ? `Sửa ca ${oldBooking.time_slot}: ${parts.join(', ')}`
    : `Cập nhật ca ${oldBooking.time_slot}`;

  await logActivity('update', desc, id, { before: oldBooking, after: data });
  return data;
}

async function completeBooking(id, booking) {
  const { data, error } = await getSupabase()
    .from('bookings')
    .update({ status: 'completed' })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  await logActivity(
    'complete',
    `Hoàn thành ca ${booking.time_slot} — Tên: ${booking.customer_name}, TLG: ${booking.tlg_name}`,
    id,
    { booking: data }
  );
  return data;
}

async function deleteBooking(id, booking) {
  const { error } = await getSupabase().from('bookings').delete().eq('id', id);
  if (error) throw error;
  await logActivity(
    'delete',
    `Xóa ca ${booking.time_slot} — Tên: ${booking.customer_name}, TLG: ${booking.tlg_name}`,
    id,
    { booking }
  );
}

async function fetchActivityLogs(limit = 200) {
  const { data, error } = await getSupabase()
    .from('activity_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data;
}

function subscribeToChanges(onBookingsChange, onLogsChange) {
  const client = getSupabase();
  const channel = client
    .channel('booking-sync')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'bookings' },
      () => onBookingsChange()
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'activity_logs' },
      () => onLogsChange()
    )
    .subscribe();
  return channel;
}

function unsubscribeChannel(channel) {
  if (channel) getSupabase().removeChannel(channel);
}
