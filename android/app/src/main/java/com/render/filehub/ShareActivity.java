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

        SharedPreferences prefs = getSharedPreferences("filehub_prefs", Context.MODE_PRIVATE);
        String password = prefs.getString("dashboard_password", "");

        if (password == null || password.trim().isEmpty()) {
            Toast.makeText(this, "Please configure your FileHub Master Password first in settings!", Toast.LENGTH_LONG).show();
            Intent settingsIntent = new Intent(this, SettingsActivity.class);
            startActivity(settingsIntent);
            finish();
            return;
        }

        Intent intent = getIntent();
        String action = intent != null ? intent.getAction() : null;

        ArrayList<Uri> urisToUpload = new ArrayList<>();

        if (intent != null) {
            if (Intent.ACTION_SEND.equals(action)) {
                Uri singleUri = intent.getParcelableExtra(Intent.EXTRA_STREAM);
                if (singleUri != null) {
                    urisToUpload.add(singleUri);
                }
            } else if (Intent.ACTION_SEND_MULTIPLE.equals(action)) {
                ArrayList<Uri> multiUris = intent.getParcelableArrayListExtra(Intent.EXTRA_STREAM);
                if (multiUris != null) {
                    urisToUpload.addAll(multiUris);
                }
            }

            // Fallback to ClipData if EXTRA_STREAM was empty
            if (urisToUpload.isEmpty() && intent.getClipData() != null) {
                int count = intent.getClipData().getItemCount();
                for (int i = 0; i < count; i++) {
                    Uri u = intent.getClipData().getItemAt(i).getUri();
                    if (u != null) urisToUpload.add(u);
                }
            }

            // Fallback to data URI
            if (urisToUpload.isEmpty() && intent.getData() != null) {
                urisToUpload.add(intent.getData());
            }
        }

        if (urisToUpload.isEmpty()) {
            Toast.makeText(this, "No valid files received to upload", Toast.LENGTH_SHORT).show();
            finish();
            return;
        }

        // Staging directory inside private app cache
        File stagingDir = new File(getCacheDir(), "shared_uploads");
        if (!stagingDir.exists()) stagingDir.mkdirs();

        ArrayList<String> stagedPaths = new ArrayList<>();
        ArrayList<String> filenames = new ArrayList<>();

        for (Uri uri : urisToUpload) {
            String filename = getDisplayName(uri);
            String safeName = filename.replaceAll("[^a-zA-Z0-9._-]", "_");
            File dest = new File(stagingDir, System.currentTimeMillis() + "_" + safeName);
            try (InputStream in = getContentResolver().openInputStream(uri);
                 FileOutputStream out = new FileOutputStream(dest)) {
                if (in != null) {
                    byte[] buffer = new byte[8192];
                    int len;
                    while ((len = in.read(buffer)) != -1) {
                        out.write(buffer, 0, len);
                    }
                    stagedPaths.add(dest.getAbsolutePath());
                    filenames.add(filename);
                }
            } catch (Exception e) {
                // If direct copy fails, dest will not be added
            }
        }

        if (!stagedPaths.isEmpty()) {
            Intent serviceIntent = new Intent(this, UploadService.class);
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
            Toast.makeText(this, "Uploading " + count + " file" + (count > 1 ? "s" : "") + " to FileHub...", Toast.LENGTH_SHORT).show();
        } else {
            Toast.makeText(this, "Failed to read shared file(s). Please try again.", Toast.LENGTH_LONG).show();
        }

        finish();
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
