# EPIC 006 — Models and resources

Status: **ready**.

The snapshot carries a schema and a validated example for 23 operations. EPIC 001 delivered two of
them. This epic delivers the other 21, plus `blob.show`, plus the nine resource classes.

## Goal

- **G1** — `lib/api/models/` holds one `@freezed` plus `@JsonSerializable` model per wire shape, one
  file per model, `@JsonKey(name:)` on every field, no `field_rename`. A model is shared by every
  resource and never duplicated per feature.
- **G2** — Every wire enum uses the open-enum representation EPIC 001 fixed: the known case plus the
  raw string, and a converter that never throws. No decode throws on an unknown value, and no decode
  throws on an unknown field.
- **G3** — `lib/api/resources/` holds the nine classes of `docs/api/operations.md`, exposed as
  `api.system`, `api.provider`, `api.repository`, `api.project`, `api.plan`, `api.node`, `api.run`,
  `api.instruction` and `api.event`.
- **G4** — One method per operation that carries a schema. Each returns a model, throws a typed
  `ApiException`, and returns no `Stream`, no `Response` and no `Map`.
- **G5** — `SystemResource.blob(hash)` returns `Uint8List`. It sends the hash exactly as the citing
  field returned it, keeps the algorithm prefix, and percent-encodes nothing.
- **G6** — The two operation-specific rules EPIC 005 deferred land here: an `Idempotency-Key` on
  `plan.import` must equal the `importId` in the body, and the redaction list gains the credential
  field names of the `provider.register` request.
- **G7** — The contract suite gains a row per delivered operation, and the covered-count assertion
  rises to 24.
- **G8** — `lib/api/README.md` holds the resource-class-to-operation map and a pointer to
  `docs/api/`. It restates no rule.

## Non-goals

- No method and no model for an operation with no schema. That is 31 operations, and
  `docs/api/parallel-development.md` forbids a hand-written wire model for them.
- No mapping layer, no view-model layer, no repository, no use case, no entity-plus-DTO pair.
- No blob cache. `ETag` and `Cache-Control` are the daemon's headers, and a client cache by hash is a
  later decision.
- No `Range` request. A check log needs one, and no screen in this set reads a check log.
- No live assertion beyond the two live read operations. The others answer `501`, and the suite
  records that as the expected live answer.
- No UI. Nothing here imports Flutter.

## Verification gate

Gates: `make verify`

Proof:

```bash
make test-one T=test/api/models \
  && echo "PASS 006-G1-MODELS" \
  && make test-one T=test/api/models/open_enum_test.dart \
  && echo "PASS 006-G2-TOLERANT" \
  && make test-one T=test/api/kanthord_api_test.dart \
  && echo "PASS 006-G3-RESOURCES" \
  && make test-one T=test/api/resources \
  && echo "PASS 006-G4-METHODS" \
  && make test-one T=test/api/resources/blob_test.dart \
  && echo "PASS 006-G5-BLOB" \
  && make test-one T=test/api/interceptors/operation_rules_test.dart \
  && echo "PASS 006-G6-OPERATION-RULES" \
  && make test-one T=test/api/contract \
  && echo "PASS 006-G7-SUITE" \
  && make arch-check \
  && echo "PASS 006-G8-BOUNDARY" \
  && echo "PASS EPIC-006"
```

Hermetic coverage required beyond the Proof:

- Every operation in `contract/manifest.json` has either a resource method or a named exclusion in
  one declared list. A new operation in a refreshed snapshot fails this test, so a contract refresh
  cannot land unnoticed.
- Every required field the schema declares appears in the model and in the published example. An
  optional field is checked against the schema alone.
- A response holding an extra field decodes. A response holding an unknown enum value decodes and
  keeps the raw string. A required field arriving as `null` becomes `ApiDecodeException` and names
  the field.
- A `501` from any unhandled operation becomes `ApiNotImplementedException`, never
  `ApiResponseException`.
- `make generate` produces no diff after the epic. Generated output is committed.
- `RunResource` and `InstructionResource` exist and expose no method. The assertion is on the public
  API of each class, written as a compile-time reference to every method the class declares.

## Stories

One story per resource class, in this order. Each writes the models its operations need, the methods,
the decode tests and the contract-suite rows.

- **`SystemResource`** — adds `status()` on `GET /v1/status` and `blob(hash)` on `GET /v1/blob/:hash`.
  `health()` and `db()` exist from EPIC 001. The blob method returns bytes, and a caller decodes by
  what the citing field declares.
- **`ProjectResource`** — `create`, `list`, `show`, `repositories`, and `status` on
  `GET /v1/project/:id/status`. `repositories` is a `PUT` that replaces the whole binding list, and
  the MVP sends one entry.
- **`RepositoryResource`** — `register`, `list`, `show`, `inspect`. `register` and `inspect` use the
  long receive timeout. `register` answering `409 host-key-mismatch` is never retried, and the
  exception carries both fingerprints from `details`.
- **`PlanResource`** — `validate`, `import`, `export`, `revisions`. `import` carries `importId`,
  `choices`, `validatedRevision`, `documentsHash` and a nullable `fromRevision`. This story adds the
  `Idempotency-Key` equals `importId` assertion of G6.
- **`ProviderResource`** — `list`, `register`, `show`. This story adds the credential field names of
  G6 to the redaction list.
- **`NodeResource`** — `list`, `show`, and `edge.list` on `GET /v1/project/:id/edge`. `list` takes the
  `project`, `kind`, `state`, `blockReason` and `repository` filters. An edge carries a nullable
  `waivedAt`, and a waived edge is a waiver, never a deletion.
- **`EventResource`** — `list` with the `after` and `limit` cursor and the five domain filters. This
  is the wire shape EPIC 007 polls.
- **`RunResource` and `InstructionResource`** — the classes exist and declare nothing, because no
  operation in either group carries a schema. The grouping is fixed before the schemas land.
- **`lib/api/README.md`** — the map and the pointer.
