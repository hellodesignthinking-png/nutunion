export type Specialty = "space" | "culture" | "platform" | "vibe";
export type MemberRole = "member" | "admin";
export type GroupMemberRole = "host" | "member";
export type GroupMemberStatus = "active" | "pending" | "waitlist";
export type AttendeeStatus = "registered" | "waitlist" | "cancelled" | "attended";
export type BookingStatus = "confirmed" | "pending" | "cancelled";
export type FieldType = "text" | "html" | "image" | "json";

export interface Profile {
  id: string;
  name: string;
  nickname: string | null;
  email: string;
  specialty: Specialty | null;
  avatar_url: string | null;
  role: MemberRole;
  created_at: string;
}

export interface Group {
  id: string;
  name: string;
  category: string;
  description: string | null;
  host_id: string;
  max_members: number;
  image_url: string | null;
  is_active: boolean;
  created_at: string;
  member_count?: number;
  host?: Profile;
}

export interface GroupMember {
  group_id: string;
  user_id: string;
  role: GroupMemberRole;
  status: GroupMemberStatus;
  joined_at: string;
  profile?: Profile;
}

export interface Event {
  id: string;
  group_id: string;
  title: string;
  description: string | null;
  location: string | null;
  start_at: string;
  end_at: string;
  max_attendees: number | null;
  is_recurring: boolean;
  recurrence_rule: string | null;
  parent_event_id: string | null;
  created_by: string;
  created_at: string;
  attendee_count?: number;
  group?: Group;
}

export interface EventAttendee {
  event_id: string;
  user_id: string;
  status: AttendeeStatus;
  registered_at: string;
  profile?: Profile;
}

export interface Venue {
  id: string;
  name: string;
  description: string | null;
  capacity: number;
  location: string;
  image_url: string | null;
  is_active: boolean;
}

export interface Booking {
  id: string;
  venue_id: string;
  event_id: string | null;
  booked_by: string;
  start_at: string;
  end_at: string;
  status: BookingStatus;
  created_at: string;
  venue?: Venue;
}

export interface PageContent {
  id: string;
  page: string;
  section: string;
  field_key: string;
  field_value: string;
  field_type: FieldType;
  sort_order: number;
  updated_at: string;
  updated_by: string;
}

export interface Notification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string | null;
  is_read: boolean;
  metadata: Record<string, any>;
  created_at: string;
}
