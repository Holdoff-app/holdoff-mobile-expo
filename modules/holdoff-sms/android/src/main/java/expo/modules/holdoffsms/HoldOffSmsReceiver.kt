package expo.modules.holdoffsms

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.provider.Telephony

class HoldOffSmsReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    if (intent.action != Telephony.Sms.Intents.SMS_DELIVER_ACTION) return
    val messages = Telephony.Sms.Intents.getMessagesFromIntent(intent)
    if (messages.isEmpty()) return
    val address = messages.first().originatingAddress ?: "Unknown sender"
    val body = messages.joinToString(separator = "") { it.messageBody.orEmpty() }
    HoldOffSmsEventStore.append(context, HoldOffSmsEvent(kind = "inbound", address = address, body = body, status = "received"))
    HoldOffSmsNotifications.showIncoming(context, address, body)
  }
}
