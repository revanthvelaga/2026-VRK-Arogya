package expo.modules.arogyawellbeing

import android.accessibilityservice.AccessibilityService
import android.content.Context
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo
import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * Counts reels / shorts swiped in a few social apps.
 *
 * It looks only at two things: which app is open, and whether a vertical
 * swipe happened on a screen that is a reels / shorts feed. Nothing that is
 * shown or typed is read or kept — only a number per app per day, saved on
 * this phone.
 */
class ReelCounterService : AccessibilityService() {
  private var lastCountAt = 0L
  private var lastPackage = ""

  override fun onAccessibilityEvent(event: AccessibilityEvent?) {
    event ?: return
    if (event.eventType != AccessibilityEvent.TYPE_VIEW_SCROLLED) return
    val pkg = event.packageName?.toString() ?: return
    val markers = MARKERS[pkg] ?: return

    // One swipe fires a burst of scroll events: count at most one per 700 ms.
    val now = System.currentTimeMillis()
    if (pkg == lastPackage && now - lastCountAt < 700) return

    val root: AccessibilityNodeInfo? = rootInActiveWindow
    val onReels = try {
      root != null && isReelsScreen(root, markers, 0)
    } catch (_: Exception) {
      false
    } finally {
      @Suppress("DEPRECATION")
      root?.recycle()
    }
    if (!onReels) return

    lastCountAt = now
    lastPackage = pkg
    bump(this, pkg)
  }

  override fun onInterrupt() {}

  // A reels feed shows up as a screen holding a view whose id mentions
  // reels / shorts / clips / spotlight. Depth-limited so a swipe stays cheap.
  private fun isReelsScreen(node: AccessibilityNodeInfo, markers: List<String>, depth: Int): Boolean {
    if (depth > 14) return false
    val id = node.viewIdResourceName
    if (id != null) {
      val lower = id.lowercase(Locale.ROOT)
      for (m in markers) if (lower.contains(m)) return true
    }
    for (i in 0 until node.childCount) {
      val child = node.getChild(i) ?: continue
      val hit = isReelsScreen(child, markers, depth + 1)
      @Suppress("DEPRECATION")
      child.recycle()
      if (hit) return true
    }
    return false
  }

  companion object {
    const val PREFS = "arogya_wellbeing"
    const val KEY = "reels"

    // Parts of view ids that only exist on a reels / shorts feed.
    val MARKERS: Map<String, List<String>> = mapOf(
      "com.instagram.android" to listOf("clips_viewer", "reel_viewer", "clips_tab"),
      "com.instagram.lite" to listOf("clips_viewer", "reel_viewer"),
      "com.google.android.youtube" to listOf("reel_player", "reel_recycler", "shorts_"),
      "com.facebook.katana" to listOf("reels_viewer", "reel_viewer", "reels_"),
      "com.facebook.lite" to listOf("reels"),
      "com.snapchat.android" to listOf("spotlight"),
      "com.twitter.android" to listOf("immersive", "video_dock"),
      "in.mohalla.sharechat" to listOf("moj", "video_feed"),
    )

    fun today(): String = SimpleDateFormat("yyyy-MM-dd", Locale.US).format(Date())

    @Synchronized
    fun bump(context: Context, pkg: String) {
      val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
      val all = try {
        JSONObject(prefs.getString(KEY, "{}") ?: "{}")
      } catch (_: Exception) {
        JSONObject()
      }
      val day = today()
      val d = all.optJSONObject(day) ?: JSONObject()
      d.put(pkg, d.optInt(pkg, 0) + 1)
      all.put(day, d)
      // Keep about six weeks.
      val keys = all.keys().asSequence().toList().sorted()
      if (keys.size > 45) for (k in keys.take(keys.size - 45)) all.remove(k)
      prefs.edit().putString(KEY, all.toString()).apply()
    }

    fun readAll(context: Context): JSONObject {
      val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
      return try {
        JSONObject(prefs.getString(KEY, "{}") ?: "{}")
      } catch (_: Exception) {
        JSONObject()
      }
    }
  }
}
