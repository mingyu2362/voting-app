# 01: 기반 작업 — DB 스키마, 마이그레이션, 테스트 하네스

**What to build:** Poll/Choice/Vote 스키마와 마이그레이션을 만들고, Neon 테스트 브랜치 연결 및 Vitest 테스트 러너를 설정해서 이후 모든 티켓이 실제 DB에 대고 서버 액션 계층을 테스트할 수 있는 기반을 마련한다.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] `Poll(id, question, created_at)`, `Choice(id, poll_id FK ON DELETE CASCADE, label, position)`, `Vote(id, poll_id FK ON DELETE CASCADE, choice_id FK, voter_token, UNIQUE(poll_id, voter_token))` 테이블이 마이그레이션으로 생성된다.
- [ ] 기존 `DATABASE_URL`과 별도로 `TEST_DATABASE_URL`(Neon 테스트 브랜치)이 설정되고 테스트가 이를 사용한다.
- [ ] Vitest가 설치·설정되어 테스트 스크립트로 실행 가능하다.
- [ ] 테스트 사이/전에 관련 테이블을 정리(truncate)하는 헬퍼가 마련되어 있다.
