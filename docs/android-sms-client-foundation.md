# HoldOff Android SMS Client Implementation Status

## Purpose

HoldOff is now structured as an Android-first SMS messenger with connection-first support at the send decision. This document distinguishes **implemented native and app logic** from the Android build, physical-device, carrier, and Google Play validation that must still occur before any production default-SMS claim.

## Implemented logic

| Capability | Implementation status | Boundary |
|---|---|---|
| Default-SMS role request | Implemented | Android’s system chooser remains the sole authority; the preview cannot invoke it. |
| Role-first SMS permissions | Implemented | `READ_SMS`, `RECEIVE_SMS`, `SEND_SMS`, and notifications are requested only after Android reports the role active. |
| On-device SMS history | Implemented as an explicit action | After role and permissions, a user can load up to 500 local inbox/sent SMS records. Nothing is silently uploaded or sent to Sadie. |
| Incoming receiver | Implemented | `SMS_DELIVER` records an inbound event durably before JavaScript runs and updates the matching conversation notification. |
| Local inbox synchronization | Implemented | Native events and selected local history merge idempotently into local conversations; overlaps do not duplicate inbound messages or unread counts. |
| Direct SMS send | Implemented | Sends are role-gated and user initiated. The app records queued, sent, delivered, and failed updates without claiming delivery before Android reports it. |
| Real-time HoldOff gate | Implemented | Every direct send route offers a visible send, hold, revise, or enabled Spiral Lock decision. |
| Spiral Lock and trusted-contact support | Implemented | Both are default-off and revocable. A trusted-contact support SMS requires prior setup, acknowledgement, a visible cancellation window, and a separate user-written template. |
| Thread notifications | Implemented | Alerts use stable normalized-address tags so repeat messages update the same conversation notification; opening a thread clears only that matching alert. |
| Notification deep link | Implemented | Incoming alerts encode the conversation address and route cold or warm launches into the matching thread. |
| Respond-via-message handoff | Implemented | The service opens a reply-ready notification to the conversation; it never auto-sends a response and preserves the normal visible send/hold decision. |

## Remaining validation gates

The sandbox has no Android SDK or physical SIM device. Kotlin source compilation, default-role qualification, carrier send/delivery callbacks, provider history queries, background receiver persistence, notification grouping/deep links, respond-via-message invocation, and permission recovery must therefore be validated in a rebuilt Android development or release build. MMS and RCS remain outside this SMS-only implementation.

## Privacy contract

Message data stays on the device by default. Sadie receives only the exact content a person deliberately submits for analysis, interpretation, or chat; incoming SMS, history import, held messages, and the trusted-contact template are never automatically sent to Sadie. Device-history loading is explicit, role-gated, permission-gated, bounded, and limited to the current device.

HoldOff must clearly explain that becoming the Android default SMS handler replaces the current app for SMS sending and receiving. The Android role chooser remains the final authority, and a user can retain the existing messaging app by declining it.

## References

[1] [Android default-handler guidance](https://developer.android.com/guide/topics/permissions/default-handlers)

[2] [Android RoleManager](https://developer.android.com/reference/android/app/role/RoleManager)

[3] [Telephony.Sms](https://developer.android.com/reference/android/provider/Telephony.Sms)

[4] [Google Play SMS and Call Log permissions guidance](https://support.google.com/googleplay/android-developer/answer/17225965?hl=en)
