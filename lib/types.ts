export type Specialty = "space" | "culture" | "platform" | "vibe";
export type MemberRole = "member" | "staff" | "admin";
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
  content: string | null;
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
  google_doc_url?: string | null;
  google_doc_id?: string | null;
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

// === Staff Platform ===

export type StaffProjectStatus = "active" | "completed" | "archived";
export type StaffTaskStatus = "todo" | "in_progress" | "done";
export type StaffTaskPriority = "low" | "medium" | "high" | "urgent";

export interface StaffProject {
  id: string;
  title: string;
  description: string | null;
  status: StaffProjectStatus;
  category: string;
  drive_folder_id: string | null;
  drive_folder_url: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  member_count?: number;
  task_count?: number;
  file_count?: number;
  creator?: { nickname: string | null; avatar_url: string | null };
  members?: StaffProjectMember[];
}

export interface StaffProjectMember {
  id: string;
  project_id: string;
  user_id: string;
  role: "lead" | "member";
  joined_at: string;
  profile?: { id: string; nickname: string | null; avatar_url: string | null };
}

export interface StaffFile {
  id: string;
  project_id: string;
  drive_file_id: string;
  title: string;
  mime_type: string | null;
  drive_url: string | null;
  thumbnail_url: string | null;
  file_size: number | null;
  created_by: string | null;
  ai_summary: string | null;
  ai_tags: string[];
  last_synced_at: string;
  created_at: string;
  updated_at: string;
  creator?: { nickname: string | null; avatar_url: string | null };
}

export interface StaffTask {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  status: StaffTaskStatus;
  priority: StaffTaskPriority;
  assigned_to: string | null;
  source_type: "manual" | "comment" | "meeting" | "ai";
  source_file_id: string | null;
  due_date: string | null;
  completed_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  assignee?: { id: string; nickname: string | null; avatar_url: string | null };
}

export interface StaffActivity {
  id: string;
  project_id: string;
  user_id: string | null;
  action: string;
  target_type: string | null;
  target_id: string | null;
  metadata: Record<string, any>;
  created_at: string;
  user?: { nickname: string | null; avatar_url: string | null };
}

export interface StaffComment {
  id: string;
  project_id: string;
  target_type: "file" | "task" | "project";
  target_id: string;
  author_id: string | null;
  content: string;
  drive_comment_id: string | null;
  created_at: string;
  author?: { nickname: string | null; avatar_url: string | null };
}

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

// === Project Advanced ===

export interface ProjectResource {
  id: string;
  project_id: string;
  name: string;
  url: string;
  type: "file" | "google_doc" | "google_sheet" | "notion" | "link";
  stage: "planning" | "interim" | "evidence" | "final";
  uploaded_by?: string;
  file_size?: number;
  mime_type?: string;
  description?: string;
  created_at: string;
  uploader?: { nickname: string | null; avatar_url: string | null };
}

export interface ProjectFinance {
  id: string;
  project_id: string;
  title: string;
  amount: number;
  type: "expense" | "income" | "budget_allocation";
  category: "general" | "personnel" | "tools" | "marketing" | "other";
  milestone_id?: string;
  receipt_url?: string;
  description?: string;
  recorded_by?: string;
  recorded_at: string;
  recorder?: { nickname: string | null };
  milestone?: { title: string };
}

export interface ProjectActionItem {
  id: string;
  project_id: string;
  title: string;
  description?: string;
  status: "open" | "in_progress" | "done";
  priority: "low" | "medium" | "high" | "urgent";
  assigned_to?: string;
  source_url?: string;
  due_date?: string;
  created_by?: string;
  created_at: string;
  completed_at?: string;
  assignee?: { nickname: string | null; avatar_url: string | null };
}

// ── Wiki ──────────────────────────────────────

export type WikiResourceType = "pdf" | "youtube" | "article" | "notion" | "link" | "other";
export type WikiSynthesisType = "weekly_consolidation" | "resource_digest" | "meeting_synthesis";
export type WikiContributionSource = "manual" | "meeting_sync" | "resource_link" | "ai_synthesis";

export interface WikiTopic {
  id: string;
  name: string;
  description: string | null;
  group_id: string;
  is_public: boolean;
  public_slug: string | null;
  public_description: string | null;
  published_at: string | null;
  created_at: string;
}

export interface WikiPage {
  id: string;
  topic_id: string;
  title: string;
  content: string;
  version: number;
  created_by: string;
  last_updated_by: string;
  created_at: string;
  updated_at: string;
  topic?: { id: string; name: string };
  author?: { nickname: string };
  updater?: { nickname: string };
}

export interface WikiResource {
  id: string;
  group_id: string;
  week_start: string;
  shared_by: string;
  title: string;
  url: string;
  resource_type: WikiResourceType;
  description: string | null;
  auto_summary: string | null;
  metadata: Record<string, string>;
  linked_wiki_page_id: string | null;
  created_at: string;
  sharer?: { id: string; nickname: string | null; avatar_url: string | null };
  linked_page?: { id: string; title: string };
}

export interface WikiContribution {
  id: string;
  page_id: string;
  user_id: string;
  change_summary: string | null;
  source_type: WikiContributionSource;
  source_id: string | null;
  created_at: string;
  contributor?: { nickname: string };
  page?: { id: string; title: string };
}
