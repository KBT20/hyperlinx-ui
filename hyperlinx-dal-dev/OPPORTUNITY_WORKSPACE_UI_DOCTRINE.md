# Opportunity Workspace UI Doctrine

Phase: 6.8H

## Core Rule

Opportunity Detail is the business development cockpit. Translate, Baseline Network, Scope Review, Prism, and Quote are subordinate workflow panels inside the opportunity view.

The workspace is composition only:

- It does not create ScopeVersions.
- It does not mutate ScopeVersions.
- It does not call DAL APIs.
- It does not persist state.
- It does not create lifecycle authority.
- It does not create commercial authority.

## User Model

Ryan opens one opportunity and sees customer context, requested network intent, protection, locations, source attachments, workflow readiness, blockers, and the deterministic next action without navigating subsystem-by-subsystem.

## Authority Boundary

The UI may display workflow readiness, but it cannot approve, promote, quote, engineer, persist, or execute. Human approval badges remain visible where future workflow transitions will require governed action.

## Data Boundary

Phase 6.8H uses fixture data only. The default fixture is Google Texas AI Expansion.

## Constitutional Alignment

The opportunity is the commercial entry point. Translate prepares evidence. Scope Review collaborates. Prism scores. Quote remains future commercial workflow. ScopeVersion truth is not created here.
