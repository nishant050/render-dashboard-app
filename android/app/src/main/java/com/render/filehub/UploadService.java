package com.render.filehub;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.os.IBinder;
import android.provider.OpenableColumns;

import androidx.core.app.NotificationCompat;

import java.io.InputStream;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

import okhttp3.Response;

public class UploadService extends Service {

    public static final String ACTION_ENQUEUE = "com.render.filehub.ENQUEUE";
    public static final String ACTION_UPLOAD_PROGRESS = "com.render.filehub.UPLOAD_PROGRESS";
    public static final String EXTRA_URIS = "extra_uris";

    private static final int NOTIFICATION_ID = 1001;
    private static final String CHANNEL_ID = "filehub_upload_channel";

    public static class UploadTask {
        public final String id;
        public final Uri uri;
        public final String filename;
        public final long size;
        public int progress = 0;
        public String status = "Queued"; // Queued, Uploading, Completed, Error
        public String errorMessage = null;

        public UploadTask(String id, Uri uri, String filename, long size) {
            this.id = id;
            this.uri = uri;
            this.filename = filename;
            this.size = size;
        }
    }

    public static final List<UploadTask> uploadQueue = Collections.synchronizedList(new ArrayList<>());

    private ExecutorService executor;
    private NotificationManager notificationManager;
    private boolean isRunning = false;

    @Override
    public void onCreate() {
        super.onCreate();
        executor = Executors.newSingleThreadExecutor();
        notificationManager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        createNotificationChannel();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null && ACTION_ENQUEUE.equals(intent.getAction())) {
            ArrayList<Uri> uris = intent.getParcelableArrayListExtra(EXTRA_URIS);
            if (uris != null && !uris.isEmpty()) {
                for (Uri uri : uris) {
                    enqueueUri(uri);
                }
                startForeground(NOTIFICATION_ID, buildNotification("Preparing uploads...", 0, 0, true));
                processNextUpload();
            }
        }
        return START_NOT_STICKY;
    }

    private void enqueueUri(Uri uri) {
        String filename = getFileName(uri);
        long size = getFileSize(uri);
        String id = System.currentTimeMillis() + "_" + Math.random();
        UploadTask task = new UploadTask(id, uri, filename, size);
        uploadQueue.add(task);
        broadcastUpdate();
    }

    private synchronized void processNextUpload() {
        if (isRunning) return;

        UploadTask nextTask = null;
        synchronized (uploadQueue) {
            for (UploadTask task : uploadQueue) {
                if ("Queued".equals(task.status)) {
                    nextTask = task;
                    break;
                }
            }
        }

        if (nextTask == null) {
            // Check if any errors occurred
            int completed = 0;
            int errors = 0;
            synchronized (uploadQueue) {
                for (UploadTask task : uploadQueue) {
                    if ("Completed".equals(task.status)) completed++;
                    if ("Error".equals(task.status)) errors++;
                }
            }
            if (errors > 0) {
                updateNotification("Upload completed with " + errors + " error(s)", 100, 100, false);
            } else if (completed > 0) {
                updateNotification("All " + completed + " file(s) uploaded successfully!", 100, 100, false);
            }
            stopForeground(false);
            return;
        }

        isRunning = true;
        final UploadTask currentTask = nextTask;
        currentTask.status = "Uploading";
        currentTask.progress = 0;
        broadcastUpdate();

        executor.execute(() -> {
            SharedPreferences prefs = getSharedPreferences("filehub_prefs", Context.MODE_PRIVATE);
            String serverUrl = prefs.getString("server_url", "https://dashboard-mszb.onrender.com");
            String password = prefs.getString("dashboard_password", "");
            String targetFolder = prefs.getString("upload_folder", "");

            try (InputStream is = getContentResolver().openInputStream(currentTask.uri)) {
                if (is == null) throw new Exception("Cannot read file from device storage");

                String mime = getContentResolver().getType(currentTask.uri);
                Response response = ApiClient.getInstance().uploadFile(
                        serverUrl,
                        password,
                        targetFolder,
                        currentTask.filename,
                        is,
                        currentTask.size,
                        mime,
                        percent -> {
                            currentTask.progress = percent;
                            updateNotification("Uploading " + currentTask.filename, percent, 100, true);
                            broadcastUpdate();
                        }
                );

                if (response.isSuccessful()) {
                    currentTask.status = "Completed";
                    currentTask.progress = 100;
                } else if (response.code() == 401) {
                    currentTask.status = "Error";
                    currentTask.errorMessage = "Incorrect master password. Please verify settings.";
                } else {
                    currentTask.status = "Error";
                    currentTask.errorMessage = "Server returned error: HTTP " + response.code();
                }
            } catch (Exception e) {
                currentTask.status = "Error";
                currentTask.errorMessage = e.getMessage() != null ? e.getMessage() : "Upload failed";
            } finally {
                isRunning = false;
                broadcastUpdate();
                processNextUpload();
            }
        });
    }

    private void broadcastUpdate() {
        Intent intent = new Intent(ACTION_UPLOAD_PROGRESS);
        sendBroadcast(intent);
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID,
                    "FileHub Background Uploads",
                    NotificationManager.IMPORTANCE_LOW
            );
            channel.setDescription("Shows upload progress for shared files");
            notificationManager.createNotificationChannel(channel);
        }
    }

    private Notification buildNotification(String text, int progress, int max, boolean ongoing) {
        Intent intent = new Intent(this, UploadQueueActivity.class);
        PendingIntent pi = PendingIntent.getActivity(this, 0, intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL_ID)
                .setSmallIcon(android.R.drawable.stat_sys_upload)
                .setContentTitle("FileHub Upload")
                .setContentText(text)
                .setContentIntent(pi)
                .setOngoing(ongoing);

        if (max > 0) {
            builder.setProgress(max, progress, false);
        }

        return builder.build();
    }

    private void updateNotification(String text, int progress, int max, boolean ongoing) {
        notificationManager.notify(NOTIFICATION_ID, buildNotification(text, progress, max, ongoing));
    }

    private String getFileName(Uri uri) {
        String result = null;
        if ("content".equals(uri.getScheme())) {
            try (Cursor cursor = getContentResolver().query(uri, null, null, null, null)) {
                if (cursor != null && cursor.moveToFirst()) {
                    int index = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME);
                    if (index >= 0) {
                        result = cursor.getString(index);
                    }
                }
            } catch (Exception ignored) {}
        }
        if (result == null) {
            result = uri.getLastPathSegment();
        }
        return result != null ? result : "shared_file_" + System.currentTimeMillis();
    }

    private long getFileSize(Uri uri) {
        long size = 0;
        if ("content".equals(uri.getScheme())) {
            try (Cursor cursor = getContentResolver().query(uri, null, null, null, null)) {
                if (cursor != null && cursor.moveToFirst()) {
                    int index = cursor.getColumnIndex(OpenableColumns.SIZE);
                    if (index >= 0) {
                        size = cursor.getLong(index);
                    }
                }
            } catch (Exception ignored) {}
        }
        return size;
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public void onDestroy() {
        if (executor != null) executor.shutdownNow();
        super.onDestroy();
    }
}
