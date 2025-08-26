const fs = require("fs");
const path = require("path");

const APP_BUILD_GRADLE = path.join(__dirname, "../android/app/build.gradle");
const SETTINGS_GRADLE = path.join(__dirname, "../android/settings.gradle");

// Patch build.gradle: ensure flavorDimensions and play flavor exist
function patchBuildGradle() {
  let content = fs.readFileSync(APP_BUILD_GRADLE, "utf8");

  if (!content.includes("flavorDimensions")) {
    content = content.replace(
      /android\s*{[^}]*defaultConfig\s*{[^}]*}/s,
      (match) =>
        match + `\n    flavorDimensions "store"\n    productFlavors {\n        play {\n            dimension "store"\n        }\n    }`
    );
    console.log("✅ Patched: flavorDimensions + play flavor added to app/build.gradle");
  } else if (!content.includes("play {")) {
    content = content.replace(
      /flavorDimensions\s+"store"/,
      `flavorDimensions "store"\n    productFlavors {\n        play {\n            dimension "store"\n        }\n    }`
    );
    console.log("✅ Patched: play flavor added to app/build.gradle");
  } else {
    console.log("ℹ️ app/build.gradle already contains play flavor.");
  }

  fs.writeFileSync(APP_BUILD_GRADLE, content, "utf8");
}

// Patch settings.gradle: add includeBuild for react-native-iap if missing
function patchSettingsGradle() {
  let content = fs.readFileSync(SETTINGS_GRADLE, "utf8");

  if (!content.includes("include ':app'")) {
    content += `\ninclude ':app'\n`;
  }

  if (!content.includes("react-native-iap")) {
    // No need to includeBuild for react-native-iap explicitly in most cases
    console.log("ℹ️ No changes needed in settings.gradle for react-native-iap.");
  }

  fs.writeFileSync(SETTINGS_GRADLE, content, "utf8");
}

patchBuildGradle();
patchSettingsGradle();
