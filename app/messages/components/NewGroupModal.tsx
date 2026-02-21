// © 2026 Ansh Gupta. All rights reserved.
// Proprietary - NOT OPEN SOURCE. No copying/modification/deployment without permission (dxb.avg@gmail.com).
'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Dialog } from '@headlessui/react';
import { Plus, Users } from 'lucide-react';
import UserAvatar from './UserAvatar';
import { UserSearchResult } from '@/lib/chat/types';
import { useChat } from '../context/ChatContext';

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated?: (roomId: string) => void;
}

const emojiOptions = ['🗳️', '🕊️', '📜', '⚖️', '🏛️'];

const NewGroupModal: React.FC<Props> = ({ open, onClose, onCreated }) => {
  const { searchUsers, createGroupRoom, selectRoom } = useChat();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<UserSearchResult[]>([]);
  const [selected, setSelected] = useState<UserSearchResult[]>([]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [icon, setIcon] = useState('🗳️');
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  const trimmedQuery = query.trim();
  const canSearch = trimmedQuery.length >= 2;

  useEffect(() => {
    if (!open) {
      setQuery('');
      setResults([]);
      setSelected([]);
      setName('');
      setDescription('');
      setError(null);
      setIsSearching(false);
      setHasSearched(false);
    }
  }, [open]);

  useEffect(() => {
    const handler = setTimeout(async () => {
      if (!canSearch) {
        setResults([]);
        setError(null);
        setIsSearching(false);
        setHasSearched(false);
        return;
      }
      setIsSearching(true);
      setError(null);
      try {
        const data = await searchUsers(trimmedQuery);
        console.log('[NewGroupModal] search results', data);
        setResults(data);
        setHasSearched(true);
      } catch (_err) {
        setError('Something went wrong while searching.');
      } finally {
        setIsSearching(false);
      }
    }, 300);
    return () => clearTimeout(handler);
  }, [canSearch, query, searchUsers, trimmedQuery]);

  const toggleSelect = (user: UserSearchResult) => {
    setSelected((prev) => {
      if (prev.find((item) => item.id === user.id)) {
        return prev.filter((item) => item.id !== user.id);
      }
      return [...prev, user];
    });
  };

  const memberPreview = useMemo(
    () => (
      <div className="flex flex-wrap gap-2">
        {selected.map((user) => (
          <span
            key={user.id}
            className="inline-flex items-center gap-2 rounded-full bg-soft-ivory px-3 py-1 text-sm font-semibold text-deep-red"
          >
            <UserAvatar user={user} size={24} /> {user.full_name}
          </span>
        ))}
      </div>
    ),
    [selected]
  );

  const handleCreate = async () => {
    const memberIds = selected.map((u) => u.id);
    const room = await createGroupRoom({ name: name || 'Untitled group', description, icon, memberIds });
    if (!room) return;
    await selectRoom(room);
    onCreated?.(room.id);
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
      <div className="fixed inset-0 flex items-start justify-center overflow-y-auto px-4 py-10">
        <Dialog.Panel className="w-full max-w-2xl rounded-3xl bg-white p-6 shadow-xl">
          <div className="flex items-start justify-between">
            <div>
              <Dialog.Title className="text-xl font-semibold text-deep-red">Create a group</Dialog.Title>
              <p className="text-sm text-almost-black-green/70">Perfect for committees, caucus rooms, and delegations.</p>
            </div>
            <button onClick={onClose} className="text-sm text-almost-black-green/60 hover:text-deep-red">Close</button>
          </div>

          <div className="mt-4 space-y-4">
            <div>
              <label className="text-sm font-semibold text-almost-black-green">Group name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-2 w-full rounded-xl border border-soft-ivory bg-warm-light-grey px-4 py-3 text-sm focus:border-deep-red/40 focus:ring-2 focus:ring-deep-red/20"
                placeholder="e.g., GA Third Committee"
              />
            </div>
            <div>
              <label className="text-sm font-semibold text-almost-black-green">Description (optional)</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="mt-2 w-full rounded-xl border border-soft-ivory bg-warm-light-grey px-4 py-3 text-sm focus:border-deep-red/40 focus:ring-2 focus:ring-deep-red/20"
                placeholder="Add context for chairs or delegates"
              />
            </div>
            <div>
              <p className="text-sm font-semibold text-almost-black-green">Choose an icon</p>
              <div className="mt-2 flex gap-2">
                {emojiOptions.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => setIcon(emoji)}
                    className={`rounded-full border px-3 py-2 text-lg ${icon === emoji ? 'border-deep-red bg-soft-rose/60' : 'border-soft-ivory hover:bg-soft-ivory'}`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-sm font-semibold text-almost-black-green">Add members</label>
              <div className="mt-2 flex items-center gap-2 rounded-xl border border-soft-ivory bg-warm-light-grey px-3 py-2">
                <Users className="h-4 w-4 text-almost-black-green/50" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="flex-1 bg-transparent text-sm outline-none"
                  placeholder="Search delegates, chairs, or staff"
                />
              </div>
              <div className="mt-2 space-y-2">
                {isSearching && canSearch && <p className="text-sm text-almost-black-green/60">Searching...</p>}
                {!isSearching && !canSearch && (
                  <p className="text-sm text-almost-black-green/60">Start typing a name or email to search.</p>
                )}
                {!isSearching && hasSearched && canSearch && !results.length && !error && (
                  <p className="text-sm text-almost-black-green/60">No people found</p>
                )}
                {results.map((user) => (
                  <button
                    key={user.id}
                    type="button"
                    onClick={() => toggleSelect(user)}
                    className={`flex w-full items-center justify-between rounded-xl border px-3 py-2 text-left transition ${
                      selected.find((u) => u.id === user.id)
                        ? 'border-deep-red/50 bg-soft-rose/40'
                        : 'border-soft-ivory hover:bg-soft-ivory'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <UserAvatar user={user} size={36} />
                      <div>
                        <p className="text-sm font-semibold text-deep-red">{user.full_name}</p>
                        <p className="text-xs text-almost-black-green/60">{user.role_title || user.role || 'Participant'}</p>
                        {user.email && <p className="text-[0.7rem] text-almost-black-green/60">{user.email}</p>}
                        {user.committee && (
                          <p className="text-[0.7rem] text-almost-black-green/60">{`${user.committee}${user.country ? ` • ${user.country}` : ''}`}</p>
                        )}
                      </div>
                    </div>
                    <Plus className="h-4 w-4 text-deep-red" />
                  </button>
                ))}
                {error && <p className="text-sm text-deep-red/80">{error}</p>}
              </div>
              <div className="mt-3 space-y-2">
                <p className="text-xs uppercase tracking-[0.2em] text-almost-black-green/60">Members</p>
                {selected.length ? memberPreview : <p className="text-sm text-almost-black-green/60">No members selected yet.</p>}
              </div>
            </div>
          </div>

          <div className="mt-6 flex items-center justify-between border-t border-soft-ivory pt-4">
            <p className="text-xs text-almost-black-green/60">We’ll add you as the first admin of this room.</p>
            <button
              type="button"
              onClick={handleCreate}
              className="inline-flex items-center gap-2 rounded-xl bg-deep-red px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-dark-burgundy"
            >
              <Users className="h-4 w-4" /> Create group
            </button>
          </div>
        </Dialog.Panel>
      </div>
    </Dialog>
  );
};

export default NewGroupModal;
