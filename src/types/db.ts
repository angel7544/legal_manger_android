export interface Case {
  id?: number;
  file_number: string; // Auto-generated YYYY-XXXX
  case_number: string;
  client_name: string;
  client_phone?: string | null;
  opposite_party?: string | null;
  party1?: string | null;
  party2?: string | null;
  respondent_category?: string | null;
  advocate_name?: string | null;
  court_name?: string | null;
  case_type: string;
  filing_date?: string | null;
  next_hearing_date?: string | null;
  notes?: string | null;
  rack_number?: string | null;
  shelf_number?: string | null;
  position_number?: string | null;
  file_status: string; // Default: 'In Office'
  priority: string; // Default: 'Medium'
  created_at: string;
}

export interface User {
  id?: number;
  username: string;
  password_hash: string;
  salt: string;
  last_login?: string | null;
}

export interface AuditLog {
  id?: number;
  case_id?: number | null;
  file_number?: string | null;
  action_type: 'CREATE' | 'UPDATE' | 'DELETE';
  timestamp: string;
  details?: string | null;
  remarks?: string | null;
}

export interface BackupRecord {
  id?: number;
  backup_path: string;
  backup_type: 'Manual' | 'Auto';
  created_at: string;
}

export interface DocumentRecord {
  id?: number;
  case_id: number;
  document_name: string;
  file_path: string;
  category: 'orders' | 'evidence' | 'affidavits' | 'other';
  uploaded_at: string;
}

export interface FileMovement {
  id?: number;
  case_id: number;
  location: string; // 'In Office', 'In Court', 'With Junior', 'Archived', 'Missing'
  moved_by?: string | null;
  movement_date: string;
  remarks?: string | null;
}

export interface Hearing {
  id?: number;
  case_id: number;
  hearing_date: string;
  hearing_notes?: string | null;
  next_action?: string | null;
  status: string; // 'Pending', 'Adjourned', 'Completed'
  created_at: string;
}

export interface Reminder {
  id?: number;
  case_id?: number | null;
  title: string;
  description?: string | null;
  reminder_date: string;
  is_read: number; // 0 or 1
  created_at: string;
}

export interface SystemSetting {
  key: string;
  value: string;
}
