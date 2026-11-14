# Context handoff

For work that needs to survive a session boundary or compaction, keep one current
note at `.agent-runs/context-handoffs/<session-id>/HANDOFF.md` (Git-ignored).
Use a unique session identifier so simultaneous chats do not overwrite each other.

Record the objective and acceptance behavior, decisions and reasons, authorizations,
branch/HEAD, changed files, verified results, current failures, owned processes,
and exact next action. Link to durable evidence rather than copying large outputs.
Keep credentials, session data, and real profile/message data out of notes.

Update after meaningful steps and before large context loads. Use the client's
native compaction behavior; project files cannot guarantee a percentage threshold
across different models or clients. Write to a temporary sibling and atomically
replace the note when preserving an existing valid checkpoint matters.

On resume, read the note and revalidate branch/HEAD, working changes, live
processes, and evidence before continuing. Reconcile lasting decisions into docs
when the task is complete. Local notes are not a backup or proof of test success.
