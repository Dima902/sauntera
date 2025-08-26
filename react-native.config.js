// react-native.config.js
module.exports = {
  dependencies: {
    'react-native-iap': {
      platforms: {
        android: {
          sourceDir: './node_modules/react-native-iap/android/play',
        },
      },
    },
  },
};
