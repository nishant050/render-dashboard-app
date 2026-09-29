package com.render.filehub;

import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.OpenableColumns;
import android.view.View;
import android.widget.Button;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.Toast;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.concurrent.atomic.AtomicBoolean;

public class ShareActivity extends Activity {

    private TextView tvFilename;
    private TextView tvDetails;
    private TextView tvStatus;
    private ProgressBar progressBar;
    private Button btnCancel;
    private Button btnBackground;

    private final AtomicBoolean isCancelled = new AtomicBoolean(false);
    private final AtomicBoolean isStarted = new AtomicBoolean(false);

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_share);

        tvFilename = findViewById(R.id.tv_share_filename);
        tvDetails = findViewById(R.id.tv_share_details);
        tvStatus = findViewById(R.id.tv_share_status);
        progressBar = findViewById(R.id.pb_share_progress);
        btnCancel = findViewById(R.id.btn_share_cancel);
        btnBackground = findViewById(R.id.btn_share_background);

        btnCancel.setOnClickListener(v -> {
            isCancelled.set(true);
            finish();
        });

        // Nothing is uploaded until the user confirms: any installed app can open this screen
        // directly, so a silent upload would let it push files into FileHub.
        btnBackground.setText("Upload");

        Intent intent = getIntent();
        if (intent == null) {
            Toast.makeText(this, "No file received", Toast.LENGTH_SHORT).show();
            finish();
            return;
        }

        String action = intent.getAction();
        ArrayList<Uri> urisToUpload = new ArrayList<>();

        if (Intent.ACTION_SEND.equals(action)) {
            Uri singleUri = null;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                singleUri = intent.getParcelableExtra(Intent.EXTRA_STREAM, Uri.class);
            } else {
                singleUri = intent.getParcelableExtra(Intent.EXTRA_STREAM);
            }
            if (singleUri != null) {
                urisToUpload.add(singleUri);
            }
        } else if (Intent.ACTION_SEND_MULTIPLE.equals(action)) {
            ArrayList<Uri> multiUris = null;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                multiUris = intent.getParcelableArrayListExtra(Intent.EXTRA_STREAM, Uri.class);
            } else {
                multiUris = intent.getParcelableArrayListExtra(Intent.EXTRA_STREAM);
            }
            if (multiUris != null) {
                urisToUpload.addAll(multiUris);
            }
        }

        // Check ClipData
        if (intent.getClipData() != null) {
            int count = intent.getClipData().getItemCount();
            for (int i = 0; i < count; i++) {
                Uri u = intent.getClipData().getItemAt(i).getUri();
                if (u != null && !urisToUpload.contains(u)) {
                    urisToUpload.add(u);
                }
            }
        }

        // Fallback to data URI
        if (urisToUpload.isEmpty() && intent.getData() != null) {
            urisToUpload.add(intent.getData());
        }

        // Only real shared content: content:// URIs from other apps. file:// URIs and this app's own
        // FileProvider could point at FileHub's private files (e.g. its saved settings).
        String ownProviderAuthority = getPackageName() + ".fileprovider";
        urisToUpload.removeIf(uri -> uri == null
                || !"content".equals(uri.getScheme())
                || ownProviderAuthority.equals(uri.getAuthority()));

        if (urisToUpload.isEmpty()) {
            Toast.makeText(this, "No valid files received to upload", Toast.LENGTH_SHORT).show();
            finish();
            return;
        }

        int fileCount = urisToUpload.size();
        String firstDisplayName = getDisplayName(urisToUpload.get(0));
        tvFilename.setText(fileCount == 1 ? firstDisplayName : firstDisplayName + " and " + (fileCount - 1) + " more");
        tvDetails.setText(fileCount + " item(s) • Target: / Root");
        tvStatus.setText("Tap Upload to send to your FileHub.");

        final ArrayList<Uri> finalUris = new ArrayList<>(urisToUpload);
        btnBackground.setOnClickListener(v -> {
            if (isStarted.compareAndSet(false, true)) {
                btnBackground.setText("Send in Background");
                tvStatus.setText("Staging files for upload...");
                startUpload(finalUris);
            } else {
                Toast.makeText(this, "Upload continuing in background...", Toast.LENGTH_SHORT).show();
                finish();
            }
        });
    }

    private void startUpload(ArrayList<Uri> finalUris) {
        new Thread(() -> {
            File stagingDir = new File(getCacheDir(), "shared_uploads");
            if (!stagingDir.exists()) stagingDir.mkdirs();

            ArrayList<String> stagedPaths = new ArrayList<>();
            ArrayList<String> filenames = new ArrayList<>();

            for (int i = 0; i < finalUris.size(); i++) {
                if (isCancelled.get()) return;

                Uri uri = finalUris.get(i);
                String filename = getDisplayName(uri);
                String safeName = filename.replaceAll("[^a-zA-Z0-9._-]", "_");
                File dest = new File(stagingDir, System.currentTimeMillis() + "_" + safeName);

                final int currentIdx = i + 1;
                runOnUiThread(() -> {
                    if (!isFinishing()) {
                        tvStatus.setText("Processing file " + currentIdx + " of " + finalUris.size() + "...");
                    }
                });

                try (InputStream in = getContentResolver().openInputStream(uri);
                     FileOutputStream out = new FileOutputStream(dest)) {
                    if (in != null) {
                        byte[] buffer = new byte[16384];
                        int len;
                        while ((len = in.read(buffer)) != -1) {
                            if (isCancelled.get()) return;
                            out.write(buffer, 0, len);
                        }
                        stagedPaths.add(dest.getAbsolutePath());
                        filenames.add(filename);
                    }
                } catch (Exception ignored) {}
            }

            if (isCancelled.get()) return;

            runOnUiThread(() -> {
                // Enqueue even if the user already tapped "Send in Background" (activity finishing).
                boolean finishing = isFinishing();

                if (!stagedPaths.isEmpty()) {
                    Intent serviceIntent = new Intent(ShareActivity.this, UploadService.class);
                    serviceIntent.setAction(UploadService.ACTION_ENQUEUE);
                    serviceIntent.putStringArrayListExtra(UploadService.EXTRA_STAGED_PATHS, stagedPaths);
                    serviceIntent.putStringArrayListExtra(UploadService.EXTRA_FILENAMES, filenames);
                    serviceIntent.putExtra(UploadService.EXTRA_TARGET_FOLDER, "");

                    try {
                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                            startForegroundService(serviceIntent);
                        } else {
                            startService(serviceIntent);
                        }
                    } catch (RuntimeException e) {
                        // Android 12+ can refuse to start a foreground service once the app is in the background.
                        Toast.makeText(getApplicationContext(), "Upload could not start in the background. Please share again and wait for it to begin.", Toast.LENGTH_LONG).show();
                        if (!finishing) finish();
                        return;
                    }

                    int count = stagedPaths.size();
                    Toast.makeText(getApplicationContext(), "✓ Uploading " + count + " file" + (count > 1 ? "s" : "") + " to FileHub", Toast.LENGTH_SHORT).show();

                    if (!finishing) {
                        try {
                            Intent queueIntent = new Intent(ShareActivity.this, UploadQueueActivity.class);
                            queueIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                            startActivity(queueIntent);
                        } catch (Exception ignored) {}
                    }
                } else {
                    Toast.makeText(getApplicationContext(), "Failed to read shared file(s)", Toast.LENGTH_LONG).show();
                }
                if (!finishing) finish();
            });
        }).start();
    }

    private String getDisplayName(Uri uri) {
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
        return (result != null && !result.trim().isEmpty()) ? result : "shared_file_" + System.currentTimeMillis();
    }
}
