# Whitney / Qwen integration source checkpoint

Whitney is a separate hosted bid companion. No Whitney application implementation was found or added here. This branch packages the current local IOF integration seams for source review, not deployment or production acceptance.

Source selection: Windows `teralinx-layer1` HEAD `0e288fab0bc2238b61b85dc070ca6efc478ad021` plus the exact working-file hashes in SOURCE_MANIFEST.json. Branch parent is the already-published `teralinx-layer1` tip `873d94d6a2fca91929dd6dda55cab4ec24c02e09`. This deliberately excludes 118 unrelated local commits and all unselected dirty/untracked material. Files are current-byte snapshots, not a claim that the complete latest local application has been published. Some imports need omitted newer local dependencies; this is a review checkpoint, not a runnable full-stack release.

| Whitney need | Existing source / reusable seam | Limit or required integration decision |
|---|---|---|
| Qwen reasoning | server/network-planning/iof-research-provider.js: researchConfiguration, checkResearchProvider, inferResearch; bounded HTTP and public-source tools | Reuse configured L40S provider. Do not mistake configured/default model for returned-model proof. Provider retries some transient statuses unless caller constrains attempts. No automatic paid fallback or live call authorized here. |
| Grounding and candidate review | scripts/iof-qwen-saved-object-validation.mjs; iof-financial-enrichment-contract.js | Required method is not approved method; DEFER valid; context-specific impact UNRESOLVED; whole unsupported finding rejected; all candidates pending review. Private READ_CONTEXT and historical responses intentionally withheld. Schema compliance does not prove semantic truth. |
| Evidence retrieval | iof-package-repository.js; iof-enrichment*.js; iof-research-tools.js; content/content-registry-authority.js | Exact source/revision/hash, account/opportunity and source attribution remain mandatory. Public retrieval is SSRF-bounded. Internal read permission does not grant GPU disclosure or customer export. CPU library projection remains an unimplemented proposal. |
| Customer clarification | routes/customer-portal.js: project questions/comments, packageForProject, persistAction; routes/proposal-drafts.js: handleComment / handleRequestChanges | Existing authenticated project/revision-bound customer action. An external Whitney conversation is not automatically an authorized portal identity or approved revision. Need exact mapping, consent/disclosure and safe retry semantics. |
| Central draft saving | routes/proposal-drafts.js: handleSave / saveProposal, /api/proposals; routes/commercial-revisions.js | Reuse canonical proposal ownership, revision/hash and existing repository. No second draft database. Whitney adapter must carry exact deal identity, actor and conflict/version evidence; generic external bid drafts may need an approved schema mapping. |
| Submission | proposal-drafts.js: handleSubmitCustomer, internal-commercial-approve and submit-customer actions | Saving, internal review and customer release are distinct. Current submission paths can issue customer-facing review artifacts; do not invoke from a model or a save operation. Need separately authorized Whitney submission contract. |
| Kyle review queue | existing proposal GET visibility, authority reviewers/approvers/executives assignments; proposal.manage/proposal.review and governed duty checks | Reuse durable Kyle principal/membership and server-filtered authorized proposals. A dedicated Whitney intake queue/filter and per-draft notification are not verified as implemented; do not create broad access or hardcode a Kyle bypass. |
| Authentication | routes/auth.js: authenticateRuntimeRequest / enforceAuthenticationBoundary; auth/postgres.js, password and invitation authorities | Use existing application identity/session and durable Account/subject checks. No browser-cookie copying, SSH-as-application-auth, secret-bearing browser bundle or new service identity created. Hosted app delegation/CORS/CSRF/session issuance must be explicitly specified. |
| Persistence / auditing | routes/_shared.js; persistence/repositoryCatalog.js; postgres/client.js / repositoryAdapter.js; commercial-revisions.js | Preserve configured file/Postgres authority and exact immutable history. Research POST persists request/results and is not a read-only inference endpoint. No DB or business writes were performed. |
| Deployment configuration | ecosystem.config.cjs; scripts/local-dev.mjs; package.json; server/index.js | Configuration source only. No .env, actual endpoint credentials, SSH tunnel, PM2 invocation, migrations, service start or deployment. Included SQL is review-only source, never applied. |

Paths in this table are relative to hyperlinx-dal-dev/. server/routes/network-planner.js and src/api/plannerIof.ts show the existing internal API wiring. PlannerIofResearch / PlannerIofEnrichment retain the existing UI admission boundaries; this checkpoint creates no new UI or API.

## Review gates

1. Identify exact Whitney draft/customer/project/revision mapping to existing Opportunity/Proposal authority. Do not imply that customer clarification is customer acceptance.
2. Specify existing approved application authentication/delegation and exact permitted operations; preserve server-side tenant filtering and disclosure rights.
3. Separate advisory Qwen output, centrally saved draft, submission intent and Kyle's human approval. No inferred approval from model prose or a status label.
4. Bind updates to exact current revision and prove duplicate/retry/conflict handling using isolated fixtures before connecting the hosted companion.
5. Preserve legacy research behavior, no paid fallback, existing grounding corrections and deterministic CPU authority. Any implementation requires a separately bounded approval.

## Validation and exclusions

SOURCE_MANIFEST.json lists exact current source bytes. SECURITY_AND_VALIDATION.json records a source-only secret-pattern scan, forbidden-path checks, syntax checks and synthetic offline provider tests. Pattern scanning is not a claim of exhaustive security assurance or an external scanner pass.

No credentials, .env files, business/customer record bodies, logs, captured requests/responses, checkpoints containing operational evidence, model weights, build outputs or preserved untracked operational archives were added. Static demo labels in existing application source are code, not copied customer records. Existing published parent history is not re-sanitized or rewritten.

Full historical grounding self-tests are not runnable from this review branch because their private evidence is deliberately excluded; previous local receipts are not republished as a new pass. This checkpoint makes no authenticated-browser, hosted-Whitney, live-inference, submission or deployment claim. Local active branch, index, business state and all original work remain preserved. Review and human acceptance remain pending.
