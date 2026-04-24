# Billing and Platega

## v1 billing model

Billing is designed for **manual renewals**.

Assumptions:

- payment links are created through Platega
- callbacks update internal payment state
- entitlements are granted from confirmed payments
- auto-renew is not assumed in the current foundation

## Ownership

- adapter and state mapping: `packages/billing`
- API checkout + webhook routes: `apps/api`
- UI route placeholder: `/billing`

## Current state

The adapter, API checkout contract, and webhook contract exist.
The user-facing billing page is intentionally still a placeholder.

That means:

- provider integration surface is scaffolded
- domain statuses are defined
- final checkout UX and history UI are deferred
