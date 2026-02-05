/*
  # Fix Follow-up Status Spacing Consistency

  1. Changes
    - Update follow_ups.status values to use consistent spacing around hyphens
    - Ensures database values match the UI dropdown options exactly:
      - "待跟進- 可繼續邀請參加聚會" → "待跟進 - 可繼續邀請參加聚會"
      - "待跟進-需要個人關懷" → "待跟進-需要個人關懷" (keep as is)
      - "待跟進-可邀約個人佈道或探訪" → "待跟進-可邀約個人佈道或探訪" (keep as is)
  
  2. Notes
    - This fixes the breakdown counting issue where the same status appeared twice
    - Ensures consistency between database records and UI display
*/

UPDATE follow_ups
SET status = '待跟進 - 可繼續邀請參加聚會'
WHERE status = '待跟進- 可繼續邀請參加聚會';
