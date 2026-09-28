# 01: 기반 작업 — `closes_at` 컬럼 + `computePercent`/`isPollClosed` 순수 함수 분리

**What to build:** `polls` 테이블에 nullable `closes_at` 컬럼을 추가하는 마이그레이션을 만들고, 기존 `getPoll`에 섞여 있던 퍼센트 계산을 `computePercent` 순수 함수로 분리하며, 마감 판단에 쓸 `isPollClosed` 순수 함수를 새로 추가한다. 사용자에게 보이는 동작 변화는 없다 — 이후 티켓들이 이 위에서 동작한다.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] `polls` 테이블에 nullable `closes_at TIMESTAMPTZ` 컬럼이 마이그레이션으로 추가된다. 기존 행은 NULL(무기한)로 유지된다.
- [ ] `computePercent(votes, totalVotes)` 순수 함수가 `getPoll` 내부에서 분리되어 단위 테스트로 커버된다 — 총 투표 0건일 때 0%를 반환하는지, 반올림이 스펙(소수 첫째자리)대로 되는지 검증.
- [ ] `isPollClosed(closesAt, now)` 순수 함수가 추가되어 단위 테스트로 커버된다 — `closesAt`이 null이면 false, 과거면 true, 미래면 false, 경계값(정확히 `now`와 같은 경우)을 포함해 검증.
- [ ] 기존 기능(설문 생성/삭제/투표/결과 조회)의 동작은 전혀 바뀌지 않는다 — 기존 테스트가 모두 그대로 통과한다.
