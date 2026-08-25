# HoldOff Android-First Messenger Release Readiness

## Current release position

HoldOff now presents **Messages** as the core product. The app contains a local conversation model, a real-time compose decision gate, explicit Spiral Lock configuration, a separately configured trusted-contact support flow, role-gated native send calls, durable native event synchronization, and Android manifest declarations. This is **not yet eligible to be described as a production-ready or Google Play-approved default SMS app**.

The managed preview cannot read, receive, send, deliver, or validate SMS. Native functionality needs a rebuilt Android application, a physical device, Android’s default-SMS role, granted messaging permissions, a test SIM, and deliberate opt-in test messages.

## Implementation status

| Area | Status | Evidence or remaining gate |
|---|---|---|
| Messenger-first navigation | Implemented | Messages is the primary destination; the former standalone Hold tab redirects into Messages. |
| Real-time message decision | Implemented in app code | The conversation composer offers a visible send, hold, revise, or Spiral Lock decision before native send. |
| Local emotional pause cues | Implemented in app code | Disabled by default; examines only the current composition for transparent observable cues and invites a user-controlled pause, analysis, hold, or send. It does not diagnose, scan the inbox, or transmit content. |
| Explicit attachment-informed analysis | Implemented in app and server code | A person can request analysis of the current draft or review and submit a disclosed scope of local thread text. Results are framed as possible observable patterns, never attachment-style labels, hidden motives, or diagnoses. |
| Spiral Lock | Implemented in app code | Disabled by default; uses only configured local cues and retains held messages for review, release, editing, or deletion. |
| Trusted-contact peer support | Implemented in app code | Separately configured, acknowledged, enabled, cancellable, and role-gated. It uses a distinct user-written SMS template and never injects the held message body. |
| Native inbound and status synchronization | Implemented in app code | Durable native events are normalized, merged idempotently, persisted, then acknowledged. Deterministic tests cover inbound deduplication and outgoing status transitions. |
| On-device SMS history import | Implemented in app and native code | A role- and permission-gated, user-initiated inbox action reads up to 500 local inbox/sent SMS records and suppresses receiver/provider duplicates. |
| Local search and contact-name resolution | Implemented in app code and Android packaging | Search runs over local names, numbers, and message text. Contact matching is an explicit read-only action; names remain optional and can be cleared back to phone numbers. |
| Thread read cleanup | Implemented in app and native code | Opening an existing conversation clears only its local unread state and matching conversation notification. |
| Notification conversation deep link | Implemented in app code and Android packaging | Incoming-SMS notifications create an app URI with the encoded sender address; the root link handler routes that URI to the matching conversation on cold launch or while the app is open. Deterministic URL tests pass. |
| Conversation notification grouping | Implemented in native code | Incoming alerts use a stable normalized-address tag plus one Android group key, so later messages from the same conversation update the existing thread alert instead of adding another tray item. |
| Respond-via-message handoff | Implemented in native code | Android requests create a reply-ready conversation handoff; they do not silently send and therefore retain the normal HoldOff send/hold decision. |
| Android manifest packaging | Validated by prebuild | One `SMS_DELIVER` query, one inbound receiver, one status receiver with sent/delivered actions, one respond-via-message service, and one `SENDTO` activity filter are generated. |
| Kotlin compilation | Blocked by sandbox Android SDK availability | Gradle reached Android project configuration but stopped because `ANDROID_HOME`/`sdk.dir` and Android command-line tools are unavailable. No Kotlin source compile result is available. |
| Physical-device default-role flow | Not tested | Requires a rebuilt Android development or release build and a physical Android device. |
| Real inbound SMS and delivery status | Not tested | Must use an opt-in test recipient. No automated validation has transmitted a real SMS. |
| Play policy approval | Not started | Needs a public privacy policy URL, Permissions Declaration Form, reviewer instructions, a core-feature explanation, and a demonstration video. |

## Required physical-device test matrix

| Test | Expected result | Completion state |
|---|---|---|
| Fresh install before role activation | Messages is clearly marked inactive; no inbox claims or direct sends are available. | Pending |
| Default-SMS role request | Android system chooser is shown; refusal keeps manual/hold features available. | Pending |
| Role approved, permissions denied | App explains the feature impact and offers retry or app-settings recovery without pressure. | Pending |
| Role and permissions approved | Role and permission states refresh when returning from Settings; native event sync runs only in this state. | Pending |
| Incoming SMS | One real inbound message creates one thread item, one unread increment, and one notification. | Pending |
| Local history import | After default-role approval, explicitly load local SMS history and confirm real inbox/sent records appear once, stay on device, and do not trigger Sadie automatically. | Pending |
| Contact-name resolution | Tap Show contact names, approve or deny the read-only contact permission, and confirm names resolve only after approval, ambiguous matches stay as numbers, and Show phone numbers clears local labels. | Pending |
| Thread read cleanup | Open one unread thread and confirm only that thread’s unread badge and matching notification are cleared. | Pending |
| Notification tap | Tapping an incoming-SMS notification opens the matching conversation address from a cold start and while HoldOff is already open. | Pending |
| Conversation notification grouping | Send two or more incoming test SMS messages from one address and confirm one tray entry updates; then send from a second address and confirm Android groups the thread alerts under HoldOff. | Pending |
| Outgoing SMS | A deliberate test send produces queued then sent/failed state; delivery is only displayed when Android reports it. | Pending |
| Multi-part SMS | One user-visible message and sensible delivery/failure handling are verified for each callback pattern. | Pending |
| Held message | Hold preserves the draft locally and does not transmit it. | Pending |
| Local emotional pause cues | With the feature enabled, enter observable cue wording in the composer and confirm a local, non-diagnostic cue appears without sending the draft, calling Sadie, or blocking send. | Pending |
| Explicit draft and thread analysis | Enable selected-text analysis, deliberately submit a current draft and a disclosed thread scope, then confirm only the chosen text is sent to Sadie, the other person is never contacted, and results are framed as possibilities rather than labels. | Pending |
| Spiral Lock | A configured cue holds a message at send time; user can revise, release, discard, or turn it off. | Pending |
| Trusted-contact support | With explicit prior setup, the visible cancel window works; cancelled support does not send; an intentional uncancelled test yields actual Android status. | Pending |
| Respond-via-message handoff | Invoke Android’s respond-via-message flow and confirm it opens the correct reply-ready thread without transmitting an SMS. | Pending |
| App restart/background | Receiver events survive while JavaScript is unavailable and appear after foreground synchronization. | Pending |
| Privacy controls | Export and delete accurately include/remove HoldOff-managed message records, holds, and support settings. | Pending |

## Google Play submission materials

Android default handlers should request the relevant role before requesting sensitive permissions, and Google Play evaluates SMS/Call Log access as a restricted permission category.[1] [2] HoldOff’s release packet should include the following materials.

| Submission item | HoldOff-specific content |
|---|---|
| Core functionality description | “HoldOff is an Android SMS messenger. It sends, receives, displays, and notifies about SMS messages after a user selects it as the default SMS app. It adds optional, on-device pause and support tools at the sending decision.” |
| Restricted-permission justification | Explain why `READ_SMS`, `RECEIVE_SMS`, `SEND_SMS`, and notifications are needed for the default SMS messenger’s core functionality, not background analytics or advertising. |
| Privacy policy URL | Publish `docs/privacy-policy.md` at a stable HTTPS URL and replace its contact placeholder with actual operator details. |
| Reviewer steps | Provide a test device/SIM path: install, select HoldOff in Android’s default-SMS chooser, grant permissions, receive a test SMS, send a test SMS, then configure and test Spiral Lock with an opt-in trusted contact. |
| Demonstration video | Show default-role selection, permission ordering, inbox receive/notification, outgoing send status, the real-time hold, a cancelled support countdown, and a separately authorized support send. Do not use private customer content. |
| Store listing disclosure | State that the product is SMS-only at launch; MMS/RCS are not supported by this foundation; peer-support SMS is optional and not emergency services. |

## Release-blocking technical gaps

The native respond-via-message service now performs a safe reply-ready handoff, but it requires device-level validation for actual role qualification. The receiver notification uses a conversation-specific update tag, deep link, and shared Android group; its platform behavior still requires physical-device validation. MMS and RCS remain outside this SMS-only implementation. The sandbox lacks an Android SDK, so a real Kotlin source build must be completed in a proper Android build environment before any release claim.

## References

[1] [Android default-handler guidance](https://developer.android.com/guide/topics/permissions/default-handlers)

[2] [Google Play SMS and Call Log permissions guidance](https://support.google.com/googleplay/android-developer/answer/17225965?hl=en)
