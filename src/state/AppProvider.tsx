import AsyncStorage from '@react-native-async-storage/async-storage';
import React, {
  createContext, useCallback, useContext, useEffect, useMemo, useState,
} from 'react';
import { useColorScheme } from 'react-native';

import { createMessageThread, sendMessage as sendMessageRemote } from '@/data/repository';
import { emptyFilters } from '@/lib/search';
import { darkTheme, lightTheme, type Theme, type ThemeMode } from '@/theme';
import type {
  Booking, Collection, FilterState, Message, MessageThread, MessageThreadKind, Preferences,
  QuoteIntake, ReviewDraft, SessionRole,
} from '@/types';

/**
 * Single app store. Context plus AsyncStorage rather than a state library —
 * the surface is small and the persistence requirements are specific:
 *
 *  - U-07: saved venues, recent searches, and confirmation details stay
 *    readable without connectivity, so they are written to disk, not memory.
 *  - U-09: review drafts autosave and resume across sessions.
 *  - U-10: filter state persists across the session.
 *  - U-12: the age gate is one friction point per session, not a repeated
 *    interruption, so it is session-scoped and not persisted.
 */

const KEYS = {
  session: 'nightout.session.v1',
  collections: 'nightout.collections.v1',
  bookings: 'nightout.bookings.v1',
  threads: 'nightout.threads.v1',
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
  signIn: (name: string) => void;
  signOut: () => void;
  verifyAge: () => void;
  /** Session-scoped: has the age gate been shown at all this session. */
  ageGateSeen: boolean;
  markAgeGateSeen: () => void;
  /** Returns 'ok' | 'soft_wall' | 'hard_wall'. */
  attemptContribution: () => 'ok' | 'soft_wall';
  canBook: boolean;

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

const DEFAULT_COLLECTIONS: Collection[] = [
  { id: 'c-1', name: 'Cigar spots in Houston', venueIds: ['ashenoak', 'bayouleaf'], shared: false },
  { id: 'c-2', name: 'Anniversary dinner shortlist', venueIds: ['vela', 'quietpart'], shared: true },
];

export function AppProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [ready, setReady] = useState(false);

  const [themeSetting, setThemeSettingState] = useState<ThemeSetting>('system');
  const [session, setSession] = useState<Session>(defaultSession);
  const [ageGateSeen, setAgeGateSeen] = useState(false);
  const [filters, setFiltersState] = useState<FilterState>(emptyFilters);
  const [recentSearches, setRecent] = useState<string[]>([]);
  const [collections, setCollections] = useState<Collection[]>(DEFAULT_COLLECTIONS);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [threads, setThreads] = useState<MessageThread[]>([]);
  const [drafts, setDrafts] = useState<Record<string, ReviewDraft>>({});
  const [prefs, setPrefsState] = useState<Preferences>(defaultPrefs);
  const [clockOverride, setClockOverrideState] = useState<number | null>(null);

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
        setCollections(read<Collection[]>(KEYS.collections, DEFAULT_COLLECTIONS));
        setBookings(read<Booking[]>(KEYS.bookings, []));
        setThreads(read<MessageThread[]>(KEYS.threads, []));
        setDrafts(read<Record<string, ReviewDraft>>(KEYS.drafts, {}));
        setPrefsState(read<Preferences>(KEYS.prefs, defaultPrefs));
        setRecent(read<string[]>(KEYS.recent, []));
      } finally {
        setReady(true);
      }
    })();
  }, []);

  const persist = useCallback((key: string, value: unknown) => {
    AsyncStorage.setItem(key, JSON.stringify(value)).catch(() => {
      /* Offline writes are best-effort; the in-memory copy is authoritative. */
    });
  }, []);

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

  const signIn = useCallback(
    (name: string) => updateSession({ role: 'registered', name, contributionAttempts: 0 }),
    [updateSession],
  );

  const signOut = useCallback(() => {
    setSession(defaultSession);
    persist(KEYS.session, defaultSession);
  }, [persist]);

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
    (venueId: string) => collections.some((c) => c.venueIds.includes(venueId)),
    [collections],
  );

  const toggleSave = useCallback(
    (venueId: string, collectionId?: string) => {
      const target = collectionId ?? collections[0]?.id;
      if (!target) return;
      const already = collections.some((c) => c.venueIds.includes(venueId));
      const next = collections.map((c) => {
        if (already) return { ...c, venueIds: c.venueIds.filter((v) => v !== venueId) };
        return c.id === target && !c.venueIds.includes(venueId)
          ? { ...c, venueIds: [venueId, ...c.venueIds] }
          : c;
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
        venueIds: venueId ? [venueId] : [],
        shared: false,
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
          c.id === collectionId ? { ...c, venueIds: c.venueIds.filter((v) => v !== venueId) } : c,
        ),
      ),
    [collections, writeCollections],
  );

  const deleteCollection = useCallback(
    (collectionId: string) => writeCollections(collections.filter((c) => c.id !== collectionId)),
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

  const cancelBooking = useCallback(
    (id: string) => {
      setBookings((prev) => {
        const next = prev.map((b) => (b.id === id ? { ...b, status: 'cancelled' as const } : b));
        persist(KEYS.bookings, next);
        return next;
      });
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

  /** A remote row id (uuid) versus a `t-<timestamp>` local-only fallback. */
  const isRemoteId = (id: string) => /^[0-9a-f-]{36}$/i.test(id);

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
      verifyAge,
      ageGateSeen,
      markAgeGateSeen: () => setAgeGateSeen(true),
      attemptContribution,
      canBook: session.role === 'verified' || session.role === 'elite',
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
      bookings,
      addBooking,
      cancelBooking,
      threads,
      startThread,
      sendThreadMessage,
      blockThread,
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
      ready, theme, themeSetting, setThemeSetting, session, signIn, signOut, verifyAge,
      ageGateSeen, attemptContribution, filters, setFilters, resetFilters, recentSearches,
      pushRecentSearch, collections, isSaved, toggleSave, createCollection,
      removeFromCollection, deleteCollection, bookings, addBooking, cancelBooking,
      threads, startThread, sendThreadMessage, blockThread, drafts,
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
