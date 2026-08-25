# SMS Conversation Import Boundary

HoldOff’s supported import flow intentionally requires the user to select and copy the desired conversation content in their own messaging application, then explicitly paste and confirm that copy inside HoldOff. Expo’s SMS module supports opening the device’s SMS composer, not enumerating or selecting inbox conversations. Android exposes SMS data through `Telephony.Sms`, but access concerns sensitive user data and Play-distributed apps typically need to qualify as the default SMS handler before requesting the associated SMS permissions. Accordingly, HoldOff does not request inbox access, does not run background SMS reads, and does not present a fabricated native thread picker.

## Sources

- [Expo SMS documentation](https://docs.expo.dev/versions/latest/sdk/sms/)
- [Android `Telephony.Sms` API reference](https://developer.android.com/reference/android/provider/Telephony.Sms)
- [Android default-handler permissions guidance](https://developer.android.com/guide/topics/permissions/default-handlers)

## Default SMS role assessment

Making an app Android’s default SMS handler is materially different from opening the system SMS composer. Android expects a default SMS handler to perform the messaging function and to obtain the user’s explicit role consent before requesting SMS permissions. The `ROLE_SMS` role is available through Android’s `RoleManager` on API 29 and later, but the system only grants roles to applications that meet the required manifest/component criteria.

HoldOff is currently a message-reflection companion, not a complete SMS client: it does not receive messages, manage the inbox, deliver inbound notifications, or provide a replacement messaging thread interface. Requesting the default SMS role or SMS read permissions before those core capabilities, user-facing privacy policy, disclosure, and Play permissions declaration are complete would not be a compliant implementation. The safe product path remains a user-controlled composer handoff; a future full default-SMS edition must be a dedicated Android-native project with the required receiver, provider, notification, role request, permission, privacy-policy, and Play Console review work.

### Sources

- [Android default-handler permissions guidance](https://developer.android.com/guide/topics/permissions/default-handlers)
- [Android RoleManager reference](https://developer.android.com/reference/android/app/role/RoleManager)
- [Google Play SMS and Call Log permissions guidance](https://support.google.com/googleplay/android-developer/answer/17225965?hl=en)

## Native receiver, send, and notification requirements

The Android implementation must be a custom native module and requires a development build rather than Expo Go. Expo’s module documentation shows that Kotlin modules can expose native functions and events to JavaScript; the receiver and send-status broadcasts should persist message events independently of the JavaScript runtime, then expose a local sync operation to the React Native layer after launch.

The module must request the default SMS role before requesting SMS permissions. Its Android manifest must declare the relevant messaging intents and an SMS delivery receiver, and Android requires an intent query declaration for `android.provider.Telephony.SMS_DELIVER` when querying the default SMS package on Android 11 and later. `Telephony.Sms` provides inbox, sent, draft, and conversation access only under the eligible role/permissions, while `SmsManager` exposes text and multipart send APIs and send-result statuses. The initial implementation should explicitly support SMS only; MMS requires a separate carrier/MMSC pipeline.

### Additional sources

- [Expo custom native module tutorial](https://docs.expo.dev/modules/native-module-tutorial/)
- [Android `Telephony.Sms` reference](https://developer.android.com/reference/android/provider/Telephony.Sms)
- [Android `SmsManager` reference](https://developer.android.com/reference/android/telephony/SmsManager)

### Permission-recovery navigation

The recovery action uses Expo Linking’s `openSettings()` API to open the operating system page for the installed app. It appears only as an optional, user-initiated action inside denial guidance and does not prompt users to change a permission automatically.

- [Expo Linking API](https://docs.expo.dev/versions/latest/sdk/linking/)

### Default-SMS release requirements — official source check, 2026-08-25

- Android states that an app must be capable of the function for which it seeks default-handler status; a default SMS handler must be able to send text messages. It also requires the app to request default-handler status before requesting the related permissions, such as `READ_SMS`.
- Google Play evaluates high-risk and sensitive permissions such as SMS and Call Log during release. When the submitted Android App Bundle requests covered permissions, the Play Console may require a Permissions Declaration Form and Google Play approval. Any newly requested sensitive permissions require a revised declaration.
- The Play Console declaration workflow requires the developer to identify the permission-related core functionality, provide reviewer instructions, and provide a video demonstration.

Sources: [Android default-handler guidance](https://developer.android.com/guide/topics/permissions/default-handlers); [Google Play permission declaration guidance](https://support.google.com/googleplay/android-developer/answer/9214102?hl=en).

### On-device history boundary — official source check, 2026-08-25

Android’s default-handler guidance requires an app to request the default SMS role before asking for `READ_SMS`. The `Telephony.Sms` and `Telephony.Sms.Conversations` APIs document the system SMS provider and its conversation view. HoldOff should only load selected local SMS history after the user has approved the role and messaging permissions; it must keep that history device-local and never present fabricated records.

Sources: [Android default-handler guidance](https://developer.android.com/guide/topics/permissions/default-handlers); [Telephony.Sms](https://developer.android.com/reference/android/provider/Telephony.Sms); [Telephony.Sms.Conversations](https://developer.android.com/reference/android/provider/Telephony.Sms.Conversations).

### Attachment-informed conversation analysis guardrails — August 25, 2026

- Adult attachment research links attachment dimensions with communication tendencies, but written conversation alone cannot establish a person’s attachment style. HoldOff should therefore reflect observable text patterns as possibilities and never label either participant as anxious, avoidant, secure, disordered, or clinically unwell.
- Attachment-informed wording can invite reflection on needs for reassurance, space, clarity, repair, availability, disclosure, or holding back. It must remain non-diagnostic, avoid claims about hidden intent, and offer user-controlled next steps rather than contact instructions.
- Columbia Psychiatry describes attachment as relevant to close-relationship behavior and emphasizes that attachment does not map to gender stereotypes and can change over time. [1]
- A Frontiers experimental study found associations between attachment style and communication strategies in a specific difficult-message task; it also notes dimensional approaches rather than reducing people to fixed categories. [2]
- A peer-reviewed couples study links attachment dimensions with disclosure and holding-back patterns in cancer-related communication; those findings are not a basis for labeling people from a text thread. [3]

References: [1] https://www.columbiapsychiatry.org/news/how-attachment-styles-influence-romantic-relationships; [2] https://www.frontiersin.org/journals/psychology/articles/10.3389/fpsyg.2020.01065/full; [3] https://pmc.ncbi.nlm.nih.gov/articles/PMC10718526/.
