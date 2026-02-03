/*
  # 更新資料庫政策以允許公開存取

  本遷移更新所有資料表的 RLS 政策，允許公開（未認證）使用者進行操作。
  這適用於內部教會應用程式，不需要使用者認證。

  1. 變更內容
    - 移除所有現有的 authenticated 角色政策
    - 為所有資料表添加新的公開存取政策
    - 允許 anon 角色進行所有 CRUD 操作

  2. 受影響的資料表
    - contacts
    - events
    - event_dates
    - registrations
    - attendance
    - follow_ups
*/

-- 移除舊的 authenticated 政策並創建新的公開政策

-- Contacts 政策
DROP POLICY IF EXISTS "允許已認證使用者查看聯絡人" ON contacts;
DROP POLICY IF EXISTS "允許已認證使用者新增聯絡人" ON contacts;
DROP POLICY IF EXISTS "允許已認證使用者更新聯絡人" ON contacts;
DROP POLICY IF EXISTS "允許已認證使用者刪除聯絡人" ON contacts;

CREATE POLICY "允許公開查看聯絡人"
  ON contacts FOR SELECT
  USING (true);

CREATE POLICY "允許公開新增聯絡人"
  ON contacts FOR INSERT
  WITH CHECK (true);

CREATE POLICY "允許公開更新聯絡人"
  ON contacts FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY "允許公開刪除聯絡人"
  ON contacts FOR DELETE
  USING (true);

-- Events 政策
DROP POLICY IF EXISTS "允許已認證使用者查看活動" ON events;
DROP POLICY IF EXISTS "允許已認證使用者新增活動" ON events;
DROP POLICY IF EXISTS "允許已認證使用者更新活動" ON events;
DROP POLICY IF EXISTS "允許已認證使用者刪除活動" ON events;

CREATE POLICY "允許公開查看活動"
  ON events FOR SELECT
  USING (true);

CREATE POLICY "允許公開新增活動"
  ON events FOR INSERT
  WITH CHECK (true);

CREATE POLICY "允許公開更新活動"
  ON events FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY "允許公開刪除活動"
  ON events FOR DELETE
  USING (true);

-- Event Dates 政策
DROP POLICY IF EXISTS "允許已認證使用者查看活動日期" ON event_dates;
DROP POLICY IF EXISTS "允許已認證使用者新增活動日期" ON event_dates;
DROP POLICY IF EXISTS "允許已認證使用者更新活動日期" ON event_dates;
DROP POLICY IF EXISTS "允許已認證使用者刪除活動日期" ON event_dates;

CREATE POLICY "允許公開查看活動日期"
  ON event_dates FOR SELECT
  USING (true);

CREATE POLICY "允許公開新增活動日期"
  ON event_dates FOR INSERT
  WITH CHECK (true);

CREATE POLICY "允許公開更新活動日期"
  ON event_dates FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY "允許公開刪除活動日期"
  ON event_dates FOR DELETE
  USING (true);

-- Registrations 政策
DROP POLICY IF EXISTS "允許已認證使用者查看登記" ON registrations;
DROP POLICY IF EXISTS "允許已認證使用者新增登記" ON registrations;
DROP POLICY IF EXISTS "允許已認證使用者更新登記" ON registrations;
DROP POLICY IF EXISTS "允許已認證使用者刪除登記" ON registrations;

CREATE POLICY "允許公開查看登記"
  ON registrations FOR SELECT
  USING (true);

CREATE POLICY "允許公開新增登記"
  ON registrations FOR INSERT
  WITH CHECK (true);

CREATE POLICY "允許公開更新登記"
  ON registrations FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY "允許公開刪除登記"
  ON registrations FOR DELETE
  USING (true);

-- Attendance 政策
DROP POLICY IF EXISTS "允許已認證使用者查看出席" ON attendance;
DROP POLICY IF EXISTS "允許已認證使用者新增出席" ON attendance;
DROP POLICY IF EXISTS "允許已認證使用者更新出席" ON attendance;
DROP POLICY IF EXISTS "允許已認證使用者刪除出席" ON attendance;

CREATE POLICY "允許公開查看出席"
  ON attendance FOR SELECT
  USING (true);

CREATE POLICY "允許公開新增出席"
  ON attendance FOR INSERT
  WITH CHECK (true);

CREATE POLICY "允許公開更新出席"
  ON attendance FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY "允許公開刪除出席"
  ON attendance FOR DELETE
  USING (true);

-- Follow-ups 政策
DROP POLICY IF EXISTS "允許已認證使用者查看跟進" ON follow_ups;
DROP POLICY IF EXISTS "允許已認證使用者新增跟進" ON follow_ups;
DROP POLICY IF EXISTS "允許已認證使用者更新跟進" ON follow_ups;
DROP POLICY IF EXISTS "允許已認證使用者刪除跟進" ON follow_ups;

CREATE POLICY "允許公開查看跟進"
  ON follow_ups FOR SELECT
  USING (true);

CREATE POLICY "允許公開新增跟進"
  ON follow_ups FOR INSERT
  WITH CHECK (true);

CREATE POLICY "允許公開更新跟進"
  ON follow_ups FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY "允許公開刪除跟進"
  ON follow_ups FOR DELETE
  USING (true);