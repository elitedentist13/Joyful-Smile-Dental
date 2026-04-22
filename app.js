I have everything I need. Let me build the complete integrated code now.

---

## Step 1 — Run this SQL in Supabase SQL Editor first

```sql
-- Add voucher_no to patients table
ALTER TABLE patients ADD COLUMN IF NOT EXISTS voucher_no TEXT;

-- Create appointments table
CREATE TABLE IF NOT EXISTS appointments (
    id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    patient_id    UUID REFERENCES patients(id) ON DELETE SET NULL,
    patient_no    TEXT,
    patient_name  TEXT,
    date          DATE NOT NULL,
    start_time    TIME NOT NULL,
    duration      INTEGER NOT NULL DEFAULT 30,
    end_time      TIME,
    treatment_items TEXT,
    remarks       TEXT,
    arrived       BOOLEAN DEFAULT FALSE,
    arrival_time  TIMESTAMPTZ,
    voucher_no    TEXT,
    bill_status   TEXT DEFAULT 'Pending',
    in_queue      BOOLEAN DEFAULT FALSE,
    created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users only" ON appointments
    FOR ALL TO authenticated USING (auth.role() = 'authenticated');
```

---

## Step 2 — Complete `index.html`

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Joyful Smile Clinic Manager</title>
    <style>
        :root {
            --primary: #0084ff;
            --success: #28a745;
            --danger:  #dc3545;
            --warning: #ffc107;
            --gray:    #6c757d;
        }

        * { box-sizing: border-box; }

        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: #f4f7f6;
            margin: 0;
            padding: 20px;
        }

        .container {
            max-width: 1200px;
            margin: auto;
            background: white;
            padding: 30px;
            border-radius: 12px;
            box-shadow: 0 4px 15px rgba(0,0,0,0.08);
        }

        /* ── Login ───────────────────────────────────────── */
        #loginOverlay {
            display: none;
            position: fixed;
            z-index: 9999;
            top: 0; left: 0;
            width: 100%; height: 100%;
            background: rgba(0,0,0,0.55);
            align-items: center;
            justify-content: center;
        }

        .login-box {
            background: white;
            padding: 40px;
            border-radius: 14px;
            width: 100%;
            max-width: 380px;
            box-shadow: 0 8px 30px rgba(0,0,0,0.2);
        }

        .login-box h2 {
            margin: 0 0 24px;
            text-align: center;
            color: var(--primary);
            font-size: 22px;
        }

        .login-box label {
            display: block;
            font-weight: 600;
            margin-bottom: 6px;
            font-size: 14px;
        }

        .login-box input {
            width: 100%;
            padding: 11px 12px;
            margin-bottom: 16px;
            border: 1px solid #ddd;
            border-radius: 7px;
            font-size: 15px;
        }

        .login-box button {
            width: 100%;
            padding: 12px;
            background: var(--primary);
            color: white;
            border: none;
            border-radius: 7px;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
        }

        .login-box button:hover { background: #006fd6; }

        #loginError {
            color: red;
            text-align: center;
            margin-top: 12px;
            font-size: 14px;
            display: none;
        }

        /* ── Dashboard ───────────────────────────────────── */
        .top-bar {
            display: flex;
            justify-content: space-between;
            align-items: center;
            flex-wrap: wrap;
            gap: 10px;
        }

        .top-bar h1 {
            margin: 0;
            color: var(--primary);
            font-size: 24px;
        }

        .top-bar-right {
            display: flex;
            align-items: center;
            gap: 14px;
        }

        /* ── User badge ──────────────────────────────────── */
        #userBadge {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            background: linear-gradient(135deg, #0084ff, #0060cc);
            color: white;
            padding: 8px 16px;
            border-radius: 20px;
            font-size: 14px;
            font-weight: 600;
            box-shadow: 0 2px 8px rgba(0,132,255,0.3);
        }

        #userBadge .role-tag {
            background: rgba(255,255,255,0.25);
            padding: 2px 8px;
            border-radius: 10px;
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }

        .dashboard-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 20px;
            margin-top: 30px;
        }

        .dash-card {
            background: white;
            padding: 30px 10px;
            text-align: center;
            border-radius: 12px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.08);
            cursor: pointer;
            transition: all 0.2s ease;
            border: 2px solid #eee;
            font-size: 30px;
        }

        .dash-card h3 {
            margin: 8px 0 0;
            font-size: 15px;
            color: #333;
        }

        .dash-card:hover {
            transform: translateY(-4px);
            border-color: var(--primary);
            background: #f0f7ff;
        }

        /* ── Buttons ─────────────────────────────────────── */
        .btn-add {
            background: var(--success);
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 6px;
            cursor: pointer;
            font-weight: bold;
            font-size: 14px;
        }

        .btn-add:hover { background: #218838; }

        .btn-logout {
            background: var(--danger);
            color: white;
            border: none;
            padding: 8px 18px;
            border-radius: 6px;
            cursor: pointer;
            font-weight: bold;
        }

        .btn-logout:hover { background: #c82333; }

        .btn-view {
            background: #f0f0f0;
            border: 1px solid #ccc;
            padding: 6px 12px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 13px;
        }

        .btn-view:hover { background: #e0e0e0; }

        /* ── Patient section ─────────────────────────────── */
        .section-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 16px;
        }

        .section-header h2 { margin: 0; }

        .back-btn {
            background: none;
            border: none;
            color: var(--primary);
            font-weight: bold;
            font-size: 15px;
            cursor: pointer;
            padding: 0;
            margin-bottom: 16px;
        }

        /* ── Search ──────────────────────────────────────── */
        #searchInput {
            width: 100%;
            padding: 10px 14px;
            margin-bottom: 16px;
            border: 1px solid #ddd;
            border-radius: 7px;
            font-size: 14px;
        }

        /* ── Table ───────────────────────────────────────── */
        table {
            width: 100%;
            border-collapse: collapse;
        }

        th {
            background: #f8f9fa;
            color: #555;
            font-size: 13px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            padding: 12px 14px;
            text-align: left;
            border-bottom: 2px solid #eee;
        }

        td {
            padding: 12px 14px;
            border-bottom: 1px solid #f0f0f0;
            vertical-align: middle;
            font-size: 14px;
        }

        tr:hover td { background: #fafcff; }

        .patient-no-badge {
            display: inline-block;
            background: #e8f4ff;
            color: var(--primary);
            font-size: 11px;
            font-weight: 700;
            padding: 2px 7px;
            border-radius: 10px;
            margin-bottom: 4px;
            letter-spacing: 0.5px;
        }

        /* ── Modals ──────────────────────────────────────── */
        .modal {
            display: none;
            position: fixed;
            z-index: 1000;
            left: 0; top: 0;
            width: 100%; height: 100%;
            background: rgba(0,0,0,0.5);
            overflow-y: auto;
        }

        .modal-content {
            background: white;
            margin: 3% auto;
            padding: 28px;
            width: 90%;
            max-width: 700px;
            border-radius: 10px;
            position: relative;
        }

        .modal-content h2 {
            margin: 0 0 20px;
            font-size: 20px;
            color: #222;
        }

        .close {
            position: absolute;
            right: 18px;
            top: 14px;
            font-size: 28px;
            cursor: pointer;
            color: #aaa;
            line-height: 1;
        }

        .close:hover { color: #333; }

        /* ── Form grid ───────────────────────────────────── */
        .form-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 14px;
        }

        .form-group label {
            display: block;
            font-size: 13px;
            font-weight: 600;
            color: #555;
            margin-bottom: 4px;
        }

        .form-group input,
        .form-group select,
        .form-group textarea {
            width: 100%;
            padding: 9px 11px;
            border: 1px solid #ddd;
            border-radius: 6px;
            font-size: 14px;
        }

        .form-group input:focus,
        .form-group select:focus,
        .form-group textarea:focus {
            outline: none;
            border-color: var(--primary);
        }

        .form-group input[readonly] {
            background: #f5f5f5;
            color: #888;
            cursor: not-allowed;
        }

        .full-width { grid-column: 1 / -1; }

        /* ── Treatment history ───────────────────────────── */
        .history-container {
            margin-top: 10px;
            max-height: 380px;
            overflow-y: auto;
        }

        .note-card {
            background: #fafafa;
            padding: 14px 16px;
            border-bottom: 1px solid #eee;
            position: relative;
        }

        .note-card:last-child { border-bottom: none; }

        /* ── Bulk entry box ──────────────────────────────── */
        #bulkEntrySection {
            background: #f9f9f9;
            padding: 16px;
            border-radius: 8px;
            margin-bottom: 20px;
        }

        #bulkEntrySection h3 {
            margin-top: 0;
            font-size: 16px;
        }

        #bulkNoteInput {
            width: 100%;
            padding: 10px;
            border: 1px solid #ddd;
            border-radius: 6px;
            font-size: 14px;
            resize: vertical;
        }

        /* ══════════════════════════════════════════════════
           APPOINTMENT MODULE STYLES
        ══════════════════════════════════════════════════ */

        /* ── Tabs ────────────────────────────────────────── */
        .appt-tabs {
            display: flex;
            gap: 4px;
            border-bottom: 2px solid #e0e0e0;
            margin-bottom: 22px;
        }

        .appt-tab-btn {
            padding: 10px 22px;
            border: none;
            background: none;
            font-size: 14px;
            font-weight: 600;
            color: #888;
            cursor: pointer;
            border-bottom: 3px solid transparent;
            margin-bottom: -2px;
            border-radius: 6px 6px 0 0;
            transition: all 0.15s;
        }

        .appt-tab-btn:hover { background: #f5f5f5; color: #444; }

        .appt-tab-btn.active {
            color: var(--primary);
            border-bottom-color: var(--primary);
            background: #f0f7ff;
        }

        .appt-tab-content { display: none; }
        .appt-tab-content.active { display: block; }

        /* ── User heading bar ────────────────────────────── */
        .appt-user-bar {
            background: linear-gradient(135deg, #0084ff 0%, #0060cc 100%);
            color: white;
            padding: 14px 20px;
            border-radius: 10px;
            margin-bottom: 20px;
            display: flex;
            align-items: center;
            justify-content: space-between;
        }

        .appt-user-bar .user-info {
            display: flex;
            align-items: center;
            gap: 12px;
        }

        .appt-user-bar .user-name {
            font-size: 18px;
            font-weight: 700;
        }

        .appt-user-bar .user-role {
            background: rgba(255,255,255,0.25);
            padding: 3px 10px;
            border-radius: 12px;
            font-size: 12px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }

        .appt-user-bar .appt-date {
            font-size: 14px;
            opacity: 0.85;
        }

        /* ── Today appointments table ────────────────────── */
        .appt-toolbar {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 14px;
            flex-wrap: wrap;
            gap: 10px;
        }

        .appt-table-wrap {
            overflow-x: auto;
            border-radius: 8px;
            border: 1px solid #eee;
        }

        .appt-table {
            width: 100%;
            border-collapse: collapse;
            min-width: 700px;
        }

        .appt-table th {
            background: #f0f7ff;
            color: var(--primary);
            font-size: 12px;
            padding: 11px 14px;
        }

        .appt-table td {
            padding: 11px 14px;
            font-size: 14px;
            border-bottom: 1px solid #f5f5f5;
        }

        .appt-table tbody tr { cursor: pointer; transition: background 0.15s; }
        .appt-table tbody tr:hover td { background: #f0f7ff; }

        .appt-table tbody tr.arrived td {
            background: #f0fff4;
        }

        .appt-table tbody tr.arrived td:first-child::before {
            content: '';
        }

        /* ── Badges ──────────────────────────────────────── */
        .badge {
            display: inline-block;
            padding: 3px 9px;
            border-radius: 10px;
            font-size: 11px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.4px;
        }

        .badge-arrived  { background: #d4edda; color: #155724; }
        .badge-pending  { background: #fff3cd; color: #856404; }
        .badge-paid     { background: #d4edda; color: #155724; }
        .badge-waived   { background: #d1ecf1; color: #0c5460; }
        .badge-waiting  { background: #e2e3e5; color: #383d41; }

        /* ── Queue table ─────────────────────────────────── */
        .queue-row-paid td   { background: #d4edda !important; }
        .queue-row-waived td { background: #cce5ff !important; }

        /* ── Patient search dropdown ─────────────────────── */
        .patient-search-wrap {
            position: relative;
        }

        .patient-search-wrap input {
            width: 100%;
            padding: 9px 11px;
            border: 1px solid #ddd;
            border-radius: 6px;
            font-size: 14px;
        }

        .patient-dropdown {
            position: absolute;
            top: 100%;
            left: 0;
            right: 0;
            background: white;
            border: 1px solid #ddd;
            border-top: none;
            border-radius: 0 0 8px 8px;
            max-height: 200px;
            overflow-y: auto;
            z-index: 100;
            box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        }

        .patient-dropdown-item {
            padding: 10px 14px;
            cursor: pointer;
            font-size: 14px;
            border-bottom: 1px solid #f5f5f5;
        }

        .patient-dropdown-item:hover { background: #f0f7ff; }
        .patient-dropdown-item:last-child { border-bottom: none; }

        /* ── Calendar ────────────────────────────────────── */
        .cal-toolbar {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 16px;
            flex-wrap: wrap;
            gap: 10px;
        }

        .cal-toggle {
            display: flex;
            gap: 4px;
            background: #f0f0f0;
            padding: 4px;
            border-radius: 8px;
        }

        .cal-toggle-btn {
            padding: 6px 16px;
            border: none;
            background: none;
            border-radius: 6px;
            font-size: 13px;
            font-weight: 600;
            cursor: pointer;
            color: #666;
            transition: all 0.15s;
        }

        .cal-toggle-btn.active {
            background: white;
            color: var(--primary);
            box-shadow: 0 1px 4px rgba(0,0,0,0.1);
        }

        .cal-nav {
            display: flex;
            align-items: center;
            gap: 12px;
        }

        .cal-nav button {
            background: white;
            border: 1px solid #ddd;
            width: 32px;
            height: 32px;
            border-radius: 6px;
            cursor: pointer;
            font-size: 16px;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .cal-nav button:hover { background: #f0f7ff; border-color: var(--primary); }

        .cal-nav .cal-title {
            font-size: 16px;
            font-weight: 700;
            color: #333;
            min-width: 200px;
            text-align: center;
        }

        /* ── Monthly calendar grid ───────────────────────── */
        .month-grid {
            border: 1px solid #e0e0e0;
            border-radius: 8px;
            overflow: hidden;
        }

        .month-day-headers {
            display: grid;
            grid-template-columns: repeat(7, 1fr);
            background: #f0f7ff;
        }

        .month-day-header {
            padding: 10px;
            text-align: center;
            font-size: 12px;
            font-weight: 700;
            color: var(--primary);
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }

        .month-days {
            display: grid;
            grid-template-columns: repeat(7, 1fr);
        }

        .month-day {
            min-height: 90px;
            border-right: 1px solid #f0f0f0;
            border-bottom: 1px solid #f0f0f0;
            padding: 6px;
            cursor: pointer;
            transition: background 0.15s;
        }

        .month-day:hover { background: #f9fbff; }
        .month-day.other-month { background: #fafafa; }
        .month-day.today { background: #fff8e1; }
        .month-day.selected { background: #e8f4ff; }

        .month-day-num {
            font-size: 13px;
            font-weight: 600;
            color: #333;
            margin-bottom: 4px;
        }

        .month-day.today .month-day-num {
            background: var(--primary);
            color: white;
            width: 24px;
            height: 24px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 12px;
        }

        .month-day.other-month .month-day-num { color: #ccc; }

        .cal-appt-chip {
            background: #0084ff;
            color: white;
            font-size: 10px;
            padding: 2px 6px;
            border-radius: 4px;
            margin-bottom: 2px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            cursor: pointer;
        }

        .cal-appt-chip:hover { background: #006fd6; }

        /* ── Weekly calendar ─────────────────────────────── */
        .week-grid {
            border: 1px solid #e0e0e0;
            border-radius: 8px;
            overflow: hidden;
            overflow-x: auto;
        }

        .week-header-row {
            display: grid;
            grid-template-columns: 60px repeat(7, 1fr);
            background: #f0f7ff;
            border-bottom: 2px solid #ddd;
        }

        .week-time-col {
            padding: 10px 6px;
            text-align: center;
            font-size: 11px;
            font-weight: 700;
            color: var(--primary);
            border-right: 1px solid #e0e0e0;
        }

        .week-day-header {
            padding: 10px 6px;
            text-align: center;
            font-size: 12px;
            font-weight: 700;
            color: #444;
            border-right: 1px solid #e0e0e0;
        }

        .week-day-header.today-col {
            background: #fff8e1;
            color: var(--primary);
        }

        .week-day-header .day-num {
            font-size: 18px;
            font-weight: 800;
            display: block;
        }

        .week-day-header.today-col .day-num {
            background: var(--primary);
            color: white;
            width: 32px;
            height: 32px;
            border-radius: 50%;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            margin: 2px auto;
        }

        .week-body {
            display: grid;
            grid-template-columns: 60px repeat(7, 1fr);
            position: relative;
        }

        .week-time-slot {
            padding: 4px 6px;
            font-size: 10px;
            color: #aaa;
            text-align: right;
            border-right: 1px solid #e0e0e0;
            border-bottom: 1px solid #f5f5f5;
            height: 40px;
            display: flex;
            align-items: flex-start;
            justify-content: flex-end;
        }

        .week-cell {
            border-right: 1px solid #f0f0f0;
            border-bottom: 1px solid #f5f5f5;
            height: 40px;
            padding: 2px;
            position: relative;
        }

        .week-cell.today-col { background: #fffef7; }

        .week-appt-block {
            background: var(--primary);
            color: white;
            border-radius: 4px;
            padding: 2px 6px;
            font-size: 10px;
            font-weight: 600;
            cursor: pointer;
            overflow: hidden;
            white-space: nowrap;
            text-overflow: ellipsis;
            position: absolute;
            left: 2px;
            right: 2px;
            top: 2px;
            z-index: 1;
        }

        .week-appt-block:hover { background: #006fd6; }

        /* ── Day detail panel ────────────────────────────── */
        .day-detail-panel {
            background: #f8faff;
            border: 1px solid #dde8f5;
            border-radius: 8px;
            padding: 16px;
            margin-top: 16px;
        }

        .day-detail-panel h4 {
            margin: 0 0 12px;
            color: var(--primary);
            font-size: 15px;
        }

        .day-appt-item {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 8px 0;
            border-bottom: 1px solid #eee;
            font-size: 13px;
        }

        .day-appt-item:last-child { border-bottom: none; }

        .day-appt-time {
            min-width: 90px;
            font-weight: 700;
            color: var(--primary);
        }

        .day-appt-name { font-weight: 600; }
        .day-appt-treatment { color: #666; }

        /* ── Appointment detail popup ────────────────────── */
        #apptDetailPopup {
            position: fixed;
            z-index: 2000;
            background: white;
            border-radius: 10px;
            padding: 18px;
            width: 280px;
            box-shadow: 0 8px 30px rgba(0,0,0,0.2);
            display: none;
        }

        #apptDetailPopup h4 {
            margin: 0 0 10px;
            color: var(--primary);
            font-size: 15px;
        }

        #apptDetailPopup .popup-row {
            font-size: 13px;
            margin-bottom: 6px;
            display: flex;
            gap: 8px;
        }

        #apptDetailPopup .popup-label {
            color: #888;
            min-width: 80px;
            font-weight: 600;
        }

        #apptDetailPopup .popup-close {
            position: absolute;
            top: 10px;
            right: 12px;
            font-size: 20px;
            cursor: pointer;
            color: #aaa;
        }

        /* ── Responsive ──────────────────────────────────── */
        @media (max-width: 768px) {
            .dashboard-grid { grid-template-columns: repeat(2, 1fr); }
            .form-grid      { grid-template-columns: 1fr; }
            .full-width     { grid-column: 1; }
            .week-grid      { min-width: 600px; }
        }
    </style>
</head>
<body>

<!-- ══════════════════════════════════════════════
     LOGIN OVERLAY
══════════════════════════════════════════════ -->
<div id="loginOverlay">
    <div class="login-box">
        <h2>🦷 Joyful Smile Clinic</h2>
        <label for="loginEmail">Email</label>
        <input id="loginEmail" type="email" placeholder="you@example.com">
        <label for="loginPassword">Password</label>
        <input id="loginPassword" type="password" placeholder="••••••••">
        <button id="loginBtn">Log In</button>
        <p id="loginError"></p>
    </div>
</div>


<!-- ══════════════════════════════════════════════
     DASHBOARD
══════════════════════════════════════════════ -->
<div id="dashboardSection" class="container" style="display:none;">
    <div class="top-bar">
        <h1>🦷 Joyful Smile Dashboard</h1>
        <div class="top-bar-right">
            <div id="userBadge">
                <span>👤</span>
                <span id="userBadgeName">—</span>
                <span class="role-tag" id="userBadgeRole">—</span>
            </div>
            <button class="btn-logout" id="logoutBtn">🚪 Logout</button>
        </div>
    </div>

    <div class="dashboard-grid">
        <div class="dash-card" id="card-appointment">📅<h3>Appointment</h3></div>
        <div class="dash-card" id="card-consultation">🩺<h3>Consultation</h3></div>
        <div class="dash-card" id="card-drugbook">💊<h3>Drug Book</h3></div>
        <div class="dash-card" id="card-report">📊<h3>Report</h3></div>
        <div class="dash-card" id="card-patient">👥<h3>Patient</h3></div>
        <div class="dash-card" id="card-expenses">💰<h3>Expenses</h3></div>
        <div class="dash-card" id="card-inventory">📦<h3>Inventory</h3></div>
        <div class="dash-card" id="card-configuration">⚙️<h3>Configuration</h3></div>
    </div>
</div>


<!-- ══════════════════════════════════════════════
     PATIENT SECTION
══════════════════════════════════════════════ -->
<div id="patientSection" class="container" style="display:none;">
    <button class="back-btn" id="backBtn">← Back to Dashboard</button>

    <div class="section-header">
        <h2>👥 Patient Directory</h2>
        <button class="btn-add" id="mainAddBtn">+ New Patient</button>
    </div>

    <input type="text" id="searchInput"
           placeholder="🔍  Search by patient no., name, phone, HKID or email…">

    <table>
        <thead>
            <tr>
                <th>Patient No. / Name</th>
                <th>Phone</th>
                <th>DOB</th>
                <th>HKID</th>
                <th>Alerts</th>
                <th>Actions</th>
            </tr>
        </thead>
        <tbody id="patientTableBody"></tbody>
    </table>
</div>


<!-- ══════════════════════════════════════════════
     APPOINTMENT SECTION
══════════════════════════════════════════════ -->
<div id="appointmentSection" class="container" style="display:none;">
    <button class="back-btn" id="apptBackBtn">← Back to Dashboard</button>

    <!-- User heading bar -->
    <div class="appt-user-bar">
        <div class="user-info">
            <span style="font-size:24px;">👤</span>
            <div>
                <div class="user-name" id="apptUserName">—</div>
                <div style="font-size:12px; opacity:0.8;">Logged in</div>
            </div>
            <span class="user-role" id="apptUserRole">—</span>
        </div>
        <div class="appt-date" id="apptTodayDate">—</div>
    </div>

    <!-- Tabs -->
    <div class="appt-tabs">
        <button class="appt-tab-btn active" data-tab="today">
            📋 Today's Appointments
        </button>
        <button class="appt-tab-btn" data-tab="queue">
            🏥 Current Queue
        </button>
        <button class="appt-tab-btn" data-tab="calendar">
            📅 Calendar
        </button>
    </div>

    <!-- ── Tab 1: Today's Appointments ── -->
    <div id="tab-today" class="appt-tab-content active">
        <div class="appt-toolbar">
            <div>
                <strong style="font-size:16px; color:#333;">
                    📋 Appointments for
                    <span id="todayLabel" style="color:var(--primary);"></span>
                </strong>
                <span id="apptCountBadge"
                      style="background:#e8f4ff; color:var(--primary);
                             font-size:12px; font-weight:700; padding:2px 8px;
                             border-radius:10px; margin-left:8px;"></span>
            </div>
            <button class="btn-add" id="addApptBtn"
                    style="display:none;">
                + Add Appointment
            </button>
        </div>

        <div class="appt-table-wrap">
            <table class="appt-table">
                <thead>
                    <tr>
                        <th>Time</th>
                        <th>Patient No.</th>
                        <th>Name</th>
                        <th>Treatment</th>
                        <th>Remarks</th>
                        <th>Duration</th>
                        <th>Status</th>
                        <th>Action</th>
                    </tr>
                </thead>
                <tbody id="todayApptBody"></tbody>
            </table>
        </div>
        <p style="font-size:12px; color:#aaa; margin-top:10px;">
            💡 Double-click a patient row to check them in to the queue
        </p>
    </div>

    <!-- ── Tab 2: Current Queue ── -->
    <div id="tab-queue" class="appt-tab-content">
        <div class="appt-toolbar">
            <strong style="font-size:16px; color:#333;">
                🏥 Current Queue
                <span id="queueCountBadge"
                      style="background:#fff3cd; color:#856404;
                             font-size:12px; font-weight:700; padding:2px 8px;
                             border-radius:10px; margin-left:8px;"></span>
            </strong>
        </div>

        <div class="appt-table-wrap">
            <table class="appt-table">
                <thead>
                    <tr>
                        <th>Patient No.</th>
                        <th>Name</th>
                        <th>Treatment</th>
                        <th>Remarks</th>
                        <th>Appt Time</th>
                        <th>Arrival Time</th>
                        <th>Voucher No.</th>
                        <th>Bill Status</th>
                        <th>Action</th>
                    </tr>
                </thead>
                <tbody id="queueBody"></tbody>
            </table>
        </div>
    </div>

    <!-- ── Tab 3: Calendar ── -->
    <div id="tab-calendar" class="appt-tab-content">
        <div class="cal-toolbar">
            <div class="cal-nav">
                <button id="calPrev">&#8249;</button>
                <div class="cal-title" id="calTitle">—</div>
                <button id="calNext">&#8250;</button>
            </div>
            <div style="display:flex; gap:10px; align-items:center;">
                <div class="cal-toggle">
                    <button class="cal-toggle-btn active" id="btnWeekly">
                        Weekly
                    </button>
                    <button class="cal-toggle-btn" id="btnMonthly">
                        Monthly
                    </button>
                </div>
                <button class="btn-add" id="calAddApptBtn">
                    + Add Appointment
                </button>
            </div>
        </div>

        <div id="calendarBody"></div>

        <!-- Day detail panel (shown when clicking a day) -->
        <div id="dayDetailPanel" class="day-detail-panel" style="display:none;">
            <h4 id="dayDetailTitle">Appointments on —</h4>
            <div id="dayDetailList"></div>
        </div>
    </div>
</div>


<!-- ══════════════════════════════════════════════
     ADD PATIENT MODAL
══════════════════════════════════════════════ -->
<div id="addPatientModal" class="modal">
    <div class="modal-content">
        <span class="close" id="closeAddModal">&times;</span>
        <h2>🆕 New Patient Registration</h2>

        <form id="patientForm">
            <div class="form-grid">
                <div class="form-group full-width"
                     style="background:#e8f4ff; padding:10px 14px;
                            border-radius:8px; margin-bottom:4px;">
                    <label style="color:var(--primary);">
                        Patient Number (auto-assigned)
                    </label>
                    <input type="text" id="preview_patientNo"
                           readonly placeholder="Will be assigned on save…"
                           style="background:transparent; border:none;
                                  font-size:18px; font-weight:700;
                                  color:var(--primary); padding:4px 0;">
                </div>

                <div class="form-group">
                    <label>Full Name *</label>
                    <input type="text" id="fullName" placeholder="Full Name" required>
                </div>

                <div class="form-group">
                    <label>Chinese Name</label>
                    <input type="text" id="chineseName" placeholder="中文姓名">
                </div>

                <div class="form-group">
                    <label>Phone Number</label>
                    <input type="text" id="phone" placeholder="e.g. 9123 4567">
                </div>

                <div class="form-group">
                    <label>Email</label>
                    <input type="email" id="email" placeholder="email@example.com">
                </div>

                <div class="form-group">
                    <label>Sex</label>
                    <select id="sex">
                        <option value="">-- Select --</option>
                        <option value="M">Male (M)</option>
                        <option value="F">Female (F)</option>
                    </select>
                </div>

                <div class="form-group">
                    <label>Date of Birth</label>
                    <input type="date" id="dob">
                </div>

                <div class="form-group">
                    <label>HKID No.</label>
                    <input type="text" id="hkid" placeholder="e.g. A123456(7)">
                </div>

                <div class="form-group">
                    <label>Insurance No.</label>
                    <input type="text" id="insuranceNo">
                </div>

                <div class="form-group">
                    <label>Occupation</label>
                    <input type="text" id="occupation">
                </div>

                <div class="form-group full-width">
                    <label>Address</label>
                    <input type="text" id="address">
                </div>

                <div class="form-group full-width">
                    <label>Medical Alerts ⚠️</label>
                    <textarea id="alerts" rows="2"
                              placeholder="Allergies, conditions…"></textarea>
                </div>

                <div class="form-group full-width">
                    <label>Remarks</label>
                    <textarea id="remarks" rows="2"
                              placeholder="Any other remarks…"></textarea>
                </div>
            </div>

            <button type="submit" class="btn-add"
                    style="width:100%; margin-top:18px; padding:12px;">
                ✅ Register Patient
            </button>
        </form>
    </div>
</div>


<!-- ══════════════════════════════════════════════
     PATIENT DETAILS MODAL  (treatment history)
══════════════════════════════════════════════ -->
<div id="patientDetailsModal" class="modal">
    <div class="modal-content" style="max-width:820px;">
        <span class="close" id="closeDetailsModal">&times;</span>

        <div style="margin-bottom:6px;">
            <span id="det_patientNo"
                  style="display:inline-block; background:#e8f4ff;
                         color:var(--primary); font-size:13px; font-weight:700;
                         padding:3px 10px; border-radius:10px; margin-bottom:6px;">
            </span>
        </div>

        <h2 id="det_patientName" style="margin:0 0 4px;"></h2>
        <p  id="det_alerts"
            style="color:var(--danger); font-weight:bold; margin:0 0 16px;"></p>

        <div id="bulkEntrySection">
            <h3 style="margin-top:0; font-size:16px;">Add Clinical Note</h3>
            <textarea id="bulkNoteInput" rows="3"
                      placeholder="Enter treatment details…"
                      style="width:100%; padding:10px; border:1px solid #ddd;
                             border-radius:6px; font-size:14px;
                             box-sizing:border-box; resize:vertical;"></textarea>
            <button class="btn-add" id="noteSaveBtn" style="margin-top:10px;">
                Add to History
            </button>
        </div>

        <h3 style="margin-bottom:8px;">Treatment History</h3>
        <div id="treatmentTimeline" class="history-container">Loading…</div>
    </div>
</div>


<!-- ══════════════════════════════════════════════
     EDIT PATIENT MODAL
══════════════════════════════════════════════ -->
<div id="editPatientModal" class="modal">
    <div class="modal-content">
        <span class="close" id="closeEditModal">&times;</span>
        <h2>✏️ Edit Patient Info</h2>

        <form id="editPatientForm">
            <div class="form-grid">
                <div class="form-group full-width"
                     style="background:#e8f4ff; padding:10px 14px;
                            border-radius:8px; margin-bottom:4px;">
                    <label style="color:var(--primary);">Patient Number</label>
                    <input type="text" id="edit_patientNo" readonly
                           style="background:transparent; border:none;
                                  font-size:18px; font-weight:700;
                                  color:var(--primary); padding:4px 0;">
                </div>

                <div class="form-group">
                    <label>Full Name *</label>
                    <input type="text" id="edit_fullName" required>
                </div>

                <div class="form-group">
                    <label>Chinese Name</label>
                    <input type="text" id="edit_chineseName">
                </div>

                <div class="form-group">
                    <label>Phone Number</label>
                    <input type="text" id="edit_phone">
                </div>

                <div class="form-group">
                    <label>Email</label>
                    <input type="email" id="edit_email">
                </div>

                <div class="form-group">
                    <label>Sex</label>
                    <select id="edit_sex">
                        <option value="">-- Select --</option>
                        <option value="M">Male (M)</option>
                        <option value="F">Female (F)</option>
                    </select>
                </div>

                <div class="form-group">
                    <label>Date of Birth</label>
                    <input type="date" id="edit_dob">
                </div>

                <div class="form-group">
                    <label>HKID No.</label>
                    <input type="text" id="edit_hkid">
                </div>

                <div class="form-group">
                    <label>Insurance No.</label>
                    <input type="text" id="edit_insuranceNo">
                </div>

                <div class="form-group">
                    <label>Occupation</label>
                    <input type="text" id="edit_occupation">
                </div>

                <div class="form-group full-width">
                    <label>Address</label>
                    <input type="text" id="edit_address">
                </div>

                <div class="form-group full-width">
                    <label>Medical Alerts ⚠️</label>
                    <textarea id="edit_alerts" rows="2"></textarea>
                </div>

                <div class="form-group full-width">
                    <label>Remarks</label>
                    <textarea id="edit_remarks" rows="2"></textarea>
                </div>
            </div>

            <div style="display:flex; justify-content:space-between;
                        align-items:center; margin-top:22px;">
                <button type="button" id="edit_deleteBtn"
                        style="background:var(--danger); color:white; border:none;
                               padding:10px 20px; border-radius:6px; cursor:pointer;
                               font-weight:bold;">
                    🗑 Delete Patient
                </button>

                <div style="display:flex; gap:10px;">
                    <button type="button" id="cancelEditBtn"
                            style="background:var(--gray); color:white; border:none;
                                   padding:10px 20px; border-radius:6px; cursor:pointer;">
                        Cancel
                    </button>
                    <button type="submit" class="btn-add" style="padding:10px 25px;">
                        💾 Save Changes
                    </button>
                </div>
            </div>
        </form>
    </div>
</div>


<!-- ══════════════════════════════════════════════
     ADD APPOINTMENT MODAL
══════════════════════════════════════════════ -->
<div id="addApptModal" class="modal">
    <div class="modal-content" style="max-width:560px;">
        <span class="close" id="closeApptModal">&times;</span>
        <h2>📅 New Appointment</h2>

        <form id="apptForm">
            <div class="form-grid">

                <!-- Patient search -->
                <div class="form-group full-width">
                    <label>Search Patient *</label>
                    <div class="patient-search-wrap">
                        <input type="text" id="apptPatientSearch"
                               placeholder="Type name or patient number…"
                               autocomplete="off">
                        <div class="patient-dropdown"
                             id="apptPatientDropdown"
                             style="display:none;"></div>
                    </div>
                    <!-- Hidden selected patient info -->
                    <input type="hidden" id="apptPatientId">
                    <input type="hidden" id="apptPatientNo">
                    <input type="hidden" id="apptPatientNameVal">
                    <div id="apptSelectedPatient"
                         style="margin-top:6px; font-size:13px; color:var(--success);
                                font-weight:600; display:none;">
                        ✅ <span id="apptSelectedName"></span>
                        (<span id="apptSelectedNo"></span>)
                    </div>
                </div>

                <!-- Date -->
                <div class="form-group">
                    <label>Date *</label>
                    <input type="date" id="apptDate" required>
                </div>

                <!-- Start time -->
                <div class="form-group">
                    <label>Start Time *</label>
                    <select id="apptStartTime" required></select>
                </div>

                <!-- Duration -->
                <div class="form-group">
                    <label>Duration</label>
                    <select id="apptDuration">
                        <option value="15">15 minutes</option>
                        <option value="30" selected>30 minutes</option>
                        <option value="45">45 minutes</option>
                        <option value="60">60 minutes</option>
                        <option value="90">90 minutes</option>
                        <option value="120">120 minutes</option>
                    </select>
                </div>

                <!-- End time (auto-calculated, readonly) -->
                <div class="form-group">
                    <label>End Time (auto)</label>
                    <input type="text" id="apptEndTime" readonly
                           placeholder="Auto-calculated">
                </div>

                <!-- Treatment items -->
                <div class="form-group full-width">
                    <label>Treatment Items</label>
                    <input type="text" id="apptTreatment"
                           placeholder="e.g. Scaling, Filling, Extraction…">
                </div>

                <!-- Remarks -->
                <div class="form-group full-width">
                    <label>Remarks</label>
                    <textarea id="apptRemarks" rows="2"
                              placeholder="Additional notes…"></textarea>
                </div>
            </div>

            <button type="submit" class="btn-add"
                    style="width:100%; margin-top:18px; padding:12px;">
                ✅ Save Appointment
            </button>
        </form>
    </div>
</div>


<!-- ══════════════════════════════════════════════
     APPOINTMENT DETAIL POPUP (calendar chip click)
══════════════════════════════════════════════ -->
<div id="apptDetailPopup">
    <span class="popup-close" id="closeApptPopup">&times;</span>
    <h4>📋 Appointment Details</h4>
    <div id="apptPopupContent"></div>
</div>


<!-- ══════════════════════════════════════════════
     SCRIPTS
══════════════════════════════════════════════ -->
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
<script src="app.js"></script>

</body>
</html>
```

---

## Step 3 — Complete `app.js`

```javascript
// ════════════════════════════════════════════════════════════════
// CONFIG
// ════════════════════════════════════════════════════════════════
const SUPABASE_URL = 'https://kprihawipljrltfzpfjd.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtwcmloYXdpcGxqcmx0ZnpwZmpkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY3NzUyMzAsImV4cCI6MjA5MjM1MTIzMH0.fHbfVQOmIMOTbjBTG6iy2yrgmo-iZXEe-wNLlAlVtM4';
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ════════════════════════════════════════════════════════════════
// STATE
// ════════════════════════════════════════════════════════════════
let currentSelectedPatientId = null;
let currentEditingPatientId  = null;
let currentUserRole          = null;
let currentUserName          = null;

// Appointment state
let apptCalView              = 'weekly';   // 'weekly' | 'monthly'
let apptCalDate              = new Date(); // reference date for calendar
let apptEditingId            = null;       // appointment being edited

// ════════════════════════════════════════════════════════════════
// HELPER
// ════════════════════════════════════════════════════════════════
function el(id) { return document.getElementById(id); }

function todayISO() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function formatTime12(timeStr) {
    // timeStr = "HH:MM" or "HH:MM:SS"
    if (!timeStr) return '—';
    const [h, m] = timeStr.split(':').map(Number);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12  = h % 12 || 12;
    return `${h12}:${String(m).padStart(2,'0')} ${ampm}`;
}

function addMinutes(timeStr, mins) {
    const [h, m] = timeStr.split(':').map(Number);
    const total  = h * 60 + m + parseInt(mins);
    const nh     = Math.floor(total / 60) % 24;
    const nm     = total % 60;
    return `${String(nh).padStart(2,'0')}:${String(nm).padStart(2,'0')}`;
}

function formatDateDisplay(dateStr) {
    if (!dateStr) return '—';
    const [y, m, d] = dateStr.split('-');
    const names = ['Jan','Feb','Mar','Apr','May','Jun',
                   'Jul','Aug','Sep','Oct','Nov','Dec'];
    return `${parseInt(d)} ${names[parseInt(m)-1]} ${y}`;
}

// Populate time dropdown (08:00 to 21:00 in 15-min steps)
function populateTimeSelect(selectId, defaultVal) {
    const sel = el(selectId);
    sel.innerHTML = '';
    for (let h = 8; h <= 21; h++) {
        for (let m = 0; m < 60; m += 15) {
            const val = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
            const opt = document.createElement('option');
            opt.value       = val;
            opt.textContent = formatTime12(val);
            if (defaultVal && val === defaultVal) opt.selected = true;
            sel.appendChild(opt);
        }
    }
}

// ════════════════════════════════════════════════════════════════
// SCREEN SWITCHERS
// ════════════════════════════════════════════════════════════════
function showLogin() {
    el('loginOverlay').style.display        = 'flex';
    el('dashboardSection').style.display    = 'none';
    el('patientSection').style.display      = 'none';
    el('appointmentSection').style.display  = 'none';
    el('loginError').style.display          = 'none';
    el('loginError').textContent            = '';
}

function showDashboard() {
    el('loginOverlay').style.display        = 'none';
    el('dashboardSection').style.display    = 'block';
    el('patientSection').style.display      = 'none';
    el('appointmentSection').style.display  = 'none';

    // Update user badge in dashboard
    if (currentUserName) {
        el('userBadgeName').textContent = currentUserName;
        el('userBadgeRole').textContent = currentUserRole || '—';
    }
}

// ════════════════════════════════════════════════════════════════
// BOOT
// ════════════════════════════════════════════════════════════════
window.addEventListener('DOMContentLoaded', async () => {

    showLogin();

    // Populate time selects
    populateTimeSelect('apptStartTime', '09:00');

    // Set today's date as default in appointment form
    el('apptDate').value = todayISO();

    // Auto-calc end time when start or duration changes
    el('apptStartTime').addEventListener('change', calcEndTime);
    el('apptDuration').addEventListener('change',  calcEndTime);
    calcEndTime();

    const { data: { session } } = await _supabase.auth.getSession();
    if (session) await checkUserRole(session.user.id);

    _supabase.auth.onAuthStateChange(async (event, session) => {
        if (event === 'SIGNED_IN'  && session) await checkUserRole(session.user.id);
        if (event === 'SIGNED_OUT')             showLogin();
    });

    // ── Static listeners ─────────────────────────────────────────
    el('loginBtn').addEventListener('click', handleLogin);
    el('loginPassword').addEventListener('keydown', e => {
        if (e.key === 'Enter') handleLogin();
    });
    el('logoutBtn').addEventListener('click', handleLogout);

    // Patient module
    el('backBtn').addEventListener('click', backToDashboard);
    el('mainAddBtn').addEventListener('click', openAddPatientModal);
    el('searchInput').addEventListener('input', searchPatients);
    el('closeAddModal').addEventListener('click',
        () => toggleModal('addPatientModal', false));
    el('closeDetailsModal').addEventListener('click',
        () => toggleModal('patientDetailsModal', false));
    el('closeEditModal').addEventListener('click',
        () => toggleModal('editPatientModal', false));
    el('cancelEditBtn').addEventListener('click',
        () => toggleModal('editPatientModal', false));
    el('edit_deleteBtn').addEventListener('click', deletePatientFromEdit);
    el('noteSaveBtn').addEventListener('click', saveBulkNote);

    // Appointment module
    el('apptBackBtn').addEventListener('click', backToDashboard);
    el('addApptBtn').addEventListener('click', () => openApptModal());
    el('calAddApptBtn').addEventListener('click', () => openApptModal());
    el('closeApptModal').addEventListener('click',
        () => toggleModal('addApptModal', false));
    el('closeApptPopup').addEventListener('click',
        () => { el('apptDetailPopup').style.display = 'none'; });

    // Appointment form submit
    el('apptForm').addEventListener('submit', saveAppointment);

    // Appointment tabs
    document.querySelectorAll('.appt-tab-btn').forEach(btn => {
        btn.addEventListener('click', () => switchApptTab(btn.dataset.tab));
    });

    // Calendar controls
    el('btnWeekly').addEventListener('click', () => {
        apptCalView = 'weekly';
        el('btnWeekly').classList.add('active');
        el('btnMonthly').classList.remove('active');
        renderCalendar();
    });
    el('btnMonthly').addEventListener('click', () => {
        apptCalView = 'monthly';
        el('btnMonthly').classList.add('active');
        el('btnWeekly').classList.remove('active');
        renderCalendar();
    });
    el('calPrev').addEventListener('click', () => {
        if (apptCalView === 'weekly') {
            apptCalDate.setDate(apptCalDate.getDate() - 7);
        } else {
            apptCalDate.setMonth(apptCalDate.getMonth() - 1);
        }
        renderCalendar();
    });
    el('calNext').addEventListener('click', () => {
        if (apptCalView === 'weekly') {
            apptCalDate.setDate(apptCalDate.getDate() + 7);
        } else {
            apptCalDate.setMonth(apptCalDate.getMonth() + 1);
        }
        renderCalendar();
    });

    // Patient search in appointment form
    el('apptPatientSearch').addEventListener('input', searchPatientsForAppt);

    // ── Dashboard cards ──────────────────────────────────────────
    el('card-patient').addEventListener('click',
        () => switchPath('patient'));
    el('card-appointment').addEventListener('click',
        () => switchPath('appointment'));

    ['card-consultation','card-drugbook','card-report',
     'card-expenses','card-inventory','card-configuration']
        .forEach(id => {
            const card = el(id);
            if (card) card.addEventListener('click', () => {
                const name = id.replace('card-', '');
                alert(name.charAt(0).toUpperCase() +
                      name.slice(1) + ' module coming soon!');
            });
        });

    // ── Add Patient form ─────────────────────────────────────────
    el('patientForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const nextNo = await generatePatientNo();
        const payload = {
            patient_no:     nextNo,
            full_name:      el('fullName').value.trim(),
            chinese_name:   el('chineseName').value.trim()  || null,
            phone_number:   el('phone').value.trim()        || null,
            email:          el('email').value.trim()        || null,
            sex:            el('sex').value                 || null,
            dob:            el('dob').value                 || null,
            hkid:           el('hkid').value.trim()         || null,
            insurance_no:   el('insuranceNo').value.trim()  || null,
            occupation:     el('occupation').value.trim()   || null,
            address:        el('address').value.trim()      || null,
            medical_alerts: el('alerts').value.trim()       || null,
            remarks:        el('remarks').value.trim()      || null,
        };
        const { error } = await _supabase.from('patients').insert([payload]);
        if (error) return alert('Error saving patient: ' + error.message);
        toggleModal('addPatientModal', false);
        el('patientForm').reset();
        el('preview_patientNo').value = '';
        fetchPatients();
        alert(`✅ Patient "${payload.full_name}" registered!\nPatient No: ${nextNo}`);
    });

    // ── Edit Patient form ────────────────────────────────────────
    el('editPatientForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!currentEditingPatientId) return;
        const payload = {
            full_name:      el('edit_fullName').value.trim(),
            chinese_name:   el('edit_chineseName').value.trim()  || null,
            phone_number:   el('edit_phone').value.trim()        || null,
            email:          el('edit_email').value.trim()        || null,
            sex:            el('edit_sex').value                 || null,
            dob:            el('edit_dob').value                 || null,
            hkid:           el('edit_hkid').value.trim()         || null,
            insurance_no:   el('edit_insuranceNo').value.trim()  || null,
            occupation:     el('edit_occupation').value.trim()   || null,
            address:        el('edit_address').value.trim()      || null,
            medical_alerts: el('edit_alerts').value.trim()       || null,
            remarks:        el('edit_remarks').value.trim()      || null,
        };
        const { error } = await _supabase
            .from('patients').update(payload)
            .eq('id', currentEditingPatientId);
        if (error) return alert('Error updating patient: ' + error.message);
        toggleModal('editPatientModal', false);
        fetchPatients();
        alert(`✅ Patient "${payload.full_name}" updated!`);
    });

}); // end DOMContentLoaded

// ════════════════════════════════════════════════════════════════
// PATIENT NUMBER — AUTO-GENERATE
// ════════════════════════════════════════════════════════════════
async function generatePatientNo() {
    const START = 1000;
    const { data, error } = await _supabase
        .from('patients').select('patient_no');
    if (error || !data || !data.length)
        return String(START).padStart(6, '0');
    const nums = data
        .map(p => parseInt(p.patient_no, 10))
        .filter(n => !isNaN(n));
    if (!nums.length) return String(START).padStart(6, '0');
    return String(Math.max(...nums) + 1).padStart(6, '0');
}

async function previewNextPatientNo() {
    const next = await generatePatientNo();
    el('preview_patientNo').value = next;
}

// ════════════════════════════════════════════════════════════════
// AUTH
// ════════════════════════════════════════════════════════════════
async function handleLogin() {
    const email    = el('loginEmail').value.trim();
    const password = el('loginPassword').value;
    const errEl    = el('loginError');

    if (!email || !password) {
        errEl.textContent   = '⚠️ Please enter your email and password.';
        errEl.style.display = 'block';
        return;
    }
    errEl.style.display = 'none';

    const { data, error } = await _supabase.auth.signInWithPassword({
        email, password
    });
    if (error) {
        errEl.textContent   = '❌ ' + error.message;
        errEl.style.display = 'block';
        return;
    }
    await checkUserRole(data.user.id);
}

async function handleLogout() {
    await _supabase.auth.signOut();
    currentUserRole          = null;
    currentUserName          = null;
    currentSelectedPatientId = null;
    currentEditingPatientId  = null;
    showLogin();
}

async function checkUserRole(userId) {
    const { data: profile, error } = await _supabase
        .from('profiles')
        .select('role, full_name')
        .eq('id', userId)
        .single();

    if (error || !profile) {
        console.error('Profile load failed:', error);
        showLogin();
        return;
    }

    currentUserRole = profile.role;
    currentUserName = profile.full_name || 'User';
    applyPermissions(currentUserRole);
    showDashboard();
}

// ════════════════════════════════════════════════════════════════
// PERMISSIONS
// ════════════════════════════════════════════════════════════════
function applyPermissions(role) {
    const addBtn = el('mainAddBtn');
    if (addBtn) {
        addBtn.style.display = role === 'nurse' ? 'none' : 'inline-block';
    }

    document.querySelectorAll('.btn-edit-patient').forEach(btn => {
        btn.style.display = role === 'nurse' ? 'none' : 'inline-block';
    });

    const delBtn = el('edit_deleteBtn');
    if (delBtn) {
        delBtn.style.display = role === 'nurse' ? 'none' : 'inline-block';
    }

    // Appointment add button — nurses cannot add
    const apptAddBtn = el('addApptBtn');
    if (apptAddBtn) {
        apptAddBtn.style.display = role === 'nurse' ? 'none' : 'inline-block';
    }
    const calAddBtn = el('calAddApptBtn');
    if (calAddBtn) {
        calAddBtn.style.display = role === 'nurse' ? 'none' : 'inline-block';
    }

    const section = el('bulkEntrySection');
    if (section && role === 'nurse') {
        section.innerHTML =
            '<p style="color:#888; font-style:italic; margin:0;">' +
            '🔒 Viewing Mode — nurses cannot add or edit records.</p>';
    }
}

// ════════════════════════════════════════════════════════════════
// NAVIGATION
// ════════════════════════════════════════════════════════════════
function switchPath(module) {
    el('dashboardSection').style.display    = 'none';
    el('patientSection').style.display      = 'none';
    el('appointmentSection').style.display  = 'none';

    if (module === 'patient') {
        el('patientSection').style.display = 'block';
        fetchPatients();
    } else if (module === 'appointment') {
        el('appointmentSection').style.display = 'block';
        initAppointmentModule();
    }
}

function backToDashboard() {
    el('patientSection').style.display      = 'none';
    el('appointmentSection').style.display  = 'none';
    el('dashboardSection').style.display    = 'block';
}

// ════════════════════════════════════════════════════════════════
// MODAL HELPER
// ════════════════════════════════════════════════════════════════
function toggleModal(id, show) {
    const modal = el(id);
    if (!modal) return;
    modal.style.display = show ? 'block' : 'none';
    if (!show && id === 'patientDetailsModal') currentSelectedPatientId = null;
    if (!show && id === 'editPatientModal')    currentEditingPatientId  = null;
    if (!show && id === 'addApptModal')        apptEditingId            = null;
    if (show && currentUserRole) applyPermissions(currentUserRole);
}

async function openAddPatientModal() {
    el('patientForm').reset();
    await previewNextPatientNo();
    toggleModal('addPatientModal', true);
}

// ════════════════════════════════════════════════════════════════
// PATIENT — FETCH & RENDER
// ════════════════════════════════════════════════════════════════
async function fetchPatients() {
    const { data, error } = await _supabase
        .from('patients')
        .select('*')
        .order('patient_no', { ascending: true });
    if (error) return console.error('fetchPatients error:', error);
    renderTable(data);
}

function renderTable(patients) {
    const tbody = el('patientTableBody');
    if (!patients || patients.length === 0) {
        tbody.innerHTML =
            '<tr><td colspan="6" style="text-align:center;' +
            ' padding:30px; color:#999;">No patients found.</td></tr>';
        return;
    }

    tbody.innerHTML = patients.map(p => {
        let dob = '--';
        if (p.dob) {
            const [y, m, d] = p.dob.split('-');
            dob = `${d}/${m}/${y}`;
        }
        return `
        <tr>
            <td>
                ${p.patient_no
                    ? `<span class="patient-no-badge"># ${p.patient_no}</span><br>`
                    : ''}
                <strong>${p.full_name}</strong>
                ${p.chinese_name
                    ? `<br><small style="color:#999;">${p.chinese_name}</small>`
                    : ''}
            </td>
            <td>${p.phone_number || '--'}</td>
            <td style="white-space:nowrap;">${dob}</td>
            <td>${p.hkid || '--'}</td>
            <td>
                <small style="color:${p.medical_alerts
                    ? 'var(--danger)' : '#bbb'};">
                    ${p.medical_alerts || 'None'}
                </small>
            </td>
            <td>
                <div style="display:flex; gap:8px; flex-wrap:wrap;">
                    <button class="btn-view btn-notes" data-id="${p.id}">
                        📋 Notes
                    </button>
                    <button class="btn-edit-patient" data-id="${p.id}"
                            style="background:var(--primary); color:white;
                                   border:none; padding:6px 12px;
                                   border-radius:4px; cursor:pointer;
                                   font-size:13px;
                                   display:${currentUserRole === 'nurse'
                                       ? 'none' : 'inline-block'};">
                        ✏️ Edit
                    </button>
                </div>
            </td>
        </tr>`;
    }).join('');

    tbody.querySelectorAll('.btn-notes').forEach(btn => {
        btn.addEventListener('click', () => viewHistory(btn.dataset.id));
    });
    tbody.querySelectorAll('.btn-edit-patient').forEach(btn => {
        btn.addEventListener('click', () => openEditPatient(btn.dataset.id));
    });
}

function searchPatients() {
    const q = el('searchInput').value.toLowerCase();
    document.querySelectorAll('#patientTableBody tr').forEach(row => {
        row.style.display =
            row.innerText.toLowerCase().includes(q) ? '' : 'none';
    });
}

// ════════════════════════════════════════════════════════════════
// PATIENT — EDIT MODAL
// ════════════════════════════════════════════════════════════════
async function openEditPatient(patientId) {
    if (!patientId) return;
    currentEditingPatientId = patientId;

    const { data: p, error } = await _supabase
        .from('patients').select('*')
        .eq('id', patientId).single();
    if (error || !p) return alert('Could not load patient data.');

    el('edit_patientNo').value   = p.patient_no     || '—';
    el('edit_fullName').value    = p.full_name       || '';
    el('edit_chineseName').value = p.chinese_name    || '';
    el('edit_phone').value       = p.phone_number    || '';
    el('edit_email').value       = p.email           || '';
    el('edit_sex').value         = p.sex             || '';
    el('edit_dob').value         = p.dob             || '';
    el('edit_hkid').value        = p.hkid            || '';
    el('edit_insuranceNo').value = p.insurance_no    || '';
    el('edit_occupation').value  = p.occupation      || '';
    el('edit_address').value     = p.address         || '';
    el('edit_alerts').value      = p.medical_alerts  || '';
    el('edit_remarks').value     = p.remarks         || '';

    toggleModal('editPatientModal', true);
}

// ════════════════════════════════════════════════════════════════
// PATIENT — DELETE
// ════════════════════════════════════════════════════════════════
async function deletePatientFromEdit() {
    if (currentUserRole === 'nurse') return alert('Permission denied.');
    if (!currentEditingPatientId)   return;

    const name = el('edit_fullName').value || 'this patient';
    const no   = el('edit_patientNo').value;

    if (!confirm(
        `⚠️ Permanently delete Patient #${no} "${name}" ` +
        `and ALL their treatment records?\n\nThis cannot be undone.`
    )) return;

    await _supabase.from('treatments').delete()
        .eq('patient_id', currentEditingPatientId);

    const { error } = await _supabase.from('patients').delete()
        .eq('id', currentEditingPatientId);
    if (error) return alert('Error deleting patient: ' + error.message);

    toggleModal('editPatientModal', false);
    fetchPatients();
    alert(`🗑️ Patient #${no} "${name}" has been deleted.`);
}

// ════════════════════════════════════════════════════════════════
// TREATMENT — VIEW HISTORY
// ════════════════════════════════════════════════════════════════
async function viewHistory(patientId) {
    if (!patientId) return;
    currentSelectedPatientId = patientId;

    const { data: patient, error } = await _supabase
        .from('patients').select('*')
        .eq('id', patientId).single();
    if (error || !patient) return alert('Could not load patient.');

    el('det_patientNo').textContent =
        patient.patient_no ? `# ${patient.patient_no}` : '';
    el('det_patientName').textContent =
        patient.full_name +
        (patient.chinese_name ? `  ${patient.chinese_name}` : '');
    el('det_alerts').textContent =
        patient.medical_alerts ? '⚠️  ' + patient.medical_alerts : '';

    if (currentUserRole !== 'nurse') {
        el('bulkEntrySection').innerHTML = `
            <h3 style="margin-top:0; font-size:16px;">Add Clinical Note</h3>
            <textarea id="bulkNoteInput" rows="3"
                      placeholder="Enter treatment details…"
                      style="width:100%; padding:10px; border:1px solid #ddd;
                             border-radius:6px; font-size:14px;
                             box-sizing:border-box; resize:vertical;">
            </textarea>
            <button class="btn-add" id="noteSaveBtn" style="margin-top:10px;">
                Add to History
            </button>`;
        el('noteSaveBtn').addEventListener('click', saveBulkNote);
    }

    await fetchTreatments(patientId);
    toggleModal('patientDetailsModal', true);
}

// ════════════════════════════════════════════════════════════════
// TREATMENT — FETCH & RENDER TIMELINE
// ════════════════════════════════════════════════════════════════
async function fetchTreatments(patientId) {
    const timeline = el('treatmentTimeline');
    timeline.innerHTML = '<p style="color:#999;">Loading…</p>';

    const { data, error } = await _supabase
        .from('treatments').select('*')
        .eq('patient_id', patientId)
        .order('created_at', { ascending: false });

    if (error || !data || !data.length) {
        timeline.innerHTML =
            '<p style="color:#999; margin:0;">No treatment history yet.</p>';
        return;
    }

    const todayStr = new Date().toDateString();

    timeline.innerHTML = data.map(t => {
        const isToday = new Date(t.created_at).toDateString() === todayStr;
        const canEdit = isToday && currentUserRole !== 'nurse';
        return `
        <div class="note-card">
            ${canEdit
                ? `<button class="btn-edit-note" data-note="${t.id}"
                           style="position:absolute; right:12px; top:12px;
                                  background:var(--primary); color:white;
                                  border:none; padding:4px 10px;
                                  border-radius:4px; cursor:pointer;
                                  font-size:12px;">✏️ Edit</button>`
                : ''}
            <small style="color:#aaa;">
                ${new Date(t.created_at).toLocaleString()}
            </small>
            <div id="note-text-${t.id}"
                 style="white-space:pre-wrap; margin-top:6px; font-size:14px;">
                ${t.notes}
            </div>
        </div>`;
    }).join('');

    timeline.querySelectorAll('.btn-edit-note').forEach(btn => {
        btn.addEventListener('click', () => prepareEdit(btn.dataset.note));
    });
}

// ════════════════════════════════════════════════════════════════
// TREATMENT — ADD NOTE
// ════════════════════════════════════════════════════════════════
async function saveBulkNote() {
    const noteInput = el('bulkNoteInput');
    if (!noteInput) return;
    const note = noteInput.value.trim();
    if (!note) return alert('Please enter a note before saving.');
    const { error } = await _supabase
        .from('treatments')
        .insert([{ patient_id: currentSelectedPatientId, notes: note }]);
    if (error) return alert('Error saving note: ' + error.message);
    noteInput.value = '';
    fetchTreatments(currentSelectedPatientId);
}

// ════════════════════════════════════════════════════════════════
// TREATMENT — INLINE EDIT
// ════════════════════════════════════════════════════════════════
function prepareEdit(noteId) {
    const noteDiv = el(`note-text-${noteId}`);
    if (!noteDiv) return;
    const original = noteDiv.innerText.trim();
    noteDiv.innerHTML = `
        <textarea id="edit-input-${noteId}"
                  style="width:100%; height:80px; padding:8px;
                         border:1px solid #ddd; border-radius:6px;
                         font-size:14px; box-sizing:border-box;
                         margin-top:8px; resize:vertical;"
        >${original}</textarea>
        <div style="display:flex; justify-content:space-between; margin-top:10px;">
            <button class="btn-del-note"
                    style="background:var(--danger); color:white; border:none;
                           padding:6px 14px; border-radius:4px; cursor:pointer;">
                🗑 Delete
            </button>
            <div style="display:flex; gap:8px;">
                <button class="btn-cancel-edit"
                        style="background:var(--gray); color:white; border:none;
                               padding:6px 14px; border-radius:4px; cursor:pointer;">
                    Cancel
                </button>
                <button class="btn-save-edit"
                        style="background:var(--success); color:white; border:none;
                               padding:6px 14px; border-radius:4px; cursor:pointer;">
                    💾 Save
                </button>
            </div>
        </div>`;
    noteDiv.querySelector('.btn-del-note')
           .addEventListener('click', () => deleteNote(noteId));
    noteDiv.querySelector('.btn-cancel-edit')
           .addEventListener('click',
               () => fetchTreatments(currentSelectedPatientId));
    noteDiv.querySelector('.btn-save-edit')
           .addEventListener('click', () => updateNote(noteId));
}

async function updateNote(noteId) {
    const input = el(`edit-input-${noteId}`);
    if (!input) return;
    const { error } = await _supabase
        .from('treatments')
        .update({ notes: input.value.trim() })
        .eq('id', noteId);
    if (error) return alert('Error updating note: ' + error.message);
    fetchTreatments(currentSelectedPatientId);
}

async function deleteNote(noteId) {
    if (!confirm('Permanently delete this note?')) return;
    const { error } = await _supabase
        .from('treatments').delete().eq('id', noteId);
    if (error) return alert('Error deleting note: ' + error.message);
    fetchTreatments(currentSelectedPatientId);
}

// ════════════════════════════════════════════════════════════════
// ══════════════════════════════════════════════════════════════
//  APPOINTMENT MODULE
// ══════════════════════════════════════════════════════════════
// ════════════════════════════════════════════════════════════════

function initAppointmentModule() {
    // Set user heading
    const roleEmoji = {
        admin:   '🛡️',
        dentist: '🦷',
        nurse:   '🩺'
    };
    const role = currentUserRole || 'user';
    el('apptUserName').textContent  = currentUserName || '—';
    el('apptUserRole').textContent  =
        (roleEmoji[role] || '👤') + ' ' +
        role.charAt(0).toUpperCase() + role.slice(1);

    // Today's date display
    const now = new Date();
    el('apptTodayDate').textContent =
        now.toLocaleDateString('en-HK', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });

    // Today label
    el('todayLabel').textContent = formatDateDisplay(todayISO());

    // RBAC — only admin/dentist can add
    const canAdd = currentUserRole !== 'nurse';
    el('addApptBtn').style.display    = canAdd ? 'inline-block' : 'none';
    el('calAddApptBtn').style.display = canAdd ? 'inline-block' : 'none';

    // Load data
    loadTodayAppointments();
    loadQueue();
    renderCalendar();
}

// ── Tab switching ──────────────────────────────────────────────
function switchApptTab(tab) {
    document.querySelectorAll('.appt-tab-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.tab === tab);
    });
    document.querySelectorAll('.appt-tab-content').forEach(c => {
        c.classList.toggle('active', c.id === `tab-${tab}`);
    });

    if (tab === 'today')    loadTodayAppointments();
    if (tab === 'queue')    loadQueue();
    if (tab === 'calendar') renderCalendar();
}

// ════════════════════════════════════════════════════════════════
// TAB 1 — TODAY'S APPOINTMENTS
// ════════════════════════════════════════════════════════════════
async function loadTodayAppointments() {
    const tbody = el('todayApptBody');
    tbody.innerHTML =
        '<tr><td colspan="8" style="text-align:center;' +
        ' padding:20px; color:#aaa;">Loading…</td></tr>';

    const today = todayISO();
    const { data, error } = await _supabase
        .from('appointments')
        .select('*')
        .eq('date', today)
        .order('start_time', { ascending: true });

    if (error) {
        tbody.innerHTML =
            `<tr><td colspan="8" style="color:red; padding:16px;">
             Error: ${error.message}</td></tr>`;
        return;
    }

    el('apptCountBadge').textContent =
        data && data.length
            ? `${data.length} appointment${data.length > 1 ? 's' : ''}`
            : '0 appointments';

    if (!data || data.length === 0) {
        tbody.innerHTML =
            '<tr><td colspan="8" style="text-align:center;' +
            ' padding:30px; color:#bbb;">No appointments today.</td></tr>';
        return;
    }

    tbody.innerHTML = data.map(a => {
        const timeDisplay =
            formatTime12(a.start_time) + ' – ' + formatTime12(a.end_time);
        const duration = a.duration ? `${a.duration} min` : '—';
        const arrivedBadge = a.arrived
            ? '<span class="badge badge-arrived">✅ Arrived</span>'
            : '<span class="badge badge-waiting">Waiting</span>';

        const canCheckin = !a.arrived;
        const canEdit    = currentUserRole !== 'nurse';

        return `
        <tr class="${a.arrived ? 'arrived' : ''}"
            data-id="${a.id}"
            style="cursor:pointer;"
            ondblclick="checkInPatient('${a.id}')">
            <td style="white-space:nowrap; font-weight:600;">
                ${timeDisplay}
            </td>
            <td>
                <span class="patient-no-badge">${a.patient_no || '—'}</span>
            </td>
            <td>
                <strong>${a.patient_name || '—'}</strong>
            </td>
            <td style="color:#555;">${a.treatment_items || '—'}</td>
            <td style="color:#777; font-size:13px;">
                ${a.remarks || '—'}
            </td>
            <td style="color:#555;">${duration}</td>
            <td>${arrivedBadge}</td>
            <td>
                <div style="display:flex; gap:6px; flex-wrap:wrap;">
                    ${canCheckin
                        ? `<button
                             onclick="checkInPatient('${a.id}')"
                             style="background:#28a745; color:white;
                                    border:none; padding:5px 10px;
                                    border-radius:4px; cursor:pointer;
                                    font-size:12px; white-space:nowrap;">
                             ✅ Check In
                           </button>`
                        : `<button disabled
                             style="background:#ccc; color:#666;
                                    border:none; padding:5px 10px;
                                    border-radius:4px; font-size:12px;
                                    white-space:nowrap; cursor:not-allowed;">
                             ✅ In Queue
                           </button>`}
                    ${canEdit
                        ? `<button
                             onclick="editAppt('${a.id}')"
                             style="background:var(--primary); color:white;
                                    border:none; padding:5px 10px;
                                    border-radius:4px; cursor:pointer;
                                    font-size:12px;">
                             ✏️
                           </button>
                           <button
                             onclick="deleteAppt('${a.id}')"
                             style="background:var(--danger); color:white;
                                    border:none; padding:5px 10px;
                                    border-radius:4px; cursor:pointer;
                                    font-size:12px;">
                             🗑
                           </button>`
                        : ''}
                </div>
            </td>
        </tr>`;
    }).join('');
}

// ── Check in patient (double-click or button) ──────────────────
async function checkInPatient(apptId) {
    const { data: appt, error: fetchErr } = await _supabase
        .from('appointments').select('*')
        .eq('id', apptId).single();

    if (fetchErr || !appt) return alert('Could not load appointment.');
    if (appt.arrived && appt.in_queue) {
        return alert(`${appt.patient_name} is already in the queue.`);
    }

    const now = new Date().toISOString();

    const { error } = await _supabase
        .from('appointments')
        .update({
            arrived:      true,
            arrival_time: now,
            in_queue:     true,
            bill_status:  appt.bill_status || 'Pending'
        })
        .eq('id', apptId);

    if (error) return alert('Error checking in: ' + error.message);

    // Refresh both tabs
    loadTodayAppointments();
    loadQueue();

    // Switch to queue tab to show the patient
    switchApptTab('queue');
}

// ════════════════════════════════════════════════════════════════
// TAB 2 — CURRENT QUEUE
// ════════════════════════════════════════════════════════════════
async function loadQueue() {
    const tbody = el('queueBody');
    tbody.innerHTML =
        '<tr><td colspan="9" style="text-align:center;' +
        ' padding:20px; color:#aaa;">Loading…</td></tr>';

    const today = todayISO();
    const { data, error } = await _supabase
        .from('appointments')
        .select('*')
        .eq('date', today)
        .eq('in_queue', true)
        .order('arrival_time', { ascending: true });

    if (error) {
        tbody.innerHTML =
            `<tr><td colspan="9" style="color:red; padding:16px;">
             Error: ${error.message}</td></tr>`;
        return;
    }

    el('queueCountBadge').textContent =
        data && data.length ? `${data.length} in queue` : 'Empty';

    if (!data || data.length === 0) {
        tbody.innerHTML =
            '<tr><td colspan="9" style="text-align:center;' +
            ' padding:30px; color:#bbb;">' +
            'No patients in queue. Double-click a patient in ' +
            'Today\'s Appointments to check them in.</td></tr>';
        return;
    }

    tbody.innerHTML = data.map(a => {
        const billStatus   = a.bill_status || 'Pending';
        const rowClass     =
            billStatus === 'Paid'   ? 'queue-row-paid'   :
            billStatus === 'Waived' ? 'queue-row-waived' : '';

        const billBadgeClass =
            billStatus === 'Paid'    ? 'badge-paid'    :
            billStatus === 'Waived'  ? 'badge-waived'  : 'badge-pending';

        const arrivalStr = a.arrival_time
            ? new Date(a.arrival_time).toLocaleTimeString('en-HK', {
                hour: '2-digit', minute: '2-digit'
              })
            : '—';

        return `
        <tr class="${rowClass}" id="queue-row-${a.id}">
            <td>
                <span class="patient-no-badge">${a.patient_no || '—'}</span>
            </td>
            <td><strong>${a.patient_name || '—'}</strong></td>
            <td style="color:#555;">${a.treatment_items || '—'}</td>
            <td style="color:#777; font-size:13px;">${a.remarks || '—'}</td>
            <td style="font-weight:600; color:var(--primary);">
                ${formatTime12(a.start_time)}
            </td>
            <td style="color:#28a745; font-weight:600;">${arrivalStr}</td>
            <td>
                <input type="text"
                       id="voucher-${a.id}"
                       value="${a.voucher_no || ''}"
                       placeholder="Voucher no."
                       style="width:110px; padding:5px 8px; border:1px solid #ddd;
                              border-radius:4px; font-size:13px;"
                       onblur="updateVoucher('${a.id}', this.value)">
            </td>
            <td>
                <select id="bill-${a.id}"
                        onchange="updateBillStatus('${a.id}', this.value)"
                        style="padding:5px 8px; border:1px solid #ddd;
                               border-radius:4px; font-size:13px;
                               cursor:pointer;">
                    <option value="Pending"
                        ${billStatus === 'Pending' ? 'selected' : ''}>
                        Pending
                    </option>
                    <option value="Paid"
                        ${billStatus === 'Paid' ? 'selected' : ''}>
                        Paid
                    </option>
                    <option value="Waived"
                        ${billStatus === 'Waived' ? 'selected' : ''}>
                        Waived
                    </option>
                </select>
                <span class="badge ${billBadgeClass}"
                      style="margin-left:4px;">${billStatus}</span>
            </td>
            <td>
                <button
                    onclick="removeFromQueue('${a.id}')"
                    style="background:var(--danger); color:white;
                           border:none; padding:5px 12px;
                           border-radius:4px; cursor:pointer;
                           font-size:12px; white-space:nowrap;">
                    ✖ Remove
                </button>
            </td>
        </tr>`;
    }).join('');
}

// ── Update voucher number ──────────────────────────────────────
async function updateVoucher(apptId, value) {
    await _supabase
        .from('appointments')
        .update({ voucher_no: value.trim() || null })
        .eq('id', apptId);
}

// ── Update bill status ─────────────────────────────────────────
async function updateBillStatus(apptId, status) {
    const { error } = await _supabase
        .from('appointments')
        .update({ bill_status: status })
        .eq('id', apptId);

    if (error) return alert('Error updating bill status: ' + error.message);

    // Refresh queue to apply color change
    loadQueue();
}

// ── Remove from queue ──────────────────────────────────────────
async function removeFromQueue(apptId) {
    if (!confirm('Remove this patient from the queue?')) return;

    const { error } = await _supabase
        .from('appointments')
        .update({ in_queue: false })
        .eq('id', apptId);

    if (error) return alert('Error removing from queue: ' + error.message);

    loadQueue();
    loadTodayAppointments();
}

// ════════════════════════════════════════════════════════════════
// ADD / EDIT APPOINTMENT
// ════════════════════════════════════════════════════════════════
function openApptModal(prefillDate, prefillTime) {
    apptEditingId = null;
    el('apptForm').reset();

    // Reset patient selection
    el('apptPatientSearch').value       = '';
    el('apptPatientId').value           = '';
    el('apptPatientNo').value           = '';
    el('apptPatientNameVal').value      = '';
    el('apptSelectedPatient').style.display = 'none';
    el('apptPatientDropdown').style.display = 'none';

    // Set defaults
    el('apptDate').value = prefillDate || todayISO();
    populateTimeSelect('apptStartTime', prefillTime || '09:00');
    el('apptDuration').value = '30';
    calcEndTime();

    toggleModal('addApptModal', true);
}

async function editAppt(apptId) {
    const { data: a, error } = await _supabase
        .from('appointments').select('*')
        .eq('id', apptId).single();
    if (error || !a) return alert('Could not load appointment.');

    apptEditingId = apptId;

    // Pre-fill patient
    el('apptPatientSearch').value   = `${a.patient_name} (${a.patient_no})`;
    el('apptPatientId').value       = a.patient_id   || '';
    el('apptPatientNo').value       = a.patient_no   || '';
    el('apptPatientNameVal').value  = a.patient_name || '';
    el('apptSelectedName').textContent = a.patient_name || '';
    el('apptSelectedNo').textContent   = a.patient_no   || '';
    el('apptSelectedPatient').style.display = 'block';

    el('apptDate').value      = a.date         || todayISO();
    populateTimeSelect('apptStartTime', a.start_time
        ? a.start_time.substring(0,5) : '09:00');
    el('apptDuration').value  = String(a.duration || 30);
    el('apptTreatment').value = a.treatment_items || '';
    el('apptRemarks').value   = a.remarks         || '';
    calcEndTime();

    toggleModal('addApptModal', true);
}

// ── Calculate end time ─────────────────────────────────────────
function calcEndTime() {
    const start    = el('apptStartTime').value;
    const duration = el('apptDuration').value;
    if (!start || !duration) return;
    const end = addMinutes(start, parseInt(duration));
    el('apptEndTime').value = formatTime12(end);
    el('apptEndTime').dataset.raw = end; // store raw HH:MM
}

// ── Save appointment ───────────────────────────────────────────
async function saveAppointment(e) {
    e.preventDefault();

    const patientId   = el('apptPatientId').value;
    const patientNo   = el('apptPatientNo').value;
    const patientName = el('apptPatientNameVal').value;

    if (!patientNo && !patientName) {
        return alert('Please search and select a patient first.');
    }

    const startTime = el('apptStartTime').value;
    const duration  = parseInt(el('apptDuration').value);
    const endTime   = addMinutes(startTime, duration);

    const payload = {
        patient_id:      patientId   || null,
        patient_no:      patientNo   || null,
        patient_name:    patientName || null,
        date:            el('apptDate').value,
        start_time:      startTime,
        duration:        duration,
        end_time:        endTime,
        treatment_items: el('apptTreatment').value.trim() || null,
        remarks:         el('apptRemarks').value.trim()   || null,
    };

    let error;
    if (apptEditingId) {
        ({ error } = await _supabase
            .from('appointments')
            .update(payload)
            .eq('id', apptEditingId));
    } else {
        ({ error } = await _supabase
            .from('appointments')
            .insert([payload]));
    }

    if (error) return alert('Error saving appointment: ' + error.message);

    toggleModal('addApptModal', false);
    loadTodayAppointments();
    renderCalendar();
    alert(`✅ Appointment ${apptEditingId ? 'updated' : 'saved'} for ${patientName}!`);
}

// ── Delete appointment ─────────────────────────────────────────
async function deleteAppt(apptId) {
    if (!confirm('Delete this appointment?')) return;
    const { error } = await _supabase
        .from('appointments').delete().eq('id', apptId);
    if (error) return alert('Error deleting: ' + error.message);
    loadTodayAppointments();
    renderCalendar();
}

// ════════════════════════════════════════════════════════════════
// PATIENT SEARCH (inside appointment form)
// ════════════════════════════════════════════════════════════════
let patientSearchTimeout = null;

async function searchPatientsForAppt() {
    const q = el('apptPatientSearch').value.trim();
    const dropdown = el('apptPatientDropdown');

    if (q.length < 1) {
        dropdown.style.display = 'none';
        return;
    }

    clearTimeout(patientSearchTimeout);
    patientSearchTimeout = setTimeout(async () => {
        const { data, error } = await _supabase
            .from('patients')
            .select('id, patient_no, full_name, chinese_name, phone_number')
            .or(`full_name.ilike.%${q}%,patient_no.ilike.%${q}%,phone_number.ilike.%${q}%`)
            .limit(8);

        if (error || !data || data.length === 0) {
            dropdown.innerHTML =
                '<div class="patient-dropdown-item" ' +
                'style="color:#aaa;">No patients found</div>';
            dropdown.style.display = 'block';
            return;
        }

        dropdown.innerHTML = data.map(p => `
            <div class="patient-dropdown-item"
                 data-id="${p.id}"
                 data-no="${p.patient_no}"
                 data-name="${p.full_name}">
                <strong>${p.full_name}</strong>
                ${p.chinese_name
                    ? `<span style="color:#999;"> ${p.chinese_name}</span>`
                    : ''}
                <br>
                <small style="color:#aaa;">
                    #${p.patient_no || '—'} · ${p.phone_number || 'No phone'}
                </small>
            </div>`).join('');

        dropdown.querySelectorAll('.patient-dropdown-item').forEach(item => {
            if (!item.dataset.id) return;
            item.addEventListener('click', () => {
                el('apptPatientId').value       = item.dataset.id;
                el('apptPatientNo').value       = item.dataset.no;
                el('apptPatientNameVal').value  = item.dataset.name;
                el('apptPatientSearch').value   =
                    `${item.dataset.name} (${item.dataset.no})`;
                el('apptSelectedName').textContent = item.dataset.name;
                el('apptSelectedNo').textContent   = item.dataset.no;
                el('apptSelectedPatient').style.display = 'block';
                dropdown.style.display = 'none';
            });
        });

        dropdown.style.display = 'block';
    }, 250);
}

// Close dropdown when clicking outside
document.addEventListener('click', (e) => {
    const wrap = document.querySelector('.patient-search-wrap');
    if (wrap && !wrap.contains(e.target)) {
        const dd = el('apptPatientDropdown');
        if (dd) dd.style.display = 'none';
    }
});

// ════════════════════════════════════════════════════════════════
// TAB 3 — CALENDAR
// ════════════════════════════════════════════════════════════════
async function renderCalendar() {
    if (apptCalView === 'weekly') {
        await renderWeeklyCalendar();
    } else {
        await renderMonthlyCalendar();
    }
}

// ── Fetch appointments for a date range ────────────────────────
async function fetchApptRange(startDate, endDate) {
    const { data, error } = await _supabase
        .from('appointments')
        .select('*')
        .gte('date', startDate)
        .lte('date', endDate)
        .order('start_time', { ascending: true });
    if (error) { console.error(error); return []; }
    return data || [];
}

// ── Helper: ISO date string from Date object ───────────────────
function dateToISO(d) {
    return `${d.getFullYear()}-` +
           `${String(d.getMonth()+1).padStart(2,'0')}-` +
           `${String(d.getDate()).padStart(2,'0')}`;
}

// ════════════════════════════════════════════════════════════════
// WEEKLY CALENDAR
// ════════════════════════════════════════════════════════════════
async function renderWeeklyCalendar() {
    const body   = el('calendarBody');
    const today  = new Date();
    const todayISO_ = dateToISO(today);

    // Get Monday of current week
    const ref  = new Date(apptCalDate);
    const dow  = ref.getDay(); // 0=Sun
    const monday = new Date(ref);
    monday.setDate(ref.getDate() - (dow === 0 ? 6 : dow - 1));

    // Build week days
    const weekDays = [];
    for (let i = 0; i < 7; i++) {
        const d = new Date(monday);
        d.setDate(monday.getDate() + i);
        weekDays.push(d);
    }

    const weekStart = dateToISO(weekDays[0]);
    const weekEnd   = dateToISO(weekDays[6]);

    // Update calendar title
    el('calTitle').textContent =
        `${weekDays[0].toLocaleDateString('en-HK',
            { day:'numeric', month:'short' })} – ` +
        `${weekDays[6].toLocaleDateString('en-HK',
            { day:'numeric', month:'short', year:'numeric' })}`;

    const appointments = await fetchApptRange(weekStart, weekEnd);

    // Time slots 08:00 – 20:45
    const timeSlots = [];
    for (let h = 8; h <= 20; h++) {
        for (let m = 0; m < 60; m += 30) {
            timeSlots.push(`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`);
        }
    }

    const dayNames = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];

    // Build header
    let html = `<div class="week-grid">
        <div class="week-header-row">
            <div class="week-time-col">TIME</div>`;

    weekDays.forEach((d, i) => {
        const iso     = dateToISO(d);
        const isToday = iso === todayISO_;
        html += `
            <div class="week-day-header ${isToday ? 'today-col' : ''}">
                <span style="font-size:11px; display:block; color:#999;">
                    ${dayNames[i]}
                </span>
                <span class="day-num">${d.getDate()}</span>
            </div>`;
    });
    html += '</div><div class="week-body">';

    // Build time rows
    timeSlots.forEach(slot => {
        const isHour = slot.endsWith(':00');
        html += `
            <div class="week-time-slot"
                 style="${isHour ? 'font-weight:700; color:#888;' : ''}">
                ${isHour ? formatTime12(slot) : ''}
            </div>`;

        weekDays.forEach(d => {
            const iso     = dateToISO(d);
            const isToday = iso === todayISO_;

            // Find appointments starting in this slot
            const slotAppts = appointments.filter(a => {
                if (a.date !== iso) return false;
                const aTime = a.start_time
                    ? a.start_time.substring(0,5) : '';
                return aTime === slot;
            });

            html += `
                <div class="week-cell ${isToday ? 'today-col' : ''}"
                     data-date="${iso}" data-time="${slot}">`;

            slotAppts.forEach(a => {
                html += `
                    <div class="week-appt-block"
                         title="${a.patient_name} — ${a.treatment_items || ''}"
                         onclick="showApptPopup('${a.id}', event)">
                        ${a.patient_name || '—'}
                        ${a.treatment_items
                            ? `<br><span style="opacity:0.8; font-size:9px;">
                               ${a.treatment_items}</span>`
                            : ''}
                    </div>`;
            });

            html += '</div>';
        });
    });

    html += '</div></div>';
    body.innerHTML = html;

    // Hide day detail panel when switching to weekly
    el('dayDetailPanel').style.display = 'none';
}

// ════════════════════════════════════════════════════════════════
// MONTHLY CALENDAR
// ════════════════════════════════════════════════════════════════
async function renderMonthlyCalendar() {
    const body  = el('calendarBody');
    const today = new Date();
    const todayISO_ = dateToISO(today);

    const year  = apptCalDate.getFullYear();
    const month = apptCalDate.getMonth();

    el('calTitle').textContent =
        apptCalDate.toLocaleDateString('en-HK',
            { month: 'long', year: 'numeric' });

    // First and last day of month
    const firstDay = new Date(year, month, 1);
    const lastDay  = new Date(year, month + 1, 0);

    // Fetch all appointments for this month
    const startISO = dateToISO(firstDay);
    const endISO   = dateToISO(lastDay);
    const appointments = await fetchApptRange(startISO, endISO);

    // Group by date
    const byDate = {};
    appointments.forEach(a => {
        if (!byDate[a.date]) byDate[a.date] = [];
        byDate[a.date].push(a);
    });

    // Build grid
    const dayNames = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
    let html = `<div class="month-grid">
        <div class="month-day-headers">
            ${
