package com.jknoova.playerstats;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import android.os.IBinder;
import android.util.Log;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.HashSet;
import java.util.Set;

public class BackgroundNotificationService extends Service {
    private static final String TAG = "PS_BgService";
    public static final String PREFS_NAME = "CoachBgNotifs";
    public static final String KEY_NOTIFIED_IDS = "notified_req_ids";
    public static final String KEY_NOTIFIED_CHAT_MSGS = "notified_chat_msgs";
    public static final String KEY_LAST_CHAT_TIME = "last_chat_time";

    private static final String SERVICE_CHANNEL_ID = "coach_service_channel";
    private static final String ALERT_CHANNEL_ID = "player_stats_channel";
    private static final int FOREGROUND_NOTIF_ID = 2001;

    private static volatile boolean isAppInForeground = false;
    private Thread pollingThread;
    private volatile boolean isRunning = false;

    public static void setAppInForeground(boolean inForeground) {
        isAppInForeground = inForeground;
    }

    public static void syncLastChatTime(Context ctx, long timestamp) {
        if (ctx == null) return;
        try {
            SharedPreferences prefs = ctx.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
            long cur = prefs.getLong(KEY_LAST_CHAT_TIME, 0L);
            long target = Math.max(cur, timestamp > 0 ? timestamp : System.currentTimeMillis());
            prefs.edit().putLong(KEY_LAST_CHAT_TIME, target).apply();
        } catch (Exception e) {
            Log.e(TAG, "Error syncLastChatTime", e);
        }
    }

    public static void markChatAsRead(Context ctx, String chatId, long messageTime) {
        if (ctx == null) return;
        try {
            SharedPreferences prefs = ctx.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
            long target = Math.max(messageTime, System.currentTimeMillis());
            SharedPreferences.Editor editor = prefs.edit();
            editor.putLong(KEY_LAST_CHAT_TIME, Math.max(prefs.getLong(KEY_LAST_CHAT_TIME, 0L), target));
            if (chatId != null && !chatId.isEmpty()) {
                editor.putLong("read_time_" + chatId, target);
                Set<String> set = prefs.getStringSet(KEY_NOTIFIED_CHAT_MSGS, null);
                Set<String> newSet = set != null ? new HashSet<>(set) : new HashSet<String>();
                newSet.add(chatId + "_" + messageTime);
                editor.putStringSet(KEY_NOTIFIED_CHAT_MSGS, newSet);
            }
            editor.apply();
        } catch (Exception e) {
            Log.e(TAG, "Error markChatAsRead in service", e);
        }
    }

    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannels();
        startForegroundSelf();
        startPolling();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        startForegroundSelf();
        if (!isRunning) {
            startPolling();
        }
        return START_STICKY;
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public void onDestroy() {
        isRunning = false;
        if (pollingThread != null) {
            pollingThread.interrupt();
        }
        super.onDestroy();
    }

    private void createNotificationChannels() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm == null) return;

            // Canal silencioso para mantener vivo el servicio en segundo plano
            NotificationChannel serviceChannel = new NotificationChannel(
                SERVICE_CHANNEL_ID,
                "Servicio en Segundo Plano",
                NotificationManager.IMPORTANCE_MIN
            );
            serviceChannel.setDescription("Mantiene activas las notificaciones del entrenador");
            serviceChannel.setShowBadge(false);
            serviceChannel.enableVibration(false);
            serviceChannel.setSound(null, null);
            nm.createNotificationChannel(serviceChannel);

            // Canal de alertas para avisos del club (alta prioridad, sonido, vibración)
            NotificationChannel alertChannel = new NotificationChannel(
                ALERT_CHANNEL_ID,
                "Alertas y Chat",
                NotificationManager.IMPORTANCE_HIGH
            );
            alertChannel.setDescription("Notificaciones de convocatorias, chat y solicitudes");
            alertChannel.enableVibration(true);
            alertChannel.setShowBadge(true);
            nm.createNotificationChannel(alertChannel);
        }
    }

    private void startForegroundSelf() {
        try {
            Intent appIntent = new Intent(this, MainActivity.class);
            appIntent.setFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
            PendingIntent pendingIntent = PendingIntent.getActivity(
                this, 0, appIntent,
                Build.VERSION.SDK_INT >= Build.VERSION_CODES.M
                    ? (PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE)
                    : PendingIntent.FLAG_UPDATE_CURRENT
            );

            Notification.Builder builder;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                builder = new Notification.Builder(this, SERVICE_CHANNEL_ID);
            } else {
                builder = new Notification.Builder(this);
            }

            builder.setContentTitle("Player Stats Coach")
                   .setContentText("Alertas activas en segundo plano")
                   .setSmallIcon(R.mipmap.ic_launcher)
                   .setContentIntent(pendingIntent)
                   .setOngoing(true);

            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
                builder.setPriority(Notification.PRIORITY_MIN);
            }

            startForeground(FOREGROUND_NOTIF_ID, builder.build());
        } catch (Exception e) {
            Log.e(TAG, "Error iniciando ForegroundService", e);
        }
    }

    private void startPolling() {
        if (isRunning) return;
        isRunning = true;
        pollingThread = new Thread(new Runnable() {
            @Override
            public void run() {
                Log.i(TAG, "Iniciando bucle de comprobación en segundo plano...");
                // Espera inicial de 5s antes del primer sondeo
                try {
                    Thread.sleep(5000);
                } catch (InterruptedException ignored) {}

                while (isRunning) {
                    try {
                        // Si la app no está abierta en primer plano, comprobar Firestore
                        if (!isAppInForeground) {
                            checkPlayerCreationRequests();
                            checkProfileRequests();
                            checkProfileClaimRequests();
                            checkNewChatMessages();
                        }
                    } catch (Throwable t) {
                        Log.e(TAG, "Error en comprobación de notificaciones: " + t.getMessage());
                    }

                    try {
                        // Comprobar cada 16 segundos
                        Thread.sleep(16000);
                    } catch (InterruptedException e) {
                        break;
                    }
                }
            }
        });
        pollingThread.setName("PSCoachNotificationThread");
        pollingThread.start();
    }

    private String fetchJson(String urlString) {
        HttpURLConnection conn = null;
        try {
            URL url = new URL(urlString);
            conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("GET");
            conn.setConnectTimeout(8000);
            conn.setReadTimeout(8000);
            conn.setRequestProperty("Accept", "application/json");

            int code = conn.getResponseCode();
            if (code != 200) return null;

            BufferedReader in = new BufferedReader(new InputStreamReader(conn.getInputStream(), StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder();
            String line;
            while ((line = in.readLine()) != null) {
                sb.append(line);
            }
            in.close();
            return sb.toString();
        } catch (Exception e) {
            return null;
        } finally {
            if (conn != null) conn.disconnect();
        }
    }

    private SharedPreferences getPrefs() {
        return getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
    }

    private Set<String> getNotifiedIds() {
        Set<String> set = getPrefs().getStringSet(KEY_NOTIFIED_IDS, null);
        return set != null ? new HashSet<>(set) : new HashSet<String>();
    }

    private void markNotified(String id) {
        Set<String> set = getNotifiedIds();
        set.add(id);
        getPrefs().edit().putStringSet(KEY_NOTIFIED_IDS, set).apply();
    }

    private void checkPlayerCreationRequests() {
        String url = "https://firestore.googleapis.com/v1/projects/player-stats-2ac9d/databases/(default)/documents/clubs/default_club/player_creation_requests";
        String json = fetchJson(url);
        if (json == null) return;

        try {
            JSONObject obj = new JSONObject(json);
            if (!obj.has("documents")) return;
            JSONArray docs = obj.getJSONArray("documents");
            Set<String> notified = getNotifiedIds();

            for (int i = 0; i < docs.length(); i++) {
                JSONObject doc = docs.getJSONObject(i);
                String docName = doc.optString("name", "");
                String docId = docName.contains("/") ? docName.substring(docName.lastIndexOf('/') + 1) : docName;
                if (docId.isEmpty() || notified.contains(docId)) continue;

                JSONObject fields = doc.optJSONObject("fields");
                if (fields == null) continue;

                String status = getFieldString(fields, "status");
                if ("pending".equalsIgnoreCase(status)) {
                    String name = getFieldString(fields, "name");
                    String lastName = getFieldString(fields, "lastName");
                    String fullName = getFieldString(fields, "fullName");
                    if (fullName.isEmpty()) {
                        fullName = (name + " " + lastName).trim();
                    }
                    if (fullName.isEmpty()) fullName = "Nuevo Jugador";

                    String teamText = getFieldString(fields, "teamText");
                    String pos = getFieldString(fields, "position");

                    String desc = fullName;
                    if (!teamText.isEmpty()) desc += " • Equipo: " + teamText;
                    else if (!pos.isEmpty()) desc += " • Pos: " + pos;

                    postAlertNotification(
                        "➕ Nueva solicitud de alta de jugador",
                        desc + " solicita unirse al club.",
                        docId.hashCode()
                    );
                    markNotified(docId);
                }
            }
        } catch (Exception e) {
            Log.e(TAG, "checkPlayerCreationRequests error", e);
        }
    }

    private void checkProfileRequests() {
        String url = "https://firestore.googleapis.com/v1/projects/player-stats-2ac9d/databases/(default)/documents/clubs/default_club/profile_requests";
        String json = fetchJson(url);
        if (json == null) return;

        try {
            JSONObject obj = new JSONObject(json);
            if (!obj.has("documents")) return;
            JSONArray docs = obj.getJSONArray("documents");
            Set<String> notified = getNotifiedIds();

            for (int i = 0; i < docs.length(); i++) {
                JSONObject doc = docs.getJSONObject(i);
                String docName = doc.optString("name", "");
                String docId = docName.contains("/") ? docName.substring(docName.lastIndexOf('/') + 1) : docName;
                if (docId.isEmpty() || notified.contains(docId)) continue;

                JSONObject fields = doc.optJSONObject("fields");
                if (fields == null) continue;

                String status = getFieldString(fields, "status");
                if ("pending".equalsIgnoreCase(status)) {
                    String fromName = getFieldString(fields, "fromPlayerName");
                    String toName = getFieldString(fields, "toPlayerName");
                    if (toName.isEmpty()) toName = "Jugador";

                    String msg = fromName.isEmpty() ? ("Solicitud para perfil: " + toName) : (fromName + " ➔ " + toName);
                    postAlertNotification(
                        "🔄 Solicitud de cambio de perfil",
                        msg,
                        docId.hashCode()
                    );
                    markNotified(docId);
                }
            }
        } catch (Exception e) {
            Log.e(TAG, "checkProfileRequests error", e);
        }
    }

    private void checkProfileClaimRequests() {
        String url = "https://firestore.googleapis.com/v1/projects/player-stats-2ac9d/databases/(default)/documents/clubs/default_club/profile_claim_requests";
        String json = fetchJson(url);
        if (json == null) return;

        try {
            JSONObject obj = new JSONObject(json);
            if (!obj.has("documents")) return;
            JSONArray docs = obj.getJSONArray("documents");
            Set<String> notified = getNotifiedIds();

            for (int i = 0; i < docs.length(); i++) {
                JSONObject doc = docs.getJSONObject(i);
                String docName = doc.optString("name", "");
                String docId = docName.contains("/") ? docName.substring(docName.lastIndexOf('/') + 1) : docName;
                if (docId.isEmpty() || notified.contains(docId)) continue;

                JSONObject fields = doc.optJSONObject("fields");
                if (fields == null) continue;

                String status = getFieldString(fields, "status");
                if ("pending".equalsIgnoreCase(status)) {
                    String playerName = getFieldString(fields, "targetPlayerName");
                    String code = getFieldString(fields, "securityCode");

                    postAlertNotification(
                        "🔐 Solicitud de acceso a perfil",
                        playerName + " solicita código: " + code,
                        docId.hashCode()
                    );
                    markNotified(docId);
                }
            }
        } catch (Exception e) {
            Log.e(TAG, "checkProfileClaimRequests error", e);
        }
    }

    private Set<String> getNotifiedChatSignatures() {
        Set<String> set = getPrefs().getStringSet(KEY_NOTIFIED_CHAT_MSGS, null);
        return set != null ? new HashSet<>(set) : new HashSet<String>();
    }

    private void markChatSignatureNotified(String sig) {
        Set<String> set = getNotifiedChatSignatures();
        set.add(sig);
        if (set.size() > 300) {
            set.clear();
            set.add(sig);
        }
        getPrefs().edit().putStringSet(KEY_NOTIFIED_CHAT_MSGS, set).apply();
    }

    private void checkNewChatMessages() {
        String url = "https://firestore.googleapis.com/v1/projects/player-stats-2ac9d/databases/(default)/documents/clubs/default_club/chats";
        String json = fetchJson(url);
        if (json == null) return;

        try {
            JSONObject obj = new JSONObject(json);
            if (!obj.has("documents")) return;
            JSONArray docs = obj.getJSONArray("documents");

            SharedPreferences prefs = getPrefs();
            long lastKnownTime = prefs.getLong(KEY_LAST_CHAT_TIME, 0L);
            if (lastKnownTime == 0L) {
                // Primera ejecución: solo guardar la marca de tiempo actual para no alertar mensajes viejos
                long maxTime = System.currentTimeMillis();
                for (int i = 0; i < docs.length(); i++) {
                    JSONObject fields = docs.getJSONObject(i).optJSONObject("fields");
                    if (fields != null) {
                        long t = getFieldLong(fields, "lastMessageTime");
                        if (t > maxTime) maxTime = t;
                    }
                }
                prefs.edit().putLong(KEY_LAST_CHAT_TIME, maxTime).apply();
                return;
            }

            Set<String> notifiedSigs = getNotifiedChatSignatures();
            long highestTime = lastKnownTime;
            for (int i = 0; i < docs.length(); i++) {
                JSONObject doc = docs.getJSONObject(i);
                String docName = doc.optString("name", "");
                String chatId = docName.contains("/") ? docName.substring(docName.lastIndexOf('/') + 1) : docName;
                JSONObject fields = doc.optJSONObject("fields");
                if (fields == null) continue;

                String senderId = getFieldString(fields, "lastSenderId");
                long msgTime = getFieldLong(fields, "lastMessageTime");

                if (msgTime <= 0L || "coach".equalsIgnoreCase(senderId)) continue;

                // El míster solo recibe notificaciones de chats donde participa (general, equipos, grupos, o con coach)
                // Ignorar chats directos privados entre dos jugadores
                if (chatId.startsWith("direct_") && !chatId.contains("coach")) {
                    continue;
                }
                String chatType = getFieldString(fields, "type");
                if ("direct".equalsIgnoreCase(chatType) && !chatId.contains("coach")) {
                    continue;
                }

                String sig = chatId + "_" + msgTime;
                long chatReadTime = prefs.getLong("read_time_" + chatId, 0L);

                // Si ya fue notificado, o fue leído por el míster, o es anterior al tiempo conocido: no alertar
                if (notifiedSigs.contains(sig) || msgTime <= chatReadTime || msgTime <= lastKnownTime) {
                    continue;
                }

                if (msgTime > highestTime) highestTime = msgTime;

                String chatName = getFieldString(fields, "name");
                String lastMsg = getFieldString(fields, "lastMessage");
                if (chatName.isEmpty()) chatName = "Chat de Equipo";

                int notifId = chatId.hashCode();
                postAlertNotification(
                    "💬 " + chatName,
                    lastMsg.isEmpty() ? "Nuevo mensaje recibido" : lastMsg,
                    notifId
                );
                markChatSignatureNotified(sig);
            }

            if (highestTime > lastKnownTime) {
                prefs.edit().putLong(KEY_LAST_CHAT_TIME, highestTime).apply();
            }
        } catch (Exception e) {
            Log.e(TAG, "checkNewChatMessages error", e);
        }
    }

    private String getFieldString(JSONObject fields, String key) {
        if (fields == null || !fields.has(key)) return "";
        JSONObject item = fields.optJSONObject(key);
        if (item != null && item.has("stringValue")) {
            return item.optString("stringValue", "");
        }
        return "";
    }

    private long getFieldLong(JSONObject fields, String key) {
        if (fields == null || !fields.has(key)) return 0L;
        JSONObject item = fields.optJSONObject(key);
        if (item != null) {
            if (item.has("integerValue")) {
                try {
                    return Long.parseLong(item.optString("integerValue", "0"));
                } catch (Exception ignored) {}
            }
        }
        return 0L;
    }

    private void postAlertNotification(String title, String message, int notifId) {
        try {
            NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm == null) return;

            Intent appIntent = new Intent(this, MainActivity.class);
            appIntent.setFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
            PendingIntent pendingIntent = PendingIntent.getActivity(
                this, notifId, appIntent,
                Build.VERSION.SDK_INT >= Build.VERSION_CODES.M
                    ? (PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE)
                    : PendingIntent.FLAG_UPDATE_CURRENT
            );

            Notification.Builder builder;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                builder = new Notification.Builder(this, ALERT_CHANNEL_ID);
            } else {
                builder = new Notification.Builder(this);
            }

            builder.setContentTitle(title)
                   .setContentText(message)
                   .setSmallIcon(R.mipmap.ic_launcher)
                   .setAutoCancel(true)
                   .setContentIntent(pendingIntent)
                   .setPriority(Notification.PRIORITY_HIGH)
                   .setDefaults(Notification.DEFAULT_ALL);

            nm.notify(notifId, builder.build());
            Log.i(TAG, "Notificación enviada con éxito: " + title + " - " + message);
        } catch (Exception e) {
            Log.e(TAG, "Error posting alert notification", e);
        }
    }
}
