import AsyncStorage from '@react-native-async-storage/async-storage';
import React, {
  createContext, useCallback, useContext, useEffect, useMemo, useState,
} from 'react';
import { useColorScheme } from 'react-native';

import { emptyFilters } from '@/lib/search';
import { darkTheme, lightTheme, type Theme, type ThemeMode } from '@/theme';
import type {
  Booking, Collection, FilterState, Preferences, ReviewDraft, SessionRole,
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
      removeFromCollection, deleteCollection, bookings, addBooking, cancelBooking, drafts,
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
