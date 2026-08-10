# Story 06 — the absent-id cursor

Epic: `.agent/plan/epics/004-mock-daemon-and-contract-suite.md`
Depends on: Story 05 (`applyCursor`, `cursor_test.dart`).

**One Task, the test-engineer lane.**

**This is a characterization Story, not a RED/GREEN cycle. Say so in the ready marker.** `applyCursor`
as Story 05 wrote it already satisfies every case below, so no assertion here is expected to fail
first and no production edit is expected to follow. The Story exists because
`docs/api/conventions.md:106-112` names these three cases as the ones a client gets silently wrong,
and an unasserted behavior is an unprotected one. `/work` runs it as a test-only Task with no
software-engineer turn. Do not manufacture a failure to make it look like a RED phase.

`docs/api/conventions.md:94-112` fixes the rule: `after` is an exclusive lower bound, not a row
reference. The daemon never checks that the string names a real row, so all three absent-id cases
are legal and none of them is an error.

## Change

- `test/mock_daemon/cursor_test.dart` — add one nested group under the existing `applyCursor` group
  and one nested group under the existing `MockDaemon` group. Add no new file and change no existing
  test.

## Constraints

- An absent `after` is never an error. Not a `400`, not a `404`, not an empty body with a special
  status. `docs/api/conventions.md:106-112` names the consequence directly: an `after` above every
  existing id returns an empty page forever, and that is indistinguishable from a quiet daemon.
- The empty page carries the `events` key with an empty array, never a missing key and never null.
  `docs/api/polling.md:96-99` fixes the response as an object with one array.
- Do not add a "bad cursor" code. `docs/api/errors.md` has none, and inventing one would teach the
  client a branch the daemon never takes.
- The three ids below are pinned literals, chosen to sort between, above and below the five rows of
  `_kRows`. Do not compute them.

## Tasks

### Task 006.1 — the absent-id cursor test

**Input:** `test/mock_daemon/cursor_test.dart`

**Action — RED:** add these two groups. Reuse the `_kRows` list and the `_ids` helper Story 05
declared in this file, and `probe` from `http_probe.dart`.

Group `applyCursor`, nested group `an id that is absent from the list`:

- `'should return the rows above the cursor when the after sorts between two ids'` — use
  `Cursor(limit: 100, after: 'event_01JQ8Z7G3H00000000000000025')`. That string sorts after
  `…0002` and before `…0003`, because it is longer and shares the shorter string as its prefix.
  Assert the result ids are `…0003`, `…0004`, `…0005`.
- `'should return an empty page when the after sorts above every id'` — use
  `Cursor(limit: 100, after: 'event_01JQ8Z7G3H0000000000009999')`. Assert the result is empty and
  assert it does not throw.
- `'should return the whole list when the after sorts below every id'` — use
  `Cursor(limit: 100, after: 'event_01JQ8Z7G3H0000000000000000')`. Assert the five ids come back in
  ascending order.

Group `MockDaemon`, nested group `an id that is absent from the log`:

- `'should answer an empty page when the after sorts above every row'` — `GET`
  `'${daemon.baseUrl}/v1/event?after=event_01JQ8Z7G3HZZZZZZZZZZZZZZZZ'`. The single fixture row of
  `docs/api/contract/examples/event.list.json` carries exactly that id, and `after` is exclusive, so
  the page is empty. Assert the status is `200`, the body has an `events` key, and the array is
  empty.
- `'should answer the whole list when the after sorts below every row'` — `GET`
  `'/v1/event?after=event_01JQ8Z7G3H0000000000000000'`. Assert the status is `200` and the array
  holds the one published row.
- `'should answer a page and never an error when the after names no row'` — `GET`
  `'/v1/event?after=event_01JQ8Z7G3HAAAAAAAAAAAAAAAA'`. Assert the status is `200` and the body has
  no `error` key. This is the case a client gets silently wrong, and the assertion is that the
  daemon does not turn it into a failure.

**Action — GREEN:** `applyCursor` already implements every case, so no production edit is expected.
If a test fails, fix `test/mock_daemon/cursor.dart` and change nothing in `mock_daemon.dart`.

## Verify

- `make test-one T=test/mock_daemon/cursor_test.dart` exits 0.
- `make verify` exits 0.
- Proof: `PASS 004-G3-CURSOR`.
