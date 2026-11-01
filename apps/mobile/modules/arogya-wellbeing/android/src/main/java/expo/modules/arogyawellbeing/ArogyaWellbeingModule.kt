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

  private fun category(pkg: String): String {
    val p = pkg.lowercase(Locale.ROOT)
    return when {
      p.contains("dialer") || p.contains("incallui") || p == "com.android.phone" || p.contains("telecom") ||
        p == "us.zoom.videomeetings" || p == "com.google.android.apps.tachyon" || p == "com.microsoft.teams" -> "calls"
      MESSAGING.contains(p) -> "messaging"
      SOCIAL.contains(p) -> "social"
      VIDEO.contains(p) -> "video"
      else -> "other"
    }
  }

  private fun snapshot(days: Int): Map<String, Any> {
    val hasUsage = usageAccess()
    val reels = ReelCounterService.readAll(context)

    val perDay = HashMap<String, HashMap<String, Long>>() // day -> pkg -> ms
    val perNight = HashMap<String, Long>() // day -> ms between 23:00 and 05:00
    val unlocks = HashMap<String, Int>()
    val points = ArrayList<Long>() // moments the phone was in use (for the sleep estimate)
    val end = System.currentTimeMillis()
    if (hasUsage) {
      val manager = context.getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
      // Start a few hours early so last night's sleep for the first day is visible.
      val start = startOfDay(days - 1).timeInMillis - 4 * 3600_000L
      val events = manager.queryEvents(start, end)
      val e = UsageEvents.Event()
      val openSince = HashMap<String, Long>()
      while (events.hasNextEvent()) {
        events.getNextEvent(e)
        val pkg = e.packageName ?: continue
        when (e.eventType) {
          UsageEvents.Event.ACTIVITY_RESUMED -> {
            openSince[pkg] = e.timeStamp
            if (!isNoise(pkg)) points.add(e.timeStamp)
          }
          UsageEvents.Event.ACTIVITY_PAUSED, UsageEvents.Event.ACTIVITY_STOPPED -> {
            val from = openSince.remove(pkg) ?: continue
            addSpan(perDay, perNight, pkg, from, e.timeStamp)
            if (!isNoise(pkg)) points.add(e.timeStamp)
          }
          UsageEvents.Event.KEYGUARD_HIDDEN -> {
            val cal = Calendar.getInstance()
            cal.timeInMillis = e.timeStamp
            val k = dayKey(cal)
            unlocks[k] = (unlocks[k] ?: 0) + 1
          }
        }
      }
      for ((pkg, from) in openSince) {
        addSpan(perDay, perNight, pkg, from, end)
        if (!isNoise(pkg)) points.add(end)
      }
      points.sort()
    }

    val out = ArrayList<Map<String, Any>>()
    for (i in days - 1 downTo 0) {
      val key = dayKey(startOfDay(i))
      val apps = HashMap<String, Int>()
      val cats = hashMapOf("social" to 0L, "messaging" to 0L, "video" to 0L, "calls" to 0L, "other" to 0L)
      var total = 0L
      for ((pkg, ms) in perDay[key] ?: HashMap()) {
        if (isNoise(pkg)) continue
        total += ms
        val c = category(pkg)
        cats[c] = (cats[c] ?: 0L) + ms
        if (ms >= 60000 && TRACKED.contains(pkg)) apps[pkg] = (ms / 60000).toInt()
      }
      val reelMap = HashMap<String, Int>()
      val r = reels.optJSONObject(key)
      if (r != null) for (k in r.keys()) reelMap[k] = r.optInt(k)
      val day = hashMapOf<String, Any>(
        "date" to key,
        "total" to (total / 60000).toInt(),
        "apps" to apps,
        "reels" to reelMap,
        "cats" to cats.mapValues { (it.value / 60000).toInt() },
        "night" to ((perNight[key] ?: 0L) / 60000).toInt(),
        "unlocks" to (unlocks[key] ?: 0),
      )
      val sleep = estimateSleep(points, i, end)
      if (sleep != null) day["sleep"] = sleep
      out.add(day)
    }
    return mapOf("usageAccess" to hasUsage, "reelsAccess" to reelsAccess(), "days" to out)
  }

  // Sleep is estimated as the longest stretch with no phone use between
  // 8 pm the evening before and noon on that day (at least 3 hours).
  private fun estimateSleep(points: List<Long>, daysAgo: Int, now: Long): Map<String, Any>? {
    if (points.isEmpty()) return null
    val dayStart = startOfDay(daysAgo)
    val winStart = dayStart.timeInMillis - 4 * 3600_000L
    val winEnd = dayStart.timeInMillis + 12 * 3600_000L
    if (now < dayStart.timeInMillis + 5 * 3600_000L) return null
    val limit = minOf(winEnd, now)
    // Need phone data from before the window to trust the first gap.
    if (points.first() > winStart) return null
    var best = 0L
    var bedAt = 0L
    var wakeAt = 0L
    var prev = winStart
    for (t in points) {
      if (t < winStart) { prev = t; continue }
      val cur = minOf(t, limit)
      if (cur - prev > best) { best = cur - prev; bedAt = prev; wakeAt = cur }
      prev = cur
      if (t >= limit) break
    }
    if (prev < limit && limit - prev > best) { best = limit - prev; bedAt = prev; wakeAt = limit }
    if (best < 3 * 3600_000L) return null
    if (wakeAt >= now - 60_000L && daysAgo == 0 && now < winEnd) return null // still asleep / not woken yet
    val fmt = SimpleDateFormat("HH:mm", Locale.US)
    return mapOf("bed" to fmt.format(bedAt), "wake" to fmt.format(wakeAt), "minutes" to (best / 60000).toInt())
  }

  // Adds a stretch of time to the day(s) it falls in, splitting at midnight.
  private fun addSpan(
    perDay: HashMap<String, HashMap<String, Long>>,
    perNight: HashMap<String, Long>,
    pkg: String,
    from: Long,
    to: Long,
  ) {
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
      val dayStart = cal.timeInMillis
      cal.add(Calendar.DAY_OF_YEAR, 1)
      val dayEnd = minOf(cal.timeInMillis, to)
      val map = perDay.getOrPut(key) { HashMap() }
      map[pkg] = (map[pkg] ?: 0L) + (dayEnd - cursor)
      if (!isNoise(pkg)) {
        val h = 3600_000L
        val early = maxOf(0L, minOf(dayEnd, dayStart + 5 * h) - maxOf(cursor, dayStart))
        val late = maxOf(0L, dayEnd - maxOf(cursor, dayStart + 23 * h))
        perNight[key] = (perNight[key] ?: 0L) + early + late
      }
      cursor = dayEnd
    }
  }

  companion object {
    val MESSAGING = setOf(
      "com.whatsapp", "com.whatsapp.w4b", "org.telegram.messenger", "org.thoughtcrime.securesms",
      "com.google.android.apps.messaging", "com.android.mms", "com.samsung.android.messaging",
      "com.facebook.orca", "com.truecaller", "com.discord", "com.slack"
    )
    val SOCIAL = setOf(
      "com.instagram.android", "com.instagram.lite", "com.facebook.katana", "com.facebook.lite",
      "com.snapchat.android", "com.twitter.android", "com.reddit.frontpage", "com.linkedin.android",
      "com.pinterest", "in.mohalla.sharechat", "com.zhiliaoapp.musically", "com.threads.android", "com.instagram.barcelona"
    )
    val VIDEO = setOf(
      "com.google.android.youtube", "com.netflix.mediaclient", "in.startv.hotstar",
      "com.amazon.avod.thirdpartyclient", "com.mxtech.videoplayer.ad", "com.jio.media.ondemand",
      "com.sonyliv", "com.google.android.apps.youtube.music", "com.spotify.music"
    )
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
