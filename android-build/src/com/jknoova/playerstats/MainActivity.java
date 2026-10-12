package com.jknoova.playerstats;

import android.app.Activity;
import android.content.ContentValues;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.os.Vibrator;
import android.provider.MediaStore;
import android.util.Base64;
import android.util.Log;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.ConsoleMessage;
import android.webkit.JavascriptInterface;
import android.webkit.PermissionRequest;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import java.io.BufferedReader;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.IOException;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Map;

public class MainActivity extends Activity {
    private static final String TAG = "PlayerStats";
    private static final String BACKUP_FILE = "stats_internal_state.json";
    private String defaultStartPage = "index.html";
    private WebView webView;
    private ValueCallback<Uri[]> filePathCallback;
    private final static int FILE_CHOOSER_RESULT_CODE = 1001;

    public class WebAppInterface {
        @JavascriptInterface
        public void saveState(final String json) {
            new Thread(new Runnable() {
                @Override
                public void run() {
                    try {
                        FileOutputStream fos = openFileOutput(BACKUP_FILE, Context.MODE_PRIVATE);
                        fos.write(json.getBytes(StandardCharsets.UTF_8));
                        fos.flush();
                        fos.close();
                    } catch (Exception e) {
                        Log.e(TAG, "Error guardando backup interno", e);
                    }
                }
            }).start();
        }

        @JavascriptInterface
        public String loadState() {
            try {
                File file = new File(getFilesDir(), BACKUP_FILE);
                if (!file.exists()) return "";
                FileInputStream fis = openFileInput(BACKUP_FILE);
                BufferedReader reader = new BufferedReader(new InputStreamReader(fis, StandardCharsets.UTF_8));
                StringBuilder sb = new StringBuilder();
                String line;
                while ((line = reader.readLine()) != null) {
                    sb.append(line);
                }
                reader.close();
                return sb.toString();
            } catch (Exception e) {
                Log.e(TAG, "Error leyendo backup interno", e);
                return "";
            }
        }

        @JavascriptInterface
        public void vibrate(final long ms) {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    try {
                        Vibrator v = (Vibrator) getSystemService(Context.VIBRATOR_SERVICE);
                        if (v != null && v.hasVibrator()) {
                            v.vibrate(ms > 0 ? ms : 30);
                        }
                    } catch (Exception ignored) {}
                }
            });
        }

        @JavascriptInterface
        public void exportFile(final String content, final String filename, final String mimeType) {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    Uri savedUri = null;
                    try {
                        String name = (filename != null && !filename.trim().isEmpty()) ? filename : "Estadisticas.csv";
                        String mime = (mimeType != null && !mimeType.trim().isEmpty()) ? mimeType : "text/csv";

                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                            ContentValues values = new ContentValues();
                            values.put(MediaStore.Downloads.DISPLAY_NAME, name);
                            values.put(MediaStore.Downloads.MIME_TYPE, mime);
                            values.put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS);
                            savedUri = getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
                            if (savedUri != null) {
                                OutputStream os = getContentResolver().openOutputStream(savedUri);
                                if (os != null) {
                                    os.write(content.getBytes(StandardCharsets.UTF_8));
                                    os.flush();
                                    os.close();
                                }
                            }
                        } else {
                            File downloadsDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS);
                            if (!downloadsDir.exists()) downloadsDir.mkdirs();
                            File file = new File(downloadsDir, name);
                            FileOutputStream fos = new FileOutputStream(file);
                            fos.write(content.getBytes(StandardCharsets.UTF_8));
                            fos.flush();
                            fos.close();
                            savedUri = Uri.fromFile(file);
                        }

                        Toast.makeText(MainActivity.this, "Guardado en Descargas: " + name, Toast.LENGTH_LONG).show();

                        if (savedUri != null) {
                            try {
                                Intent shareIntent = new Intent(Intent.ACTION_SEND);
                                shareIntent.setType(mime);
                                shareIntent.putExtra(Intent.EXTRA_STREAM, savedUri);
                                shareIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                                startActivity(Intent.createChooser(shareIntent, "Compartir con..."));
                            } catch (Exception ignored) {}
                        }
                    } catch (Exception e) {
                        Log.e(TAG, "Error guardando archivo", e);
                        Toast.makeText(MainActivity.this, "Error al guardar archivo: " + e.getMessage(), Toast.LENGTH_SHORT).show();
                    }
                }
            });
        }

        @JavascriptInterface
        public void saveImage(final String base64Data, final String filename) {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    try {
                        if (base64Data == null || base64Data.trim().isEmpty()) {
                            Toast.makeText(MainActivity.this, "Error: Imagen vacía", Toast.LENGTH_SHORT).show();
                            return;
                        }

                        String raw = base64Data;
                        int commaIdx = raw.indexOf(",");
                        if (commaIdx >= 0) {
                            raw = raw.substring(commaIdx + 1);
                        }

                        byte[] imageBytes = Base64.decode(raw, Base64.DEFAULT);
                        String name = (filename != null && !filename.trim().isEmpty()) ? filename : ("Ficha_" + System.currentTimeMillis() + ".png");
                        if (!name.toLowerCase().endsWith(".png")) {
                            name += ".png";
                        }

                        Uri imageUri = null;
                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                            ContentValues values = new ContentValues();
                            values.put(MediaStore.Images.Media.DISPLAY_NAME, name);
                            values.put(MediaStore.Images.Media.MIME_TYPE, "image/png");
                            values.put(MediaStore.Images.Media.RELATIVE_PATH, Environment.DIRECTORY_PICTURES + "/PlayerStats");
                            imageUri = getContentResolver().insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, values);
                            if (imageUri != null) {
                                OutputStream os = getContentResolver().openOutputStream(imageUri);
                                if (os != null) {
                                    os.write(imageBytes);
                                    os.flush();
                                    os.close();
                                }
                            }
                        } else {
                            File picsDir = new File(Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_PICTURES), "PlayerStats");
                            if (!picsDir.exists()) picsDir.mkdirs();
                            File file = new File(picsDir, name);
                            FileOutputStream fos = new FileOutputStream(file);
                            fos.write(imageBytes);
                            fos.flush();
                            fos.close();
                            imageUri = Uri.fromFile(file);
                        }

                        Toast.makeText(MainActivity.this, "Ficha guardada en Galería: " + name, Toast.LENGTH_LONG).show();
                    } catch (Exception e) {
                        Log.e(TAG, "Error guardando imagen", e);
                        Toast.makeText(MainActivity.this, "Error guardando imagen: " + e.getMessage(), Toast.LENGTH_SHORT).show();
                    }
                }
            });
        }

        @JavascriptInterface
        public void shareImage(final String base64Data, final String filename, final String targetApp, final String captionText) {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    try {
                        if (base64Data == null || base64Data.trim().isEmpty()) {
                            Toast.makeText(MainActivity.this, "Error: Imagen vacía", Toast.LENGTH_SHORT).show();
                            return;
                        }

                        String raw = base64Data;
                        int commaIdx = raw.indexOf(",");
                        if (commaIdx >= 0) {
                            raw = raw.substring(commaIdx + 1);
                        }

                        byte[] imageBytes = Base64.decode(raw, Base64.DEFAULT);
                        String name = (filename != null && !filename.trim().isEmpty()) ? filename : ("Ficha_" + System.currentTimeMillis() + ".png");
                        if (!name.toLowerCase().endsWith(".png")) {
                            name += ".png";
                        }

                        Uri imageUri = null;
                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                            ContentValues values = new ContentValues();
                            values.put(MediaStore.Images.Media.DISPLAY_NAME, name);
                            values.put(MediaStore.Images.Media.MIME_TYPE, "image/png");
                            values.put(MediaStore.Images.Media.RELATIVE_PATH, Environment.DIRECTORY_PICTURES + "/PlayerStats");
                            imageUri = getContentResolver().insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, values);
                            if (imageUri != null) {
                                OutputStream os = getContentResolver().openOutputStream(imageUri);
                                if (os != null) {
                                    os.write(imageBytes);
                                    os.flush();
                                    os.close();
                                }
                            }
                        } else {
                            File picsDir = new File(Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_PICTURES), "PlayerStats");
                            if (!picsDir.exists()) picsDir.mkdirs();
                            File file = new File(picsDir, name);
                            FileOutputStream fos = new FileOutputStream(file);
                            fos.write(imageBytes);
                            fos.flush();
                            fos.close();
                            imageUri = Uri.fromFile(file);
                        }

                        if (imageUri != null) {
                            Intent shareIntent = new Intent(Intent.ACTION_SEND);
                            shareIntent.setType("image/png");
                            shareIntent.putExtra(Intent.EXTRA_STREAM, imageUri);
                            shareIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                            if (captionText != null && !captionText.trim().isEmpty()) {
                                shareIntent.putExtra(Intent.EXTRA_TEXT, captionText);
                            }

                            String target = (targetApp != null) ? targetApp.trim().toLowerCase() : "all";
                            if ("whatsapp".equals(target)) {
                                shareIntent.setPackage("com.whatsapp");
                            } else if ("telegram".equals(target)) {
                                shareIntent.setPackage("org.telegram.messenger");
                            } else if ("viber".equals(target)) {
                                shareIntent.setPackage("com.viber.voip");
                            }

                            try {
                                if ("all".equals(target)) {
                                    startActivity(Intent.createChooser(shareIntent, "Compartir con..."));
                                } else {
                                    startActivity(shareIntent);
                                }
                            } catch (Exception ex) {
                                // Fallback a chooser si la app seleccionada no está instalada
                                try {
                                    shareIntent.setPackage(null);
                                    startActivity(Intent.createChooser(shareIntent, "Compartir con..."));
                                } catch (Exception ignored) {}
                            }
                        }
                    } catch (Exception e) {
                        Log.e(TAG, "Error compartiendo imagen", e);
                        Toast.makeText(MainActivity.this, "Error compartiendo imagen: " + e.getMessage(), Toast.LENGTH_SHORT).show();
                    }
                }
            });
        }

        @JavascriptInterface
        public void shareText(final String text, final String targetApp) {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    try {
                        Intent sendIntent = new Intent(Intent.ACTION_SEND);
                        sendIntent.setType("text/plain");
                        sendIntent.putExtra(Intent.EXTRA_TEXT, text != null ? text : "");
                        String target = (targetApp != null) ? targetApp.trim().toLowerCase() : "all";
                        if ("viber".equals(target)) {
                            sendIntent.setPackage("com.viber.voip");
                        } else if ("whatsapp".equals(target)) {
                            sendIntent.setPackage("com.whatsapp");
                        } else if ("telegram".equals(target)) {
                            sendIntent.setPackage("org.telegram.messenger");
                        }
                        try {
                            if ("all".equals(target)) {
                                startActivity(Intent.createChooser(sendIntent, "Compartir con..."));
                            } else {
                                startActivity(sendIntent);
                            }
                        } catch (Exception ex) {
                            sendIntent.setPackage(null);
                            startActivity(Intent.createChooser(sendIntent, "Compartir con..."));
                        }
                    } catch (Exception e) {
                        Log.e(TAG, "Error compartiendo texto", e);
                    }
                }
            });
        }

        @JavascriptInterface
        public void pickDate(final String initialDate, final String callbackId) {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    try {
                        int year = 2026, month = 0, day = 1;
                        if (initialDate != null && initialDate.contains("-")) {
                            String[] parts = initialDate.trim().split("-");
                            if (parts.length >= 3) {
                                year = Integer.parseInt(parts[0].trim());
                                month = Integer.parseInt(parts[1].trim()) - 1;
                                day = Integer.parseInt(parts[2].trim());
                            }
                        } else {
                            java.util.Calendar c = java.util.Calendar.getInstance();
                            year = c.get(java.util.Calendar.YEAR);
                            month = c.get(java.util.Calendar.MONTH);
                            day = c.get(java.util.Calendar.DAY_OF_MONTH);
                        }

                        android.app.DatePickerDialog dp = new android.app.DatePickerDialog(
                            MainActivity.this,
                            new android.app.DatePickerDialog.OnDateSetListener() {
                                @Override
                                public void onDateSet(android.widget.DatePicker view, int y, int m, int d) {
                                    final String formatted = String.format(java.util.Locale.US, "%04d-%02d-%02d", y, m + 1, d);
                                    webView.post(new Runnable() {
                                        @Override
                                        public void run() {
                                            String js = "if (window.__onNativeDatePicked) { window.__onNativeDatePicked('" + callbackId + "', '" + formatted + "'); }";
                                            webView.evaluateJavascript(js, null);
                                        }
                                    });
                                }
                            },
                            year, month, day
                        );
                        dp.show();
                    } catch (Exception e) {
                        Log.e(TAG, "Error abriendo DatePickerDialog", e);
                    }
                }
            });
        }

        @JavascriptInterface
        public void pickTime(final String initialTime, final String callbackId) {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    try {
                        int hour = 18, minute = 0;
                        if (initialTime != null && initialTime.contains(":")) {
                            String[] parts = initialTime.trim().split(":");
                            if (parts.length >= 2) {
                                hour = Integer.parseInt(parts[0].trim());
                                minute = Integer.parseInt(parts[1].trim());
                            }
                        } else {
                            java.util.Calendar c = java.util.Calendar.getInstance();
                            hour = c.get(java.util.Calendar.HOUR_OF_DAY);
                            minute = c.get(java.util.Calendar.MINUTE);
                        }

                        android.app.TimePickerDialog tp = new android.app.TimePickerDialog(
                            MainActivity.this,
                            new android.app.TimePickerDialog.OnTimeSetListener() {
                                @Override
                                public void onTimeSet(android.widget.TimePicker view, int h, int m) {
                                    final String formatted = String.format(java.util.Locale.US, "%02d:%02d", h, m);
                                    webView.post(new Runnable() {
                                        @Override
                                        public void run() {
                                            String js = "if (window.__onNativeTimePicked) { window.__onNativeTimePicked('" + callbackId + "', '" + formatted + "'); }";
                                            webView.evaluateJavascript(js, null);
                                        }
                                    });
                                }
                            },
                            hour, minute, true
                        );
                        tp.show();
                    } catch (Exception e) {
                        Log.e(TAG, "Error abriendo TimePickerDialog", e);
                    }
                }
            });
        }

        @JavascriptInterface
        public void requestNotificationPermission() {
            if (Build.VERSION.SDK_INT >= 33) {
                runOnUiThread(new Runnable() {
                    @Override
                    public void run() {
                        try {
                            if (checkSelfPermission("android.permission.POST_NOTIFICATIONS") != android.content.pm.PackageManager.PERMISSION_GRANTED) {
                                requestPermissions(new String[]{"android.permission.POST_NOTIFICATIONS"}, 102);
                            }
                        } catch (Exception e) {
                            Log.e(TAG, "Error requesting notification permission", e);
                        }
                    }
                });
            }
        }

        @JavascriptInterface
        public void showSystemNotification(final String title, final String message) {
            showSystemNotification(title, message, null);
        }

        @JavascriptInterface
        public void showSystemNotification(final String title, final String message, final String tag) {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    try {
                        android.app.NotificationManager nm = (android.app.NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
                        if (nm == null) return;
                        String channelId = "player_stats_channel";
                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                            android.app.NotificationChannel channel = new android.app.NotificationChannel(
                                channelId, "Player Stats", android.app.NotificationManager.IMPORTANCE_HIGH
                            );
                            channel.setDescription("Notificaciones de convocatorias, chat y asistencia");
                            channel.enableVibration(true);
                            nm.createNotificationChannel(channel);
                        }

                        android.content.Intent intent = new android.content.Intent(MainActivity.this, MainActivity.class);
                        intent.setFlags(android.content.Intent.FLAG_ACTIVITY_CLEAR_TOP | android.content.Intent.FLAG_ACTIVITY_SINGLE_TOP);
                        int notifId = (tag != null && !tag.isEmpty()) ? tag.hashCode() : (title + ":" + message).hashCode();
                        android.app.PendingIntent pendingIntent = android.app.PendingIntent.getActivity(
                            MainActivity.this, notifId, intent,
                            Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? (android.app.PendingIntent.FLAG_UPDATE_CURRENT | android.app.PendingIntent.FLAG_IMMUTABLE) : android.app.PendingIntent.FLAG_UPDATE_CURRENT
                        );

                        android.app.Notification.Builder builder;
                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                            builder = new android.app.Notification.Builder(MainActivity.this, channelId);
                        } else {
                            builder = new android.app.Notification.Builder(MainActivity.this);
                        }

                        builder.setContentTitle(title)
                               .setContentText(message)
                               .setSmallIcon(R.mipmap.ic_launcher)
                               .setAutoCancel(true)
                               .setContentIntent(pendingIntent)
                               .setPriority(android.app.Notification.PRIORITY_HIGH)
                               .setDefaults(android.app.Notification.DEFAULT_ALL);

                        nm.notify(notifId, builder.build());
                        // Sincronizar tiempo de chat para que el servicio secundario sepa que ya fue notificado
                        BackgroundNotificationService.syncLastChatTime(MainActivity.this, System.currentTimeMillis());
                    } catch (Exception e) {
                        Log.e(TAG, "Error showing system notification", e);
                    }
                }
            });
        }

        @JavascriptInterface
        public void markChatAsRead(final String chatId, final long timestamp) {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    try {
                        long time = timestamp > 0 ? timestamp : System.currentTimeMillis();
                        BackgroundNotificationService.markChatAsRead(MainActivity.this, chatId, time);
                        android.app.NotificationManager nm = (android.app.NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
                        if (nm != null && chatId != null && !chatId.isEmpty()) {
                            nm.cancel(chatId.hashCode());
                        }
                    } catch (Exception e) {
                        Log.e(TAG, "Error in markChatAsRead bridge", e);
                    }
                }
            });
        }

        @JavascriptInterface
        public void clearNotifications() {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    try {
                        android.app.NotificationManager nm = (android.app.NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
                        if (nm != null) {
                            nm.cancelAll();
                        }
                        BackgroundNotificationService.syncLastChatTime(MainActivity.this, System.currentTimeMillis());
                    } catch (Exception e) {
                        Log.e(TAG, "Error clearing notifications", e);
                    }
                }
            });
        }
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        try {
            Window window = getWindow();
            window.addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS);
            window.setStatusBarColor(0xFF060A13);
            window.setNavigationBarColor(0xFF060A13);
        } catch (Exception ignored) {}

        setContentView(R.layout.activity_main);

        WebView.setWebContentsDebuggingEnabled(true);
        webView = findViewById(R.id.webview);
        setupWebView();

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            java.util.List<String> perms = new java.util.ArrayList<String>();
            if (checkSelfPermission(android.Manifest.permission.CAMERA) != android.content.pm.PackageManager.PERMISSION_GRANTED) {
                perms.add(android.Manifest.permission.CAMERA);
            }
            if (Build.VERSION.SDK_INT >= 33) {
                if (checkSelfPermission("android.permission.POST_NOTIFICATIONS") != android.content.pm.PackageManager.PERMISSION_GRANTED) {
                    perms.add("android.permission.POST_NOTIFICATIONS");
                }
            }
            if (!perms.isEmpty()) {
                requestPermissions(perms.toArray(new String[0]), 101);
            }
        }

        try {
            android.content.pm.ApplicationInfo ai = getPackageManager().getApplicationInfo(getPackageName(), android.content.pm.PackageManager.GET_META_DATA);
            if (ai != null && ai.metaData != null && ai.metaData.containsKey("START_URL")) {
                String metaUrl = ai.metaData.getString("START_URL");
                if (metaUrl != null && !metaUrl.trim().isEmpty()) {
                    defaultStartPage = metaUrl.trim();
                }
            }
        } catch (Exception ignored) {}

        try {
            Intent bgIntent = new Intent(this, BackgroundNotificationService.class);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                startForegroundService(bgIntent);
            } else {
                startService(bgIntent);
            }
        } catch (Exception e) {
            Log.e(TAG, "Error iniciando BackgroundNotificationService", e);
        }

        webView.loadUrl("https://localhost/" + defaultStartPage);
    }

    @Override
    protected void onResume() {
        super.onResume();
        BackgroundNotificationService.setAppInForeground(true);
        BackgroundNotificationService.syncLastChatTime(this, System.currentTimeMillis());
    }

    @Override
    protected void onPause() {
        super.onPause();
        BackgroundNotificationService.setAppInForeground(false);
        BackgroundNotificationService.syncLastChatTime(this, System.currentTimeMillis());
    }

    private void setupWebView() {
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);
        settings.setAllowFileAccessFromFileURLs(true);
        settings.setAllowUniversalAccessFromFileURLs(true);
        settings.setUseWideViewPort(false);
        settings.setLoadWithOverviewMode(false);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);

        webView.setWebViewClient(new WebViewClient() {
            private boolean handleExternalUrl(Uri uri) {
                if (uri == null) return false;
                String scheme = uri.getScheme();
                String host = uri.getHost();

                if ("whatsapp".equalsIgnoreCase(scheme) || "intent".equalsIgnoreCase(scheme)
                    || "viber".equalsIgnoreCase(scheme) || "tg".equalsIgnoreCase(scheme)
                    || "tel".equalsIgnoreCase(scheme) || "mailto".equalsIgnoreCase(scheme)
                    || ("https".equalsIgnoreCase(scheme) && host != null && (host.contains("whatsapp.com") || host.contains("wa.me") || host.contains("t.me") || host.contains("viber.com")))) {
                    try {
                        Intent intent = new Intent(Intent.ACTION_VIEW, uri);
                        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                        startActivity(intent);
                        return true;
                    } catch (Exception e) {
                        Log.e(TAG, "No se pudo abrir enlace externo: " + uri, e);
                        Toast.makeText(MainActivity.this, "No se encontró aplicación para abrir este enlace", Toast.LENGTH_SHORT).show();
                        return true;
                    }
                }
                return false;
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if (handleExternalUrl(uri)) return true;
                return super.shouldOverrideUrlLoading(view, request);
            }

            @SuppressWarnings("deprecation")
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                if (url != null && handleExternalUrl(Uri.parse(url))) return true;
                return super.shouldOverrideUrlLoading(view, url);
            }

            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                String host = uri.getHost();

                boolean isLocal = "localhost".equalsIgnoreCase(host) || "appassets.androidplatform.net".equalsIgnoreCase(host);

                if (isLocal) {
                    String path = uri.getPath();
                    if (path == null || path.isEmpty() || path.equals("/")) {
                        path = defaultStartPage;
                    }
                    while (path.startsWith("/")) {
                        path = path.substring(1);
                    }
                    path = path.replace('\\', '/');

                    try {
                        InputStream is = getAssets().open(path);
                        String mimeType = getMimeType(path);
                        Map<String, String> headers = new HashMap<>();
                        headers.put("Access-Control-Allow-Origin", "*");
                        headers.put("Cache-Control", "no-cache");
                        return new WebResourceResponse(mimeType, "UTF-8", 200, "OK", headers, is);
                    } catch (IOException e) {
                        Log.w(TAG, "Asset no encontrado: " + path);
                        return null;
                    }
                }

                return super.shouldInterceptRequest(view, request);
            }
        });

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onConsoleMessage(ConsoleMessage consoleMessage) {
                Log.d(TAG, "[Consola JS] " + consoleMessage.message() + " (" + consoleMessage.sourceId() + ":" + consoleMessage.lineNumber() + ")");
                return true;
            }

            @Override
            public void onPermissionRequest(final PermissionRequest request) {
                runOnUiThread(new Runnable() {
                    @Override
                    public void run() {
                        try {
                            request.grant(request.getResources());
                        } catch (Exception e) {
                            Log.e(TAG, "Error concediendo permisos a WebView", e);
                        }
                    }
                });
            }

            @Override
            public boolean onShowFileChooser(WebView webView, ValueCallback<Uri[]> filePathCallback, FileChooserParams fileChooserParams) {
                MainActivity.this.filePathCallback = filePathCallback;
                try {
                    Intent intent = fileChooserParams.createIntent();
                    startActivityForResult(intent, FILE_CHOOSER_RESULT_CODE);
                } catch (Exception e) {
                    MainActivity.this.filePathCallback = null;
                    return false;
                }
                return true;
            }
        });

        webView.addJavascriptInterface(new WebAppInterface(), "AndroidBridge");
    }

    private String getMimeType(String path) {
        String lower = path.toLowerCase();
        if (lower.endsWith(".html") || lower.endsWith(".htm")) return "text/html";
        if (lower.endsWith(".css")) return "text/css";
        if (lower.endsWith(".js") || lower.endsWith(".mjs")) return "application/javascript";
        if (lower.endsWith(".json")) return "application/json";
        if (lower.endsWith(".png")) return "image/png";
        if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
        if (lower.endsWith(".svg")) return "image/svg+xml";
        if (lower.endsWith(".webp")) return "image/webp";
        if (lower.endsWith(".ico")) return "image/x-icon";
        return "application/octet-stream";
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        if (requestCode == FILE_CHOOSER_RESULT_CODE) {
            if (filePathCallback != null) {
                Uri[] results = null;
                if (resultCode == Activity.RESULT_OK && data != null) {
                    String dataString = data.getDataString();
                    if (dataString != null) {
                        results = new Uri[]{Uri.parse(dataString)};
                    }
                }
                filePathCallback.onReceiveValue(results);
                filePathCallback = null;
            }
        } else {
            super.onActivityResult(requestCode, resultCode, data);
        }
    }

    private long lastBackPressTime = 0;

    @Override
    public void onBackPressed() {
        if (webView != null) {
            webView.evaluateJavascript(
                "(function() { " +
                "  if (typeof window.__handleAppBack === 'function') { " +
                "    try { var res = window.__handleAppBack(); if (res === true || res === 'handled') return 'handled'; } catch(e) {} " +
                "  } " +
                "  var chatModal = document.querySelector('.chat-dialog-overlay'); " +
                "  if (chatModal) { " +
                "    var backBtn = chatModal.querySelector('#chat-back-btn') || chatModal.querySelector('#chat-close-btn'); " +
                "    if (backBtn) backBtn.click(); else chatModal.remove(); " +
                "    return 'handled'; " +
                "  } " +
                "  var dialog = document.querySelector('.dialog-overlay'); " +
                "  if (dialog) { dialog.remove(); return 'handled'; } " +
                "  var sheet = document.querySelector('.sheet-backdrop'); " +
                "  if (sheet) { " +
                "    var cl = sheet.querySelector('#sheet-close-btn') || sheet.querySelector('.sheet-close'); " +
                "    if (cl) cl.click(); else sheet.remove(); " +
                "    return 'handled'; " +
                "  } " +
                "  var tr = document.getElementById('tracker-fullscreen'); " +
                "  if (tr) { " +
                "    var b = tr.querySelector('#tracker-btn-back'); if (b) b.click(); else tr.remove(); " +
                "    return 'handled'; " +
                "  } " +
                "  return 'none'; " +
                "})()",
                new ValueCallback<String>() {
                    @Override
                    public void onReceiveValue(String value) {
                        String res = (value != null) ? value.replace("\"", "").trim() : "none";
                        if ("handled".equals(res) || "true".equals(res)) {
                            return;
                        }
                        long now = System.currentTimeMillis();
                        if (now - lastBackPressTime < 2000) {
                            MainActivity.super.onBackPressed();
                        } else {
                            lastBackPressTime = now;
                            Toast.makeText(MainActivity.this, "Pulsa atrás otra vez para salir", Toast.LENGTH_SHORT).show();
                        }
                    }
                }
            );
            return;
        }
        long now = System.currentTimeMillis();
        if (now - lastBackPressTime < 2000) {
            super.onBackPressed();
        } else {
            lastBackPressTime = now;
            Toast.makeText(this, "Pulsa atrás otra vez para salir", Toast.LENGTH_SHORT).show();
        }
    }
}
