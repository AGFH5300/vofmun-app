// © 2026 Ansh Gupta. All rights reserved.
// Proprietary - NOT OPEN SOURCE. No copying/modification/deployment without permission (dxb.avg@gmail.com).
'use client';

/* eslint-disable @next/next/no-img-element */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AdminRoute } from '@/components/protectedroute';
import { getBrowserAccessToken, withBrowserAuthHeaders } from '@/lib/auth/browserAuthFetch';
import { Bell, CalendarDays, CheckCircle2, ImagePlus, LifeBuoy, Loader2, RefreshCw, Send, Trash2, Users } from 'lucide-react';
import { toast } from 'sonner';

type AdminTab = 'updates' | 'users' | 'support' | 'notifications' | 'conference';
type UserRole = 'delegate' | 'chair' | 'admin' | 'secretariat';
type SupportStatus = 'open' | 'in_progress' | 'resolved' | 'closed';
type NotificationScope = 'all' | 'role' | 'committee' | 'user';

type SupportRequest = {
  id: string;
  user_id: string | null;
  display_name: string | null;
  country: string | null;
  committee_name: string | null;
  role: string | null;
  message: string;
  status: SupportStatus;
  created_at: string;
};

type NotificationRecord = {
  id: string;
  title: string;
  message: string;
  kind: string;
  target_scope: NotificationScope;
  target_role: string | null;
  target_committee_id: string | null;
  target_user_id: string | null;
  created_at: string;
  expires_at: string | null;
};

type DirectoryUser = {
  id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  role: UserRole;
  committee_id: string | null;
  country: string | null;
};

type CommitteeRecord = {
  committeeID: string;
  committeeCode: string;
  name: string;
  fullname: string;
};

type ConferenceRecord = {
  conference_name: string;
  timezone: string;
  utc_offset: string;
  start_at: string | null;
  end_at: string | null;
  schedule: unknown;
  crisis_status: 'not_published' | 'published';
  crisis_title: string | null;
  crisis_content: string | null;
  crisis_media_url: string | null;
};

const fieldClass = 'w-full rounded-xl border border-[#dcc0bd]/70 bg-white px-4 py-3 text-sm text-[#1a1c1c] outline-none transition focus:border-[#6E1D1B] focus:ring-2 focus:ring-[#6E1D1B]/10 disabled:opacity-60';
const labelClass = 'mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-[#6E1D1B]/75';
const cardClass = 'rounded-2xl border border-[#dcc0bd]/45 bg-white p-5 shadow-[0_12px_35px_rgba(26,28,28,0.05)] sm:p-6';

const apiFetch = async (url: string, init?: RequestInit, source?: string) =>
  fetch(url, await withBrowserAuthHeaders(init, source));

const parseResponse = async (response: Response) => {
  const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) throw new Error(typeof body.error === 'string' ? body.error : 'Request failed.');
  return body;
};

const AdminPage = () => {
  const [tab, setTab] = useState<AdminTab>('updates');
  const [loadingOperations, setLoadingOperations] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [updateTitle, setUpdateTitle] = useState('');
  const [updateContent, setUpdateContent] = useState('');
  const [publishingUpdate, setPublishingUpdate] = useState(false);

  const [supportRequests, setSupportRequests] = useState<SupportRequest[]>([]);
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [directoryUsers, setDirectoryUsers] = useState<DirectoryUser[]>([]);
  const [committees, setCommittees] = useState<CommitteeRecord[]>([]);
  const [conference, setConference] = useState<ConferenceRecord | null>(null);

  const [invite, setInvite] = useState({
    email: '',
    firstName: '',
    lastName: '',
    role: 'delegate' as UserRole,
    committeeId: '',
    country: '',
  });
  const [inviting, setInviting] = useState(false);

  const [notice, setNotice] = useState({
    title: '',
    message: '',
    kind: 'announcement',
    targetScope: 'all' as NotificationScope,
    targetRole: 'delegate' as UserRole,
    targetCommitteeId: '',
    targetUserId: '',
    expiresAt: '',
  });
  const [publishingNotice, setPublishingNotice] = useState(false);

  const [conferenceForm, setConferenceForm] = useState({
    conferenceName: '',
    timezone: 'Asia/Dubai',
    utcOffset: '+04:00',
    startAt: '',
    endAt: '',
    schedule: '[]',
    crisisStatus: 'not_published' as 'not_published' | 'published',
    crisisTitle: '',
    crisisContent: '',
    crisisMediaUrl: '',
  });
  const [savingConference, setSavingConference] = useState(false);

  const previewUrl = useMemo(() => selectedFile ? URL.createObjectURL(selectedFile) : null, [selectedFile]);
  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);

  const applyConference = useCallback((record: ConferenceRecord) => {
    setConference(record);
    setConferenceForm({
      conferenceName: record.conference_name,
      timezone: record.timezone,
      utcOffset: record.utc_offset,
      startAt: record.start_at || '',
      endAt: record.end_at || '',
      schedule: JSON.stringify(record.schedule || [], null, 2),
      crisisStatus: record.crisis_status,
      crisisTitle: record.crisis_title || '',
      crisisContent: record.crisis_content || '',
      crisisMediaUrl: record.crisis_media_url || '',
    });
  }, []);

  const loadOperations = useCallback(async (quiet = false) => {
    quiet ? setRefreshing(true) : setLoadingOperations(true);
    try {
      const [supportResponse, notificationResponse, usersResponse, conferenceResponse] = await Promise.all([
        apiFetch('/api/admin/support-requests', undefined, 'admin-support-load'),
        apiFetch('/api/admin/notifications', undefined, 'admin-notifications-load'),
        apiFetch('/api/admin/users', undefined, 'admin-users-load'),
        apiFetch('/api/conference', undefined, 'admin-conference-load'),
      ]);

      const [supportBody, notificationBody, usersBody, conferenceBody] = await Promise.all([
        parseResponse(supportResponse),
        parseResponse(notificationResponse),
        parseResponse(usersResponse),
        parseResponse(conferenceResponse),
      ]);

      setSupportRequests((supportBody.requests as SupportRequest[]) || []);
      setNotifications((notificationBody.notifications as NotificationRecord[]) || []);
      setDirectoryUsers((usersBody.users as DirectoryUser[]) || []);
      setCommittees((usersBody.committees as CommitteeRecord[]) || []);
      applyConference(conferenceBody.conference as ConferenceRecord);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to load admin operations.');
    } finally {
      setLoadingOperations(false);
      setRefreshing(false);
    }
  }, [applyConference]);

  useEffect(() => {
    void loadOperations();
  }, [loadOperations]);

  const publishUpdate = async () => {
    if (!selectedFile || !updateTitle.trim() || !updateContent.trim()) {
      toast.error('Add an image, title, and update content.');
      return;
    }

    setPublishingUpdate(true);
    try {
      const accessToken = await getBrowserAccessToken('admin-live-update');
      if (!accessToken) throw new Error('Your session expired. Please sign in again.');

      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('title', updateTitle.trim());
      formData.append('content', updateContent.trim());

      const response = await fetch('/api/upload-image', {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
        body: formData,
      });
      await parseResponse(response);

      setSelectedFile(null);
      setUpdateTitle('');
      setUpdateContent('');
      toast.success('Live update published.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to publish the update.');
    } finally {
      setPublishingUpdate(false);
    }
  };

  const updateSupportStatus = async (id: string, status: SupportStatus) => {
    try {
      const response = await apiFetch('/api/admin/support-requests', {
        method: 'PATCH',
        body: JSON.stringify({ id, status }),
      }, 'admin-support-update');
      const body = await parseResponse(response);
      const updated = body.request as SupportRequest;
      setSupportRequests((current) => current.map((request) => request.id === id ? updated : request));
      toast.success('Support request updated.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to update support request.');
    }
  };

  const inviteUser = async () => {
    setInviting(true);
    try {
      const response = await apiFetch('/api/admin/users', {
        method: 'POST',
        body: JSON.stringify(invite),
      }, 'admin-user-invite');
      const body = await parseResponse(response);
      setDirectoryUsers((current) => [...current, body.user as DirectoryUser].sort((a, b) =>
        (a.first_name || '').localeCompare(b.first_name || ''),
      ));
      setInvite({ email: '', firstName: '', lastName: '', role: 'delegate', committeeId: '', country: '' });
      toast.success('Invitation sent and VOFMUN profile created.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to invite the user.');
    } finally {
      setInviting(false);
    }
  };

  const publishNotification = async () => {
    setPublishingNotice(true);
    try {
      const response = await apiFetch('/api/admin/notifications', {
        method: 'POST',
        body: JSON.stringify(notice),
      }, 'admin-notification-publish');
      const body = await parseResponse(response);
      setNotifications((current) => [body.notification as NotificationRecord, ...current]);
      setNotice({
        title: '',
        message: '',
        kind: 'announcement',
        targetScope: 'all',
        targetRole: 'delegate',
        targetCommitteeId: '',
        targetUserId: '',
        expiresAt: '',
      });
      toast.success('Notification published.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to publish the notification.');
    } finally {
      setPublishingNotice(false);
    }
  };

  const removeNotification = async (id: string) => {
    try {
      const response = await apiFetch('/api/admin/notifications', {
        method: 'DELETE',
        body: JSON.stringify({ id }),
      }, 'admin-notification-delete');
      await parseResponse(response);
      setNotifications((current) => current.filter((item) => item.id !== id));
      toast.success('Notification removed.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to remove the notification.');
    }
  };

  const saveConference = async () => {
    setSavingConference(true);
    try {
      const schedule = JSON.parse(conferenceForm.schedule) as unknown;
      const response = await apiFetch('/api/conference', {
        method: 'PUT',
        body: JSON.stringify({ ...conferenceForm, schedule }),
      }, 'admin-conference-save');
      const body = await parseResponse(response);
      applyConference(body.conference as ConferenceRecord);
      toast.success('Conference schedule and briefing saved.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to save conference settings.');
    } finally {
      setSavingConference(false);
    }
  };

  const tabs: { id: AdminTab; label: string; icon: React.ReactNode; count?: number }[] = [
    { id: 'updates', label: 'Live Updates', icon: <ImagePlus className="h-4 w-4" /> },
    { id: 'users', label: 'Users', icon: <Users className="h-4 w-4" />, count: directoryUsers.length },
    { id: 'support', label: 'Support', icon: <LifeBuoy className="h-4 w-4" />, count: supportRequests.filter((item) => item.status !== 'closed' && item.status !== 'resolved').length },
    { id: 'notifications', label: 'Notifications', icon: <Bell className="h-4 w-4" />, count: notifications.length },
    { id: 'conference', label: 'Conference', icon: <CalendarDays className="h-4 w-4" /> },
  ];

  return (
    <AdminRoute>
      <div className="min-h-screen bg-[#f9f9f9] pb-16">
        <section className="bg-[#6E1D1B] px-5 py-10 text-white sm:px-8">
          <div className="mx-auto max-w-6xl">
            <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
              <div>
                <span className="text-xs font-semibold uppercase tracking-[0.22em] text-white/65">VOFMUN Operations</span>
                <h1 className="mt-2 font-serif text-4xl font-semibold">Admin Control Centre</h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-white/75">
                  Manage conference content, provision accounts, respond to delegates, and publish announcements.
                </p>
              </div>
              <button onClick={() => void loadOperations(true)} disabled={refreshing} className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/25 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10 disabled:opacity-60">
                <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>
          </div>
        </section>

        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-8">
          <div className="mb-6 flex gap-2 overflow-x-auto pb-2">
            {tabs.map((item) => (
              <button key={item.id} onClick={() => setTab(item.id)} className={`inline-flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${tab === item.id ? 'bg-[#6E1D1B] text-white' : 'border border-[#dcc0bd]/60 bg-white text-[#564240] hover:border-[#6E1D1B]/40'}`}>
                {item.icon}
                {item.label}
                {item.count !== undefined ? <span className={`rounded-full px-2 py-0.5 text-[11px] ${tab === item.id ? 'bg-white/15' : 'bg-[#f4f3f3]'}`}>{item.count}</span> : null}
              </button>
            ))}
          </div>

          {loadingOperations ? (
            <div className={`${cardClass} flex items-center justify-center gap-3 py-16 text-sm text-[#564240]`}>
              <Loader2 className="h-5 w-5 animate-spin text-[#6E1D1B]" />
              Loading VOFMUN operations…
            </div>
          ) : null}

          {!loadingOperations && tab === 'updates' ? (
            <section className={cardClass}>
              <h2 className="font-serif text-2xl font-semibold text-[#6E1D1B]">Publish Live Update</h2>
              <p className="mt-1 text-sm text-[#564240]/75">Post a verified update to the live conference feed.</p>
              <div className="mt-6 grid gap-5 md:grid-cols-[0.8fr_1.2fr]">
                <label className="flex min-h-56 cursor-pointer flex-col items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-[#dcc0bd] bg-[#fff8f2] text-center">
                  {previewUrl ? <img src={previewUrl} alt="Selected update preview" className="h-56 w-full object-cover" /> : <><ImagePlus className="h-8 w-8 text-[#6E1D1B]" /><span className="mt-3 text-sm font-semibold text-[#6E1D1B]">Choose JPEG, PNG, or WebP</span><span className="mt-1 text-xs text-[#564240]/65">Maximum 8 MB</span></>}
                  <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(event) => setSelectedFile(event.target.files?.[0] || null)} />
                </label>
                <div className="space-y-4">
                  <label><span className={labelClass}>Title</span><input value={updateTitle} onChange={(event) => setUpdateTitle(event.target.value)} maxLength={180} className={fieldClass} /></label>
                  <label><span className={labelClass}>Content</span><textarea value={updateContent} onChange={(event) => setUpdateContent(event.target.value)} maxLength={6000} rows={6} className={fieldClass} /></label>
                  <button onClick={() => void publishUpdate()} disabled={publishingUpdate} className="inline-flex items-center gap-2 rounded-xl bg-[#6E1D1B] px-5 py-3 text-sm font-semibold text-white disabled:opacity-60">
                    {publishingUpdate ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    {publishingUpdate ? 'Publishing…' : 'Publish update'}
                  </button>
                </div>
              </div>
            </section>
          ) : null}

          {!loadingOperations && tab === 'users' ? (
            <div className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
              <section className={cardClass}>
                <h2 className="font-serif text-2xl font-semibold text-[#6E1D1B]">Provision Account</h2>
                <p className="mt-1 text-sm text-[#564240]/75">VOFMUN remains invitation-only; this sends the account setup email.</p>
                <div className="mt-5 space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label><span className={labelClass}>First name</span><input value={invite.firstName} onChange={(event) => setInvite((value) => ({ ...value, firstName: event.target.value }))} className={fieldClass} /></label>
                    <label><span className={labelClass}>Last name</span><input value={invite.lastName} onChange={(event) => setInvite((value) => ({ ...value, lastName: event.target.value }))} className={fieldClass} /></label>
                  </div>
                  <label><span className={labelClass}>Email</span><input type="email" value={invite.email} onChange={(event) => setInvite((value) => ({ ...value, email: event.target.value }))} className={fieldClass} /></label>
                  <label><span className={labelClass}>Country</span><input value={invite.country} onChange={(event) => setInvite((value) => ({ ...value, country: event.target.value }))} className={fieldClass} /></label>
                  <div><span className={labelClass}>Role</span><div className="grid grid-cols-2 gap-2">{(['delegate', 'chair', 'secretariat', 'admin'] as UserRole[]).map((role) => <button key={role} type="button" onClick={() => setInvite((value) => ({ ...value, role }))} className={`rounded-xl border px-3 py-2 text-sm capitalize ${invite.role === role ? 'border-[#6E1D1B] bg-[#6E1D1B] text-white' : 'border-[#dcc0bd] bg-white text-[#564240]'}`}>{role}</button>)}</div></div>
                  {(invite.role === 'delegate' || invite.role === 'chair') ? <label><span className={labelClass}>Committee</span><select value={invite.committeeId} onChange={(event) => setInvite((value) => ({ ...value, committeeId: event.target.value }))} className={fieldClass}><option value="">Select committee</option>{committees.map((committee) => <option key={committee.committeeID} value={committee.committeeID}>{committee.committeeCode} — {committee.name}</option>)}</select></label> : null}
                  <button onClick={() => void inviteUser()} disabled={inviting} className="inline-flex items-center gap-2 rounded-xl bg-[#6E1D1B] px-5 py-3 text-sm font-semibold text-white disabled:opacity-60">{inviting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}{inviting ? 'Sending…' : 'Send invitation'}</button>
                </div>
              </section>
              <section className={cardClass}>
                <h2 className="font-serif text-2xl font-semibold text-[#6E1D1B]">User Directory</h2>
                <div className="mt-4 max-h-[640px] space-y-3 overflow-y-auto pr-1">
                  {directoryUsers.map((user) => {
                    const committee = committees.find((item) => item.committeeID === user.committee_id);
                    return <div key={user.id} className="rounded-xl border border-[#e7dcda] bg-[#fffdfb] p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-semibold text-[#1a1c1c]">{[user.first_name, user.last_name].filter(Boolean).join(' ') || 'Unnamed user'}</p><p className="text-sm text-[#564240]/70">{user.email || 'No email'}</p></div><span className="rounded-full bg-[#f4e8e4] px-3 py-1 text-xs font-semibold capitalize text-[#6E1D1B]">{user.role}</span></div><p className="mt-2 text-xs text-[#564240]/65">{committee?.committeeCode || 'No committee'}{user.country ? ` · ${user.country}` : ''}</p></div>;
                  })}
                  {directoryUsers.length === 0 ? <p className="rounded-xl bg-[#f4f3f3] p-4 text-sm text-[#564240]">No application users found.</p> : null}
                </div>
              </section>
            </div>
          ) : null}

          {!loadingOperations && tab === 'support' ? (
            <section className={cardClass}>
              <h2 className="font-serif text-2xl font-semibold text-[#6E1D1B]">Support Inbox</h2>
              <div className="mt-5 space-y-4">
                {supportRequests.map((request) => <article key={request.id} className="rounded-2xl border border-[#e7dcda] bg-[#fffdfb] p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-semibold text-[#1a1c1c]">{request.display_name || 'VOFMUN user'}</p><p className="text-xs text-[#564240]/65">{request.role || 'participant'}{request.committee_name ? ` · ${request.committee_name}` : ''}{request.country ? ` · ${request.country}` : ''} · {new Date(request.created_at).toLocaleString()}</p></div><span className="rounded-full bg-[#f4e8e4] px-3 py-1 text-xs font-semibold capitalize text-[#6E1D1B]">{request.status.replace('_', ' ')}</span></div><p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-[#1a1c1c]/85">{request.message}</p><div className="mt-4 flex flex-wrap gap-2">{(['open', 'in_progress', 'resolved', 'closed'] as SupportStatus[]).map((status) => <button key={status} onClick={() => void updateSupportStatus(request.id, status)} disabled={request.status === status} className={`rounded-lg px-3 py-1.5 text-xs font-semibold capitalize ${request.status === status ? 'bg-[#6E1D1B] text-white' : 'border border-[#dcc0bd] bg-white text-[#564240]'}`}>{status.replace('_', ' ')}</button>)}{request.user_id ? <button onClick={() => { setNotice((value) => ({ ...value, title: 'Support request update', message: '', targetScope: 'user', targetUserId: request.user_id || '' })); setTab('notifications'); }} className="rounded-lg border border-[#6E1D1B] px-3 py-1.5 text-xs font-semibold text-[#6E1D1B]">Reply by notification</button> : null}</div></article>)}
                {supportRequests.length === 0 ? <p className="rounded-xl bg-[#f4f3f3] p-4 text-sm text-[#564240]">No support requests.</p> : null}
              </div>
            </section>
          ) : null}

          {!loadingOperations && tab === 'notifications' ? (
            <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
              <section className={cardClass}>
                <h2 className="font-serif text-2xl font-semibold text-[#6E1D1B]">Publish Notification</h2>
                <div className="mt-5 space-y-4">
                  <label><span className={labelClass}>Title</span><input value={notice.title} onChange={(event) => setNotice((value) => ({ ...value, title: event.target.value }))} maxLength={160} className={fieldClass} /></label>
                  <label><span className={labelClass}>Message</span><textarea value={notice.message} onChange={(event) => setNotice((value) => ({ ...value, message: event.target.value }))} maxLength={2000} rows={5} className={fieldClass} /></label>
                  <div><span className={labelClass}>Audience</span><div className="grid grid-cols-2 gap-2">{(['all', 'role', 'committee', 'user'] as NotificationScope[]).map((scope) => <button key={scope} type="button" onClick={() => setNotice((value) => ({ ...value, targetScope: scope }))} className={`rounded-xl border px-3 py-2 text-sm capitalize ${notice.targetScope === scope ? 'border-[#6E1D1B] bg-[#6E1D1B] text-white' : 'border-[#dcc0bd] bg-white text-[#564240]'}`}>{scope}</button>)}</div></div>
                  {notice.targetScope === 'role' ? <label><span className={labelClass}>Role</span><select value={notice.targetRole} onChange={(event) => setNotice((value) => ({ ...value, targetRole: event.target.value as UserRole }))} className={fieldClass}>{(['delegate', 'chair', 'secretariat', 'admin'] as UserRole[]).map((role) => <option key={role}>{role}</option>)}</select></label> : null}
                  {notice.targetScope === 'committee' ? <label><span className={labelClass}>Committee</span><select value={notice.targetCommitteeId} onChange={(event) => setNotice((value) => ({ ...value, targetCommitteeId: event.target.value }))} className={fieldClass}><option value="">Select committee</option>{committees.map((committee) => <option key={committee.committeeID} value={committee.committeeID}>{committee.committeeCode} — {committee.name}</option>)}</select></label> : null}
                  {notice.targetScope === 'user' ? <label><span className={labelClass}>User</span><select value={notice.targetUserId} onChange={(event) => setNotice((value) => ({ ...value, targetUserId: event.target.value }))} className={fieldClass}><option value="">Select user</option>{directoryUsers.map((user) => <option key={user.id} value={user.id}>{[user.first_name, user.last_name].filter(Boolean).join(' ')} — {user.email}</option>)}</select></label> : null}
                  <button onClick={() => void publishNotification()} disabled={publishingNotice} className="inline-flex items-center gap-2 rounded-xl bg-[#6E1D1B] px-5 py-3 text-sm font-semibold text-white disabled:opacity-60">{publishingNotice ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bell className="h-4 w-4" />}{publishingNotice ? 'Publishing…' : 'Publish notification'}</button>
                </div>
              </section>
              <section className={cardClass}>
                <h2 className="font-serif text-2xl font-semibold text-[#6E1D1B]">Published Notifications</h2>
                <div className="mt-4 max-h-[640px] space-y-3 overflow-y-auto pr-1">{notifications.map((item) => <article key={item.id} className="rounded-xl border border-[#e7dcda] bg-[#fffdfb] p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-semibold text-[#1a1c1c]">{item.title}</p><p className="mt-1 text-xs uppercase tracking-[0.12em] text-[#6E1D1B]/70">{item.target_scope} · {item.kind}</p></div><button onClick={() => void removeNotification(item.id)} className="rounded-lg p-2 text-[#6E1D1B] hover:bg-[#f4e8e4]" aria-label="Remove notification"><Trash2 className="h-4 w-4" /></button></div><p className="mt-2 text-sm leading-6 text-[#564240]">{item.message}</p><p className="mt-2 text-xs text-[#564240]/55">{new Date(item.created_at).toLocaleString()}</p></article>)}{notifications.length === 0 ? <p className="rounded-xl bg-[#f4f3f3] p-4 text-sm text-[#564240]">No published notifications.</p> : null}</div>
              </section>
            </div>
          ) : null}

          {!loadingOperations && tab === 'conference' ? (
            <section className={cardClass}>
              <div className="flex items-center gap-3"><CheckCircle2 className="h-6 w-6 text-[#6E1D1B]" /><div><h2 className="font-serif text-2xl font-semibold text-[#6E1D1B]">Conference & Crisis Control</h2><p className="text-sm text-[#564240]/70">This drives the live schedule and crisis briefing shown to participants.</p></div></div>
              <div className="mt-6 grid gap-5 sm:grid-cols-2">
                <label><span className={labelClass}>Conference name</span><input value={conferenceForm.conferenceName} onChange={(event) => setConferenceForm((value) => ({ ...value, conferenceName: event.target.value }))} className={fieldClass} /></label>
                <label><span className={labelClass}>Timezone</span><input value={conferenceForm.timezone} onChange={(event) => setConferenceForm((value) => ({ ...value, timezone: event.target.value }))} className={fieldClass} /></label>
                <label><span className={labelClass}>UTC offset</span><input value={conferenceForm.utcOffset} onChange={(event) => setConferenceForm((value) => ({ ...value, utcOffset: event.target.value }))} placeholder="+04:00" className={fieldClass} /></label>
                <div />
                <label><span className={labelClass}>Conference starts (ISO)</span><input value={conferenceForm.startAt} onChange={(event) => setConferenceForm((value) => ({ ...value, startAt: event.target.value }))} placeholder="2027-06-11T13:30:00+04:00" className={fieldClass} /></label>
                <label><span className={labelClass}>Conference ends (ISO)</span><input value={conferenceForm.endAt} onChange={(event) => setConferenceForm((value) => ({ ...value, endAt: event.target.value }))} placeholder="2027-06-13T16:15:00+04:00" className={fieldClass} /></label>
              </div>
              <label className="mt-5 block"><span className={labelClass}>Schedule JSON</span><textarea value={conferenceForm.schedule} onChange={(event) => setConferenceForm((value) => ({ ...value, schedule: event.target.value }))} rows={18} spellCheck={false} className={`${fieldClass} font-mono text-xs leading-5`} /></label>
              <div className="mt-7 border-t border-[#e7dcda] pt-6">
                <h3 className="font-serif text-xl font-semibold text-[#6E1D1B]">Crisis Briefing</h3>
                <div className="mt-4 flex gap-2">{(['not_published', 'published'] as const).map((status) => <button key={status} onClick={() => setConferenceForm((value) => ({ ...value, crisisStatus: status }))} className={`rounded-xl border px-4 py-2 text-sm font-semibold ${conferenceForm.crisisStatus === status ? 'border-[#6E1D1B] bg-[#6E1D1B] text-white' : 'border-[#dcc0bd] bg-white text-[#564240]'}`}>{status === 'published' ? 'Published' : 'Not published'}</button>)}</div>
                <div className="mt-4 grid gap-4">
                  <label><span className={labelClass}>Briefing title</span><input value={conferenceForm.crisisTitle} onChange={(event) => setConferenceForm((value) => ({ ...value, crisisTitle: event.target.value }))} className={fieldClass} /></label>
                  <label><span className={labelClass}>Briefing content</span><textarea value={conferenceForm.crisisContent} onChange={(event) => setConferenceForm((value) => ({ ...value, crisisContent: event.target.value }))} rows={5} className={fieldClass} /></label>
                  <label><span className={labelClass}>Media URL (HTTPS)</span><input type="url" value={conferenceForm.crisisMediaUrl} onChange={(event) => setConferenceForm((value) => ({ ...value, crisisMediaUrl: event.target.value }))} className={fieldClass} /></label>
                </div>
              </div>
              <button onClick={() => void saveConference()} disabled={savingConference || !conference} className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[#6E1D1B] px-5 py-3 text-sm font-semibold text-white disabled:opacity-60">{savingConference ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}{savingConference ? 'Saving…' : 'Save conference settings'}</button>
            </section>
          ) : null}
        </div>
      </div>
    </AdminRoute>
  );
};

export default AdminPage;
