-- 마감 시각(closes_at) 컬럼 추가: nullable, null이면 무기한 진행.
-- 별도 "마감 상태" 컬럼은 두지 않는다 — 마감 여부는 요청마다
-- closes_at과 현재 시각을 비교해 계산한다 (docs/adr/0004-deadline-computed-not-scheduled.md).

ALTER TABLE polls ADD COLUMN IF NOT EXISTS closes_at TIMESTAMPTZ;
