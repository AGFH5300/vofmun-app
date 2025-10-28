// scripts/seed-database.js
/* eslint-disable no-console */
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// ---------- Mock data ----------

const mockCommittees = [
  { committeeID: 'UNHCR', name: 'UNHCR', fullname: 'United Nations High Commissioner for Refugees' },
  { committeeID: 'IACA', name: 'IACA', fullname: 'International Aviation and something' },
  { committeeID: 'HSC', name: 'HSC', fullname: 'Historic Security Council' },
  { committeeID: 'IPACRC', name: 'IPACRC', fullname: 'International Psychological Association Case Review Commission' },
  { committeeID: 'UNBOCC', name: 'UNBOCC', fullname: 'United Nations Black Ops Crisis Committee' },
  { committeeID: 'IPC', name: 'IPC', fullname: 'International Peace Committee' },
];

const mockCountries = [
  { countryID: 'USA', name: 'United States of America', flag: 'usa.png' },
  { countryID: 'GBR', name: 'United Kingdom', flag: 'uk.png' },
  { countryID: 'FRA', name: 'France', flag: 'france.png' },
  { countryID: 'DEU', name: 'Germany', flag: 'germany.png' },
  { countryID: 'CHN', name: 'China', flag: 'china.png' },
  { countryID: 'RUS', name: 'Russia', flag: 'russia.png' },
  { countryID: 'JPN', name: 'Japan', flag: 'japan.png' },
  { countryID: 'IND', name: 'India', flag: 'india.png' },
  { countryID: 'BRA', name: 'Brazil', flag: 'brazil.png' },
  { countryID: 'CAN', name: 'Canada', flag: 'canada.png' },
  { countryID: 'AUS', name: 'Australia', flag: 'australia.png' },
  { countryID: 'MEX', name: 'Mexico', flag: 'mexico.png' },
];

const mockDelegates = [
  {
    delegateID: 'del_001',
    firstname: 'Alice',
    lastname: 'Johnson',
    password: 'password123',
    email: 'alice.johnson@example.com',
    resoPerms: {
      'view:ownreso': true,
      'view:allreso': false,
      'update:ownreso': true,
      'update:reso': [],
    },
  },
  {
    delegateID: 'del_002',
    firstname: 'Bob',
    lastname: 'Smith',
    password: 'password123',
    email: 'bob.smith@example.com',
    resoPerms: {
      'view:ownreso': true,
      'view:allreso': true,
      'update:ownreso': true,
      'update:reso': ['del_001'],
    },
  },
  {
    delegateID: 'del_003',
    firstname: 'Carol',
    lastname: 'Williams',
    password: 'password123',
    email: 'carol.williams@example.com',
    resoPerms: {
      'view:ownreso': true,
      'view:allreso': false,
      'update:ownreso': true,
      'update:reso': [],
    },
  },
  {
    delegateID: 'del_004',
    firstname: 'David',
    lastname: 'Brown',
    password: 'password123',
    email: 'david.brown@example.com',
    resoPerms: {
      'view:ownreso': true,
      'view:allreso': false,
      'update:ownreso': true,
      'update:reso': [],
    },
  },
  {
    delegateID: 'del_005',
    firstname: 'Eve',
    lastname: 'Davis',
    password: 'password123',
    email: 'eve.davis@example.com',
    resoPerms: {
      'view:ownreso': true,
      'view:allreso': true,
      'update:ownreso': true,
      'update:reso': ['del_003', 'del_004'],
    },
  },
];

const mockChairs = [
  { chairID: 'chair_001', firstname: 'Michael', lastname: 'Thompson', password: 'chairpass123' },
  { chairID: 'chair_002', firstname: 'Sarah', lastname: 'Wilson', password: 'chairpass123' },
  { chairID: 'chair_003', firstname: 'James', lastname: 'Anderson', password: 'chairpass123' },
];

const mockCommitteeChairs = [
  { chairID: 'chair_001', committeeID: 'UNHCR' },
  { chairID: 'chair_002', committeeID: 'IACA' },
  { chairID: 'chair_003', committeeID: 'HSC' },
];

const mockAdmins = [
  { adminID: 'admin_001', firstname: 'Admin', lastname: 'User', password: 'adminpass123' },
];

const mockDelegations = [
  { delegateID: 'del_001', committeeID: 'UNHCR', countryID: 'USA' },
  { delegateID: 'del_002', committeeID: 'UNHCR', countryID: 'GBR' },
  { delegateID: 'del_003', committeeID: 'IACA', countryID: 'FRA' },
  { delegateID: 'del_004', committeeID: 'HSC', countryID: 'DEU' },
  { delegateID: 'del_005', committeeID: 'IPACRC', countryID: 'CHN' },
];

// NOTE: Removed delegateID here. Author linkage is done via mockDelegateSpeeches.
const mockSpeeches = [
  {
    speechID: 'speech_001',
    title: 'Opening Statement on Refugee Rights',
    content:
      'Honorable Chair, fellow delegates, the refugee crisis demands immediate international cooperation...',
    date: new Date().toISOString(),
  },
  {
    speechID: 'speech_002',
    title: 'Aviation Safety Protocols',
    content:
      'Distinguished delegates, aviation safety is paramount to international travel security...',
    date: new Date().toISOString(),
  },
  {
    speechID: 'speech_003',
    title: 'Historical Perspectives on WWII',
    content:
      'Esteemed colleagues, examining the strategic decisions of 1943 provides crucial insights...',
    date: new Date().toISOString(),
  },
];

// NEW: map speeches to delegates via the junction table ("Delegate-Speech")
const mockDelegateSpeeches = [
  { speechID: 'speech_001', delegateID: 'del_001' },
  { speechID: 'speech_002', delegateID: 'del_003' },
  { speechID: 'speech_003', delegateID: 'del_004' },
];

const mockSpeechTags = [
  { speechID: 'speech_001', tag: 'human-rights' },
  { speechID: 'speech_001', tag: 'refugees' },
  { speechID: 'speech_002', tag: 'aviation' },
  { speechID: 'speech_002', tag: 'safety' },
  { speechID: 'speech_003', tag: 'history' },
  { speechID: 'speech_003', tag: 'strategy' },
];

const mockResos = [
  {
    resoID: 'reso_001',
    title: 'Resolution on Refugee Protection Standards',
    delegateID: 'del_001',
    committeeID: 'UNHCR',
    content: {
      preamble: 'Recognizing the urgent need for enhanced refugee protection...',
      clauses: [
        'Calls upon all member states to strengthen refugee protection frameworks',
        'Encourages international cooperation in refugee resettlement programs',
      ],
    },
    isNew: true,
  },
  {
    resoID: 'reso_002',
    title: 'Aviation Security Enhancement Protocol',
    delegateID: 'del_003',
    committeeID: 'IACA',
    content: {
      preamble: 'Acknowledging the critical importance of aviation security...',
      clauses: [
        'Establishes enhanced screening procedures for international flights',
        'Mandates regular security audits for all participating airlines',
      ],
    },
    isNew: false,
  },
];

const mockUpdates = [
  {
    updateID: 'update_001',
    time: new Date().toISOString(),
    title: 'Conference Opening Ceremony',
    content:
      'The VOFMUN conference has officially begun with opening remarks from the Secretary-General.',
    href: '/images/updates/opening.jpg',
  },
  {
    updateID: 'update_002',
    time: new Date(Date.now() - 3600000).toISOString(),
    title: 'Committee Sessions Underway',
    content:
      'All committees are now in session with delegates actively participating in debates.',
    href: '/images/updates/sessions.jpg',
  },
];

const mockAnnouncements = [
  {
    announcementID: 'ann_001',
    date: new Date().toISOString(),
    title: 'Lunch Break Schedule',
    content: 'Lunch will be served in the main hall from 12:00 PM to 1:30 PM.',
    href: '/announcements/lunch',
  },
  {
    announcementID: 'ann_002',
    date: new Date().toISOString(),
    title: 'Evening Social Event',
    content:
      'Join us for the delegate social event tonight at 7:00 PM in the conference center.',
    href: '/announcements/social',
  },
];

// ---------- Seeder ----------

async function seedDatabase() {
  console.log('Starting database seeding...');

  try {
    // Order matters for FKs:
    // Committee → Country → Delegate → Chair → Admin → Committee-Chair → Delegation → Speech → Delegate-Speech → Speech-Tags → Resos → Updates → Announcement

    console.log('Inserting committees...');
    const { error: committeeError } = await supabase
      .from('Committee')
      .upsert(mockCommittees, { onConflict: 'committeeID' });
    if (committeeError) throw committeeError;

    console.log('Inserting countries...');
    const { error: countryError } = await supabase
      .from('Country')
      .upsert(mockCountries, { onConflict: 'countryID' });
    if (countryError) throw countryError;

    console.log('Inserting delegates...');
    const { error: delegateError } = await supabase
      .from('Delegate')
      .upsert(mockDelegates, { onConflict: 'delegateID' });
    if (delegateError) throw delegateError;

    console.log('Inserting chairs...');
    const { error: chairError } = await supabase
      .from('Chair')
      .upsert(mockChairs, { onConflict: 'chairID' });
    if (chairError) throw chairError;

    console.log('Inserting admins...');
    const { error: adminError } = await supabase
      .from('Admin')
      .upsert(mockAdmins, { onConflict: 'adminID' });
    if (adminError) throw adminError;

    console.log('Inserting committee-chair relationships...');
    const { error: committeeChairError } = await supabase
      .from('Committee-Chair') // table name contains hyphen; keep exact
      .upsert(mockCommitteeChairs, { onConflict: 'chairID,committeeID' });
    if (committeeChairError) throw committeeChairError;

    console.log('Inserting delegations...');
    const { error: delegationError } = await supabase
      .from('Delegation')
      .upsert(mockDelegations, { onConflict: 'delegateID,committeeID,countryID' });
    if (delegationError) throw delegationError;

    console.log('Inserting speeches...');
    const { error: speechError } = await supabase
      .from('Speech')
      .upsert(mockSpeeches, { onConflict: 'speechID' });
    if (speechError) throw speechError;

    console.log('Inserting delegate-speech relationships...');
    const { error: delegateSpeechError } = await supabase
      .from('Delegate-Speech') // table name contains hyphen; keep exact
      .upsert(mockDelegateSpeeches, { onConflict: 'speechID,delegateID' });
    if (delegateSpeechError) throw delegateSpeechError;

    console.log('Inserting speech tags...');
    const { error: tagError } = await supabase
      .from('Speech-Tags') // table name contains hyphen; keep exact
      .upsert(mockSpeechTags, { onConflict: 'speechID,tag' });
    if (tagError) throw tagError;

    console.log('Inserting resolutions...');
    const { error: resoError } = await supabase
      .from('Resos')
      .upsert(mockResos, { onConflict: 'resoID' });
    if (resoError) throw resoError;

    console.log('Inserting updates...');
    const { error: updateError } = await supabase
      .from('Updates')
      .upsert(mockUpdates, { onConflict: 'updateID' });
    if (updateError) throw updateError;

    console.log('Inserting announcements...');
    const { error: announcementError } = await supabase
      .from('Announcement')
      .upsert(mockAnnouncements, { onConflict: 'announcementID' });
    if (announcementError) throw announcementError;

    console.log('✅ Database seeding completed successfully!');

    console.log('\n📊 Mock Data Summary:');
    console.log(`- ${mockCommittees.length} committees`);
    console.log(`- ${mockCountries.length} countries`);
    console.log(`- ${mockDelegates.length} delegates`);
    console.log(`- ${mockChairs.length} chairs`);
    console.log(`- ${mockCommitteeChairs.length} committee-chair relationships`);
    console.log(`- ${mockAdmins.length} admins`);
    console.log(`- ${mockDelegations.length} delegations`);
    console.log(`- ${mockSpeeches.length} speeches`);
    console.log(`- ${mockDelegateSpeeches.length} delegate-speech relationships`);
    console.log(`- ${mockSpeechTags.length} speech tags`);
    console.log(`- ${mockResos.length} resolutions`);
    console.log(`- ${mockUpdates.length} updates`);
    console.log(`- ${mockAnnouncements.length} announcements`);
  } catch (error) {
    console.error('❌ Error seeding database:', error);
    process.exit(1);
  }
}

seedDatabase();
