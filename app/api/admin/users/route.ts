import { NextResponse } from 'next/server';
import { getVerifiedSessionUserFromRequest } from '@/lib/chat/auth';
import supabaseAdmin from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const roles = new Set(['delegate', 'chair', 'admin', 'secretariat']);
const isValidEmail = (value: string) => {
  if (!value || value.length > 254) return false;
  const firstAt = value.indexOf('@');
  if (firstAt <= 0 || firstAt !== value.lastIndexOf('@') || firstAt >= value.length - 3) return false;
  for (const character of value) if (character <= ' ') return false;
  const domain = value.slice(firstAt + 1);
  const dot = domain.lastIndexOf('.');
  return dot > 0 && dot < domain.length - 1;
};
const reply = (body: Record<string, unknown>, status = 200) =>
  NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store, max-age=0' } });

const authorizeStaff = async (request: Request) => {
  const user = await getVerifiedSessionUserFromRequest(request);
  return user && ['admin', 'secretariat'].includes(user.role) ? user : null;
};

const loadDirectory = async () => {
  if (!supabaseAdmin) return { users: [], committees: [] };

  const [
    { data: users, error: usersError },
    { data: committees, error: committeesError },
    { data: matrixSeats, error: matrixError },
  ] = await Promise.all([
    supabaseAdmin
      .from('app_users')
      .select('id, email, first_name, last_name, role, committee_id, country, school, grade, created_at, updated_at')
      .order('first_name', { ascending: true })
      .limit(500),
    supabaseAdmin
      .from('Committee')
      .select('committeeID, committeeCode, name, fullname')
      .order('committeeCode', { ascending: true }),
    supabaseAdmin
      .from('committee_matrix_seats')
      .select('id, committee_id, country_name, sort_order')
      .order('sort_order', { ascending: true }),
  ]);

  if (usersError) throw usersError;
  if (committeesError) throw committeesError;
  if (matrixError) throw matrixError;

  return { users: users || [], committees: committees || [], matrixSeats: matrixSeats || [] };
};

const createLegacyProfile = async (profile: {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  committeeId: string | null;
  country: string | null;
  school: string | null;
  grade: string | null;
}) => {
  if (!supabaseAdmin) throw new Error('User provisioning is unavailable.');

  if (profile.role === 'delegate') {
    return supabaseAdmin.from('Delegate').insert({
      delegateID: profile.id,
      auth_user_id: profile.id,
      firstname: profile.firstName,
      lastname: profile.lastName,
      email: profile.email,
      resoPerms: {
        'view:ownreso': true,
        'view:allreso': false,
        'update:ownreso': true,
        'update:reso': [],
      },
      country: profile.country,
      school: profile.school,
      grade: profile.grade,
      committeeID: profile.committeeId,
    });
  }

  if (profile.role === 'chair') {
    return supabaseAdmin.from('Chair').insert({
      chairID: profile.id,
      auth_user_id: profile.id,
      firstname: profile.firstName,
      lastname: profile.lastName,
      email: profile.email,
      committeeID: profile.committeeId,
    });
  }

  if (profile.role === 'admin') {
    return supabaseAdmin.from('Admin').insert({
      adminID: profile.id,
      auth_user_id: profile.id,
      firstname: profile.firstName,
      lastname: profile.lastName,
      email: profile.email,
    });
  }

  return supabaseAdmin.from('Secretariat').insert({
    secretariatID: profile.id,
    auth_user_id: profile.id,
    firstname: profile.firstName,
    lastname: profile.lastName,
    email: profile.email,
  });
};

const removeLegacyProfile = async (role: string, id: string) => {
  if (!supabaseAdmin) return;
  if (role === 'delegate') await supabaseAdmin.from('Delegate').delete().eq('delegateID', id);
  else if (role === 'chair') await supabaseAdmin.from('Chair').delete().eq('chairID', id);
  else if (role === 'admin') await supabaseAdmin.from('Admin').delete().eq('adminID', id);
  else await supabaseAdmin.from('Secretariat').delete().eq('secretariatID', id);
};

export async function GET(request: Request) {
  if (!supabaseAdmin) return reply({ error: 'User directory is unavailable.' }, 503);
  const actor = await authorizeStaff(request);
  if (!actor) return reply({ error: 'Unauthorized' }, 401);

  try {
    return reply(await loadDirectory());
  } catch (error) {
    console.error('[admin users] directory load failed', {
      actorId: actor.id,
      message: error instanceof Error ? error.message : String(error),
    });
    return reply({ error: 'Unable to load users and committees.' }, 500);
  }
}

export async function POST(request: Request) {
  if (!supabaseAdmin) return reply({ error: 'User provisioning is unavailable.' }, 503);
  const actor = await authorizeStaff(request);
  if (!actor) return reply({ error: 'Unauthorized' }, 401);

  const body = (await request.json()) as Record<string, unknown>;
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const firstName = typeof body.firstName === 'string' ? body.firstName.trim() : '';
  const lastName = typeof body.lastName === 'string' ? body.lastName.trim() : '';
  const role = typeof body.role === 'string' ? body.role.trim().toLowerCase() : '';
  const committeeId = typeof body.committeeId === 'string' && body.committeeId ? body.committeeId : null;
  const country = typeof body.country === 'string' ? body.country.trim() || null : null;
  const school = typeof body.school === 'string' ? body.school.trim().slice(0, 255) || null : null;
  const grade = typeof body.grade === 'string' ? body.grade.trim().slice(0, 50) || null : null;

  if (!isValidEmail(email) || !firstName || !lastName || !roles.has(role)) {
    return reply({ error: 'A valid email, first name, last name, and role are required.' }, 400);
  }
  if ((role === 'delegate' || role === 'chair') && !committeeId) {
    return reply({ error: 'Delegates and chairs must be assigned to a committee.' }, 400);
  }
  if (role === 'delegate' && (!country || !school)) {
    return reply({ error: 'Delegates require a matrix country and school.' }, 400);
  }
  if (role === 'delegate') {
    const { data: seat, error: seatError } = await supabaseAdmin
      .from('committee_matrix_seats')
      .select('id')
      .eq('committee_id', committeeId!)
      .eq('country_name', country!)
      .maybeSingle();
    if (seatError) return reply({ error: 'Unable to validate the committee matrix.' }, 500);
    if (!seat) return reply({ error: 'Choose a country from the selected committee matrix.' }, 400);
  }

  const configuredAppUrl = (process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/$/, '');
  const { data: invite, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(
    email,
    configuredAppUrl ? { redirectTo: `${configuredAppUrl}/reset-password` } : {},
  );
  const invitedUser = invite?.user;
  if (inviteError || !invitedUser?.id) {
    const duplicate = inviteError?.message?.toLowerCase().includes('already') ?? false;
    return reply(
      { error: duplicate ? 'An authentication account already exists for this email.' : 'Unable to send the account invitation.' },
      duplicate ? 409 : 500,
    );
  }

  const { error: legacyError } = await createLegacyProfile({
    id: invitedUser.id,
    email,
    firstName,
    lastName,
    role,
    committeeId,
    country,
    school,
    grade,
  });

  if (legacyError) {
    await supabaseAdmin.auth.admin.deleteUser(invitedUser.id).catch(() => undefined);
    console.error('[admin users] legacy profile provisioning failed', {
      actorId: actor.id,
      invitedUserId: invitedUser.id,
      message: legacyError.message,
    });
    return reply({ error: 'The invitation could not be linked to the conference directory.' }, 500);
  }

  const { data, error } = await supabaseAdmin
    .from('app_users')
    .upsert({
      id: invitedUser.id,
      email,
      first_name: firstName,
      last_name: lastName,
      role,
      committee_id: role === 'delegate' || role === 'chair' ? committeeId : null,
      country,
      school,
      grade,
      reso_perms: {
        'view:ownreso': role === 'delegate',
        'view:allreso': role === 'chair' || role === 'admin' || role === 'secretariat',
        'update:ownreso': role === 'delegate',
        'update:reso': [],
      },
      updated_at: new Date().toISOString(),
    })
    .select('id, email, first_name, last_name, role, committee_id, country, school, grade, created_at, updated_at')
    .single();

  if (error) {
    await removeLegacyProfile(role, invitedUser.id).catch(() => undefined);
    await supabaseAdmin.auth.admin.deleteUser(invitedUser.id).catch(() => undefined);
    console.error('[admin users] profile provisioning failed', {
      actorId: actor.id,
      invitedUserId: invitedUser.id,
      message: error.message,
    });
    return reply({ error: 'The invitation could not be linked to an application profile.' }, 500);
  }

  return reply({ user: data }, 201);
}

export async function PATCH(request: Request) {
  if (!supabaseAdmin) return reply({ error: 'User management is unavailable.' }, 503);
  const actor = await authorizeStaff(request);
  if (!actor) return reply({ error: 'Unauthorized' }, 401);

  const body = (await request.json()) as Record<string, unknown>;
  const id = typeof body.id === 'string' ? body.id : '';
  const firstName = typeof body.firstName === 'string' ? body.firstName.trim() : '';
  const lastName = typeof body.lastName === 'string' ? body.lastName.trim() : '';
  const role = typeof body.role === 'string' ? body.role.trim().toLowerCase() : '';
  const committeeId = typeof body.committeeId === 'string' && body.committeeId ? body.committeeId : null;
  const country = typeof body.country === 'string' ? body.country.trim() || null : null;
  const school = typeof body.school === 'string' ? body.school.trim().slice(0, 255) || null : null;
  const grade = typeof body.grade === 'string' ? body.grade.trim().slice(0, 50) || null : null;

  if (!id || !firstName || !lastName || !roles.has(role)) {
    return reply({ error: 'User, name, and role are required.' }, 400);
  }
  if ((role === 'delegate' || role === 'chair') && !committeeId) {
    return reply({ error: 'Delegates and chairs must be assigned to a committee.' }, 400);
  }
  if (role === 'delegate' && (!country || !school)) {
    return reply({ error: 'Delegates require a matrix country and school.' }, 400);
  }
  if (role === 'delegate') {
    const { data: seat, error: seatError } = await supabaseAdmin
      .from('committee_matrix_seats')
      .select('id')
      .eq('committee_id', committeeId!)
      .eq('country_name', country!)
      .maybeSingle();
    if (seatError) return reply({ error: 'Unable to validate the committee matrix.' }, 500);
    if (!seat) return reply({ error: 'Choose a country from the selected committee matrix.' }, 400);
  }

  const { data: existing, error: existingError } = await supabaseAdmin
    .from('app_users')
    .select('role')
    .eq('id', id)
    .maybeSingle();
  if (existingError) return reply({ error: 'Unable to validate the current user role.' }, 500);
  if (!existing) return reply({ error: 'User not found.' }, 404);
  if (existing.role !== role) {
    return reply({ error: 'Role changes require a new invitation so document ownership remains intact.' }, 409);
  }

  if (id === actor.id && role !== actor.role) {
    return reply({ error: 'You cannot change your own staff role.' }, 400);
  }

  const { data, error } = await supabaseAdmin
    .from('app_users')
    .update({
      first_name: firstName,
      last_name: lastName,
      role,
      committee_id: role === 'delegate' || role === 'chair' ? committeeId : null,
      country,
      school,
      grade,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select('id, email, first_name, last_name, role, committee_id, country, school, grade, created_at, updated_at')
    .maybeSingle();

  if (error) {
    console.error('[admin users] update failed', { actorId: actor.id, userId: id, message: error.message });
    return reply({ error: 'Unable to update the user.' }, 500);
  }
  if (!data) return reply({ error: 'User not found.' }, 404);

  return reply({ user: data });
}

