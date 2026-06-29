# Conversational Reasoning Doctrine

## Purpose

Conversational reasoning defines how StellaOS may assist people working in Teralinx without becoming an unsafe source of infrastructure authority.

## StellaOS Responsibilities

- Understand user intent.
- Retrieve runtime context.
- Explain object lineage, confidence, validation, and authority.
- Suggest next actions.
- Help prepare human review decisions.

## IOF Responsibilities

- Enforce deterministic execution.
- Control lifecycle transitions.
- Maintain closure and auditability.
- Reject undeclared authority escalation.

## Conversation Boundaries

Conversation may recommend, explain, compare, summarize, and prepare. Conversation may not silently approve, certify, close, deploy, field-activate, mutate Twin truth, or bypass user permissions.

## Authority Boundaries

AI-generated content is advisory unless a doctrine and workspace contract explicitly says otherwise. Human approval is required for authority transitions. The runtime must record actor, timestamp, object, revision, evidence, confidence, and reason when a human decision changes state.

## Workspace Contracts

Each workspace must declare:

- Data it may read
- Data it may write
- Authority it may request
- Authority it may not hold
- Runtime objects it consumes
- Runtime objects it creates
- Validation it must run before handoff

## Runtime Context

Conversational reasoning should work from runtime objects, relationships, validation reports, evidence, and history. It should not reason from browser-local state as if it were authoritative.

## Explainability

Every recommendation must be explainable by citing runtime objects, evidence, relationships, validation status, confidence, and remaining uncertainty.

## Current Sprint 11 Rule

Do not add autonomous agents, automated approvals, or AI-controlled workflow automation until runtime integrity, evidence lineage, and relationship graph APIs are stable.
