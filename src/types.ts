export type UserRole = 'admin' | 'team_leader' | 'caller';

export interface User {
  id: string;
  org_id: string;
  name: string;
  email: string;
  role: UserRole;
  active: boolean;
  avatar_url?: string;
  two_factor_enabled?: boolean;
  two_factor_pin?: string;
  last_active_at: string;
  created_at: string;
}

export interface Industry {
  id: string;
  org_id: string;
  name: string;
  default_pitch?: string;
}

export interface Business {
  id: string;
  batch_id?: string;
  org_id: string;
  name: string;
  phone: string;
  has_website: boolean;
  website_url?: string;
  industry: string;
  address: string;
  city?: string;
  state?: string;
  zip?: string;
  email?: string;
  contact_person?: string;
  created_at: string;
}

export interface ImportedBatch {
  id: string;
  org_id: string;
  file_name: string;
  total_leads: number;
  unassigned_count?: number;
  completed_count?: number;
  allowed_caller_ids?: string[];
  imported_by_id: string;
  imported_by_name: string;
  created_at: string;
  sample_businesses?: Business[];
}

export type LeadStatus = 'unassigned' | 'reserved' | 'completed' | 'do_not_call';

export interface Lead {
  id: string;
  org_id: string;
  business_id: string;
  status: LeadStatus;
  assigned_caller_id?: string;
  assigned_caller_name?: string;
  allowed_caller_ids?: string[];
  reserved_at?: string;
  completed_at?: string;
  current_cycle: number;
  created_at: string;
  business?: Business;
  smart_pitch?: string;
  is_followup_resurface?: boolean;
}

export type WhoAnswered =
  | 'Receptionist'
  | 'Manager'
  | 'Owner-Doctor'
  | 'Voicemail'
  | 'No Answer'
  | 'Wrong Number'
  | 'Business Closed-Disconnected'
  | 'Gatekeeper (refused transfer)';

export type CallOutcome =
  | 'Interested (wants more info)'
  | 'Interested (appointment set)'
  | 'Not Interested'
  | 'Call Back Later'
  | 'Asked to Email Info'
  | 'Asked to Text'
  | 'Gatekeeper Blocked'
  | 'Do Not Call';

export type PitchGiven =
  | 'Website + AI Receptionist'
  | 'AI Receptionist Only'
  | 'Both'
  | 'General Intro Only';

export type ObjectionReason =
  | 'Too Expensive'
  | 'Already Has a Solution'
  | 'Not Decision Maker'
  | 'No Budget'
  | 'Doesn\'t See Value'
  | 'Bad Timing'
  | 'Other';

export type FollowUpMethod = 'Call' | 'Email' | 'WhatsApp' | 'Text';

export interface CallLog {
  id: string;
  org_id: string;
  lead_id: string;
  business_id: string;
  caller_id: string;
  caller_name: string;
  who_answered: WhoAnswered;
  call_outcome?: CallOutcome;
  pitch_given?: PitchGiven;
  objection_reason?: ObjectionReason;
  has_followup: boolean;
  followup_at?: string;
  followup_method?: FollowUpMethod;
  contact_name?: string;
  contact_email?: string;
  notes?: string;
  created_at: string;
  business_name?: string;
  business_phone?: string;
}

export type FollowUpPipelineStatus =
  | 'interested'
  | 'email_sent'
  | 'followup'
  | 'appointment'
  | 'closed';

export interface FollowUp {
  id: string;
  org_id: string;
  call_log_id: string;
  lead_id: string;
  business_id: string;
  caller_id: string;
  status: FollowUpPipelineStatus;
  scheduled_at: string;
  method: FollowUpMethod;
  notes?: string;
  created_at: string;
}

export interface AuditLog {
  id: string;
  org_id: string;
  user_id: string;
  user_name: string;
  action: string;
  target_type: string;
  target_id?: string;
  details: string;
  timestamp: string;
}

export interface CallerDashboardStats {
  calls_today: number;
  interested_count: number;
  appointments_count: number;
  remaining_leads: number;
  avg_call_seconds: number;
  current_streak: number;
}

export interface AdminDashboardStats {
  total_leads: number;
  completed_leads: number;
  remaining_leads: number;
  conversion_rate: number;
  appointments_set: number;
  active_callers_count: number;
  top_performers: {
    caller_id: string;
    caller_name: string;
    calls_count: number;
    appointments: number;
    interested: number;
  }[];
  active_callers: {
    id: string;
    name: string;
    status: 'In Call' | 'Idle' | 'Offline';
    last_active_at: string;
    calls_today: number;
    idle_minutes: number;
    is_idle_alert: boolean;
    current_lead_name?: string;
  }[];
  call_volume_series: {
    date: string;
    total_calls: number;
    interested: number;
    appointments: number;
  }[];
}

export interface ImportRowError {
  row: number;
  field: string;
  message: string;
  value?: string;
}

export interface ImportValidationResult {
  total_rows: number;
  valid_count: number;
  invalid_count: number;
  errors: ImportRowError[];
  sample_valid_rows: any[];
}

export interface CallbackNotificationItem {
  id: string;
  lead_id: string;
  business_id: string;
  business_name: string;
  business_phone: string;
  industry?: string;
  address?: string;
  contact_person?: string;
  contact_email?: string;
  caller_id: string;
  caller_name: string;
  scheduled_at: string;
  scheduled_date: string; // YYYY-MM-DD
  scheduled_time?: string;
  method: string;
  notes?: string;
  call_outcome?: string;
  smart_pitch?: string;
  status: FollowUpPipelineStatus;
  created_at: string;
  is_due_today: boolean;
  is_overdue: boolean;
}

export interface CallbackNotificationsResponse {
  today_callbacks: CallbackNotificationItem[];
  overdue_callbacks: CallbackNotificationItem[];
  upcoming_callbacks: CallbackNotificationItem[];
  selected_date_callbacks?: CallbackNotificationItem[];
  target_date: string;
  active_count: number;
  total_overdue_count: number;
}
