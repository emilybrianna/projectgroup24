const { AndroidConfig, IOSConfig, withAndroidManifest, withEntitlementsPlist } = require("@expo/config-plugins");

function withStripeSafe(config, props) {
  const merchantIdentifier = props && props.merchantIdentifier;
  const enableGooglePay = !!(props && props.enableGooglePay);

  config = withEntitlementsPlist(config, function (nextConfig) {
    const key = "com.apple.developer.in-app-payments";
    const merchants = nextConfig.modResults[key] || [];

    if (merchantIdentifier && !merchants.includes(merchantIdentifier)) {
      merchants.push(merchantIdentifier);
    }

    if (merchants.length) {
      nextConfig.modResults[key] = merchants;
    }

    return nextConfig;
  });

  config = IOSConfig.XcodeProjectFile.withBuildSourceFile(config, {
    filePath: "noop-file.swift",
    contents: ["//", "// @generated", "// Required for Swift native modules.", "//", ""].join("\n"),
  });

  config = withAndroidManifest(config, function (nextConfig) {
    const mainApplication = AndroidConfig.Manifest.getMainApplicationOrThrow(nextConfig.modResults);
    const googlePayMetaName = "com.google.android.gms.wallet.api.enabled";

    if (enableGooglePay) {
      AndroidConfig.Manifest.addMetaDataItemToMainApplication(
        mainApplication,
        googlePayMetaName,
        "true"
      );
    } else {
      AndroidConfig.Manifest.removeMetaDataItemFromMainApplication(
        mainApplication,
        googlePayMetaName
      );
    }

    return nextConfig;
  });

  return config;
}

module.exports = withStripeSafe;
