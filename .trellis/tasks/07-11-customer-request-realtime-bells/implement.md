# Implementation checklist

- [x] Trace schema, query, mutations, socket and existing bell consumers.
- [ ] Add notification recipient dispatcher for managers and active restaurant staff.
- [ ] Trigger notification dispatch from customer-request restaurant events.
- [ ] Add focused backend tests for recipient notification dispatch and socket emission.
- [ ] Refactor POS request queue UI and realtime refresh.
- [ ] Add/update focused queue tests.
- [ ] Place the request queue in the staff order workspace.
- [ ] Make the staff bell global without duplicating it on the order workspace.
- [ ] Make bell items navigate to their action URL after marking read.
- [ ] Re-fetch changed files and review callers/usages.
- [ ] Record test/build status.
