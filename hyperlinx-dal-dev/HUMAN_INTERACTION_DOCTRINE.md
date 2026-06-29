# Human Interaction Doctrine

## Purpose

Human interaction is the front door to StellaOS, IOF, and the Teralinx runtime. Humans provide intent, evidence, review, judgment, and approval. The platform may assist, normalize, validate, and explain, but it may not silently convert human intent into authoritative infrastructure state.

## Layer Order

1. Human
2. StellaOS
3. IOF
4. Runtime
5. Platform workspaces

The layers are directional. A workspace may present runtime context to a human, and StellaOS may reason over that context, but no conversational or automated layer may bypass runtime authority.

## Human Responsibilities

- Submit evidence.
- Select opportunities and customer designs.
- Review normalized objects.
- Resolve validation warnings.
- Approve authority transitions.
- Provide reason text where human judgment changes estimate, design, or lifecycle state.

## StellaOS Responsibilities

- Interpret human intent.
- Retrieve runtime context.
- Explain uncertainty, lineage, and confidence.
- Recommend next actions.
- Maintain conversation boundaries.

StellaOS is not a source of infrastructure truth. It is a reasoning and interaction layer over runtime objects.

## IOF Responsibilities

- Enforce deterministic execution.
- Preserve closure rules.
- Maintain auditable transitions.
- Reject authority escalation without explicit human or doctrine approval.

## Runtime Responsibilities

- Store evidence.
- Store runtime objects.
- Store relationships.
- Store validation reports.
- Store history.
- Serve shared APIs to all users.

## Workspace Responsibilities

Workspaces may create drafts, views, comparisons, and validation requests. They may not own authoritative data outside the runtime. Every persisted workflow object must carry runtime identity, evidence, lineage, and authority metadata.

## Authority Boundary

Human approval is required when a workflow changes authority class, including customer evidence to commercial draft, commercial draft to engineering revision, engineering revision to ScopeVersion, ScopeVersion to Control, and Field closure to Twin/OI.

## Current Sprint 11 Rule

No workflow should depend on browser-local data or static project assets for customer inventory, customer designs, relationship graph state, or runtime authority.
