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
import android.widget.Toast;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.util.ArrayList;

public class ShareActivity extends Activity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

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

        if (urisToUpload.isEmpty()) {
            Toast.makeText(this, "No valid files received to upload", Toast.LENGTH_SHORT).show();
            finish();
            return;
        }

        Toast.makeText(this, "Preparing " + urisToUpload.size() + " file(s) for FileHub upload...", Toast.LENGTH_SHORT).show();

        // Process file staging in background to avoid freezing UI
        final ArrayList<Uri> finalUris = new ArrayList<>(urisToUpload);
        new Thread(() -> {
            File stagingDir = new File(getCacheDir(), "shared_uploads");
            if (!stagingDir.exists()) stagingDir.mkdirs();

            ArrayList<String> stagedPaths = new ArrayList<>();
            ArrayList<String> filenames = new ArrayList<>();

            for (Uri uri : finalUris) {
                String filename = getDisplayName(uri);
                String safeName = filename.replaceAll("[^a-zA-Z0-9._-]", "_");
                File dest = new File(stagingDir, System.currentTimeMillis() + "_" + safeName);
                try (InputStream in = getContentResolver().openInputStream(uri);
                     FileOutputStream out = new FileOutputStream(dest)) {
                    if (in != null) {
                        byte[] buffer = new byte[16384];
                        int len;
                        while ((len = in.read(buffer)) != -1) {
                            out.write(buffer, 0, len);
                        }
                        stagedPaths.add(dest.getAbsolutePath());
                        filenames.add(filename);
                    }
                } catch (Exception e) {
                    // Ignore failed individual files
                }
            }

            runOnUiThread(() -> {
                if (!stagedPaths.isEmpty()) {
                    Intent serviceIntent = new Intent(ShareActivity.this, UploadService.class);
                    serviceIntent.setAction(UploadService.ACTION_ENQUEUE);
                    serviceIntent.putStringArrayListExtra(UploadService.EXTRA_STAGED_PATHS, stagedPaths);
                    serviceIntent.putStringArrayListExtra(UploadService.EXTRA_FILENAMES, filenames);
                    serviceIntent.putExtra(UploadService.EXTRA_TARGET_FOLDER, "");

                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                        startForegroundService(serviceIntent);
                    } else {
                        startService(serviceIntent);
                    }

                    int count = stagedPaths.size();
                    Toast.makeText(ShareActivity.this, "Uploading " + count + " file" + (count > 1 ? "s" : "") + " to FileHub...", Toast.LENGTH_SHORT).show();

                    // Open Upload Queue Activity so the user gets instant visual confirmation
                    try {
                        Intent queueIntent = new Intent(ShareActivity.this, UploadQueueActivity.class);
                        queueIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                        startActivity(queueIntent);
                    } catch (Exception ignored) {}
                } else {
                    Toast.makeText(ShareActivity.this, "Failed to read shared file(s). Please try again.", Toast.LENGTH_LONG).show();
                }
                finish();
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
