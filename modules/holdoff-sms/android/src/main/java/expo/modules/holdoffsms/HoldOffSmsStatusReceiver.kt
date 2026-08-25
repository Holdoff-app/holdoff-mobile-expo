package expo.modules.holdoffsms

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

class HoldOffSmsStatusReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    val address = intent.getStringExtra("address").orEmpty()
    val body = intent.getStringExtra("body").orEmpty()
    val eventId = intent.getStringExtra("eventId")
    val succeeded = resultCode == android.app.Activity.RESULT_OK
    val kind = if (!succeeded) "failed" else if (intent.action == HoldOffSmsModule.ACTION_DELIVERED) "delivered" else "sent"
    val status = if (kind == "delivered") "delivered" else if (kind == "sent") "sent" else "failed"
    HoldOffSmsEventStore.append(context, HoldOffSmsEvent(id = eventId ?: java.util.UUID.randomUUID().toString(), kind = kind, address = address, body = body, status = status, errorCode = if (kind == "failed") resultCode.toString() else null))
  }
}
