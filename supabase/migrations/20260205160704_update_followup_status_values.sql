/*
  # Update Follow-up Status Values

  1. Changes
    - Update existing follow_ups.status values to match new status options
    - Map old status values to new standardized format:
      - "待跟進" → "待跟進- 可繼續邀請參加聚會"
      - "需要關懷" → "待跟進-需要個人關懷"
      - "待確認後續日期" → "待確定跟進日期"
      - "已完成" → "已完成跟進行動"
      - "已確認" → "已完成跟進行動"
  
  2. Notes
    - This ensures consistency between database records and UI dropdown options
    - Allows follow-up status breakdown to display correct counts
*/

UPDATE follow_ups
SET status = CASE 
  WHEN status = '待跟進' THEN '待跟進- 可繼續邀請參加聚會'
  WHEN status = '需要關懷' THEN '待跟進-需要個人關懷'
  WHEN status = '待確認後續日期' THEN '待確定跟進日期'
  WHEN status = '已完成' THEN '已完成跟進行動'
  WHEN status = '已確認' THEN '已完成跟進行動'
  ELSE status
END
WHERE status IN ('待跟進', '需要關懷', '待確認後續日期', '已完成', '已確認');