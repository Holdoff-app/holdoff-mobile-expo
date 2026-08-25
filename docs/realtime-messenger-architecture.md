# HoldOff Real-Time Messenger Architecture

## Product boundary

HoldOff is being rebuilt as an **Android-first SMS messenger**. Conversations, threads, composition, sending, delivery state, incoming-message notifications, and default-SMS activation are the primary product. HoldOff’s existing connection-first features are embedded in these flows rather than presented as a separate companion app.

The managed preview remains a visual and state-model review surface only. It cannot read, receive, or transmit SMS. Native SMS behavior requires a rebuilt Android development or release build, Android’s default-SMS role, the related runtime permissions, and physical-device validation.

## Core screens and message flow

| Surface | Purpose | HoldOff integration |
|---|---|---|
| Messages | Default landing screen with real, device-local SMS conversations | Shows unread counts, the latest message preview, send/delivery state, and an honest native-build status when unavailable. |
| Conversation | A thread with an always-available composer and native send action | The send action passes through HoldOff’s real-time decision gate before the native send call. |
| Compose decision gate | A lightweight sheet shown at the exact send decision when applicable | Offers **Send now**, **Hold**, **Revise**, and, when the user has enabled it, **Spiral Lock**. It does not silently change text. |
| Held messages | A visible local queue of messages deliberately held before transmission | The user may release, edit, discard, or disable the relevant hold setting. |
| Spiral Lock settings | Explicit setup and ongoing control for automated holding and trusted-contact support | Includes enablement, user-selected activation indicators, trusted-contact selection, editable support text, timeout/cancel behavior, and one-tap revocation. |
| People and patterns | Relationship context derived only from locally stored, user-approved data | Incoming or outgoing message content is never submitted to Sadie automatically. |

## Real-time decision model

HoldOff makes its intervention **inside its own Android SMS composer, before `SmsManager` is asked to transmit**. It is therefore able to hold a message in real time only after the user has chosen HoldOff as the default SMS app and is composing within HoldOff. It cannot intercept messages typed in another messaging application.

The standard decision gate is always visible and user-controlled. A person can select **Hold** at any time, even when no cue is detected. When the user enables Spiral Lock in Settings, device-local configured indicators can request a hold at the send boundary. These signals are an invitation to pause, not a diagnosis of panic, addiction, danger, or intent.

## Spiral Lock and trusted-contact support

Spiral Lock is disabled by default. Enabling it requires a dedicated acknowledgement that the user is asking HoldOff to hold qualifying outgoing messages before sending. A separately enabled trusted-contact support option may send a preconfigured peer-support SMS to one chosen contact when Spiral Lock activates.

| Safeguard | Required behavior |
|---|---|
| Explicit configuration | The user selects the trusted contact, confirms the phone number, writes or accepts the support message, and enables the option in advance. |
| Visible activation | When a lock is triggered, HoldOff displays that the original message is held and that trusted-contact support is scheduled or being sent. |
| Cancellation | A clearly labelled countdown cancel control is shown before automatic support transmission whenever platform timing permits. The user can still edit, release, or discard their held message independently. |
| No silent content sharing | The trusted-contact message is a separate configured check-in. It does not include the held message body, interpretation, or chat history unless the user explicitly writes it into the support template. |
| Delivery feedback | Native sent, delivered, and failed events appear in the UI. A queued or requested state is not represented as delivered. |
| Reversibility | The user can disable Spiral Lock, disable trusted-contact support, replace the contact, or erase local settings at any time. |
| Safety boundary | This is peer support, not therapy or emergency response. The product continues to present emergency and 988 guidance where appropriate. |

## Data and native-event model

The Android receiver and status callbacks write durable native events while JavaScript is not running. On foreground and on the Messages screen, HoldOff drains the event queue after confirming an active SMS role and granted messaging permissions. The app then deterministically merges each record by normalised phone address into a local conversation and message model, persists it, and acknowledges only the persisted native event IDs.

`inbound` events create received messages and increment a conversation’s unread count. `sent`, `delivered`, and `failed` events update the existing native message record when possible and otherwise preserve a visible status record. This lets the user see actual system events without fabricating a conversation history or a successful delivery.

## Compliance and validation boundary

The feature is not ready to claim production default-SMS compliance until the Android module compiles, role-qualification components work on a physical device, actual opt-in test messages confirm receiver and send-status behavior, the privacy policy is published, and Google Play accepts the appropriate declaration and review materials. MMS and RCS remain out of scope for the SMS-only foundation.

## References

[1] [Android default-handler guidance](https://developer.android.com/guide/topics/permissions/default-handlers)

[2] [Android RoleManager reference](https://developer.android.com/reference/android/app/role/RoleManager)

[3] [Google Play SMS and Call Log permissions guidance](https://support.google.com/googleplay/android-developer/answer/17225965?hl=en)
