const { AndroidConfig, withAndroidManifest } = require("@expo/config-plugins");

const SMS_DELIVER = "android.provider.Telephony.SMS_DELIVER";
const SENDTO = "android.intent.action.SENDTO";
const STATUS_SENT = "space.manus.holdoff.mobile.SMS_SENT";
const STATUS_DELIVERED = "space.manus.holdoff.mobile.SMS_DELIVERED";
const INBOUND_RECEIVER = "expo.modules.holdoffsms.HoldOffSmsReceiver";
const STATUS_RECEIVER = "expo.modules.holdoffsms.HoldOffSmsStatusReceiver";
const RESPOND_SERVICE = "expo.modules.holdoffsms.HoldOffRespondViaMessageService";
const DEEP_LINK_SCHEME_METADATA = "holdoff.notification_deep_link_scheme";
const permissions = [
  "android.permission.RECEIVE_SMS",
  "android.permission.READ_SMS",
  "android.permission.SEND_SMS",
  "android.permission.POST_NOTIFICATIONS",
];

function intentFilter(action, data) {
  const filter = { action: [{ $: { "android:name": action } }], category: [{ $: { "android:name": "android.intent.category.DEFAULT" } }] };
  if (data) filter.data = data.map((scheme) => ({ $: { "android:scheme": scheme } }));
  return filter;
}

function filterHasAction(filter, action) {
  return filter.action?.some((item) => item.$?.["android:name"] === action);
}

function replaceActionFilter(component, action, data) {
  component["intent-filter"] = (component["intent-filter"] || []).filter((filter) => !filterHasAction(filter, action));
  component["intent-filter"].push(intentFilter(action, data));
}

function findOrCreateSingleComponent(application, key, name, attributes) {
  const matches = (application[key] || []).filter((entry) => entry.$?.["android:name"] === name);
  const primary = matches[0] || { $: { "android:name": name } };
  primary.$ = { ...primary.$, ...attributes };
  application[key] = [...(application[key] || []).filter((entry) => entry.$?.["android:name"] !== name), primary];
  return primary;
}

function upsertApplicationMetaData(application, name, value) {
  application["meta-data"] = application["meta-data"] || [];
  const existing = application["meta-data"].find((entry) => entry.$?.["android:name"] === name);
  if (existing) {
    existing.$ = { ...existing.$, "android:value": value };
    return;
  }
  application["meta-data"].push({ $: { "android:name": name, "android:value": value } });
}

function removeQueryAction(manifest, action) {
  (manifest.queries || []).forEach((query) => {
    query.intent = (query.intent || []).filter((intent) => !filterHasAction(intent, action));
  });
}

function withHoldOffSms(config) {
  const configuredScheme = Array.isArray(config.scheme) ? config.scheme[0] : config.scheme;
  const deepLinkScheme = configuredScheme || config.android?.package;
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;
    manifest["uses-permission"] = manifest["uses-permission"] || [];
    permissions.forEach((name) => {
      if (!manifest["uses-permission"].some((entry) => entry.$?.["android:name"] === name)) {
        manifest["uses-permission"].push({ $: { "android:name": name } });
      }
    });

    manifest.queries = manifest.queries?.length ? manifest.queries : [{ intent: [] }];
    removeQueryAction(manifest, SMS_DELIVER);
    manifest.queries[0].intent = manifest.queries[0].intent || [];
    manifest.queries[0].intent.push({ action: [{ $: { "android:name": SMS_DELIVER } }] });

    const application = AndroidConfig.Manifest.getMainApplicationOrThrow(config.modResults);
    if (deepLinkScheme) upsertApplicationMetaData(application, DEEP_LINK_SCHEME_METADATA, deepLinkScheme);
    const inboundReceiver = findOrCreateSingleComponent(application, "receiver", INBOUND_RECEIVER, {
      "android:exported": "true",
      "android:permission": "android.permission.BROADCAST_SMS",
    });
    replaceActionFilter(inboundReceiver, SMS_DELIVER);

    const statusReceiver = findOrCreateSingleComponent(application, "receiver", STATUS_RECEIVER, {
      "android:exported": "false",
    });
    replaceActionFilter(statusReceiver, STATUS_SENT);
    replaceActionFilter(statusReceiver, STATUS_DELIVERED);

    const respondService = findOrCreateSingleComponent(application, "service", RESPOND_SERVICE, {
      "android:exported": "true",
      "android:permission": "android.permission.SEND_RESPOND_VIA_MESSAGE",
    });
    replaceActionFilter(respondService, "android.intent.action.RESPOND_VIA_MESSAGE", ["sms", "smsto", "mms", "mmsto"]);

    const mainActivity = application.activity?.find((entry) => entry.$?.["android:name"]?.includes("MainActivity"));
    if (mainActivity) replaceActionFilter(mainActivity, SENDTO, ["sms", "smsto", "mms", "mmsto"]);
    return config;
  });
}

module.exports = withHoldOffSms;
