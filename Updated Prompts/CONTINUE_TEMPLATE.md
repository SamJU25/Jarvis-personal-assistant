# CONTINUE TEMPLATE — v11

Use after reading the previous completion report.

First inspect the current local state and the previous phase's changes. Do not assume the previous report is correct without checking.

If the previous phase passes:
- preserve it
- run its relevant live checks again if needed
- implement only the next named phase

If it fails:
- do not start the next phase
- fix only the blocking issue with evidence
- rerun the failed verification
- report the corrected state

For UI changes, require real backend data. Do not substitute mock status values.
