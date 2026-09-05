## Goal
Build SIH26016 as a greenfield national land-acquisition orchestration platform. The first release should demonstrate an end-to-end project through LARR 2013 and National Highways Act 1956 workflows, with role-specific views, GIS parcels, compensation/payment tracking, public transparency, and tamper-evident audit history. Later releases add more regimes, offline capture, live integrations, and AI.

The workspace contains no SIH source code or scaffolding, so start a new monorepo. The plan follows `SIH26016_Master.pdf` §§18–24, §§25–29, §§30–44, and §§45–51.

## 1. Repository and technology

Create:

```text
sih26016/
  apps/web/                    React + TypeScript + Vite frontend
  services/api/                Rust + Axum + SQLx HTTP/API
  services/workflow/           statutory engines and transition kernel
  services/domain/             shared domain types/policies
  services/integrations/       adapter interfaces and mocks
  services/jobs/               outbox, alerts, timelines, projections
  services/analytics/          Python rules/analytics service
  db/migrations/               PostgreSQL/PostGIS schema and RLS
  db/seeds/ db/fixtures/       demo data and statutory test fixtures
  packages/api-client/         generated client
  packages/schemas/            OpenAPI/JSON schemas
  packages/i18n/               Hindi/English strings and templates
  tests/{unit,integration,workflow,contract,security,e2e}/
  deploy/{compose,k8s}/
  docs/{architecture,adr,api,legal-validation}/
```

Use PostgreSQL 16 + PostGIS 3.4, fixed-point `NUMERIC` monetary fields, MapLibre GL, S3-compatible object storage (MinIO locally), PostgreSQL outbox/workers, and OCI containers. Use a modular monolith initially, with module boundaries matching the reference service split so extraction later is possible. Target MeghRaj/Kubernetes deployment but make the demo runnable with Docker Compose.

## 2. Domain model and database foundation

Build the schema before screens:

- `ministry`/tenant → `project` → `state_subproject` → `parcel`.
- First-class `process_type`: compulsory acquisition, right-of-user, land pooling, government allotment, consent purchase. Execute acquisition first; retain extensibility for later tracks.
- Multi-owner/interested-person and disputed-title records; affected families separate from titleholders.
- PostGIS parcel/alignment geometry, ULPIN and raw state identifiers, classification, area, source provenance, and circle-rate retrieval metadata.
- Effective-dated `regime`, `regime_stage`, gate definitions, deadlines, compensation-rule versions, notice templates, and language variants.
- Stage instances/history, gate evaluations, objections, hearings, surveys, consent, declarations, awards, R&R entitlements, payments, possession, mutation, litigation/stays, clearance evidence, documents, field evidence, alerts, and KPI projections.
- Provenance/version fields on legal and external records; never overwrite evidence or statutory documents.

Enforce tenant/jurisdiction columns, PostgreSQL Row-Level Security, one active stage per parcel, legal transition constraints, nonnegative money, payment idempotency keys, and transaction atomicity. Add a testable migration/seed path from a clean checkout.

## 3. Identity, RBAC, and audit before functional breadth

Implement the reference’s three-dimensional authorization model: role × jurisdiction scope × regime/stage. Support central, state, district/CALA, sub-division, requiring body, field, R&R, finance, legal, policy/audit, public, judicial guest, and system roles.

- Use seeded development identities behind an authentication adapter; leave seams for government SSO/DigiLocker. Never store raw Aadhaar.
- Store time-bounded assignments (`valid_from`, `valid_to`, scope IDs, appointment reference, appointing user) and resolve them at request time.
- Enforce separation of duties: Collector computes/declares awards, finance disburses, requiring body funds/observes but cannot advance parcel workflow, policy/audit sees aggregates and audit data without personal records.
- Create an append-only, hash-chained audit ledger capturing actor role/scope at action time, old/new values, reason, document refs, signature metadata, previous hash, and row hash. Revoke update/delete.
- Log every stage decision, failed predicate, override, personal-data read, external fetch, document event, role change, guest-token event, and configuration change.
- Overrides require dedicated permission, mandatory reason, signature, audit record, and oversight flag. The NH one-year lapse has no override path.

## 4. Shared workflow transition kernel

Every transition must run atomically in one transaction:

1. Authenticate and resolve current assignment.
2. Check project/parcel regime and current stage.
3. Evaluate effective-dated gate predicates.
4. Validate evidence, signatures, deadlines, and jurisdiction.
5. Update state and append stage history.
6. Write audit and outbox events.
7. Trigger notifications/alerts and asynchronous projections.

The API, not the client, controls state. Return actionable failure details: failed predicate, missing evidence, owner role, deadline, and remediation.

## 5. Statutory engines

### LARR engine

Implement Stage 0 proposal scrutiny; SIA (Sections 4–9); preliminary notification/60-day objections (11–15); declaration and R&R/consent/deposit gates (16–19); compensation award (21–30); per-family R&R award and Third Schedule site obligations (31–42); possession (38); Section 64 reference/enhanced award; and closure prerequisites.

Include SIA/SIMP, public hearing and Expert Group/empanelment references, vulnerable-family profiling, publication checklists, objection orders, valuation inputs and provenance, signed awards, entitlement lines, payment/R&R verification, possession evidence, and dispute linkage.

### NH Act engine

Implement 3A notification/21-day clock; 3B survey and earmarking; 3C objections/hearing; 3D declaration/vesting with an absolute one-year hard lapse; 3E surrender notice/possession modes; 3G compensation; 3H payment/deposit; 3G(5)/3I arbitration with case-scoped arbitrator token; and parallel mutation.

### Configurable track

Use Railways as the first sector-regime configuration example. New regimes should be data/configuration where they fit the shared shape. Model right-of-user/non-acquisition types but do not claim them as complete in the first release.

## 6. Functional vertical slices

1. **Stage 0 proposal portal:** requiring body submits project, states, villages/survey numbers, alignment, budget, process type, and clearance evidence. Scrutiny checks completeness, regime validity, spatial conflicts, forest/Scheduled Area/CRZ constraints, food-security limits, budget, and document classification. Support multi-state hierarchy and vernacular notice packs.
2. **Parcel/GIS and field:** MapLibre status map, alignment/cadastral overlays, geometry validation, spatial conflict checks, role-scoped drill-down, and responsive assigned-parcel survey form. Capture GPS accuracy, timestamp, device, photo hash, structures/crops/trees, measurements, and owner acknowledgement. Treat phone geometry as indicative.
3. **Compensation/finance:** versioned LARR/NH formulas, line-item computation and input provenance, review/signature, allocation→deposit→instruction→disbursement→reconciliation views, fixed-point arithmetic, idempotency, UTR, unclaimed/disputed states, and strict read/write separation.
4. **R&R:** affected-family registry, per-family entitlement cards, independently tracked monetary/housing/transport/subsistence/employment lines, resettlement geometry, Third Schedule infrastructure checklist, Collector approval, and aggregate oversight.
5. **Documents/evidence:** bilingual notices/declarations/awards/orders/certificates, immutable versions, SHA-256 hashes, supersession, DSC/eSign metadata, verification at gates, and parcel/case evidence bundle export with custody history.
6. **Timeline/alerts:** configurable statutory clocks, lapse detection, 90/30/7-day alerts, responsible role/escalation/severity, and outbox delivery. Design scoped stay exclusions for later P3 work; never pause an entire project for a parcel-specific stay.
7. **Dashboards/public:** materialized KPI views for notified/acquired area, compensation, affected/displaced families, R&R, progress, possession, and timeline adherence. Provide central/state/district/CALA/requiring-body/field/R&R/finance/legal/policy views. Public no-login status, notices, estimator, objection/grievance filing, and OTP step-up for personal details. Keep grievances distinct from statutory objections.

## 7. Integration strategy

Build adapter interfaces, mock servers, provenance, retries, timeout handling, idempotency, and manual fallback first.

- Phase 1: read-only/mock DILRMP/Bhulekh, Bhoomi Rashi, e-Courts, DigiLocker, PFMS, e-Gazette, and PARIVESH evidence status.
- Phase 2: approved bi-directional/write integrations only where an API/sandbox exists.
- Phase 3: legacy import/migration, ULPIN/LGD normalization, raw identifier retention, duplicate detection, and historical archive.

Document clearly which integrations are live, read-only, mocked, or manual.

## 8. Delivery milestones and gates

**M0 Foundation:** repo, Compose, migrations, health checks, OpenAPI, CI, seeded identity, logging, ADRs. Gate: clean checkout starts and tests.

**M1 Governance/domain:** tenant model, RLS, assignments, audit chain, documents, project/parcel/owner/family models, policy middleware. Gate: scope-escalation and audit-immutability tests pass.

**M2 LARR vertical slice:** Stage 0 through SIA/notification, hearings, objections, notice generation, central/state/district/public views. Gate: transitions require all configured predicates and produce audit events.

**M3 NH vertical slice:** 3A–3D, survey evidence, objections, vesting, mutation event. Gate: expired 3A→3D projects cannot advance through any role or API; only fresh 3A recovers.

**M4 Awards to closure:** formulas, awards, R&R, payment, possession, reference/arbitration, mutation, closure. Gate: impossible sequences fail in API and database tests.

**M5 GIS/public/documents:** MapLibre, responsive field form, evidence, public lookup, estimator, grievances, document bundles, Hindi/English. Gate: desktop/mobile E2E and accessibility scenarios pass.

**M6 Alerts/dashboards/adapters:** timeline worker, escalation, KPI projections, mock/read-only integrations, exports. Gate: drill-down and recipients obey scope; adapter contract/replay tests pass.

**M7 Hardening:** performance, security, dependency scan, backup/restore, DR rehearsal, retention, audit verification, API/deployment docs. Gate: measure against targets rather than claiming them—standard reads p95 <200 ms, dashboard <3 s, map overlay <2 s, and a documented scale path toward 1M parcels/10k users.

## 9. Testing and quality

- Unit tests for formulae, predicates, deadlines, authorization, hash chains, geometry, and templates.
- Database tests for migrations, constraints, RLS, atomic transitions, idempotency, append-only audit, and projections.
- Workflow acceptance tests for happy paths, missing evidence/returns, lapse, disputed/multi-owner title, multi-state projects, consent gates, and closure.
- OpenAPI/adapter contract tests with retries and replay.
- E2E journeys for all primary panels and public users.
- Security tests for bypass/scope escalation, masking, access logs, token expiry, guest-token limits, uploads, injection, CSRF/CORS, rate limiting, and secret leakage.
- Performance and accessibility tests for PostGIS, dashboards, maps, keyboard use, labels, contrast, screen readers, 200% scaling, Hindi/English, and mobile layouts.

## 10. Scope discipline and post-MVP roadmap

Do not include in the first executable release: rebuilt clearance workflows, complete land pooling/TDR/allotment, every sector regime, working Section 24 legacy handling, unapproved live PFMS/e-Gazette writes, direct Aadhaar authentication, blockchain audit, trained ML, all-state legal packs, or construction monitoring.

After MVP: add scoped stay exclusions and Gram Sabha/Fifth/Sixth Schedule consent; Section 24 and additional/right-of-user tracks after legal validation; approved live writes; offline PWA conflict resolution; rules-first AI for extraction/anomaly/duplicate-owner/grievance/delay/value use cases; then governed model training, DPDP operations, formal GIGW/WCAG certification, and nationwide rule packs.

## Definition of done

A reproducible demo shows one project through Central Ministry, District/CALA, Field Surveyor, Public/Landowner, and Finance views; LARR and NH transitions are legally gated and auditable; parcel geometry/evidence is traceable; compensation, R&R, payments, possession, disputes, and grievances are visible only within allowed scope; and an auditor can export a tamper-evident explanation of every material action and failed gate.