package expo.modules.holdoffsms

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject
import java.util.UUID

data class HoldOffSmsEvent(
  val id: String = UUID.randomUUID().toString(),
  val kind: String,
  val address: String,
  val body: String,
  val timestamp: Long = System.currentTimeMillis(),
  val status: String,
  val errorCode: String? = null,
) {
  fun toJson(): JSONObject = JSONObject().apply {
    put("id", id)
    put("kind", kind)
    put("address", address)
    put("body", body)
    put("timestamp", timestamp.toString())
    put("status", status)
    if (errorCode != null) put("errorCode", errorCode)
  }
}

object HoldOffSmsEventStore {
  private const val PREFS = "holdoff_sms_native_events"
  private const val KEY_EVENTS = "events"

  fun append(context: Context, event: HoldOffSmsEvent) {
    val events = readJson(context)
    events.put(event.toJson())
    context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString(KEY_EVENTS, events.toString()).commit()
  }

  fun all(context: Context): List<Map<String, Any?>> {
    val events = readJson(context)
    return (0 until events.length()).mapNotNull { index ->
      val event = events.optJSONObject(index) ?: return@mapNotNull null
      mapOf(
        "id" to event.optString("id"),
        "kind" to event.optString("kind"),
        "address" to event.optString("address"),
        "body" to event.optString("body"),
        "timestamp" to event.optString("timestamp"),
        "status" to event.optString("status"),
        "errorCode" to event.optString("errorCode", ""),
      )
    }
  }

  fun acknowledge(context: Context, ids: List<String>) {
    val retained = JSONArray()
    val idSet = ids.toSet()
    val events = readJson(context)
    for (index in 0 until events.length()) {
      val event = events.optJSONObject(index) ?: continue
      if (!idSet.contains(event.optString("id"))) retained.put(event)
    }
    context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString(KEY_EVENTS, retained.toString()).commit()
  }

  private fun readJson(context: Context): JSONArray {
    val raw = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY_EVENTS, "[]") ?: "[]"
    return try { JSONArray(raw) } catch (_: Exception) { JSONArray() }
  }
}
