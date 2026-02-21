// © 2026 Ansh Gupta. All rights reserved.
// Proprietary - NOT OPEN SOURCE. No copying/modification/deployment without permission (dxb.avg@gmail.com).
import supabase from "@/lib/supabase";
import { Announcement } from "@/db/types";

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('Announcement')
      .select('*')

    if (error) {
      return new Response(
        JSON.stringify({ message: `Error fetching announcements: ${error.message}` }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify(data as Announcement[]),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch {
    return new Response(
      JSON.stringify({ message: 'Error fetching announcements' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}