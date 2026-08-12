import fs from 'node:fs';

// These checks cover the complete public-login bootstrap boundary: visible SSR,
// session recovery, client hydration, and non-conflicting WebSocket upgrades.
const loginSource = fs.readFileSync('app/login/page.tsx', 'utf8');
const sessionSource = fs.readFileSync('app/context/sessionContext.tsx', 'utf8');
const serverSource = fs.readFileSync('server/chat/server.ts', 'utf8');
const profileRouteSource = fs.readFileSync('app/api/auth/profile/route.ts', 'utf8');
const typewriterSource = fs.readFileSync('components/ui/typewriter.tsx', 'utf8');
const customNavSource = fs.readFileSync('components/ui/customnav.tsx', 'utf8');
const packageSource = fs.readFileSync('package.json', 'utf8');
const stablePreviewSource = fs.readFileSync('scripts/start-stable-preview.mjs', 'utf8');
const warmupSource = fs.readFileSync('scripts/warmup-dev.mjs', 'utf8');
const smokeSource = fs.readFileSync('scripts/smoke-next-hmr.mjs', 'utf8');
const providersSource = fs.readFileSync('app/providers.tsx', 'utf8');
const appWrapperSource = fs.readFileSync('components/AppWrapper.tsx', 'utf8');

if (/initial=\{\{[^{}]*opacity:\s*0/.test(loginSource)) {
  throw new Error('Login page still server-renders hidden motion content.');
}

if (!sessionSource.includes('event === "INITIAL_SESSION" && !session')) {
  throw new Error('Session bootstrap does not recover a persisted session from a transient null INITIAL_SESSION.');
}

if (!sessionSource.includes('? readPersistedSession()')) {
  throw new Error('Session bootstrap persisted-session fallback is missing.');
}

if (!sessionSource.includes('supabaseAuthStorageKey') || sessionSource.includes('window.localStorage.length')) {
  throw new Error('Session recovery can inspect stale Supabase projects or throw while enumerating storage.');
}

if (!loginSource.includes('Cookies.set("user", JSON.stringify(mapAppUserToSessionUser(appUser))')) {
  throw new Error('Login does not cache the verified profile before its hard navigation.');
}

if (!serverSource.includes('httpServer: server')) {
  throw new Error('Next is not attached to the shared HTTP server, so development WebSocket upgrades can fail.');
}

if (!serverSource.includes('new WebSocketServer({ noServer: true })') || !serverSource.includes('await nextApp.prepare();\n  const nextUpgradeHandler = nextApp.getUpgradeHandler();')) {
  throw new Error('Chat and Next WebSocket upgrades are not explicitly separated.');
}

if (!serverSource.includes('webpack: true') || !serverSource.includes('turbopack: false')) {
  throw new Error('Replit development mode is not pinned to the stable webpack HMR path.');
}

if (!typewriterSource.includes('useState(FALLBACK_TEXT)') || !typewriterSource.includes('cancelled = true') || typewriterSource.includes('setHasMounted(true)')) {
  throw new Error('Typewriter is not using the single cancellable timer implementation.');
}

if (typewriterSource.includes('aria-live="polite"')) {
  throw new Error('Typewriter still announces every animated character to assistive technology.');
}

if (!loginSource.includes('disabled={!isClientReady || loading}') || !loginSource.includes('Preparing secure login...')) {
  throw new Error('Login can submit before React hydration and silently reload the page.');
}

console.log('Auth, hydration, and WebSocket regression checks passed.');


if (!packageSource.includes('node scripts/start-clean-dev.mjs')) {
  throw new Error('Development startup does not clear stale generated Next chunks.');
}

if (!warmupSource.includes('redirect: "manual"') || !warmupSource.includes('WARMUP_CONCURRENCY || 2')) {
  throw new Error('Development warm-up can still flood /login through followed redirects.');
}

if (!smokeSource.includes('new vm.Script') || !smokeSource.includes('/app/layout.js')) {
  throw new Error('CI does not syntax-check the generated layout client chunk.');
}

if (!providersSource.includes("pathname === '/login'") || !providersSource.includes("dynamic(() => import('./authenticated-shell')") || providersSource.includes("from '@/app/context/sessionContext'")) {
  throw new Error('Public auth routes still pull the authenticated application shell into app/layout.js.');
}

if (!appWrapperSource.includes("dynamic(() => import('@/components/ui/customnav')") || !appWrapperSource.includes("dynamic(() => import('@/components/ui/site-footer')")) {
  throw new Error('Authenticated navigation and footer are not split into lazy chunks.');
}

if (loginSource.includes('useSession') || loginSource.includes('useRouter') || !loginSource.includes('window.location.replace(routeByRole(appUser.role))')) {
  throw new Error('Login still depends on the global session shell or client-router race.');
}

if (!smokeSource.includes("'app/context/sessionContext.tsx'") || !smokeSource.includes("'node_modules/@supabase/auth-js/'") || !smokeSource.includes('new vm.Script')) {
  throw new Error('CI does not parse generated chunks or prevent authenticated modules leaking into app/layout.js.');
}

if (!packageSource.includes('node scripts/start-stable-preview.mjs') || !packageSource.includes('dev:webpack')) {
  throw new Error('The Replit command is not separated from the optional webpack development command.');
}

if (!stablePreviewSource.includes("['run', 'build']") || !stablePreviewSource.includes("['run', 'start']") || !stablePreviewSource.includes('Starting without HMR or Fast Refresh')) {
  throw new Error('Stable preview does not build first and start with HMR disabled.');
}


if (
  !serverSource.includes("'/api/auth/profile'") ||
  serverSource.includes("app.get('/api/auth/profile'") ||
  !profileRouteSource.includes('admin.auth.getUser(accessToken)') ||
  !profileRouteSource.includes('sync_auth_user_to_app_users')
) {
  throw new Error('The unified server is not forwarding profile bootstrap to the canonical self-syncing Next handler.');
}

if (!smokeSource.includes('Authenticated profile endpoint routing smoke test passed.') || !smokeSource.includes('unauthenticatedProfileResponse.status !== 401')) {
  throw new Error('CI does not verify that /api/auth/profile is registered before the Next fallback.');
}


const chatContextSource = fs.readFileSync('app/messages/context/ChatContext.tsx', 'utf8');
const footerSource = fs.readFileSync('components/ui/site-footer.tsx', 'utf8');

for (const endpoint of [
  '/api/chat/attachments/upload',
  '/api/chat/attachments/sign',
  '/api/chat/attachments/pending',
  '/api/upload-image',
]) {
  if (!serverSource.includes(endpoint)) {
    throw new Error(`Unified server does not forward ${endpoint} to its Next route handler.`);
  }
}

if (!serverSource.includes('chatReceiptRateLimit') || !serverSource.includes("app.post('/api/rooms/:roomId/receipts', chatReceiptRateLimit")) {
  throw new Error('Receipt writes still share the low-volume generic chat write limit.');
}

if (
  !chatContextSource.includes('RECEIPT_FAILURE_BACKOFF_MS') ||
  !chatContextSource.includes('receiptFailureBackoffRef') ||
  !chatContextSource.includes('receiptRetryTimerRef') ||
  !chatContextSource.includes('pendingReceiptQueueRef.current.set(roomId, retryQueue)')
) {
  throw new Error('Receipt failures are not retained and retried after bounded backoff.');
}

if (!chatContextSource.includes('deliveredOnlyIds') || !chatContextSource.includes('isRoomActivelyRead(normalizedRoomId)')) {
  throw new Error('Receipt batching or active-room unread clearing has regressed.');
}

if (!smokeSource.includes('Attachment, admin upload, and receipt API routing smoke tests passed.')) {
  throw new Error('CI does not exercise every Next-owned upload route and the receipt route through the unified server.');
}

if (/href=["']vofmun\.org\//.test(footerSource)) {
  throw new Error('Footer still contains relative vofmun.org links that trigger local Next prefetch 404s.');
}


const messagesPageSource = fs.readFileSync('app/messages/page.tsx', 'utf8');
const messageBubbleSource = fs.readFileSync('app/messages/components/MessageBubble.tsx', 'utf8');
const conversationItemSource = fs.readFileSync('app/messages/components/ConversationListItem.tsx', 'utf8');
const conversationListSource = fs.readFileSync('app/messages/components/ConversationList.tsx', 'utf8');

if (!messagesPageSource.includes('editComposerSnapshotRef') || !messagesPageSource.includes('restoreComposerAfterEdit') || !messagesPageSource.includes('Your previous draft will return')) {
  throw new Error('Composer-based editing no longer preserves and restores the existing draft.');
}

if (!messageBubbleSource.includes('onRequestEditMessage(message)') || !messagesPageSource.includes('onRequestEditMessage={beginEditingMessage}')) {
  throw new Error('Message editing has fallen back to the low-contrast inline bubble editor.');
}

if (!messagesPageSource.includes('if (isUploadingAttachments)') || !messagesPageSource.includes('Wait for the attachment upload to finish')) {
  throw new Error('Editing can still clear an in-flight attachment upload.');
}

for (const label of ['Open in new window', 'Mark as unread', 'Archive', 'Mute', 'Conversation info', 'Export conversation', 'Clear conversation']) {
  if (!conversationItemSource.includes(label)) {
    throw new Error(`Conversation context menu is missing ${label}.`);
  }
}

if (conversationItemSource.includes('Contact info')) {
  throw new Error('Conversation menu incorrectly exposes consumer contact-info language in the MUN app.');
}

if (!conversationListSource.includes('archivedRooms') || !chatContextSource.includes('manualUnreadRoomIds')) {
  throw new Error('Archive or manual-unread conversation state is not persisted.');
}


if (
  chatContextSource.includes("logChatDebug('socket:onopen:send_auth', authPayload") ||
  chatContextSource.includes("logChatDebug('socket:onmessage:raw'") ||
  chatContextSource.includes("console.debug('sendMessage payload'")
) {
  throw new Error('Chat debug output can still expose bearer tokens or message bodies.');
}

if (
  !customNavSource.includes('<Dialog') ||
  !customNavSource.includes('<Dialog.Title') ||
  !customNavSource.includes('How can we help?') ||
  !customNavSource.includes('{ name: "Home", to: "/home" }') ||
  customNavSource.includes('{ name: "Dashboard", to: "/home" }')
) {
  throw new Error('Support modal accessibility or delegate navigation hierarchy has regressed.');
}
