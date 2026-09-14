package com.render.filehub;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.ServiceInfo;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.os.IBinder;
import android.provider.OpenableColumns;

import androidx.core.app.NotificationCompat;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
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
    public static final String EXTRA_STAGED_PATHS = "extra_staged_paths";
    public static final String EXTRA_FILENAMES = "extra_filenames";
    public static final String EXTRA_TARGET_FOLDER = "extra_target_folder";

    private static final int NOTIFICATION_ID = 1001;
    private static final String CHANNEL_ID = "filehub_upload_channel";

    public static class UploadTask {
        public final String id;
        public final Uri uri;
        public final String filename;
        public long size;
        public int progress = 0;
        public String status = "Queued"; // Queued, Uploading, Completed, Error
        public String errorMessage = null;
        public File stagedFile = null;
        public String mimeType = null;
        public String targetFolder = "";

        public UploadTask(String id, Uri uri, String filename, long size) {
            this.id = id;
            this.uri = uri;
            this.filename = filename;
            this.size = size;
        }
    }

    public static final List<UploadTask> uploadQueue = Collections.synchronizedList(new ArrayList<>());

    private ExecutorService executor;
    private ExecutorService stagingExecutor;
    private NotificationManager notificationManager;
    private boolean isRunning = false;

    @Override
    public void onCreate() {
        super.onCreate();
        executor = Executors.newSingleThreadExecutor();
        stagingExecutor = Executors.newSingleThreadExecutor();
        notificationManager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        createNotificationChannel();
    }

    private File getStagingDir() {
        File dir = new File(getCacheDir(), "staged_uploads");
        if (!dir.exists()) {
            dir.mkdirs();
        }
        return dir;
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null && ACTION_ENQUEUE.equals(intent.getAction())) {
            String targetFolder = intent.getStringExtra(EXTRA_TARGET_FOLDER);
            if (targetFolder == null) targetFolder = "";

            ArrayList<String> stagedPaths = intent.getStringArrayListExtra(EXTRA_STAGED_PATHS);
            ArrayList<String> filenames = intent.getStringArrayListExtra(EXTRA_FILENAMES);

            if (stagedPaths != null && !stagedPaths.isEmpty()) {
                for (int i = 0; i < stagedPaths.size(); i++) {
                    String path = stagedPaths.get(i);
                    File stagedFile = new File(path);
                    String name = (filenames != null && i < filenames.size()) ? filenames.get(i) : stagedFile.getName();
                    String id = System.currentTimeMillis() + "_" + (int)(Math.random() * 1000);
                    UploadTask task = new UploadTask(id, null, name, stagedFile.length());
                    task.stagedFile = stagedFile;
                    task.targetFolder = targetFolder;
                    uploadQueue.add(task);
                }
                broadcastUpdate();
                startForegroundWithDataSync("Preparing uploads...", 0, 0, true);
                processNextUpload();
                return START_NOT_STICKY;
            }

            ArrayList<Uri> uris = intent.getParcelableArrayListExtra(EXTRA_URIS);
            if (uris == null || uris.isEmpty()) {
                if (intent.getClipData() != null) {
                    uris = new ArrayList<>();
                    for (int i = 0; i < intent.getClipData().getItemCount(); i++) {
                        Uri u = intent.getClipData().getItemAt(i).getUri();
                        if (u != null) uris.add(u);
                    }
                } else if (intent.getData() != null) {
                    uris = new ArrayList<>();
                    for (int i = 0; i < 1; i++) {
                        uris.add(intent.getData());
                    }
                }
            }

            if (uris != null && !uris.isEmpty()) {
                for (Uri uri : uris) {
                    enqueueUri(uri, targetFolder);
                }
                startForegroundWithDataSync("Preparing uploads...", 0, 0, true);
                processNextUpload();
            }
        }
        return START_NOT_STICKY;
    }

    private void startForegroundWithDataSync(String message, int progress, int max, boolean indeterminate) {
        Notification notif = buildNotification(message, progress, max, indeterminate);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(NOTIFICATION_ID, notif, ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC);
        } else {
            startForeground(NOTIFICATION_ID, notif);
        }
    }

    private void enqueueUri(Uri uri, String targetFolder) {
        String filename = getFileName(uri);
        long size = getFileSize(uri);
        String mime = null;
        try {
            mime = getContentResolver().getType(uri);
        } catch (Exception ignored) {}

        String id = System.currentTimeMillis() + "_" + (int)(Math.random() * 1000);
        UploadTask task = new UploadTask(id, uri, filename, size);
        task.mimeType = mime;
        task.targetFolder = targetFolder != null ? targetFolder : "";
        uploadQueue.add(task);
        broadcastUpdate();

        // Immediately stage the file into private cache while URI permission is active
        stagingExecutor.execute(() -> stageTaskFile(task));
    }

    private void stageTaskFile(UploadTask task) {
        if (task.uri == null) return;
        try {
            File dest = new File(getStagingDir(), task.id + "_" + task.filename);
            try (InputStream in = getContentResolver().openInputStream(task.uri);
                 FileOutputStream out = new FileOutputStream(dest)) {
                if (in != null) {
                    byte[] buf = new byte[8192];
                    int len;
                    long total = 0;
                    while ((len = in.read(buf)) != -1) {
                        out.write(buf, 0, len);
                        total += len;
                    }
                    task.stagedFile = dest;
                    task.size = total;
                }
            }
        } catch (Exception ignored) {}
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
            String folderToUploadTo = (currentTask.targetFolder != null && !currentTask.targetFolder.trim().isEmpty())
                    ? currentTask.targetFolder
                    : prefs.getString("upload_folder", "");

            InputStream is = null;
            try {
                if (currentTask.stagedFile != null && currentTask.stagedFile.exists()) {
                    is = new FileInputStream(currentTask.stagedFile);
                    if (currentTask.size <= 0) {
                        currentTask.size = currentTask.stagedFile.length();
                    }
                } else if (currentTask.uri != null) {
                    is = getContentResolver().openInputStream(currentTask.uri);
                }

                if (is == null) throw new Exception("Cannot read file from storage");

                String mime = currentTask.mimeType;
                if (mime == null && currentTask.uri != null) {
                    try {
                        mime = getContentResolver().getType(currentTask.uri);
                    } catch (Exception ignored) {}
                }

                try (Response response = ApiClient.getInstance().uploadFile(
                        serverUrl,
                        password,
                        folderToUploadTo,
                        currentTask.filename,
                        is,
                        currentTask.size,
                        mime,
                        percent -> {
                            currentTask.progress = percent;
                            updateNotification("Uploading " + currentTask.filename, percent, 100, true);
                            broadcastUpdate();
                        }
                )) {
                    if (response.isSuccessful()) {
                        currentTask.status = "Completed";
                        currentTask.progress = 100;
                    } else if (response.code() == 401) {
                        currentTask.status = "Error";
                        currentTask.errorMessage = "Incorrect master password. Please verify settings.";
                    } else {
                        currentTask.status = "Error";
                        currentTask.errorMessage = "Server error HTTP " + response.code();
                    }
                }
            } catch (Exception e) {
                currentTask.status = "Error";
                currentTask.errorMessage = e.getMessage() != null ? e.getMessage() : "Upload failed";
            } finally {
                if (is != null) {
                    try { is.close(); } catch (Exception ignored) {}
                }
                if (currentTask.stagedFile != null && currentTask.stagedFile.exists()) {
                    try { currentTask.stagedFile.delete(); } catch (Exception ignored) {}
                }
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
            channel.setDescription("Shows upload progress for files uploaded to FileHub");
            if (notificationManager != null) {
                notificationManager.createNotificationChannel(channel);
            }
        }
    }

    private Notification buildNotification(String text, int progress, int max, boolean indeterminate) {
        Intent notificationIntent = new Intent(this, UploadQueueActivity.class);
        PendingIntent pendingIntent = PendingIntent.getActivity(
                this, 0, notificationIntent,
                Build.VERSION.SDK_INT >= Build.VERSION_CODES.M
                        ? PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT
                        : PendingIntent.FLAG_UPDATE_CURRENT
        );

        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL_ID)
                .setContentTitle("FileHub Upload")
                .setContentText(text)
                .setSmallIcon(android.R.drawable.stat_sys_upload)
                .setContentIntent(pendingIntent)
                .setOngoing(true);

        if (max > 0) {
            builder.setProgress(max, progress, indeterminate);
        }

        return builder.build();
    }

    private void updateNotification(String text, int progress, int max, boolean indeterminate) {
        if (notificationManager != null) {
            notificationManager.notify(NOTIFICATION_ID, buildNotification(text, progress, max, indeterminate));
        }
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
        return (result != null && !result.trim().isEmpty()) ? result : "upload_" + System.currentTimeMillis();
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
        super.onDestroy();
        if (executor != null) executor.shutdown();
        if (stagingExecutor != null) stagingExecutor.shutdown();
    }
}
