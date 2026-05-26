BEGIN TRANSACTION;
CREATE TABLE audit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        case_id INTEGER,
        file_number TEXT,
        action_type TEXT NOT NULL, -- CREATE, UPDATE, DELETE
        timestamp TEXT NOT NULL,
        details TEXT,
        remarks TEXT,
        FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE SET NULL
    );
INSERT INTO "audit_logs" VALUES(1,1,'CIV-2026-0001','CREATE','2026-05-26 09:12:32','Case file created. Client: Amresh Kumar Inyatpur Prabodhi','Initial creation');
INSERT INTO "audit_logs" VALUES(2,2,'CIV-2026-0002','CREATE','2026-05-26 09:17:29','Case file created. Client: Md. Sahid','Initial creation');
INSERT INTO "audit_logs" VALUES(3,1,'CIV-2026-0001','UPDATE','2026-05-26 09:19:03','Case details updated. Status: In Office','Details modified');
CREATE TABLE backups (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        backup_path TEXT NOT NULL,
        backup_type TEXT NOT NULL, -- Manual, Auto
        created_at TEXT NOT NULL
    );
INSERT INTO "backups" VALUES(1,'nyaya_backup_20260526_111533.zip','Manual','2026-05-26 11:15:34');
CREATE TABLE cases (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        file_number TEXT UNIQUE NOT NULL,
        case_number TEXT NOT NULL,
        client_name TEXT NOT NULL,
        client_phone TEXT,
        opposite_party TEXT,
        party1 TEXT,
        party2 TEXT,
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
INSERT INTO "cases" VALUES(1,'CIV-2026-0001','257/851-2023','Amresh Kumar Inyatpur Prabodhi','7635095682','Sharda Devi','','','Adv. Narendra Kumar','Civil Court','CIV','2026-05-26','','','A','2','0','In Office','Medium','2026-05-26 09:12:32');
INSERT INTO "cases" VALUES(2,'CIV-2026-0002','238/2023','Md. Sahid','','Mahmood Alam','','','Adv. Abhay Jee','Sub Judge 16','CIV','2026-05-26','','','A','2','0','In Office','Medium','2026-05-26 09:17:29');
CREATE TABLE documents (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        case_id INTEGER NOT NULL,
        document_name TEXT NOT NULL,
        file_path TEXT NOT NULL,
        category TEXT NOT NULL, -- orders, evidence, affidavits, other
        uploaded_at TEXT NOT NULL,
        FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE
    );
CREATE TABLE file_movements (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        case_id INTEGER NOT NULL,
        location TEXT NOT NULL, -- In Office, In Court, With Junior, Archived, Missing
        moved_by TEXT,
        movement_date TEXT NOT NULL,
        remarks TEXT,
        FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE
    );
INSERT INTO "file_movements" VALUES(1,1,'In Office','System','2026-05-26 09:12:32','Initial setup at filing.');
INSERT INTO "file_movements" VALUES(2,2,'In Office','System','2026-05-26 09:17:29','Initial setup at filing.');
CREATE TABLE hearings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        case_id INTEGER NOT NULL,
        hearing_date TEXT NOT NULL,
        hearing_notes TEXT,
        next_action TEXT,
        status TEXT DEFAULT 'Pending',
        created_at TEXT NOT NULL,
        FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE
    );
CREATE TABLE reminders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        case_id INTEGER,
        title TEXT NOT NULL,
        description TEXT,
        reminder_date TEXT NOT NULL,
        is_read INTEGER DEFAULT 0,
        created_at TEXT NOT NULL,
        FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE SET NULL
    );
CREATE TABLE users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        salt TEXT NOT NULL,
        last_login TEXT
    );
INSERT INTO "users" VALUES(1,'admin','3b7113209044a8b18d39e1bc4ff798e4fc6c412a98c19e17dcf2068ae3dc464f','e408482cdbe9bdb0e56ece9b7dfb59de','2026-05-26 11:15:28');
DELETE FROM "sqlite_sequence";
INSERT INTO "sqlite_sequence" VALUES('users',1);
INSERT INTO "sqlite_sequence" VALUES('cases',2);
INSERT INTO "sqlite_sequence" VALUES('audit_logs',3);
INSERT INTO "sqlite_sequence" VALUES('file_movements',2);
INSERT INTO "sqlite_sequence" VALUES('backups',1);
COMMIT;
