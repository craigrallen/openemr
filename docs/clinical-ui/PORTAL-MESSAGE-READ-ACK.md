# Native portal message read acknowledgement (OPEMR-187)

The native messaging client posts `task=setread`, `noteid`, and `csrf_token_form` to `portal/messaging/handle_note.php`. The handler replies with the exact plain text `ok` for its successful `setread` branch. It can also return other text, including `missing note id`, on an HTTP 200 response.

Opening a New message now keeps it selected and visible while the request runs. Its cached status changes to Read only after the response body is exactly `ok`. A different body, HTTP failure, or rejected fetch leaves the cached status New and logs a generic handled error. The response body is not logged.

Mark all as read keeps the existing `Promise.all` behavior: all unread requests must return exact `ok` before any local cached status changes. A failed or unacknowledged request leaves the local unread statuses in place. This is a client cache rule, not a transaction or a claim that server persistence was independently verified; other requests in the batch may already have succeeded server side.

The portable contract runs the complete native `messages.js` in a Node VM with mocked fetch, DOM, and jQuery boundaries. It covers single and bulk acknowledgement, error bodies, HTTP and network failures, cache state, selection, request metadata, and no-op behavior for already Read messages:

```sh
node tests/clinical-ui/portal-message-read-ack-contract.cjs
```

The Jest adapter in `tests/js/portal-message-read-ack.test.js` invokes that same Node contract. No live portal, authentication, database, session, or clinical workflow is exercised by this contract.
