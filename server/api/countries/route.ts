// © 2026 Ansh Gupta. All rights reserved.
// Proprietary - NOT OPEN SOURCE. No copying/modification/deployment without permission (dxb.avg@gmail.com).
import supabase from '@/lib/supabase';

export async function GET(req: Request) {
    try {
        const url = new URL(req.url);
        const committeeID = url.searchParams.get('committeeID');
        if (!committeeID) {
            return new Response(JSON.stringify({ message: 'Missing committeeID parameter' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }
        const { data, error } = await supabase
            .from('Delegate')
            .select('country')
            .eq('committeeID', committeeID);
        if (error) {
            return new Response(JSON.stringify({ message: `Error fetching delegates: ${error.message}` }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        const countries = Array.from(new Set((data || []).map((row: { country: string | null }) => row.country).filter(Boolean)))
            .map((countryName) => ({ country: countryName }));

        return new Response(JSON.stringify(countries), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });
    } catch {
        return new Response(JSON.stringify({ message: 'Error fetching countries' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}