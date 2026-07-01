# Sprint 14 Account Workspace Report

## Result

Sprint 14 establishes Account as the governed commercial workspace root for StellaOS commercial execution.

The Commercial Planning workspace now loads Accounts and Contacts from deterministic JSON persistence, uses an Active Account selector for downstream work, and shows an Account Workspace dashboard for contacts, opportunities, proposals, IOF packages, runtime history, and governed activity.

## Implemented

- Added governed Account and Contact libraries under `server/data/accounts` and `server/data/contacts`.
- Mirrored Accounts and Contacts into the Runtime Object Library with no duplicate Twin storage.
- Added Runtime History events for Account and Contact saves.
- Replaced the fixed customer dropdown with searchable Active Account selection plus create/edit and contact-entry controls.
- Preserved the existing Google Helium commercial, proposal, IOF assembly, Engineering Certification, ScopeVersion, and Runtime Lifecycle Bridge behavior.
- Threaded `accountId` through Opportunity, Proposal, Draft IOF Package, Certified IOF Package, ScopeVersion, Runtime Object, and Runtime History records.
- Extended Twin state projection to surface Account, Opportunity, Customer Twin, and Proposal runtime objects directly from `runtime-objects`.

## Golden Path

The validation script reproduces the Sprint 14 governed path:

1. Create/update the Google Account.
2. Add Google customer contacts.
3. Create the Google Helium Opportunity through the Runtime Lifecycle Bridge.
4. Generate a 20-year IRU proposal with $29M NRC.
5. Record customer approval.
6. Assemble the Draft IOF Package.
7. Complete Engineering Certification.
8. Generate the Certified IOF Package and ScopeVersion.
9. Verify Twin surfaces Account and Opportunity runtime objects without duplicate storage.

Validation command:

```bash
node sprint14-account-workspace-validation.mjs
```

The script writes proof to:

```text
.tmp/sprint14-account-workspace-report.json
```
