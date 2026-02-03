/*
  # 教會活動籌辦系統資料庫架構

  1. 新資料表
    - `contacts` - 聯絡人資料庫（包括信徒和非信徒）
      - `id` (uuid, 主鍵)
      - `name` (text, 姓名)
      - `faith_status` (text, 信仰狀況)
      - `source_group` (text, 來源群組/背景)
      - `notes` (text, 備註)
      - `is_believer` (boolean, 是否為信徒)
      - `role` (text, 角色: attendee/helper/organizer)
      - `created_at` (timestamptz, 創建時間)
      - `updated_at` (timestamptz, 更新時間)

    - `events` - 活動資料表
      - `id` (uuid, 主鍵)
      - `name` (text, 活動名稱)
      - `description` (text, 活動描述)
      - `created_at` (timestamptz, 創建時間)
      - `updated_at` (timestamptz, 更新時間)

    - `event_dates` - 活動日期資料表
      - `id` (uuid, 主鍵)
      - `event_id` (uuid, 外鍵到 events)
      - `event_date` (date, 活動日期)
      - `created_at` (timestamptz, 創建時間)

    - `registrations` - 登記資料表
      - `id` (uuid, 主鍵)
      - `contact_id` (uuid, 外鍵到 contacts)
      - `event_date_id` (uuid, 外鍵到 event_dates)
      - `registration_status` (text, 登記狀態)
      - `registration_type` (text, 登記類型: pre_registered/new)
      - `position` (text, 崗位，給協助者使用)
      - `created_at` (timestamptz, 創建時間)
      - `updated_at` (timestamptz, 更新時間)

    - `attendance` - 出席紀錄資料表
      - `id` (uuid, 主鍵)
      - `registration_id` (uuid, 外鍵到 registrations)
      - `attended` (boolean, 是否出席)
      - `attendance_date` (timestamptz, 出席時間)
      - `notes` (text, 備註)
      - `created_at` (timestamptz, 創建時間)

    - `follow_ups` - 跟進紀錄資料表
      - `id` (uuid, 主鍵)
      - `contact_id` (uuid, 外鍵到 contacts)
      - `event_date_id` (uuid, 外鍵到 event_dates)
      - `status` (text, 跟進狀態)
      - `responsible_person` (text, 跟進負責人)
      - `next_follow_up_date` (date, 下次跟進日期)
      - `action_notes` (text, 跟進行動)
      - `created_at` (timestamptz, 創建時間)
      - `updated_at` (timestamptz, 更新時間)

  2. 安全性
    - 啟用所有資料表的 RLS
    - 添加已認證使用者的讀寫政策
*/

-- 創建 contacts 資料表
CREATE TABLE IF NOT EXISTS contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  faith_status text DEFAULT '',
  source_group text DEFAULT '',
  notes text DEFAULT '',
  is_believer boolean DEFAULT false,
  role text DEFAULT 'attendee',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 創建 events 資料表
CREATE TABLE IF NOT EXISTS events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 創建 event_dates 資料表
CREATE TABLE IF NOT EXISTS event_dates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  event_date date NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- 創建 registrations 資料表
CREATE TABLE IF NOT EXISTS registrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  event_date_id uuid NOT NULL REFERENCES event_dates(id) ON DELETE CASCADE,
  registration_status text DEFAULT '待確認',
  registration_type text DEFAULT 'pre_registered',
  position text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(contact_id, event_date_id)
);

-- 創建 attendance 資料表
CREATE TABLE IF NOT EXISTS attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_id uuid NOT NULL REFERENCES registrations(id) ON DELETE CASCADE,
  attended boolean DEFAULT false,
  attendance_date timestamptz DEFAULT now(),
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

-- 創建 follow_ups 資料表
CREATE TABLE IF NOT EXISTS follow_ups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  event_date_id uuid REFERENCES event_dates(id) ON DELETE CASCADE,
  status text DEFAULT '待跟進',
  responsible_person text DEFAULT '',
  next_follow_up_date date,
  action_notes text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 啟用 RLS
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_dates ENABLE ROW LEVEL SECURITY;
ALTER TABLE registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE follow_ups ENABLE ROW LEVEL SECURITY;

-- Contacts 政策
CREATE POLICY "允許已認證使用者查看聯絡人"
  ON contacts FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "允許已認證使用者新增聯絡人"
  ON contacts FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "允許已認證使用者更新聯絡人"
  ON contacts FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "允許已認證使用者刪除聯絡人"
  ON contacts FOR DELETE
  TO authenticated
  USING (true);

-- Events 政策
CREATE POLICY "允許已認證使用者查看活動"
  ON events FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "允許已認證使用者新增活動"
  ON events FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "允許已認證使用者更新活動"
  ON events FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "允許已認證使用者刪除活動"
  ON events FOR DELETE
  TO authenticated
  USING (true);

-- Event Dates 政策
CREATE POLICY "允許已認證使用者查看活動日期"
  ON event_dates FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "允許已認證使用者新增活動日期"
  ON event_dates FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "允許已認證使用者更新活動日期"
  ON event_dates FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "允許已認證使用者刪除活動日期"
  ON event_dates FOR DELETE
  TO authenticated
  USING (true);

-- Registrations 政策
CREATE POLICY "允許已認證使用者查看登記"
  ON registrations FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "允許已認證使用者新增登記"
  ON registrations FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "允許已認證使用者更新登記"
  ON registrations FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "允許已認證使用者刪除登記"
  ON registrations FOR DELETE
  TO authenticated
  USING (true);

-- Attendance 政策
CREATE POLICY "允許已認證使用者查看出席"
  ON attendance FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "允許已認證使用者新增出席"
  ON attendance FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "允許已認證使用者更新出席"
  ON attendance FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "允許已認證使用者刪除出席"
  ON attendance FOR DELETE
  TO authenticated
  USING (true);

-- Follow-ups 政策
CREATE POLICY "允許已認證使用者查看跟進"
  ON follow_ups FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "允許已認證使用者新增跟進"
  ON follow_ups FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "允許已認證使用者更新跟進"
  ON follow_ups FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "允許已認證使用者刪除跟進"
  ON follow_ups FOR DELETE
  TO authenticated
  USING (true);

-- 創建索引以提升查詢效能
CREATE INDEX IF NOT EXISTS idx_event_dates_event_id ON event_dates(event_id);
CREATE INDEX IF NOT EXISTS idx_registrations_contact_id ON registrations(contact_id);
CREATE INDEX IF NOT EXISTS idx_registrations_event_date_id ON registrations(event_date_id);
CREATE INDEX IF NOT EXISTS idx_attendance_registration_id ON attendance(registration_id);
CREATE INDEX IF NOT EXISTS idx_follow_ups_contact_id ON follow_ups(contact_id);
CREATE INDEX IF NOT EXISTS idx_follow_ups_event_date_id ON follow_ups(event_date_id);