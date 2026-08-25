package expo.modules.holdoffsms

import android.app.PendingIntent
import android.app.role.RoleManager
import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.content.Intent
import android.os.Build
import android.provider.Telephony
import android.telephony.SmsManager
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.util.UUID

class HoldOffSmsModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("HoldOffSms")

    Function("getRoleState") {
      val context = requireContext()
      mapOf(
        "available" to roleAvailable(context),
        "active" to isDefaultSmsApp(context),
        "packageName" to context.packageName,
      )
    }

    Function("requestDefaultSmsRole") {
      val context = requireContext()
      val activity = appContext.currentActivity ?: return@Function
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
        val manager = context.getSystemService(RoleManager::class.java)
        if (manager?.isRoleAvailable(RoleManager.ROLE_SMS) == true && !manager.isRoleHeld(RoleManager.ROLE_SMS)) {
          activity.startActivity(manager.createRequestRoleIntent(RoleManager.ROLE_SMS))
        }
      } else if (!isDefaultSmsApp(context)) {
        activity.startActivity(Intent(Telephony.Sms.Intents.ACTION_CHANGE_DEFAULT).putExtra(Telephony.Sms.Intents.EXTRA_PACKAGE_NAME, context.packageName))
      }
    }

    Function("getMessagingPermissionState") {
      val context = requireContext()
      val missing = missingMessagingPermissions(context)
      mapOf(
        "roleActive" to isDefaultSmsApp(context),
        "allGranted" to missing.isEmpty(),
        "missing" to missing,
      )
    }

    Function("requestMessagingPermissions") {
      val context = requireContext()
      require(isDefaultSmsApp(context)) { "HoldOff can request messaging permissions only after Android approves its default SMS role." }
      val missing = missingMessagingPermissions(context)
      if (missing.isEmpty()) return@Function mapOf("requested" to false, "missing" to emptyList<String>())
      val activity = appContext.currentActivity ?: throw IllegalStateException("HoldOff needs an active Android screen to request permissions.")
      activity.requestPermissions(missing.toTypedArray(), REQUEST_MESSAGING_PERMISSIONS)
      mapOf("requested" to true, "missing" to missing)
    }

    Function("sendText") { address: String, body: String ->
      val context = requireContext()
      require(address.trim().isNotEmpty()) { "HoldOff needs a recipient before sending an SMS." }
      require(body.trim().isNotEmpty()) { "HoldOff cannot send an empty SMS." }
      require(isDefaultSmsApp(context)) { "HoldOff must be the active default SMS app before sending directly." }
      val eventId = UUID.randomUUID().toString()
      val sent = PendingIntent.getBroadcast(context, eventId.hashCode(), statusIntent(context, ACTION_SENT, eventId, address, body), PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
      val delivered = PendingIntent.getBroadcast(context, (eventId + "delivery").hashCode(), statusIntent(context, ACTION_DELIVERED, eventId, address, body), PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
      val manager = SmsManager.getDefault()
      val parts = manager.divideMessage(body)
      if (parts.size > 1) {
        val sentIntents = ArrayList<PendingIntent>(parts.size).apply { repeat(parts.size) { add(sent) } }
        val deliveryIntents = ArrayList<PendingIntent>(parts.size).apply { repeat(parts.size) { add(delivered) } }
        manager.sendMultipartTextMessage(address, null, parts, sentIntents, deliveryIntents)
      } else {
        manager.sendTextMessage(address, null, body, sent, delivered)
      }
      HoldOffSmsEventStore.append(context, HoldOffSmsEvent(id = eventId, kind = "sent", address = address, body = body, status = "queued"))
      mapOf("id" to eventId, "status" to "queued")
    }

    Function("getDeviceSmsHistory") {
      val context = requireContext()
      require(isDefaultSmsApp(context)) { "HoldOff can load device SMS history only after Android approves its default SMS role." }
      require(missingMessagingPermissions(context).isEmpty()) { "HoldOff needs approved messaging permissions before loading device SMS history." }
      readDeviceSmsHistory(context)
    }

    Function("getPendingEvents") { HoldOffSmsEventStore.all(requireContext()) }
    Function("acknowledgeEvents") { ids: List<String> -> HoldOffSmsEventStore.acknowledge(requireContext(), ids) }
    Function("markConversationRead") { address: String -> HoldOffSmsNotifications.clearConversation(requireContext(), address) }
  }

  private fun requireContext(): Context = requireNotNull(appContext.reactContext)

  private fun roleAvailable(context: Context): Boolean {
    return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) context.getSystemService(RoleManager::class.java)?.isRoleAvailable(RoleManager.ROLE_SMS) == true else true
  }

  private fun isDefaultSmsApp(context: Context): Boolean {
    return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) context.getSystemService(RoleManager::class.java)?.isRoleHeld(RoleManager.ROLE_SMS) == true else Telephony.Sms.getDefaultSmsPackage(context) == context.packageName
  }

  private fun missingMessagingPermissions(context: Context): List<String> {
    val permissions = mutableListOf(Manifest.permission.READ_SMS, Manifest.permission.RECEIVE_SMS, Manifest.permission.SEND_SMS)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) permissions.add(Manifest.permission.POST_NOTIFICATIONS)
    return permissions.filter { context.checkSelfPermission(it) != PackageManager.PERMISSION_GRANTED }
  }

  private fun statusIntent(context: Context, action: String, eventId: String, address: String, body: String): Intent {
    return Intent(action).setPackage(context.packageName).putExtra("eventId", eventId).putExtra("address", address).putExtra("body", body)
  }

  private fun readDeviceSmsHistory(context: Context): List<Map<String, String>> {
    val projection = arrayOf(Telephony.Sms._ID, Telephony.Sms.ADDRESS, Telephony.Sms.BODY, Telephony.Sms.DATE, Telephony.Sms.TYPE)
    val events = mutableListOf<Map<String, String>>()
    context.contentResolver.query(Telephony.Sms.CONTENT_URI, projection, null, null, "${Telephony.Sms.DATE} DESC")?.use { cursor ->
      val idIndex = cursor.getColumnIndexOrThrow(Telephony.Sms._ID)
      val addressIndex = cursor.getColumnIndexOrThrow(Telephony.Sms.ADDRESS)
      val bodyIndex = cursor.getColumnIndexOrThrow(Telephony.Sms.BODY)
      val dateIndex = cursor.getColumnIndexOrThrow(Telephony.Sms.DATE)
      val typeIndex = cursor.getColumnIndexOrThrow(Telephony.Sms.TYPE)
      while (cursor.moveToNext() && events.size < DEVICE_HISTORY_LIMIT) {
        val type = cursor.getInt(typeIndex)
        val incoming = type == Telephony.Sms.MESSAGE_TYPE_INBOX
        val outgoing = type == Telephony.Sms.MESSAGE_TYPE_SENT
        if (!incoming && !outgoing) continue
        val address = cursor.getString(addressIndex)?.trim().orEmpty()
        if (address.isBlank()) continue
        events.add(mapOf(
          "id" to "device-sms:${cursor.getString(idIndex)}",
          "kind" to if (incoming) "inbound" else "sent",
          "address" to address,
          "body" to (cursor.getString(bodyIndex) ?: ""),
          "timestamp" to cursor.getLong(dateIndex).toString(),
          "status" to if (incoming) "received" else "sent",
        ))
      }
    }
    return events
  }

  companion object {
    const val ACTION_SENT = "space.manus.holdoff.mobile.SMS_SENT"
    const val ACTION_DELIVERED = "space.manus.holdoff.mobile.SMS_DELIVERED"
    const val REQUEST_MESSAGING_PERMISSIONS = 4102
    const val DEVICE_HISTORY_LIMIT = 500
  }
}
