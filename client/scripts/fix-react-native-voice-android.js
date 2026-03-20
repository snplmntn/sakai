const fs = require('fs');
const path = require('path');

const targetPath = path.join(
  __dirname,
  '..',
  'node_modules',
  '@react-native-voice',
  'voice',
  'android',
  'build.gradle'
);

if (!fs.existsSync(targetPath)) {
  process.exit(0);
}

const source = fs.readFileSync(targetPath, 'utf8');
let next = source.replaceAll('jcenter()', 'mavenCentral()');

next = next.replace(
  /def DEFAULT_SUPPORT_LIB_VERSION = "28\.0\.0"\r?\n\r?\n/,
  ''
);

next = next.replace(
  /def supportVersion = rootProject\.hasProperty\('supportLibVersion'\) \? rootProject\.supportLibVersion : DEFAULT_SUPPORT_LIB_VERSION\r?\n\r?\n/,
  ''
);

next = next.replace(
  /implementation "com\.android\.support:appcompat-v7:\$\{supportVersion\}"/,
  "implementation 'androidx.appcompat:appcompat:1.7.1'"
);

if (next !== source) {
  fs.writeFileSync(targetPath, next, 'utf8');
  console.log('Patched @react-native-voice/voice Android Gradle settings for Expo SDK 55 / Gradle 9 compatibility.');
}
