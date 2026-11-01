package expo.modules.arogyawellbeing

import android.app.AppOpsManager
import android.app.usage.UsageEvents
import android.app.usage.UsageStatsManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.os.Process
import android.provider.Settings
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Locale

class ArogyaWellbeingModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  override fun definition() = ModuleDefinition {
    Name("ArogyaWellbeing")

    Function("hasUsageAccess") { usageAccess() }
    Function("hasReelsAccess") { reelsAccess() }

    Function("openUsageSettings") {
      launch(Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS))
    }
    Function("openAccessibilitySettings") {
      launch(Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS))
    }

    AsyncFunction("getSnapshot") { days: Int -> snapshot(days.coerceIn(1, 14)) }
  }

  private fun launch(intent: Intent) {
    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    context.startActivity(intent)
  }

  private fun usageAccess(): Boolean {
    val ops = context.getSystemService(Context.APP_OPS_SERVICE) as AppOpsManager
    @Suppress("DEPRECATION")
    val mode = ops.checkOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, Process.myUid(), context.packageName)
    return mode == AppOpsManager.MODE_ALLOWED
  }

  private fun reelsAccess(): Boolean {
    val enabled = Settings.Secure.getString(context.contentResolver, Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES)
      ?: return false
    val mine = ComponentName(context.packageName, ReelCounterService::class.java.name)
    return enabled.split(':').any {
      ComponentName.unflattenFromString(it)?.let { c -> c == mine } ?: false
    }
  }

  private fun dayKey(cal: Calendar): String =
    SimpleDateFormat("yyyy-MM-dd", Locale.US).format(cal.time)

  private fun startOfDay(daysAgo: Int): Calendar {
    val c = Calendar.getInstance()
    c.set(Calendar.HOUR_OF_DAY, 0)
    c.set(Calendar.MINUTE, 0)
    c.set(Calendar.SECOND, 0)
    c.set(Calendar.MILLISECOND, 0)
    c.add(Calendar.DAY_OF_YEAR, -daysAgo)
    return c
  }

  private fun isNoise(pkg: String): Boolean {
    val p = pkg.lowercase(Locale.ROOT)
    return p == context.packageName || p == "android" || p.contains("launcher") ||
      p.startsWith("com.android.systemui") || p.contains("inputmethod") || p.contains("keyboard") ||
      p.startsWith("com.android.settings") || p.startsWith("com.google.android.permissioncontroller")
  }

  private fun snapshot(days: Int): Map<String, Any> {
    val hasUsage = usageAccess()
    val reels = ReelCounterService.readAll(context)

    // Minutes per app per day, from the phone's own foreground / background log.
    val perDay = HashMap<String, HashMap<String, Long>>() // day -> pkg -> ms
    if (hasUsage) {
      val manager = context.getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
      val start = startOfDay(days - 1).timeInMillis
      val end = System.currentTimeMillis()
      val events = manager.queryEvents(start, end)
      val e = UsageEvents.Event()
      val openSince = HashMap<String, Long>() // pkg -> time it came to the front
      while (events.hasNextEvent()) {
        events.getNextEvent(e)
        val pkg = e.packageName ?: continue
        when (e.eventType) {
          UsageEvents.Event.ACTIVITY_RESUMED -> openSince[pkg] = e.timeStamp
          UsageEvents.Event.ACTIVITY_PAUSED, UsageEvents.Event.ACTIVITY_STOPPED -> {
            val from = openSince.remove(pkg) ?: continue
            addSpan(perDay, pkg, from, e.timeStamp)
          }
        }
      }
      // Still open right now.
      for ((pkg, from) in openSince) addSpan(perDay, pkg, from, end)
    }

    val out = ArrayList<Map<String, Any>>()
    for (i in days - 1 downTo 0) {
      val key = dayKey(startOfDay(i))
      val apps = HashMap<String, Int>()
      var total = 0L
      for ((pkg, ms) in perDay[key] ?: HashMap()) {
        if (isNoise(pkg)) continue
        total += ms
        val min = (ms / 60000).toInt()
        if (ms >= 60000 && TRACKED.contains(pkg)) apps[pkg] = min
      }
      val reelMap = HashMap<String, Int>()
      val r = reels.optJSONObject(key)
      if (r != null) for (k in r.keys()) reelMap[k] = r.optInt(k)
      out.add(mapOf("date" to key, "total" to (total / 60000).toInt(), "apps" to apps, "reels" to reelMap))
    }
    return mapOf("usageAccess" to hasUsage, "reelsAccess" to reelsAccess(), "days" to out)
  }

  // Adds a stretch of time to the day(s) it falls in, splitting at midnight.
  private fun addSpan(perDay: HashMap<String, HashMap<String, Long>>, pkg: String, from: Long, to: Long) {
    if (to <= from) return
    var cursor = from
    while (cursor < to) {
      val cal = Calendar.getInstance()
      cal.timeInMillis = cursor
      val key = dayKey(cal)
      cal.set(Calendar.HOUR_OF_DAY, 0)
      cal.set(Calendar.MINUTE, 0)
      cal.set(Calendar.SECOND, 0)
      cal.set(Calendar.MILLISECOND, 0)
      cal.add(Calendar.DAY_OF_YEAR, 1)
      val dayEnd = minOf(cal.timeInMillis, to)
      val map = perDay.getOrPut(key) { HashMap() }
      map[pkg] = (map[pkg] ?: 0L) + (dayEnd - cursor)
      cursor = dayEnd
    }
  }

  companion object {
    // The apps worth showing by name; the rest still count in the day's total.
    val TRACKED = setOf(
      "com.instagram.android", "com.instagram.lite", "com.google.android.youtube",
      "com.facebook.katana", "com.facebook.lite", "com.snapchat.android", "com.twitter.android",
      "com.whatsapp", "org.telegram.messenger", "com.reddit.frontpage", "com.linkedin.android",
      "in.mohalla.sharechat", "com.pinterest", "com.netflix.mediaclient", "in.startv.hotstar",
      "com.amazon.avod.thirdpartyclient", "com.spotify.music"
    )
  }
}
