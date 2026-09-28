-- 투표 앱 초기 스키마: Poll(설문) / Choice(선택지) / Vote(투표)
-- 운영자(Operator) 테이블은 없다 — 공유 비밀번호는 ADMIN_PASSWORD 환경 변수로만 존재한다.

CREATE TABLE IF NOT EXISTS polls (
  id SERIAL PRIMARY KEY,
  question TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS choices (
  id SERIAL PRIMARY KEY,
  poll_id INTEGER NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  position INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS choices_poll_id_idx ON choices(poll_id);

CREATE TABLE IF NOT EXISTS votes (
  id SERIAL PRIMARY KEY,
  poll_id INTEGER NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
  choice_id INTEGER NOT NULL REFERENCES choices(id) ON DELETE CASCADE,
  voter_token TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (poll_id, voter_token)
);

CREATE INDEX IF NOT EXISTS votes_poll_id_idx ON votes(poll_id);
