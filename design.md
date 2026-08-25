# HoldOff Mobile Interface Design

## Product intent

HoldOff is a private, Android-first SMS messenger for moments when a person needs a little space before responding. The inbox, conversation thread, composer, native send status, and incoming-message notifications are the core experience. HoldOff’s connection-first assistance appears within those live message moments: a person can pause a draft, ask Sadie for help, interpret a received message, notice local patterns, or enable a pre-consented Spiral Lock without leaving the conversation.

The mobile interface should feel like a calm, capable bedside light at 1am: supportive but never intrusive, with clear choices, grounded language, and no visual urgency except where safety information needs gentle prominence. The design is portrait-first for a 390 × 844 viewport and follows Android messaging conventions for fast thread access, 44-point minimum touch targets, bottom sheets for contextual tasks, and thumb-reachable primary actions.

## Screen list and content

| Screen | Primary content | Key functionality |
|---|---|---|
| Welcome onboarding | Mission statement and moving violet light field | Starts the required first-run sequence |
| Age confirmation | Plain-language 13+ confirmation checkbox | Continues only after confirmed; otherwise gives a kind, non-dismissive message |
| Capabilities | Accurate explanation of draft-only analysis and Android SMS distinction | Requires acknowledgement before continuing |
| Support boundaries | Not-therapy disclosure and prominent 988 note | Requires acknowledgement before continuing |
| Consent | Required AI draft-analysis consent and optional mood-learning consent | Stores revocable choices locally |
| Trusted contact | Optional name and phone/email form | Saves locally; never contacts anyone automatically |
| Meet Sadie | Small animated companion introduction | Completes onboarding and opens Hold tab |
| Messages | Default landing screen with real device-local SMS conversations, unread counts, previews, and status | Opens a conversation or native-role activation; does not fabricate inbox data in preview |
| Conversation | SMS thread, message composer, send status, and contextual conversation controls | Sends through HoldOff’s real-time decision gate before the native Android send call |
| Compose decision gate | Lightweight send-boundary sheet | Lets the user send now, hold, revise, or use enabled Spiral Lock without silently changing their text |
| Held messages | Local queue of deliberately unsent messages | Lets the user review, edit, release, discard, or turn off a hold setting |
| Spiral Lock | Opt-in real-time safety intervention, preserved draft, and safety note where applicable | Holds configured messages and can trigger separately enabled trusted-contact support |
| Spiral Lock settings | Consent, indicators, trusted-contact configuration, support template, cancellation and revocation controls | Allows a user to opt into a configurable peer-support SMS that is sent when a Spiral Lock triggers |
| Interpret | Received-message input, uncertainty statement, read and reply approaches | Stores optional local interpretation record associated with a person |
| People | Local people list and add-person sheet | Creates people and opens their personal thread |
| Person thread | Held, sent, saved, and interpreted entries with state chips | Presents a local-only, warm pattern summary when history exists |
| Patterns | Consent-aware inferred writing timeline and pattern cards | Shows no mood questionnaire; explains inference and provides a transparent empty state |
| Settings | Launch conditions, consents, trusted contact, data export/delete, capability statement and 988 note | Lets users update local-only preferences and revoke consent without losing unrelated functions |
| Pricing | Accurate Free, Pro, One-Time and disabled therapist integration cards | Shows an honest preview notice instead of checkout |
| Sadie drawer | Contextual companion avatar, chat history, input, safe failure state | Keeps context for the current session and offers supportive responses from one service boundary |

## Key user flows

The primary flow starts with **Messages**. The person opens an SMS thread, writes a message, and taps Send. At that exact point, HoldOff provides a fast visible choice to send, hold, or revise. If the person has configured Spiral Lock, selected device-local indicators may activate a hold before native transmission. A held message stays visible and editable. HoldOff may send a separately configured peer-support text to the one trusted contact the person chose in advance, with a visible cancel window and real native sent/delivered/failed status. This support message never includes the held SMS body unless the user intentionally places it in their own template.

The interpretation flow lets the user paste a received text, select “Help me read this,” and receive an explicitly uncertain reading with healthy reply options. The person flow begins from a local People list or from the recipient field, then shows a local thread and a history-derived summary only when enough entries exist. The pattern flow only displays inference if the user has opted in, and every chart or card names its writing-based source.

## Visual language

| Element | Decision |
|---|---|
| Background | Layered vertical gradient from **#1A1033** to **#2D1B4E**, with restrained radial violet halos behind key moments |
| Elevated surfaces | **#241640** fill, **#3D2A66** hairline border, 20–24 point rounded corners, soft violet shadow |
| Primary action | Deep blue **#4361EE** with violet **#7B5EE7** secondary highlight; labels in **#F5F2FF** |
| Text | Warm white **#F5F2FF** for high emphasis and muted lavender **#A99CC9** for secondary text |
| Focus / active state | Soft lavender **#B8A6F0** outlines, never high-chroma warm colors |
| Verdict colors | Clear uses a cool green-violet treatment; Hold uses muted gold-lavender without orange, coral, peach, salmon, or a light theme |
| Typography | System rounded typography, large 30–34 point headers, 16–17 point body copy, comfortable 1.45–1.6 line height |
| Sadie | A 64-point floating circular avatar at lower right, with gentle eye, mouth, and glow changes for calm, listening, concerned, encouraging, and celebrating states |

## Interaction and accessibility

The persistent navigation is centered on **Messages**, with people, patterns, and settings as supportive spaces. Contextual features such as Hold, Interpret, Sadie, and Spiral Lock open from an active thread or its composer rather than displacing the messenger. Long forms scroll, but primary actions remain at the visual bottom of each section rather than requiring reaching back to the header. Bottom sheets use a visible drag handle and explicit close label. Controls use full-row press targets, accessible labels, readable contrast, and non-color-dependent status chips. All sensitive text is stored only on device through AsyncStorage; the app offers JSON export and a double-confirm delete action.
