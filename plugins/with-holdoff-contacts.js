const { withAndroidManifest } = require("@expo/config-plugins");

const READ_CONTACTS = "android.permission.READ_CONTACTS";
const WRITE_CONTACTS = "android.permission.WRITE_CONTACTS";

module.exports = function withHoldOffContacts(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;
    const permissions = manifest["uses-permission"] || [];
    manifest["uses-permission"] = permissions.filter((entry) => entry.$?.["android:name"] !== WRITE_CONTACTS);
    if (!manifest["uses-permission"].some((entry) => entry.$?.["android:name"] === READ_CONTACTS)) {
      manifest["uses-permission"].push({ $: { "android:name": READ_CONTACTS } });
    }
    return config;
  });
};
