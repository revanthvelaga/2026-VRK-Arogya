#!/usr/bin/env bash
# Installs the APK on the emulator, opens the app, and fails if it
# crashes or closes within 30 seconds. Leaves a screenshot and the crash
# log (if any) in smoke/ for the workflow to upload.
set -u
APK="$1"
PKG=com.arogya.customer
mkdir -p smoke

adb wait-for-device
adb logcat -c || true
adb install -r "$APK"
adb shell monkey -p "$PKG" -c android.intent.category.LAUNCHER 1 >/dev/null

alive=1
for i in $(seq 1 30); do
  sleep 1
  if ! adb shell pidof "$PKG" >/dev/null; then alive=0; break; fi
done

adb exec-out screencap -p > smoke/screen.png || true
adb logcat -d -b crash > smoke/crash.log || true
adb logcat -d | grep -E "AndroidRuntime|ReactNativeJS|FATAL|$PKG" | tail -300 > smoke/app.log || true

if [ "$alive" = 1 ] && ! grep -q "FATAL EXCEPTION" smoke/crash.log; then
  echo "App is running after 30 seconds."
  exit 0
fi
echo "::error::The app crashed or closed on start. Crash log:"
cat smoke/crash.log
tail -80 smoke/app.log
exit 1
