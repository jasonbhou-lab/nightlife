import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Linking from 'expo-linking';
import React, {
  createContext, useCallback, useContext, useEffect, useMemo, useState,
} from 'react';
import { useColorScheme } from 'react-native';

import {
  cancelBookingRemote, completeAuthFromUrl, createMessageThread, getAuthSnapshot, getManagedVenueIds,
  getPlatformRoles, getThreadMessages, onAuthSignedOut, sendMessage as sendMessageRemote,
  sendSignInCode as sendSignInCodeRemote, signInWithGoogle as signInWithGoogleRemote,
  signOutRemote, verifySignInCode as verifySignInCodeRemote, type AuthProfile,
} from '@/data/repository';
import { emptyFilters } from '@/lib/search';
import { hasBackend } from '@/lib/supabase';
import { darkTheme, lightTheme, type Theme, type ThemeMode } from '@/theme';
import type {
  Booking, CheckIn, CheckInVisibility, Collection, FilterState, Message, MessageThread,
  MessageThreadKind, PlatformRole, Preferences, QuoteIntake, ReviewDraft, SessionRole,
} from '@/types';

/**
 * Single app store. Context plus AsyncStorage rather than a state library —
 * the surface is small and the persistence requirements are specific:
 *
 *  - U-07: saved venues, recent searches, and confirmation details stay
 *    readable without connectivity, so they are written to disk, not memory.
 *  - U-09: review drafts autosave and resume across sessions.
 *  - U-10: filter state persists across the session.
 */

const KEYS = {
  session: 'nightout.session.v1',
  collections: 'nightout.collections.v1',
  bookings: 'nightout.bookings.v1',
  threads: 'nightout.threads.v1',
  follows: 'nightout.follows.v1',
  checkins: 'nightout.checkins.v1',
  drafts: 'nightout.drafts.v1',
  prefs: 'nightout.prefs.v1',
  recent: 'nightout.recent.v1',
  theme: 'nightout.theme.v1',
};

export type ThemeSetting = ThemeMode | 'system';

type Session = {
  role: SessionRole;
  name: string;
  phoneVerified: boolean;
  ageVerified: boolean;
  /**
   * R1: a guest hits a soft registration wall on the third contribution
   * attempt, and a hard wall on booking.
   */
  contributionAttempts: number;
};

const defaultSession: Session = {
  role: 'guest',
  name: 'Guest',
  phoneVerified: false,
  ageVerified: false,
  contributionAttempts: 0,
};

/** F-SOCIAL-02. Two separate follow lists: people (the roster) and venues. */
type Follows = { memberIds: string[]; venueIds: string[] };

const defaultFollows: Follows = { memberIds: [], venueIds: [] };

const defaultPrefs: Preferences = {
  cuisines: [],
  dietary: [],
  priceComfort: [],
  nightlifeInterest: true,
  cigarInterest: false,
  typicalPartySize: 2,
  personalized: true,
  completedOnboarding: false,
};

type Ctx = {
  ready: boolean;
  theme: Theme;
  themeSetting: ThemeSetting;
  setThemeSetting: (t: ThemeSetting) => void;

  session: Session;
  /** No-backend fallback only: a local, unpersisted-past-this-device identity. */
  signIn: (name: string) => void;
  signOut: () => void;
  /**
   * Real Supabase Auth (email one-time code), when a backend is configured.
   * `sendSignInCode` emails the code; `verifySignInCode` confirms it and,
   * on success, replaces the local mock session with the real account's.
   */
  sendSignInCode: (email: string, displayName: string) => Promise<{ ok: true } | { ok: false; error: string }>;
  verifySignInCode: (email: string, code: string) => Promise<{ ok: true } | { ok: false; error: string }>;
  /**
   * Google sign-in — a second real path onto the same account model, not a
   * separate flow. There is no "sign up with Google" distinct from "sign in
   * with Google": the first successful call for a given Google account is
   * what creates it, same as the email code's first-ever verification does.
   */
  signInWithGoogle: () => Promise<{ ok: true } | { ok: false; error: string }>;
  /**
   * Set when the user tapped the magic-link email and Supabase's redirect
   * carried an error (expired or already-used link) instead of a session —
   * read by app/auth/callback.tsx, the screen that redirect lands on.
   */
  authCallbackError: string | null;
  verifyAge: () => void;
  /** Returns 'ok' | 'soft_wall' | 'hard_wall'. */
  attemptContribution: () => 'ok' | 'soft_wall';
  canBook: boolean;

  /** F-BIZ-01/07: venues this account holds a business role at. */
  managedVenueIds: string[];
  isManagingVenue: (venueId: string) => boolean;
  /** Optimistic: reflects a just-succeeded claim before the next refetch. */
  addManagedVenue: (venueId: string) => void;

  /** F-TRUST: platform roles this account holds. No self-serve path — see
   * getPlatformRoles' own comment for why. */
  platformRoles: PlatformRole[];
  isModerator: boolean;
  isTrustSafety: boolean;
  /** F-BIZ-01: decides pending venue claims. See 20260828100000_add_admin_platform_role.sql. */
  isAdmin: boolean;

  filters: FilterState;
  setFilters: (f: FilterState) => void;
  resetFilters: () => void;

  recentSearches: string[];
  pushRecentSearch: (q: string) => void;

  collections: Collection[];
  isSaved: (venueId: string) => boolean;
  toggleSave: (venueId: string, collectionId?: string) => void;
  createCollection: (name: string, venueId?: string) => Collection;
  removeFromCollection: (collectionId: string, venueId: string) => void;
  deleteCollection: (collectionId: string) => void;
  /** F-SOCIAL-04: invite/remove a contributor. Inviting also flips `shared` on. */
  inviteCollaborator: (collectionId: string, memberId: string) => void;
  removeCollaborator: (collectionId: string, memberId: string) => void;

  /** F-SOCIAL-02: following a person or a venue. */
  followedMemberIds: string[];
  followedVenueIds: string[];
  isFollowingMember: (memberId: string) => boolean;
  toggleFollowMember: (memberId: string) => void;
  isFollowingVenue: (venueId: string) => boolean;
  toggleFollowVenue: (venueId: string) => void;

  /** F-SOCIAL-05: the signed-in device's own check-ins. */
  checkIns: CheckIn[];
  addCheckIn: (venueId: string, visibility: CheckInVisibility, note?: string) => CheckIn;

  bookings: Booking[];
  addBooking: (b: Booking) => void;
  cancelBooking: (id: string) => void;

  /**
   * F-MSG. `startThread` returns the new thread's id once it exists, whether
   * that id came from the database or, offline, from this device — the
   * caller does not need to know which. `sendThreadMessage` returns an error
   * string rather than throwing, the same shape as the repository writes,
   * so the composer can show *why* a send failed (blocked thread, sending
   * too fast) instead of a generic failure.
   */
  threads: MessageThread[];
  startThread: (venueId: string, kind: MessageThreadKind, subject?: string) => Promise<string>;
  /**
   * `intake` is applied atomically with the message, in the same state
   * update. Setting it in a separate call right before this one is a trap:
   * both would close over the same pre-update `threads` snapshot, and
   * whichever write lands second would silently discard the other's change.
   */
  sendThreadMessage: (
    threadId: string,
    text: string,
    intake?: QuoteIntake,
  ) => { ok: true } | { ok: false; error: string };
  blockThread: (threadId: string) => void;
  /** F-MSG-02: pulls fresh messages for a thread (a business reply otherwise
   * never appears). Fetch-on-open, not realtime — see repository.getThreadMessages. */
  refreshThread: (threadId: string) => Promise<void>;

  drafts: Record<string, ReviewDraft>;
  saveDraft: (d: ReviewDraft) => void;
  clearDraft: (venueId: string) => void;

  prefs: Preferences;
  setPrefs: (p: Preferences) => void;

  /** "Now" for the whole app, overridable so Tonight Mode can be demonstrated. */
  now: Date;
  clockOverride: number | null;
  setClockOverride: (hour: number | null) => void;
};

const AppContext = createContext<Ctx | null>(null);

// The second collection's "quietpart" entry is attributed to Dana R. (a
// roster community member, not "you") on purpose — it demonstrates the
// F-SOCIAL-04 attribution model with a contribution that predates this
// session, which a brand-new local-only collection could otherwise never show.
const DEFAULT_COLLECTIONS: Collection[] = [
  {
    id: 'c-1',
    name: 'Cigar spots in Houston',
    entries: [
      { venueId: 'ashenoak', addedBy: 'you', addedAt: '2026-08-10T12:00:00Z' },
      { venueId: 'bayouleaf', addedBy: 'you', addedAt: '2026-08-10T12:05:00Z' },
    ],
    shared: false,
    collaboratorIds: [],
  },
  {
    id: 'c-2',
    name: 'Anniversary dinner shortlist',
    entries: [
      { venueId: 'vela', addedBy: 'you', addedAt: '2026-08-05T12:00:00Z' },
      { venueId: 'quietpart', addedBy: 'cm-dana', addedAt: '2026-08-06T09:30:00Z' },
    ],
    shared: true,
    collaboratorIds: ['cm-dana'],
  },
];

export function AppProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [ready, setReady] = useState(false);

  const [themeSetting, setThemeSettingState] = useState<ThemeSetting>('system');
  const [session, setSession] = useState<Session>(defaultSession);
  const [filters, setFiltersState] = useState<FilterState>(emptyFilters);
  const [recentSearches, setRecent] = useState<string[]>([]);
  const [collections, setCollections] = useState<Collection[]>(DEFAULT_COLLECTIONS);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [threads, setThreads] = useState<MessageThread[]>([]);
  const [follows, setFollows] = useState<Follows>(defaultFollows);
  const [checkIns, setCheckIns] = useState<CheckIn[]>([]);
  const [drafts, setDrafts] = useState<Record<string, ReviewDraft>>({});
  const [prefs, setPrefsState] = useState<Preferences>(defaultPrefs);
  const [clockOverride, setClockOverrideState] = useState<number | null>(null);
  const [managedVenueIds, setManagedVenueIds] = useState<string[]>([]);
  const [platformRoles, setPlatformRoles] = useState<PlatformRole[]>([]);
  const [authCallbackError, setAuthCallbackError] = useState<string | null>(null);

  const persist = useCallback((key: string, value: unknown) => {
    AsyncStorage.setItem(key, JSON.stringify(value)).catch(() => {
      /* Offline writes are best-effort; the in-memory copy is authoritative. */
    });
  }, []);

  /* ------------------------------------------------------------- session */
  const updateSession = useCallback(
    (patch: Partial<Session>) => {
      setSession((prev) => {
        const next = { ...prev, ...patch };
        persist(KEYS.session, next);
        return next;
      });
    },
    [persist],
  );

  /** Replaces the local mock session with a real account's, once signed in for real. */
  const applyAuthProfile = useCallback(
    (profile: AuthProfile) => {
      updateSession({
        role: profile.phoneVerified && profile.ageVerified ? 'verified' : 'registered',
        name: profile.displayName,
        phoneVerified: profile.phoneVerified,
        ageVerified: profile.ageVerified,
        contributionAttempts: 0,
      });
    },
    [updateSession],
  );

  /* ------------------------------------------------------------- hydrate */
  useEffect(() => {
    (async () => {
      try {
        const pairs = await AsyncStorage.multiGet(Object.values(KEYS));
        const map = Object.fromEntries(pairs);
        const read = <T,>(key: string, fallback: T): T => {
          const raw = map[key];
          if (!raw) return fallback;
          try {
            return JSON.parse(raw) as T;
          } catch {
            return fallback;
          }
        };
        setThemeSettingState(read<ThemeSetting>(KEYS.theme, 'system'));
        setSession(read<Session>(KEYS.session, defaultSession));
        // Collections gained `entries`/`collaboratorIds` in place of a bare
        // `venueIds` array. A collection persisted before that change reads
        // back with no `entries` at all, so it is migrated in place rather
        // than left to crash the first time something calls `.map` on it.
        const rawCollections = read<(Collection & { venueIds?: string[] })[]>(
          KEYS.collections,
          DEFAULT_COLLECTIONS,
        );
        setCollections(
          rawCollections.map((c) =>
            c.entries
              ? c
              : {
                  ...c,
                  entries: (c.venueIds ?? []).map((venueId) => ({
                    venueId,
                    addedBy: 'you',
                    addedAt: new Date(0).toISOString(),
                  })),
                  collaboratorIds: c.collaboratorIds ?? [],
                },
          ),
        );
        setBookings(read<Booking[]>(KEYS.bookings, []));
        setThreads(read<MessageThread[]>(KEYS.threads, []));
        setFollows(read<Follows>(KEYS.follows, defaultFollows));
        setCheckIns(read<CheckIn[]>(KEYS.checkins, []));
        setDrafts(read<Record<string, ReviewDraft>>(KEYS.drafts, {}));
        setPrefsState(read<Preferences>(KEYS.prefs, defaultPrefs));
        setRecent(read<string[]>(KEYS.recent, []));

        // Reconcile against the real Supabase Auth session, if a backend is
        // configured. A locally-remembered "registered"/"verified" role from
        // before this device had a real account (or from a session that has
        // since expired) is not carried forward — it was never real.
        if (hasBackend) {
          const snapshot = await getAuthSnapshot();
          if (snapshot) {
            applyAuthProfile(snapshot);
            setManagedVenueIds(await getManagedVenueIds());
            setPlatformRoles(await getPlatformRoles());
          } else {
            setSession(defaultSession);
            persist(KEYS.session, defaultSession);
          }
        }
      } finally {
        setReady(true);
      }
    })();
  }, []);

  /** Real sign-out this device did not initiate — an expired or revoked session. */
  useEffect(() => {
    if (!hasBackend) return;
    return onAuthSignedOut(() => {
      setSession(defaultSession);
      persist(KEYS.session, defaultSession);
      setManagedVenueIds([]);
      setPlatformRoles([]);
    });
  }, [persist]);

  /**
   * Finishes sign-in for the user who tapped the magic-link email instead of
   * typing the 6-digit code. Unlike Google sign-in (which captures its own
   * redirect by opening the browser itself), this URL arrives as a genuine
   * OS deep link — a cold start via `getInitialURL`, or a foreground/
   * background app via the `url` event — so every incoming URL is handed to
   * `completeAuthFromUrl` unconditionally; it no-ops for anything that is not
   * actually this callback. app/auth/callback.tsx is the screen expo-router
   * lands on for `nightout://auth/callback` and reads `authCallbackError`
   * while this resolves.
   */
  useEffect(() => {
    if (!hasBackend) return;
    const handle = async (url: string) => {
      const result = await completeAuthFromUrl(url);
      if (!result) return;
      if (!result.ok) {
        setAuthCallbackError(result.error);
        return;
      }
      setAuthCallbackError(null);
      applyAuthProfile(result.profile);
      getManagedVenueIds().then(setManagedVenueIds).catch(() => {});
      getPlatformRoles().then(setPlatformRoles).catch(() => {});
    };
    Linking.getInitialURL().then((url) => {
      if (url) handle(url);
    });
    const sub = Linking.addEventListener('url', ({ url }) => handle(url));
    return () => sub.remove();
  }, [applyAuthProfile]);

  /* --------------------------------------------------------------- clock */
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  const now = useMemo(() => {
    void tick;
    const d = new Date();
    if (clockOverride != null) {
      d.setHours(clockOverride, clockOverride === 0 ? 30 : 15, 0, 0);
    }
    return d;
  }, [clockOverride, tick]);

  /* --------------------------------------------------------------- theme */
  const resolvedMode: ThemeMode =
    themeSetting === 'system' ? (systemScheme === 'dark' ? 'dark' : 'light') : themeSetting;
  const theme = resolvedMode === 'dark' ? darkTheme : lightTheme;

  const setThemeSetting = useCallback(
    (t: ThemeSetting) => {
      setThemeSettingState(t);
      persist(KEYS.theme, t);
    },
    [persist],
  );

  const signIn = useCallback(
    (name: string) => updateSession({ role: 'registered', name, contributionAttempts: 0 }),
    [updateSession],
  );

  const sendSignInCode = useCallback(
    (email: string, displayName: string) => sendSignInCodeRemote({ email, displayName }),
    [],
  );

  const verifySignInCode = useCallback(
    async (email: string, code: string): Promise<{ ok: true } | { ok: false; error: string }> => {
      const result = await verifySignInCodeRemote({ email, code });
      if (!result.ok) return result;
      applyAuthProfile(result.profile);
      getManagedVenueIds().then(setManagedVenueIds).catch(() => {});
      getPlatformRoles().then(setPlatformRoles).catch(() => {});
      return { ok: true };
    },
    [applyAuthProfile],
  );

  const signInWithGoogle = useCallback(async (): Promise<{ ok: true } | { ok: false; error: string }> => {
    const result = await signInWithGoogleRemote();
    if (!result.ok) return result;
    applyAuthProfile(result.profile);
    getManagedVenueIds().then(setManagedVenueIds).catch(() => {});
    getPlatformRoles().then(setPlatformRoles).catch(() => {});
    return { ok: true };
  }, [applyAuthProfile]);

  const signOut = useCallback(() => {
    setSession(defaultSession);
    persist(KEYS.session, defaultSession);
    setManagedVenueIds([]);
    setPlatformRoles([]);
    if (hasBackend) signOutRemote().catch(() => {});
  }, [persist]);

  const isManagingVenue = useCallback(
    (venueId: string) => managedVenueIds.includes(venueId),
    [managedVenueIds],
  );

  const addManagedVenue = useCallback(
    (venueId: string) => setManagedVenueIds((prev) => (prev.includes(venueId) ? prev : [...prev, venueId])),
    [],
  );

  const verifyAge = useCallback(
    () => updateSession({ ageVerified: true, phoneVerified: true, role: 'verified' }),
    [updateSession],
  );

  const attemptContribution = useCallback((): 'ok' | 'soft_wall' => {
    if (session.role !== 'guest') return 'ok';
    const next = session.contributionAttempts + 1;
    updateSession({ contributionAttempts: next });
    return next >= 3 ? 'soft_wall' : 'ok';
  }, [session.contributionAttempts, session.role, updateSession]);

  /* ------------------------------------------------------------- filters */
  const setFilters = useCallback((f: FilterState) => setFiltersState(f), []);
  const resetFilters = useCallback(() => setFiltersState(emptyFilters), []);

  const pushRecentSearch = useCallback(
    (q: string) => {
      const t = q.trim();
      if (!t) return;
      setRecent((prev) => {
        const next = [t, ...prev.filter((x) => x.toLowerCase() !== t.toLowerCase())].slice(0, 8);
        persist(KEYS.recent, next);
        return next;
      });
    },
    [persist],
  );

  /* --------------------------------------------------------- collections */
  const writeCollections = useCallback(
    (next: Collection[]) => {
      setCollections(next);
      persist(KEYS.collections, next);
    },
    [persist],
  );

  const isSaved = useCallback(
    (venueId: string) => collections.some((c) => c.entries.some((e) => e.venueId === venueId)),
    [collections],
  );

  const toggleSave = useCallback(
    (venueId: string, collectionId?: string) => {
      const target = collectionId ?? collections[0]?.id;
      if (!target) return;
      const already = collections.some((c) => c.entries.some((e) => e.venueId === venueId));
      const next = collections.map((c) => {
        if (already) return { ...c, entries: c.entries.filter((e) => e.venueId !== venueId) };
        if (c.id !== target || c.entries.some((e) => e.venueId === venueId)) return c;
        const entry = { venueId, addedBy: 'you', addedAt: new Date().toISOString() };
        return { ...c, entries: [entry, ...c.entries] };
      });
      writeCollections(next);
    },
    [collections, writeCollections],
  );

  const createCollection = useCallback(
    (name: string, venueId?: string) => {
      const c: Collection = {
        id: `c-${Date.now()}`,
        name: name.trim() || 'New collection',
        entries: venueId ? [{ venueId, addedBy: 'you', addedAt: new Date().toISOString() }] : [],
        shared: false,
        collaboratorIds: [],
      };
      writeCollections([c, ...collections]);
      return c;
    },
    [collections, writeCollections],
  );

  const removeFromCollection = useCallback(
    (collectionId: string, venueId: string) =>
      writeCollections(
        collections.map((c) =>
          c.id === collectionId ? { ...c, entries: c.entries.filter((e) => e.venueId !== venueId) } : c,
        ),
      ),
    [collections, writeCollections],
  );

  const deleteCollection = useCallback(
    (collectionId: string) => writeCollections(collections.filter((c) => c.id !== collectionId)),
    [collections, writeCollections],
  );

  /** F-SOCIAL-04: inviting a contributor also flips `shared` on — a
   * collection with a collaborator is definitionally no longer private-only. */
  const inviteCollaborator = useCallback(
    (collectionId: string, memberId: string) =>
      writeCollections(
        collections.map((c) =>
          c.id === collectionId && !c.collaboratorIds.includes(memberId)
            ? { ...c, collaboratorIds: [...c.collaboratorIds, memberId], shared: true }
            : c,
        ),
      ),
    [collections, writeCollections],
  );

  const removeCollaborator = useCallback(
    (collectionId: string, memberId: string) =>
      writeCollections(
        collections.map((c) =>
          c.id === collectionId
            ? { ...c, collaboratorIds: c.collaboratorIds.filter((m) => m !== memberId) }
            : c,
        ),
      ),
    [collections, writeCollections],
  );

  /* ------------------------------------------------------------ bookings */
  const addBooking = useCallback(
    (b: Booking) => {
      setBookings((prev) => {
        const next = [b, ...prev];
        persist(KEYS.bookings, next);
        return next;
      });
    },
    [persist],
  );

  /** A remote row id (uuid) versus a device-local `<prefix>-<timestamp>` fallback. */
  const isRemoteId = (id: string) => /^[0-9a-f-]{36}$/i.test(id);

  /**
   * Found missing while building the F-BIZ-11 business console: this only
   * ever updated local device state, so a venue reading the real `bookings`
   * table would see a permanently-stale status for anything its own guest
   * had "cancelled." Best-effort mirror, the same shape as sendThreadMessage
   * below — local state is already updated by the time the remote call
   * fires, and a local-only booking (no backend, or the pre-fix local id
   * shape) has nothing real to cancel remotely anyway.
   */
  const cancelBooking = useCallback(
    (id: string) => {
      setBookings((prev) => {
        const next = prev.map((b) => (b.id === id ? { ...b, status: 'cancelled' as const } : b));
        persist(KEYS.bookings, next);
        return next;
      });
      if (isRemoteId(id)) {
        cancelBookingRemote(id).catch(() => {
          /* Best-effort mirror. The cancellation already lives on this device. */
        });
      }
    },
    [persist],
  );

  /* -------------------------------------------------------------- threads */
  const writeThreads = useCallback(
    (next: MessageThread[]) => {
      setThreads(next);
      persist(KEYS.threads, next);
    },
    [persist],
  );

  const startThread = useCallback(
    async (venueId: string, kind: MessageThreadKind, subject?: string): Promise<string> => {
      const existing = threads.find(
        (t) => t.venueId === venueId && t.kind === kind && !t.blocked,
      );
      if (existing) return existing.id;

      const created = await createMessageThread({ venueId, kind, subject });
      const id = created.ok ? created.id : `t-${Date.now()}`;
      const nowIso = new Date().toISOString();
      const thread: MessageThread = {
        id,
        venueId,
        kind,
        subject,
        blocked: false,
        createdAt: nowIso,
        lastMessageAt: nowIso,
        messages: [],
      };
      writeThreads([thread, ...threads]);
      return id;
    },
    [threads, writeThreads],
  );

  /**
   * F-MSG-04 / NFR-11: the same 5-second-per-thread rate limit the database
   * trigger enforces, checked here first so the composer can explain the
   * rejection immediately rather than waiting on a round trip. The database
   * remains the actual control — this is the courtesy copy of it.
   *
   * `intake` is folded into the same `writeThreads` call as the message,
   * not written by a preceding call — two sequential provider calls in one
   * event handler would each close over the same pre-update `threads`, and
   * the second write would silently overwrite the first's change with stale
   * data. One call, one derived array, no lost update.
   */
  const sendThreadMessage = useCallback(
    (threadId: string, text: string, intake?: QuoteIntake): { ok: true } | { ok: false; error: string } => {
      const thread = threads.find((t) => t.id === threadId);
      if (!thread) return { ok: false, error: 'This conversation no longer exists.' };
      if (thread.blocked) return { ok: false, error: 'This conversation is blocked and cannot receive new messages.' };
      const trimmed = text.trim();
      if (!trimmed) return { ok: false, error: 'Write something first.' };
      if (thread.messages.length && Date.now() - new Date(thread.lastMessageAt).getTime() < 5_000) {
        return { ok: false, error: 'Sending too quickly. Wait a moment before the next message.' };
      }

      const nowIso = new Date().toISOString();
      const message: Message = { id: `m-${Date.now()}`, sender: 'user', text: trimmed, createdAt: nowIso };
      writeThreads(
        threads.map((t) =>
          t.id === threadId
            ? { ...t, ...(intake ? { intake } : null), messages: [...t.messages, message], lastMessageAt: nowIso }
            : t,
        ),
      );

      if (isRemoteId(threadId)) {
        sendMessageRemote({ threadId, text: trimmed }).catch(() => {
          /* Best-effort mirror. The message already lives on this device. */
        });
      }
      return { ok: true };
    },
    [threads, writeThreads],
  );

  const blockThread = useCallback(
    (threadId: string) => writeThreads(threads.map((t) => (t.id === threadId ? { ...t, blocked: true } : t))),
    [threads, writeThreads],
  );

  /**
   * F-MSG-02: pulls fresh messages for one thread from the backend and
   * replaces the local copy with them. Before a business account could
   * reply, this thread screen had nothing else to fetch — the thread's own
   * creation was the only server round trip that ever happened, so trusting
   * local state forever was reasonable. It stops being reasonable the
   * moment a business can write into the same thread: server truth is what
   * this replaces local state with, not a merge, so a message sent this
   * session (still on its local `m-<timestamp>` id) is safely overwritten
   * with the server's real row rather than risking a duplicate. Deliberately
   * fetch-on-open, not a realtime subscription — see the migration header on
   * 20260827090000_add_business_messaging.sql for why.
   */
  const refreshThread = useCallback(
    async (threadId: string) => {
      if (!isRemoteId(threadId)) return;
      const messages = await getThreadMessages(threadId);
      if (!messages.length) return;
      writeThreads(
        threads.map((t) =>
          t.id === threadId
            ? { ...t, messages, lastMessageAt: messages[messages.length - 1].createdAt }
            : t,
        ),
      );
    },
    [threads, writeThreads],
  );

  /* -------------------------------------------------------------- follows */
  const writeFollows = useCallback(
    (next: Follows) => {
      setFollows(next);
      persist(KEYS.follows, next);
    },
    [persist],
  );

  const isFollowingMember = useCallback(
    (memberId: string) => follows.memberIds.includes(memberId),
    [follows],
  );

  const toggleFollowMember = useCallback(
    (memberId: string) => {
      writeFollows({
        ...follows,
        memberIds: follows.memberIds.includes(memberId)
          ? follows.memberIds.filter((m) => m !== memberId)
          : [...follows.memberIds, memberId],
      });
    },
    [follows, writeFollows],
  );

  const isFollowingVenue = useCallback(
    (venueId: string) => follows.venueIds.includes(venueId),
    [follows],
  );

  const toggleFollowVenue = useCallback(
    (venueId: string) => {
      writeFollows({
        ...follows,
        venueIds: follows.venueIds.includes(venueId)
          ? follows.venueIds.filter((v) => v !== venueId)
          : [...follows.venueIds, venueId],
      });
    },
    [follows, writeFollows],
  );

  /* ------------------------------------------------------------ check-ins */
  const addCheckIn = useCallback(
    (venueId: string, visibility: CheckInVisibility, note?: string): CheckIn => {
      const checkIn: CheckIn = { id: `ci-${Date.now()}`, venueId, date: new Date().toISOString(), visibility, note };
      setCheckIns((prev) => {
        const next = [checkIn, ...prev];
        persist(KEYS.checkins, next);
        return next;
      });
      return checkIn;
    },
    [persist],
  );

  /* -------------------------------------------------------------- drafts */
  const saveDraft = useCallback(
    (d: ReviewDraft) => {
      setDrafts((prev) => {
        const next = { ...prev, [d.venueId]: d };
        persist(KEYS.drafts, next);
        return next;
      });
    },
    [persist],
  );

  const clearDraft = useCallback(
    (venueId: string) => {
      setDrafts((prev) => {
        const next = { ...prev };
        delete next[venueId];
        persist(KEYS.drafts, next);
        return next;
      });
    },
    [persist],
  );

  const setPrefs = useCallback(
    (p: Preferences) => {
      setPrefsState(p);
      persist(KEYS.prefs, p);
    },
    [persist],
  );

  const value: Ctx = useMemo(
    () => ({
      ready,
      theme,
      themeSetting,
      setThemeSetting,
      session,
      signIn,
      signOut,
      sendSignInCode,
      verifySignInCode,
      signInWithGoogle,
      authCallbackError,
      verifyAge,
      attemptContribution,
      canBook: session.role === 'verified' || session.role === 'elite',
      managedVenueIds,
      isManagingVenue,
      addManagedVenue,
      platformRoles,
      isModerator: platformRoles.includes('moderator'),
      isTrustSafety: platformRoles.includes('trust_safety'),
      isAdmin: platformRoles.includes('admin'),
      filters,
      setFilters,
      resetFilters,
      recentSearches,
      pushRecentSearch,
      collections,
      isSaved,
      toggleSave,
      createCollection,
      removeFromCollection,
      deleteCollection,
      inviteCollaborator,
      removeCollaborator,
      followedMemberIds: follows.memberIds,
      followedVenueIds: follows.venueIds,
      isFollowingMember,
      toggleFollowMember,
      isFollowingVenue,
      toggleFollowVenue,
      checkIns,
      addCheckIn,
      bookings,
      addBooking,
      cancelBooking,
      threads,
      startThread,
      sendThreadMessage,
      blockThread,
      refreshThread,
      drafts,
      saveDraft,
      clearDraft,
      prefs,
      setPrefs,
      now,
      clockOverride,
      setClockOverride: setClockOverrideState,
    }),
    [
      ready, theme, themeSetting, setThemeSetting, session, signIn, signOut, sendSignInCode,
      verifySignInCode, signInWithGoogle, authCallbackError, verifyAge, attemptContribution, managedVenueIds, isManagingVenue,
      addManagedVenue, platformRoles, filters, setFilters, resetFilters, recentSearches,
      pushRecentSearch, collections, isSaved, toggleSave, createCollection,
      removeFromCollection, deleteCollection, inviteCollaborator, removeCollaborator,
      follows, isFollowingMember, toggleFollowMember, isFollowingVenue, toggleFollowVenue,
      checkIns, addCheckIn, bookings, addBooking, cancelBooking,
      threads, startThread, sendThreadMessage, blockThread, refreshThread, drafts,
      saveDraft, clearDraft, prefs, setPrefs, now, clockOverride,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): Ctx {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}

export function useTheme(): Theme {
  return useApp().theme;
}
