// © 2026 Ansh Gupta. All rights reserved.
// Proprietary - NOT OPEN SOURCE. No copying/modification/deployment without permission (dxb.avg@gmail.com).
import supabase from "@/lib/supabase";

const isValidResoPerms = (resoPerms: unknown) =>
  typeof resoPerms === 'object' &&
  resoPerms !== null &&
  'view:ownreso' in resoPerms &&
  'view:allreso' in resoPerms &&
  'update:ownreso' in resoPerms;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const committeeID = searchParams.get('committeeID');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('app_users')
    .select('id, first_name, last_name, email, country, committee_id, reso_perms')
    .eq('role', 'delegate')
    .eq('committee_id', committeeID);

  if (error) {
    console.error('Error fetching delegates from app_users:', error);
    return new Response(JSON.stringify({ error: 'Failed to fetch delegates' }), { status: 500 });
  }

  const mapped = (data || []).map((delegate) => ({
    delegateID: delegate.id,
    firstname: delegate.first_name,
    lastname: delegate.last_name,
    email: delegate.email,
    country: delegate.country,
    committeeID: delegate.committee_id,
    resoPerms: delegate.reso_perms,
  }));

  if (mapped.length === 0) {
    return new Response(JSON.stringify({ message: 'No delegates found' }), { status: 404 });
  }

  return new Response(JSON.stringify(mapped), { status: 200 });
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();

    if (body.delegateID && body.resoPerms) {
      const { delegateID, resoPerms } = body;

      if (!isValidResoPerms(resoPerms)) {
        return new Response(
          JSON.stringify({
            error: 'Invalid resoPerms structure. Required properties: view:ownreso, view:allreso, update:ownreso',
          }),
          { status: 400 }
        );
      }

      const { data, error } = await supabase
        .from('app_users')
        .update({ reso_perms: resoPerms })
        .eq('id', delegateID)
        .eq('role', 'delegate')
        .select('id, first_name, last_name, email, country, committee_id, reso_perms');

      if (error) {
        console.error('Error updating delegate permissions in app_users:', error);
        return new Response(JSON.stringify({ error: 'Failed to update delegate permissions' }), { status: 500 });
      }

      if (!data || data.length === 0) {
        return new Response(JSON.stringify({ message: 'Delegate not found' }), { status: 404 });
      }

      return new Response(
        JSON.stringify({
          message: 'Delegate permissions updated successfully',
          delegate: data[0],
        }),
        { status: 200 }
      );
    }

    if (body.delegates && Array.isArray(body.delegates)) {
      const { delegates } = body;

      if (delegates.length === 0) {
        return new Response(JSON.stringify({ error: 'No delegates provided' }), { status: 400 });
      }

      const updates = [];
      const errors = [];

      for (const delegate of delegates) {
        const { delegateID, resoPerms } = delegate;

        if (!delegateID || !resoPerms) {
          errors.push({ delegateID, error: 'Missing delegateID or resoPerms' });
          continue;
        }

        if (!isValidResoPerms(resoPerms)) {
          errors.push({ delegateID, error: 'Invalid resoPerms structure' });
          continue;
        }

        updates.push({ delegateID, resoPerms });
      }

      if (errors.length > 0) {
        return new Response(
          JSON.stringify({
            error: 'Invalid data for some delegates',
            details: errors,
          }),
          { status: 400 }
        );
      }

      const results = [];

      for (const update of updates) {
        const { delegateID, resoPerms } = update;

        const { data, error } = await supabase
          .from('app_users')
          .update({ reso_perms: resoPerms })
          .eq('id', delegateID)
          .eq('role', 'delegate')
          .select('id, first_name, last_name, email, country, committee_id, reso_perms');

        if (error) {
          results.push({ delegateID, success: false, error: error.message });
        } else if (!data || data.length === 0) {
          results.push({ delegateID, success: false, error: 'Delegate not found' });
        } else {
          results.push({ delegateID, success: true, delegate: data[0] });
        }
      }

      return new Response(
        JSON.stringify({
          message: 'Bulk update completed',
          results,
        }),
        { status: 200 }
      );
    }

    return new Response(
      JSON.stringify({
        error: 'Invalid request format. Provide either a single delegateID and resoPerms, or an array of delegates',
      }),
      { status: 400 }
    );
  } catch (error) {
    console.error('Error processing PUT request:', error);
    return new Response(JSON.stringify({ error: 'Failed to process request' }), { status: 500 });
  }
}
