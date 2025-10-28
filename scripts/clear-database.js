
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function clearDatabase() {
  console.log('Starting database cleanup...');

  try {
    // Delete in reverse order of dependencies
    console.log('Clearing speech tags...');
    await supabase.from('Speech-Tags').delete().neq('speechID', '');

    console.log('Clearing speeches...');
    await supabase.from('Speech').delete().neq('speechID', '');

    console.log('Clearing delegations...');
    await supabase.from('Delegation').delete().neq('delegateID', '');

    console.log('Clearing resolutions...');
    await supabase.from('Resos').delete().neq('resoID', '');

    console.log('Clearing updates...');
    await supabase.from('Updates').delete().neq('updateID', '');

    console.log('Clearing announcements...');
    await supabase.from('Announcement').delete().neq('announcementID', '');

    console.log('Clearing delegates...');
    await supabase.from('Delegate').delete().neq('delegateID', '');

    console.log('Clearing committee-chair relationships...');
    await supabase.from('Committee-Chair').delete().neq('chairID', '');

    console.log('Clearing chairs...');
    await supabase.from('Chair').delete().neq('chairID', '');

    console.log('Clearing admins...');
    await supabase.from('Admin').delete().neq('adminID', '');

    console.log('Clearing committees...');
    await supabase.from('Committee').delete().neq('committeeID', '');

    console.log('Clearing countries...');
    await supabase.from('Country').delete().neq('countryID', '');

    console.log('✅ Database cleared successfully!');

  } catch (error) {
    console.error('❌ Error clearing database:', error);
    process.exit(1);
  }
}

clearDatabase();
