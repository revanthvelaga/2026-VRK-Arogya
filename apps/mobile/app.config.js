// app.json holds the settings; this only adds the Firebase file for push
// notifications when it is present. google-services.json comes from the
// Firebase console (Project settings > Your apps > Android) and is kept out
// of git — the GitHub build writes it from a repository secret. Without it
// the app still builds and runs; it just can't receive push notifications.
const fs = require('fs');
const path = require('path');

module.exports = ({ config }) => {
  const file = path.join(__dirname, 'google-services.json');
  if (fs.existsSync(file)) {
    config.android = { ...config.android, googleServicesFile: './google-services.json' };
  }
  return config;
};
