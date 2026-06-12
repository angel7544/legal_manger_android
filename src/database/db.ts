import * as SQLite from 'expo-sqlite';
import { Case, User, AuditLog, FileMovement, Hearing, Reminder, SystemSetting } from '../types/db';

let dbInstance: SQLite.SQLiteDatabase | null = null;

/**
 * Gets or opens the SQLite database instance.
 */
export async function getDB(): Promise<SQLite.SQLiteDatabase> {
  if (!dbInstance) {
    dbInstance = await SQLite.openDatabaseAsync('legal_files.db');
  }
  return dbInstance;
}

/**
 * Closes the database connection and resets the cached instance.
 */
export async function closeDB(): Promise<void> {
  if (dbInstance) {
    try {
      await dbInstance.closeAsync();
    } catch (error) {
      console.warn('Error closing database instance:', error);
    }
    dbInstance = null;
  }
}

/**
 * Initializes the database schemas and seeds the default admin user if not present.
 */
export async function initDatabase(): Promise<void> {
  try {
    const db = await getDB();
    
    // Enable Foreign Key support in SQLite
    await db.execAsync('PRAGMA foreign_keys = ON;');

    // 1. Create cases table
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS cases (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        file_number TEXT UNIQUE NOT NULL,
        case_number TEXT NOT NULL,
        client_name TEXT NOT NULL,
        client_phone TEXT,
        opposite_party TEXT,
        party1 TEXT,
        party2 TEXT,
        respondent_category TEXT,
        advocate_name TEXT,
        court_name TEXT,
        case_type TEXT NOT NULL,
        filing_date TEXT,
        next_hearing_date TEXT,
        notes TEXT,
        rack_number TEXT,
        shelf_number TEXT,
        position_number TEXT,
        file_status TEXT DEFAULT 'In Office',
        priority TEXT DEFAULT 'Medium',
        created_at TEXT NOT NULL
      );
    `);

    // Safe migration: add respondent_category column if it does not exist
    try {
      await db.execAsync('ALTER TABLE cases ADD COLUMN respondent_category TEXT;');
    } catch (e) {
      // Column might already exist, ignore error
    }

    // Safe migration: add status column to hearings if it does not exist
    try {
      await db.execAsync("ALTER TABLE hearings ADD COLUMN status TEXT DEFAULT 'Pending';");
    } catch (e) {
      // Column might already exist, ignore error
    }

    // 2. Create users table
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        salt TEXT NOT NULL,
        last_login TEXT
      );
    `);

    // 3. Create audit_logs table
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        case_id INTEGER,
        file_number TEXT,
        action_type TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        details TEXT,
        remarks TEXT,
        FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE SET NULL
      );
    `);

    // 4. Create backups table
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS backups (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        backup_path TEXT NOT NULL,
        backup_type TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
    `);

    // 5. Create documents table
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS documents (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        case_id INTEGER NOT NULL,
        document_name TEXT NOT NULL,
        file_path TEXT NOT NULL,
        category TEXT NOT NULL,
        uploaded_at TEXT NOT NULL,
        FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE
      );
    `);

    // 6. Create file_movements table
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS file_movements (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        case_id INTEGER NOT NULL,
        location TEXT NOT NULL,
        moved_by TEXT,
        movement_date TEXT NOT NULL,
        remarks TEXT,
        FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE
      );
    `);

    // 7. Create hearings table
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS hearings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        case_id INTEGER NOT NULL,
        hearing_date TEXT NOT NULL,
        hearing_notes TEXT,
        next_action TEXT,
        status TEXT DEFAULT 'Pending',
        created_at TEXT NOT NULL,
        FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE
      );
    `);

    // 8. Create reminders table
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS reminders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        case_id INTEGER,
        title TEXT NOT NULL,
        description TEXT,
        reminder_date TEXT NOT NULL,
        is_read INTEGER DEFAULT 0,
        created_at TEXT NOT NULL,
        FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE SET NULL
      );
    `);

    // 9. Create settings table
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT
      );
    `);

    // Seed default admin user if no users exist
    const userCount = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM users;');
    if (userCount && userCount.count === 0) {
      console.log('Seeding default admin user...');
      // Salt: e408482cdbe9bdb0e56ece9b7dfb59de
      // Password: admin123
      // Hash: 3b7113209044a8b18d39e1bc4ff798e4fc6c412a98c19e17dcf2068ae3dc464f
      await db.runAsync(
        'INSERT INTO users (id, username, password_hash, salt, last_login) VALUES (?, ?, ?, ?, ?);',
        1,
        'admin',
        '3b7113209044a8b18d39e1bc4ff798e4fc6c412a98c19e17dcf2068ae3dc464f',
        'e408482cdbe9bdb0e56ece9b7dfb59de',
        new Date().toISOString().replace('T', ' ').substring(0, 19)
      );
    }
  } catch (error) {
    console.error('Failed to initialize database:', error);
    throw error;
  }
}

/**
 * Generates the next sequential unique file number for the current year.
 * Format: {prefix}-{year}-{sequence} e.g. CIV-2026-0001, or 2026-0001
 * 
 * @param prefix The prefix for the case type e.g. "CIV", "CRI" (or empty string)
 * @returns Generated file number string
 */
export async function generateNextFileNumber(prefix: string): Promise<string> {
  const db = await getDB();
  const year = new Date().getFullYear();
  const yearStr = year.toString();
  
  // Search for the max file number sequence for this year & prefix
  // Matches file numbers like: Prefix-Year-Seq or Year-Seq
  const matchPattern = prefix ? `${prefix}-${yearStr}-%` : `${yearStr}-%`;
  
  const query = `
    SELECT file_number FROM cases 
    WHERE file_number LIKE ? 
    ORDER BY id DESC;
  `;
  
  const results = await db.getAllAsync<{ file_number: string }>(query, [matchPattern]);
  
  let nextSeq = 1;
  if (results.length > 0) {
    // Parse the sequences to find the max
    let maxSeq = 0;
    for (const row of results) {
      const parts = row.file_number.split('-');
      const lastPart = parts[parts.length - 1];
      const seqVal = parseInt(lastPart, 10);
      if (!isNaN(seqVal) && seqVal > maxSeq) {
        maxSeq = seqVal;
      }
    }
    nextSeq = maxSeq + 1;
  }
  
  const paddedSeq = nextSeq.toString().padStart(4, '0');
  return prefix ? `${prefix}-${yearStr}-${paddedSeq}` : `${yearStr}-${paddedSeq}`;
}

/**
 * Inserts a new case record and logs the initial movement and audit trail.
 */
export async function addCase(
  caseData: Omit<Case, 'id' | 'file_number' | 'created_at'> & { file_number?: string }
): Promise<Case> {
  const db = await getDB();
  const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
  
  // Generate file number or use the custom one
  const fileNumber = caseData.file_number || await generateNextFileNumber(caseData.case_type);
  
  // Start SQLite transaction logic (using standard queries)
  await db.execAsync('BEGIN TRANSACTION;');
  try {
    const result = await db.runAsync(`
      INSERT INTO cases (
        file_number, case_number, client_name, client_phone, opposite_party,
        party1, party2, respondent_category, advocate_name, court_name, case_type,
        filing_date, next_hearing_date, notes, rack_number, shelf_number,
        position_number, file_status, priority, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
    `, [
      fileNumber,
      caseData.case_number,
      caseData.client_name,
      caseData.client_phone || null,
      caseData.opposite_party || null,
      caseData.party1 || null,
      caseData.party2 || null,
      caseData.respondent_category || null,
      caseData.advocate_name || null,
      caseData.court_name || null,
      caseData.case_type,
      caseData.filing_date || null,
      caseData.next_hearing_date || null,
      caseData.notes || null,
      caseData.rack_number || null,
      caseData.shelf_number || null,
      caseData.position_number || '0',
      caseData.file_status || 'In Office',
      caseData.priority || 'Medium',
      timestamp
    ]);

    const newCaseId = result.lastInsertRowId;
    
    // Log initial movement
    await db.runAsync(`
      INSERT INTO file_movements (case_id, location, moved_by, movement_date, remarks)
      VALUES (?, ?, ?, ?, ?);
    `, [newCaseId, caseData.file_status || 'In Office', 'System', timestamp, 'Initial setup at filing.']);

    // Log audit log
    await db.runAsync(`
      INSERT INTO audit_logs (case_id, file_number, action_type, timestamp, details, remarks)
      VALUES (?, ?, 'CREATE', ?, ?, ?);
    `, [
      newCaseId,
      fileNumber,
      timestamp,
      `Case file created. Client: ${caseData.client_name}`,
      'Initial creation'
    ]);
    
    await db.execAsync('COMMIT;');
    
    return {
      ...caseData,
      id: newCaseId,
      file_number: fileNumber,
      created_at: timestamp
    };
  } catch (error) {
    await db.execAsync('ROLLBACK;');
    throw error;
  }
}

/**
 * Updates an existing case and logs an audit log (and movement if status changes).
 */
export async function updateCase(id: number, oldCase: Case, updateData: Partial<Case>, updatedBy = 'Admin'): Promise<void> {
  const db = await getDB();
  const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
  
  await db.execAsync('BEGIN TRANSACTION;');
  try {
    const updatedCase = { ...oldCase, ...updateData };
    
    await db.runAsync(`
      UPDATE cases SET
        case_number = ?, client_name = ?, client_phone = ?, opposite_party = ?,
        party1 = ?, party2 = ?, respondent_category = ?, advocate_name = ?, court_name = ?, case_type = ?,
        filing_date = ?, next_hearing_date = ?, notes = ?, rack_number = ?, shelf_number = ?,
        position_number = ?, file_status = ?, priority = ?
      WHERE id = ?;
    `, [
      updatedCase.case_number,
      updatedCase.client_name,
      updatedCase.client_phone || null,
      updatedCase.opposite_party || null,
      updatedCase.party1 || null,
      updatedCase.party2 || null,
      updatedCase.respondent_category || null,
      updatedCase.advocate_name || null,
      updatedCase.court_name || null,
      updatedCase.case_type,
      updatedCase.filing_date || null,
      updatedCase.next_hearing_date || null,
      updatedCase.notes || null,
      updatedCase.rack_number || null,
      updatedCase.shelf_number || null,
      updatedCase.position_number || '0',
      updatedCase.file_status,
      updatedCase.priority,
      id
    ]);

    // Check if status/location changed
    if (updateData.file_status && updateData.file_status !== oldCase.file_status) {
      await db.runAsync(`
        INSERT INTO file_movements (case_id, location, moved_by, movement_date, remarks)
        VALUES (?, ?, ?, ?, ?);
      `, [
        id,
        updateData.file_status,
        updatedBy,
        timestamp,
        `Location changed from "${oldCase.file_status}" to "${updateData.file_status}".`
      ]);
    }

    // Insert audit log
    let details = 'Case details updated.';
    const changedFields = Object.keys(updateData).filter(key => (updateData as any)[key] !== (oldCase as any)[key]);
    if (changedFields.length > 0) {
      details += ` Fields changed: ${changedFields.join(', ')}`;
    }
    
    await db.runAsync(`
      INSERT INTO audit_logs (case_id, file_number, action_type, timestamp, details, remarks)
      VALUES (?, ?, 'UPDATE', ?, ?, ?);
    `, [
      id,
      oldCase.file_number,
      timestamp,
      details,
      'Details modified'
    ]);

    await db.execAsync('COMMIT;');
  } catch (error) {
    await db.execAsync('ROLLBACK;');
    throw error;
  }
}

/**
 * Deletes a case record and writes a deletion log.
 */
export async function deleteCase(id: number, fileNumber: string, clientName: string): Promise<void> {
  const db = await getDB();
  const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);

  await db.execAsync('BEGIN TRANSACTION;');
  try {
    // Delete documents first (cascade constraint handled by SQLite but safe to write queries)
    await db.runAsync('DELETE FROM documents WHERE case_id = ?;', [id]);
    await db.runAsync('DELETE FROM file_movements WHERE case_id = ?;', [id]);
    await db.runAsync('DELETE FROM hearings WHERE case_id = ?;', [id]);
    await db.runAsync('DELETE FROM reminders WHERE case_id = ?;', [id]);
    await db.runAsync('DELETE FROM cases WHERE id = ?;', [id]);

    // Insert orphaned audit log to record deletion
    await db.runAsync(`
      INSERT INTO audit_logs (case_id, file_number, action_type, timestamp, details, remarks)
      VALUES (NULL, ?, 'DELETE', ?, ?, ?);
    `, [
      fileNumber,
      timestamp,
      `Case file deleted. Client was: ${clientName}`,
      'Record permanent delete'
    ]);

    await db.execAsync('COMMIT;');
  } catch (error) {
    await db.execAsync('ROLLBACK;');
    throw error;
  }
}

/**
 * Fetches a single case by its internal ID.
 */
export async function getCaseById(id: number): Promise<Case | null> {
  const db = await getDB();
  const result = await db.getFirstAsync<Case>('SELECT * FROM cases WHERE id = ?;', [id]);
  return result || null;
}

/**
 * Fetches a single case by its file number.
 */
export async function getCaseByFileNumber(fileNumber: string): Promise<Case | null> {
  const db = await getDB();
  const result = await db.getFirstAsync<Case>('SELECT * FROM cases WHERE file_number = ?;', [fileNumber]);
  return result || null;
}

/**
 * Searches cases based on a keyword. Matches partially on file number, client name, case number, or client phone.
 */
export async function searchCases(query: string): Promise<Case[]> {
  const db = await getDB();
  if (!query.trim()) {
    return db.getAllAsync<Case>('SELECT * FROM cases ORDER BY created_at DESC;');
  }
  const wildcard = `%${query}%`;
  return db.getAllAsync<Case>(`
    SELECT * FROM cases 
    WHERE file_number LIKE ? 
       OR client_name LIKE ? 
       OR case_number LIKE ? 
       OR client_phone LIKE ? 
    ORDER BY created_at DESC;
  `, [wildcard, wildcard, wildcard, wildcard]);
}

/**
 * Fetches aggregate dashboard stats and recent cases.
 */
export async function getDashboardStats(): Promise<{ totalFiles: number; recentFiles: Case[] }> {
  const db = await getDB();
  
  const countResult = await db.getFirstAsync<{ total: number }>('SELECT COUNT(*) as total FROM cases;');
  const totalFiles = countResult ? countResult.total : 0;
  
  const recentFiles = await db.getAllAsync<Case>('SELECT * FROM cases ORDER BY created_at DESC LIMIT 5;');
  
  return {
    totalFiles,
    recentFiles
  };
}

/**
 * Gets audit logs list.
 */
export async function getAuditLogs(): Promise<AuditLog[]> {
  const db = await getDB();
  return db.getAllAsync<AuditLog>('SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT 100;');
}

/**
 * Gets file movements for a specific case.
 */
export async function getFileMovements(caseId: number): Promise<FileMovement[]> {
  const db = await getDB();
  return db.getAllAsync<FileMovement>('SELECT * FROM file_movements WHERE case_id = ? ORDER BY movement_date DESC;', [caseId]);
}

/**
 * Gets hearings list for a specific case.
 */
export async function getHearings(caseId: number): Promise<Hearing[]> {
  const db = await getDB();
  return db.getAllAsync<Hearing>('SELECT * FROM hearings WHERE case_id = ? ORDER BY hearing_date DESC;', [caseId]);
}

/**
 * Adds a new hearing record and updates next_hearing_date in cases.
 */
export async function addHearing(caseId: number, hearingDate: string, notes: string, nextAction: string, status: string = 'Pending'): Promise<void> {
  const db = await getDB();
  const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
  
  await db.execAsync('BEGIN TRANSACTION;');
  try {
    await db.runAsync(`
      INSERT INTO hearings (case_id, hearing_date, hearing_notes, next_action, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?);
    `, [caseId, hearingDate, notes, nextAction, status, timestamp]);
    
    // Check if the hearing date is in the future compared to current case next_hearing_date or if we should set it
    await db.runAsync('UPDATE cases SET next_hearing_date = ? WHERE id = ?;', [hearingDate, caseId]);
    
    await db.execAsync('COMMIT;');
  } catch (error) {
    await db.execAsync('ROLLBACK;');
    throw error;
  }
}

/**
 * Updates an existing hearing record.
 */
export async function updateHearing(id: number, caseId: number, hearingDate: string, notes: string, nextAction: string, status: string = 'Pending'): Promise<void> {
  const db = await getDB();
  await db.execAsync('BEGIN TRANSACTION;');
  try {
    await db.runAsync(`
      UPDATE hearings 
      SET hearing_date = ?, hearing_notes = ?, next_action = ?, status = ? 
      WHERE id = ?;
    `, [hearingDate, notes, nextAction, status, id]);
    
    await db.runAsync('UPDATE cases SET next_hearing_date = ? WHERE id = ?;', [hearingDate, caseId]);
    
    await db.execAsync('COMMIT;');
  } catch (error) {
    await db.execAsync('ROLLBACK;');
    throw error;
  }
}

/**
 * Deletes multiple hearing records by their IDs.
 */
export async function deleteHearings(ids: number[]): Promise<void> {
  const db = await getDB();
  if (ids.length === 0) return;
  const placeholders = ids.map(() => '?').join(',');
  await db.runAsync(`DELETE FROM hearings WHERE id IN (${placeholders});`, ids);
}

/**
 * Fetches recent/upcoming hearings joined with case details for the dashboard.
 */
export async function getDashboardHearings(): Promise<(Hearing & { client_name: string; file_number: string; case_number: string })[]> {
  const db = await getDB();
  return db.getAllAsync<any>(`
    SELECT h.*, c.client_name, c.file_number, c.case_number 
    FROM hearings h 
    JOIN cases c ON h.case_id = c.id 
    ORDER BY h.hearing_date DESC, h.id DESC 
    LIMIT 30;
  `);
}

/**
 * Updates a hearing's status.
 */
export async function updateHearingStatus(id: number, status: string): Promise<void> {
  const db = await getDB();
  await db.runAsync('UPDATE hearings SET status = ? WHERE id = ?;', [status, id]);
}

/**
 * User Settings helpers.
 */
export async function getSetting(key: string, defaultValue: string): Promise<string> {
  try {
    const db = await getDB();
    const row = await db.getFirstAsync<SystemSetting>('SELECT value FROM settings WHERE key = ?;', [key]);
    return row ? row.value : defaultValue;
  } catch (e) {
    return defaultValue;
  }
}

export async function setSetting(key: string, value: string): Promise<void> {
  const db = await getDB();
  await db.runAsync('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?);', [key, value]);
}
