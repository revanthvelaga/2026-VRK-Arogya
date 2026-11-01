package expo.modules.arogyawellbeing

import android.app.job.JobInfo
import android.app.job.JobParameters
import android.app.job.JobScheduler
import android.app.job.JobService
import android.content.BroadcastReceiver
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.BatteryManager
import org.json.JSONArray
import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * Remembers each time the phone is put on charge: when, for how long, and
 * from what battery level to what. Android keeps no charging history an app
 * can read, so this starts counting from when Arogya 1.12.2 is installed.
 *
 * Changes are noticed by a light check every 15 minutes and whenever the
 * wellbeing page is opened, so a very short top-up can be missed.
 */
object ChargeTracker {
  private const val PREFS = "arogya_wellbeing"
  private const val STATE = "charge_state"
  private const val LOG = "charge_log"
  private const val JOB_ID = 46021

  data class Battery(val plugged: Boolean, val level: Int)

  fun read(context: Context): Battery? {
    val i = context.applicationContext.registerReceiver(null, IntentFilter(Intent.ACTION_BATTERY_CHANGED)) ?: return null
    val plugged = i.getIntExtra(BatteryManager.EXTRA_PLUGGED, 0) != 0
    val level = i.getIntExtra(BatteryManager.EXTRA_LEVEL, -1)
    val scale = i.getIntExtra(BatteryManager.EXTRA_SCALE, 100)
    val pct = if (level >= 0 && scale > 0) level * 100 / scale else -1
    return Battery(plugged, pct)
  }

  private fun dayKey(ms: Long): String = SimpleDateFormat("yyyy-MM-dd", Locale.US).format(Date(ms))

  @Synchronized
  fun update(context: Context, battery: Battery? = read(context)) {
    battery ?: return
    val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
    val state = try { JSONObject(prefs.getString(STATE, "{}") ?: "{}") } catch (_: Exception) { JSONObject() }
    val now = System.currentTimeMillis()
    val first = !state.has("plugged")
    val was = state.optBoolean("plugged", false)
    if (battery.plugged && (!was || first)) {
      state.put("plugged", true)
      state.put("since", now)
      state.put("from", battery.level)
      state.put("counted", !first) // a charge already going on at install isn't counted as a new one
    } else if (!battery.plugged && was) {
      if (state.optBoolean("counted", true)) {
        val log = readLog(prefs)
        val since = state.optLong("since", now)
        val entry = JSONObject()
          .put("start", since)
          .put("end", now)
          .put("from", state.optInt("from", -1))
          .put("to", battery.level)
        val day = dayKey(since)
        val list = log.optJSONArray(day) ?: JSONArray()
        list.put(entry)
        log.put(day, list)
        val keys = log.keys().asSequence().toList().sorted()
        if (keys.size > 45) for (k in keys.take(keys.size - 45)) log.remove(k)
        prefs.edit().putString(LOG, log.toString()).apply()
      }
      state.put("plugged", false)
      state.put("counted", true)
    } else if (first) {
      state.put("plugged", battery.plugged)
      state.put("counted", true)
    }
    state.put("level", battery.level)
    prefs.edit().putString(STATE, state.toString()).apply()
  }

  private fun readLog(prefs: android.content.SharedPreferences): JSONObject =
    try { JSONObject(prefs.getString(LOG, "{}") ?: "{}") } catch (_: Exception) { JSONObject() }

  /** day -> list of {start, end, from, to}; a charge going on now is included with end = now. */
  fun sessions(context: Context): Map<String, List<Map<String, Any>>> {
    val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
    val log = readLog(prefs)
    val out = HashMap<String, MutableList<Map<String, Any>>>()
    val fmt = SimpleDateFormat("HH:mm", Locale.US)
    for (day in log.keys()) {
      val arr = log.optJSONArray(day) ?: continue
      val list = out.getOrPut(day) { ArrayList() }
      for (i in 0 until arr.length()) {
        val o = arr.optJSONObject(i) ?: continue
        val start = o.optLong("start")
        val end = o.optLong("end")
        list.add(mapOf(
          "start" to fmt.format(Date(start)),
          "end" to fmt.format(Date(end)),
          "minutes" to ((end - start) / 60000).toInt(),
          "from" to o.optInt("from", -1),
          "to" to o.optInt("to", -1),
          "now" to false,
        ))
      }
    }
    val state = try { JSONObject(prefs.getString(STATE, "{}") ?: "{}") } catch (_: Exception) { JSONObject() }
    if (state.optBoolean("plugged", false) && state.optBoolean("counted", false)) {
      val since = state.optLong("since")
      val now = System.currentTimeMillis()
      out.getOrPut(dayKey(since)) { ArrayList() }.add(mapOf(
        "start" to fmt.format(Date(since)),
        "end" to fmt.format(Date(now)),
        "minutes" to ((now - since) / 60000).toInt(),
        "from" to state.optInt("from", -1),
        "to" to state.optInt("level", -1),
        "now" to true,
      ))
    }
    return out
  }

  fun schedule(context: Context) {
    try {
      val js = context.getSystemService(Context.JOB_SCHEDULER_SERVICE) as JobScheduler
      if (js.getPendingJob(JOB_ID) != null) return
      val job = JobInfo.Builder(JOB_ID, ComponentName(context, ChargeCheckJob::class.java))
        .setPeriodic(15 * 60 * 1000L)
        .setPersisted(true)
        .build()
      js.schedule(job)
    } catch (_: Exception) {
      // scheduling not allowed on this phone — charges are still noticed when the app is open
    }
  }

  /** Listens for the charger while registered by a long-lived component. */
  class Receiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
      val plugged = intent.action == Intent.ACTION_POWER_CONNECTED
      val level = read(context)?.level ?: -1
      update(context, Battery(plugged, level))
    }
  }
}

class ChargeCheckJob : JobService() {
  override fun onStartJob(params: JobParameters?): Boolean {
    try { ChargeTracker.update(this) } catch (_: Exception) {}
    return false
  }

  override fun onStopJob(params: JobParameters?): Boolean = true
}
