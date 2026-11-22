import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

/** No secrets are embedded in the client. RLS is required for every user table. */
export const db = url && key ? createClient(url, key, {
  auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: true },
}) : null;

export type MemberRole = 'parent' | 'student';
export type MemberProfile = {
  id: string;
  nickname: string;
  role: MemberRole;
  grade: number | null;
  under_14: boolean;
  guardian_verified_at: string | null;
};
export type StudyEvent = {
  event_type: 'lesson_open' | 'concept_view' | 'lab_interaction' | 'answer' |
    'standard_open' | 'standard_answer' | 'active_time';
  unit_id?: string;
  topic?: string;
  standard_id?: string;
  correct?: boolean;
  seconds?: number;
};
export type Assignment = {
  id: string; parent_id: string; student_id: string;
  unit_id: string; status: 'assigned' | 'completed';
  due_at: string | null; created_at: string;
};
