export type Specialty = "space" | "culture" | "platform" | "vibe";
export type MemberRole = "member" | "admin";
export type GroupMemberRole = "host" | "member" | "moderator";
export type GroupMemberStatus = "active" | "pending" | "waitlist";
export type AttendeeStatus = "registered" | "waitlist" | "cancelled" | "attended";
export type BookingStatus = "confirmed" | "pending" | "cancelled";
export type FieldType = "text" | "html" | "image" | "json" | "richtext";
export type ProjectStatus = "draft" | "active" | "completed" | "archived";
export type ProjectMemberRole = "lead" | "member" | "observer";
export type MilestoneStatus = "pending" | "in_progress" | "completed";
export type TaskStatus = "todo" | "in_progress" | "done";

export interface Profile {
  id: string;
  name: string;
  nickname: string | null;
  email: string;
  specialty: Specialty | null;
  avatar_url: string | null;
  role: MemberRole;
  can_create_crew: boolean;
  bio: string | null;
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
  kakao_chat_url: string | null;
  google_drive_url: string | null;
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
  project_id: string | null;
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

// === Project System ===

export interface Project {
  id: string;
  title: string;
  description: string | null;
  status: ProjectStatus;
  category: Specialty | null;
  image_url: string | null;
  start_date: string | null;
  end_date: string | null;
  kakao_chat_url: string | null;
  google_drive_url: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  creator?: Profile;
  member_count?: number;
  milestone_count?: number;
  task_stats?: { todo: number; in_progress: number; done: number };
}

export interface ProjectMember {
  id: string;
  project_id: string;
  user_id: string | null;
  crew_id: string | null;
  role: ProjectMemberRole;
  joined_at: string;
  profile?: Profile;
  crew?: Group;
}

export interface ProjectMilestone {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  status: MilestoneStatus;
  due_date: string | null;
  sort_order: number;
  created_at: string;
  tasks?: ProjectTask[];
}

export interface ProjectTask {
  id: string;
  milestone_id: string;
  project_id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  assigned_to: string | null;
  due_date: string | null;
  sort_order: number;
  created_at: string;
  assignee?: Profile;
}

export interface ProjectUpdate {
  id: string;
  project_id: string;
  author_id: string;
  content: string;
  type: "post" | "milestone_update" | "status_change" | "member_joined";
  metadata: Record<string, any>;
  created_at: string;
  author?: Profile;
}

export interface CrewPost {
  id: string;
  group_id: string;
  author_id: string;
  content: string;
  type: "post" | "announcement" | "event_recap" | "system";
  metadata: Record<string, any>;
  created_at: string;
  author?: Profile;
}

// === Community ===

export interface Comment {
  id: string;
  target_type: "project_update" | "crew_post";
  target_id: string;
  author_id: string;
  content: string;
  created_at: string;
  author?: Profile;
}

export interface Reaction {
  id: string;
  target_type: "project_update" | "crew_post" | "comment" | "chat_message";
  target_id: string;
  user_id: string;
  emoji: string;
  created_at: string;
}

export interface FileAttachment {
  id: string;
  target_type: "project_update" | "crew_post" | "project_task" | "project" | "group";
  target_id: string;
  uploaded_by: string | null;
  file_name: string;
  file_url: string;
  file_size: number | null;
  file_type: string | null;
  created_at: string;
}

// === Meetings ===

export type MeetingStatus = "upcoming" | "in_progress" | "completed" | "cancelled";
export type NoteType = "note" | "action_item" | "decision";
export type ApplicationStatus = "pending" | "approved" | "rejected" | "withdrawn";

export interface Meeting {
  id: string;
  group_id: string;
  title: string;
  description: string | null;
  scheduled_at: string;
  duration_min: number;
  location: string | null;
  status: MeetingStatus;
  organizer_id: string | null;
  next_topic: string | null;
  summary: string | null;
  created_at: string;
  organizer?: Profile;
  agendas?: MeetingAgenda[];
  notes_count?: number;
}

export interface MeetingAgenda {
  id: string;
  meeting_id: string;
  topic: string;
  description: string | null;
  duration_min: number | null;
  presenter_id: string | null;
  sort_order: number;
  resources: { name: string; url: string }[];
  created_at: string;
  presenter?: Profile;
}

export interface MeetingNote {
  id: string;
  meeting_id: string;
  type: NoteType;
  content: string;
  owner_id: string | null;
  due_date: string | null;
  status: string | null;
  created_by: string | null;
  created_at: string;
  owner?: Profile;
  creator?: Profile;
}

export interface ProjectApplication {
  id: string;
  project_id: string;
  applicant_id: string;
  crew_id: string | null;
  message: string | null;
  portfolio_url: string | null;
  status: ApplicationStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  applicant?: Profile;
  crew?: Group;
}

export interface Integration {
  id: string;
  workspace_type: "crew" | "project";
  workspace_id: string;
  type: "slack" | "notion" | "webhook" | "discord";
  name: string;
  config: Record<string, any>;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
}

// === Chat ===

export interface ChatMessage {
  id: string;
  room_type: "crew" | "project";
  room_id: string;
  sender_id: string;
  content: string;
  metadata: Record<string, any>;
  created_at: string;
  sender?: Profile;
}
