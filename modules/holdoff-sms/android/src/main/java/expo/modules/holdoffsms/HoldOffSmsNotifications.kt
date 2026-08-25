package expo.modules.holdoffsms

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build

object HoldOffSmsNotifications {
  private const val CHANNEL_ID = "holdoff_sms_messages"
  private const val CHANNEL_NAME = "Messages"
  private const val DEEP_LINK_SCHEME_METADATA = "holdoff.notification_deep_link_scheme"
  private const val CONVERSATION_GROUP_KEY = "holdoff_sms_conversations"
  private const val CONVERSATION_NOTIFICATION_ID = 4101

  fun showIncoming(context: Context, address: String, body: String) {
    val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      manager.createNotificationChannel(NotificationChannel(CHANNEL_ID, CHANNEL_NAME, NotificationManager.IMPORTANCE_DEFAULT))
    }
    val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) Notification.Builder(context, CHANNEL_ID) else Notification.Builder(context)
    builder
      .setSmallIcon(context.applicationInfo.icon)
      .setContentTitle(address)
      .setContentText(body.take(120))
      .setStyle(Notification.BigTextStyle().bigText(body.take(500)))
      .setCategory(Notification.CATEGORY_MESSAGE)
      .setGroup(CONVERSATION_GROUP_KEY)
      .setContentIntent(conversationPendingIntent(context, address))
      .setAutoCancel(true)

    // Android replaces a notification only when both its tag and ID match. A stable per-address tag
    // keeps repeated messages from one conversation in one notification-tray entry.
    manager.notify(conversationNotificationTag(address), CONVERSATION_NOTIFICATION_ID, builder.build())
  }

  fun showQuickReplyHandoff(context: Context, address: String) {
    val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      manager.createNotificationChannel(NotificationChannel(CHANNEL_ID, CHANNEL_NAME, NotificationManager.IMPORTANCE_DEFAULT))
    }
    val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) Notification.Builder(context, CHANNEL_ID) else Notification.Builder(context)
    builder
      .setSmallIcon(context.applicationInfo.icon)
      .setContentTitle("Reply ready for $address")
      .setContentText("Open HoldOff to review before sending.")
      .setCategory(Notification.CATEGORY_MESSAGE)
      .setGroup(CONVERSATION_GROUP_KEY)
      .setContentIntent(conversationPendingIntent(context, address, quickReply = true))
      .setAutoCancel(true)
    manager.notify(conversationNotificationTag(address), CONVERSATION_NOTIFICATION_ID, builder.build())
  }

  fun clearConversation(context: Context, address: String) {
    val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    manager.cancel(conversationNotificationTag(address), CONVERSATION_NOTIFICATION_ID)
  }

  private fun conversationNotificationTag(address: String): String {
    val trimmed = address.trim()
    val normalizedNumber = trimmed.replace(Regex("[^+\\d]"), "")
    val conversationKey = normalizedNumber.ifBlank { trimmed.lowercase() }.lowercase()
    return "holdoff_sms_conversation:$conversationKey"
  }

  private fun conversationPendingIntent(context: Context, address: String, quickReply: Boolean = false): PendingIntent {
    val baseUri = Uri.parse("${deepLinkScheme(context)}:///conversation/${Uri.encode(address)}")
    val uri = if (quickReply) baseUri.buildUpon().appendQueryParameter("quickReply", "1").build() else baseUri
    val intent = Intent(Intent.ACTION_VIEW, uri)
      .setPackage(context.packageName)
      .addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP)
    return PendingIntent.getActivity(
      context,
      conversationNotificationTag(address).hashCode(),
      intent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )
  }

  private fun deepLinkScheme(context: Context): String {
    return try {
      context.packageManager.getApplicationInfo(context.packageName, PackageManager.GET_META_DATA)
        .metaData?.getString(DEEP_LINK_SCHEME_METADATA)
        ?.takeIf { it.isNotBlank() }
        ?: context.packageName
    } catch (_: Exception) {
      context.packageName
    }
  }
}
