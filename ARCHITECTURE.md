# NyayaRack Android - Complete System Architecture & Documentation

## 1. App Explanation & Overview
**NyayaRack** is an offline-first, mobile-centric physical file management system designed for legal professionals, law firms, and independent advocates. It bridges the gap between physical case folders and digital tracking by utilizing QR codes, real-time logging, and geographical rack-level organization.

The core philosophy is **"Offline-First and Privacy-Focused."** All data is stored securely on the device using an encrypted local SQLite database, ensuring that sensitive client information never leaves the local environment unless explicitly exported by the administrator.

---

## 2. Comprehensive App Features
*   **Physical Rack Mapping**: Map physical files to specific coordinates in an office (`Rack Number`, `Shelf Number`, `Position`).
*   **Instant QR Retrieval**: Print folder labels with auto-generated QR codes. Scanning these codes with the built-in camera retrieves the exact case file instantly.
*   **Hearing Timeline Logging**: Track the lifecycle of a case by logging hearing dates, notes, next actions, and outcomes (Pending, Adjourned, Completed).
*   **Advanced Real-Time Search**: Search through thousands of local records instantly using partial matches on names, phones, case numbers, or file numbers.
*   **Local Security**: Application access is secured by a hashed password/PIN (`crypto-js`).
*   **Backup & Restore**: Generate complete `.db` or `.sql` backups and export them via email, Google Drive, or local storage.
*   **Dynamic Theme**: Adapts to user environments with an automatic or toggleable Dark/Light mode.

---

## 3. Future Scopes & Scaling Opportunities
While NyayaRack is currently an offline-first application, its architecture allows for significant future expansions:
1. **Cloud Synchronization (Opt-In)**: Allow users to securely sync their local SQLite data to a remote Postgres database (via a Node.js/Supabase backend) for multi-device access.
2. **Role-Based Access Control (RBAC)**: Support for multiple logins (Junior Advocates, Clerks, Senior Advocates) with restricted access to specific cases or financial data.
3. **Automated SMS/WhatsApp Reminders**: Integrate with Twilio/WhatsApp APIs to automatically send hearing reminders to clients 24 hours before the court date.
4. **Billing & Invoicing Module**: Track professional fees, generate PDF invoices, and log payments against specific case files.

---

## 4. AI & LLM Integration (Future Roadmap)
Integrating Artificial Intelligence and Large Language Models (LLMs) can transform NyayaRack from a simple tracking tool into an intelligent legal assistant:

*   **AI Document Summarization**:
    *   *Concept*: Users scan or photograph legal notices and court orders. An on-device or secure cloud LLM processes the OCR text and generates a 3-bullet-point summary of the 50-page document.
*   **Conversational Case Querying (RAG Pipeline)**:
    *   *Concept*: A chatbot interface where the lawyer asks, *"What cases do I have tomorrow in the High Court?"* or *"Summarize the last 3 hearings for Mr. Sharma's land dispute."* The LLM queries the SQLite database and responds in natural language.
*   **Predictive Adjournment Analysis**:
    *   *Concept*: By analyzing historical hearing logs, a machine learning model could predict the likelihood of an adjournment based on the specific judge, case type, or opponent advocate history.
*   **Drafting Assistant**:
    *   *Concept*: Generate boilerplate legal drafts (applications, affidavits) automatically pre-filled with the database's litigant and court details.

---

## 5. Architectural Diagrams

### 5.1 System Architecture Diagram
This diagram illustrates how the frontend components interact with the local device storage and native APIs.

```mermaid
graph TD
    UI["React Native / Expo UI"] --> Router["Expo Router"]
    Router --> Screens["Screens: Add Case, Search, Settings"]
    
    Screens --> DB_Layer["Database Abstraction Layer"]
    DB_Layer --> SQLite[("Expo SQLite")]
    
    Screens --> NativeAPIs["Native Expo APIs"]
    NativeAPIs --> Print["Expo Print HTML to PDF"]
    NativeAPIs --> Camera["Expo Camera QR Scanner"]
    NativeAPIs --> FileSys["Expo File System / Sharing"]
    
    FileSys --> Backup[("Local Backup .db")]
```

### 5.2 User Flow Diagram
This flowchart demonstrates the typical journey of an administrator adding a new file and interacting with the system.

```mermaid
flowchart TD
    A(["App Launch"]) --> B{"Is Authenticated?"}
    B -- "No" --> C["Login Screen"]
    C --> B
    B -- "Yes" --> D["Dashboard / Agenda"]
    
    D --> E{"Action"}
    E -- "Add File" --> F["Input Case Metadata"]
    F --> G["Assign Physical Rack/Shelf"]
    G --> H["Save to SQLite"]
    H --> I["Print QR Label"]
    I --> D
    
    E -- "Scan QR" --> J["Camera Scanner Opens"]
    J --> K["QR Decoded to Case ID"]
    K --> L["View Case Details"]
    L --> M["Log New Hearing"]
    M --> D
    
    E -- "Search" --> N["Type Query"]
    N --> O["Real-time DB Filter"]
    O --> L
```

### 5.3 Entity Relationship (ER) Diagram
This diagram models the relational structure of the SQLite database.

```mermaid
erDiagram
    USERS {
        int id PK
        string username
        string password_hash
        string salt
        string last_login
    }
    
    CASES {
        int id PK
        string file_number
        string case_number
        string client_name
        string client_phone
        string advocate_name
        string case_type
        string rack_number
        string shelf_number
        string file_status
        string priority
        string filing_date
        string next_hearing_date
    }
    
    HEARINGS {
        int id PK
        int case_id FK
        string hearing_date
        string hearing_notes
        string next_action
        string status
    }
    
    FILE_MOVEMENTS {
        int id PK
        int case_id FK
        string location
        string moved_by
        string movement_date
    }
    
    DOCUMENT_RECORDS {
        int id PK
        int case_id FK
        string document_name
        string file_path
        string category
    }
    
    AUDIT_LOGS {
        int id PK
        int case_id FK
        string action_type
        string timestamp
        string details
    }
    
    REMINDERS {
        int id PK
        int case_id FK
        string title
        string reminder_date
        int is_read
    }

    BACKUP_RECORDS {
        int id PK
        string backup_path
        string backup_type
        string created_at
    }

    SYSTEM_SETTINGS {
        string key PK
        string value
    }

    CASES ||--o{ HEARINGS : "has"
    CASES ||--o{ FILE_MOVEMENTS : "tracks_movements"
    CASES ||--o{ DOCUMENT_RECORDS : "contains"
    CASES ||--o{ AUDIT_LOGS : "generates"
    CASES ||--o{ REMINDERS : "has"
```

### 5.4 Proposed AI Integration Pipeline
If LLMs are introduced in the future, this is how the data flow would look.

```mermaid
sequenceDiagram
    participant User
    participant App
    participant SQLite
    participant Local_RAG
    participant Cloud_LLM

    User->>App: "What happened in the last hearing for File CIV-2026-0001?"
    App->>SQLite: "Query hearings for case CIV-2026-0001"
    SQLite-->>App: "Return raw hearing notes & dates"
    App->>Local_RAG: "Format notes as Context Prompt"
    Local_RAG->>Cloud_LLM: "Send Context + User Question via Secure API"
    Cloud_LLM-->>Local_RAG: "The last hearing on June 5th was adjourned because the opposite counsel failed to appear."
    Local_RAG-->>App: "Process response"
    App-->>User: "Display conversational response"
```
