/**
 * Database types.
 *
 * Hand-authored, then diffed against `supabase gen types` output taken from the
 * live project after the migrations were applied: every column, nullability,
 * and enum member matched, so these are accurate rather than aspirational.
 *
 * Regenerate mechanically rather than by hand whenever the schema changes:
 *
 *   npm run db:types
 *
 * Generated output is authoritative. If this file and the database disagree,
 * this file is the one that is wrong.
 *
 * One deliberate difference from the generated output: `Relationships` is `[]`
 * on every table here, where the generator emits the real foreign keys. That
 * only types PostgREST's embedded joins (`.select('*, venues(*)')`), which this
 * app does not use — it fetches whole tables and joins on the device. Running
 * db:types fills them in.
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type VerticalEnum = 'dining' | 'bar' | 'lounge' | 'cigar' | 'nightclub';
export type ProvenanceEnum = 'owner' | 'community' | 'provider' | 'operator_verified';
export type BookingModeEnum =
  | 'reservation' | 'table_service' | 'waitlist' | 'bar_hold' | 'inquiry' | 'walk_in';
export type BookingStatusEnum = 'confirmed' | 'requested' | 'waitlisted' | 'cancelled';
export type ClosureStateEnum = 'temporary' | 'permanent' | 'moved' | 'seasonal';
export type MessageThreadKindEnum = 'general' | 'quote_request';
export type PhotoAlbumEnum =
  | 'food' | 'drink' | 'interior' | 'exterior' | 'menu' | 'crowd' | 'humidor' | 'stage' | 'table';
export type PhotoCreditEnum = 'owner' | 'community';
export type BusinessRoleEnum = 'owner' | 'manager' | 'staff' | 'group_admin';

export type VenueRow = {
  id: string;
  name: string;
  alternate_names: string[];
  primary_vertical: VerticalEnum;
  primary_category: string;
  secondary: Json;
  price_tier: number;
  neighborhood: string;
  address: string;
  lat: number | null;
  lng: number | null;
  map_x: number | null;
  map_y: number | null;
  phone: string | null;
  website: string | null;
  rating: number;
  review_count: number;
  claimed: boolean;
  verified: boolean;
  opened_year: number | null;
  closure_state: ClosureStateEnum | null;
  closure_note: string | null;
  closure_successor_id: string | null;
  consumer_alert: string | null;
  promoted: boolean;
  tagline: string | null;
  about: string | null;
  attributes: Json;
  attribute_meta: Json;
  default_source: ProvenanceEnum;
  default_updated_at: string;
  schedules: Json;
  happy_hours: Json;
  photos: Json;
  menus: Json;
  qa: Json;
  sub_rating_averages: Json;
  busyness: Json;
  booking_modes: BookingModeEnum[];
  booking_terms: string | null;
  /** F-MSG-01: published response-time metric, shown on the profile and composer. */
  avg_response_minutes: number | null;
  search_text: string | null;
  created_at: string;
  updated_at: string;
};

export type TableTierRow = {
  id: string;
  venue_id: string;
  name: string;
  section: string;
  minimum_spend: number;
  seats: number;
  x: number;
  y: number;
  available: boolean;
};

export type EventRow = {
  id: string;
  venue_id: string;
  title: string;
  recurring: boolean;
  weekday: number | null;
  event_date: string | null;
  start_time: string;
  end_time: string;
  genre: string | null;
  lineup: string[];
  cover: number | null;
  age_policy: string | null;
  description: string | null;
  ticket_url: string | null;
  created_at: string;
};

export type ReviewRow = {
  id: string;
  seed_key: string | null;
  venue_id: string;
  author_id: string | null;
  author_name: string;
  author_trust: number;
  elite: boolean;
  rating: number;
  sub_ratings: Json;
  body: string;
  visited_on: string | null;
  created_at: string;
  edited: boolean;
  helpful: number;
  insightful: number;
  funny: number;
  tags: Json;
  photo_count: number;
  comped: boolean;
  recommended: boolean;
  owner_response: string | null;
  owner_response_at: string | null;
};

export type BookingRow = {
  id: string;
  user_id: string;
  venue_id: string;
  kind: BookingModeEnum;
  booking_date: string;
  booking_time: string;
  party_size: number;
  tier: string | null;
  deposit: number | null;
  status: BookingStatusEnum;
  notes: string | null;
  waitlist_position: number | null;
  wait_minutes: number | null;
  terms_accepted_at: string | null;
  terms_text: string | null;
  created_at: string;
};

export type CollectionRow = {
  id: string;
  user_id: string;
  name: string;
  shared: boolean;
  created_at: string;
};

export type CollectionVenueRow = {
  collection_id: string;
  venue_id: string;
  added_at: string;
};

export type ProfileRow = {
  id: string;
  display_name: string;
  phone_verified: boolean;
  age_verified: boolean;
  elite: boolean;
  trust: number;
  visibility: 'public' | 'followers' | 'private';
  preferences: Json;
  created_at: string;
};

export type ReviewDraftRow = {
  user_id: string;
  venue_id: string;
  rating: number | null;
  sub_ratings: Json;
  body: string | null;
  tags: Json;
  photo_count: number;
  saved_at: string;
};

export type MessageThreadRow = {
  id: string;
  user_id: string;
  venue_id: string;
  kind: MessageThreadKindEnum;
  subject: string | null;
  intake: Json;
  blocked: boolean;
  created_at: string;
  last_message_at: string;
};

/** `sender` is DB-constrained to 'user' — see the messaging migration header. */
export type MessageRow = {
  id: string;
  thread_id: string;
  sender: 'user';
  body: string;
  created_at: string;
};

export type PhotoRow = {
  id: string;
  venue_id: string;
  uploaded_by: string;
  album: PhotoAlbumEnum;
  caption: string | null;
  /** Trigger-filled when blank — never required from the client. */
  alt: string | null;
  storage_path: string;
  /** Server-computed from business_roles; never trusted from the client. */
  by: PhotoCreditEnum;
  removal_requested: boolean;
  created_at: string;
};

export type PhotoRemovalRequestRow = {
  id: string;
  photo_id: string;
  requested_by: string;
  reason: string;
  created_at: string;
};

/** Insert shapes: server-defaulted and server-maintained columns are omitted. */
type Insertable<T, Optional extends keyof T> = Omit<T, Optional> & Partial<Pick<T, Optional>>;

export type Database = {
  public: {
    Tables: {
      venues: {
        Row: VenueRow;
        Insert: Insertable<VenueRow, 'created_at' | 'updated_at' | 'search_text'>;
        Update: Partial<VenueRow>;
        Relationships: [];
      };
      venue_categories: {
        Row: { venue_id: string; vertical: VerticalEnum; category: string; is_primary: boolean };
        Insert: { venue_id: string; vertical: VerticalEnum; category: string; is_primary?: boolean };
        Update: Partial<{ venue_id: string; vertical: VerticalEnum; category: string; is_primary: boolean }>;
        Relationships: [];
      };
      table_tiers: {
        Row: TableTierRow;
        Insert: TableTierRow;
        Update: Partial<TableTierRow>;
        Relationships: [];
      };
      events: {
        Row: EventRow;
        Insert: Insertable<EventRow, 'created_at' | 'lineup'>;
        Update: Partial<EventRow>;
        Relationships: [];
      };
      reviews: {
        Row: ReviewRow;
        Insert: Insertable<
          ReviewRow,
          | 'id' | 'seed_key' | 'created_at' | 'edited' | 'helpful' | 'insightful' | 'funny'
          | 'recommended' | 'owner_response' | 'owner_response_at' | 'author_trust' | 'elite'
          | 'photo_count' | 'comped' | 'visited_on' | 'sub_ratings' | 'tags'
        >;
        Update: Partial<ReviewRow>;
        Relationships: [];
      };
      bookings: {
        Row: BookingRow;
        Insert: Insertable<BookingRow, 'id' | 'created_at' | 'status'>;
        Update: Partial<BookingRow>;
        Relationships: [];
      };
      collections: {
        Row: CollectionRow;
        Insert: Insertable<CollectionRow, 'id' | 'created_at' | 'shared'>;
        Update: Partial<CollectionRow>;
        Relationships: [];
      };
      collection_venues: {
        Row: CollectionVenueRow;
        Insert: Insertable<CollectionVenueRow, 'added_at'>;
        Update: Partial<CollectionVenueRow>;
        Relationships: [];
      };
      profiles: {
        Row: ProfileRow;
        Insert: Insertable<
          ProfileRow,
          'created_at' | 'phone_verified' | 'age_verified' | 'elite' | 'trust' | 'visibility' | 'preferences'
        >;
        Update: Partial<ProfileRow>;
        Relationships: [];
      };
      review_drafts: {
        Row: ReviewDraftRow;
        Insert: Insertable<ReviewDraftRow, 'saved_at' | 'sub_ratings' | 'tags' | 'photo_count'>;
        Update: Partial<ReviewDraftRow>;
        Relationships: [];
      };
      business_roles: {
        Row: { user_id: string; venue_id: string; role: BusinessRoleEnum; created_at: string };
        Insert: { user_id: string; venue_id: string; role: BusinessRoleEnum; created_at?: string };
        Update: Partial<{ user_id: string; venue_id: string; role: BusinessRoleEnum }>;
        Relationships: [];
      };
      message_threads: {
        Row: MessageThreadRow;
        Insert: Insertable<
          MessageThreadRow,
          'id' | 'kind' | 'subject' | 'intake' | 'blocked' | 'created_at' | 'last_message_at'
        >;
        Update: Partial<MessageThreadRow>;
        Relationships: [];
      };
      messages: {
        Row: MessageRow;
        Insert: Insertable<MessageRow, 'id' | 'sender' | 'created_at'>;
        Update: Partial<MessageRow>;
        Relationships: [];
      };
      photos: {
        Row: PhotoRow;
        Insert: Insertable<PhotoRow, 'id' | 'alt' | 'by' | 'removal_requested' | 'created_at'>;
        Update: Partial<PhotoRow>;
        Relationships: [];
      };
      photo_removal_requests: {
        Row: PhotoRemovalRequestRow;
        Insert: Insertable<PhotoRemovalRequestRow, 'id' | 'created_at'>;
        Update: Partial<PhotoRemovalRequestRow>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      vertical: VerticalEnum;
      provenance: ProvenanceEnum;
      booking_mode: BookingModeEnum;
      booking_status: BookingStatusEnum;
      closure_state: ClosureStateEnum;
      message_thread_kind: MessageThreadKindEnum;
      photo_album: PhotoAlbumEnum;
      photo_credit: PhotoCreditEnum;
    };
    CompositeTypes: Record<string, never>;
  };
};
