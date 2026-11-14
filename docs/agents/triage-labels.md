# Triage labels

The five canonical roles use the same label strings in `montuyamaricela/bondi`:

- `needs-triage`: maintainer evaluation required.
- `needs-info`: waiting for more information.
- `ready-for-agent`: fully specified work an agent can implement.
- `ready-for-human`: human implementation required.
- `wontfix`: work will not be actioned.

The user selected GitHub with the standard vocabulary on 2026-11-14. Reuse these
labels when a tracker workflow is invoked; installation does not start triage.

## Remote setup status

On 2026-11-14, the connection reported `READ` access. `wontfix` already exists,
but creating `needs-triage` returned HTTP 404. The four other standard labels
remain uncreated; a connection with label-write access must finish that step.
The local vocabulary is configured, but remote triage setup is incomplete.
