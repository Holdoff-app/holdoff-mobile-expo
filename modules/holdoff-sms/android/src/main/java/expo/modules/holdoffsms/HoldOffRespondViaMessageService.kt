package expo.modules.holdoffsms

import android.app.Service
import android.content.Intent
import android.os.IBinder

/**
 * Android can invoke this service for a respond-via-message request. HoldOff deliberately does not
 * transmit the supplied response silently: the request is returned to the appropriate conversation
 * as a notification handoff so the user can use the normal visible send/hold decision in the app.
 */
class HoldOffRespondViaMessageService : Service() {
  override fun onBind(intent: Intent?): IBinder? = null

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    val address = intent?.data?.schemeSpecificPart?.trim().orEmpty()
    if (address.isNotBlank()) HoldOffSmsNotifications.showQuickReplyHandoff(this, address)
    stopSelf(startId)
    return START_NOT_STICKY
  }
}
