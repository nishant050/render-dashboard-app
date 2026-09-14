package com.render.filehub;

import android.app.Activity;
import android.content.ClipData;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.widget.Toast;

import java.util.ArrayList;

public class ShareActivity extends Activity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        SharedPreferences prefs = getSharedPreferences("filehub_prefs", Context.MODE_PRIVATE);
        String password = prefs.getString("dashboard_password", "");

        if (password == null || password.trim().isEmpty()) {
            Toast.makeText(this, "Please configure your FileHub Master Password first!", Toast.LENGTH_LONG).show();
            Intent settingsIntent = new Intent(this, SettingsActivity.class);
            startActivity(settingsIntent);
            finish();
            return;
        }

        Intent intent = getIntent();
        String action = intent != null ? intent.getAction() : null;
        String type = intent != null ? intent.getType() : null;

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

        if (!urisToUpload.isEmpty()) {
            Intent serviceIntent = new Intent(this, UploadService.class);
            serviceIntent.setAction(UploadService.ACTION_ENQUEUE);
            serviceIntent.putParcelableArrayListExtra(UploadService.EXTRA_URIS, urisToUpload);

            // Forward URI read permissions to background service via ClipData and flags
            ClipData clipData = ClipData.newRawUri("FileHub Share Upload", urisToUpload.get(0));
            for (int i = 1; i < urisToUpload.size(); i++) {
                clipData.addItem(new ClipData.Item(urisToUpload.get(i)));
            }
            serviceIntent.setClipData(clipData);
            serviceIntent.setData(urisToUpload.get(0));
            serviceIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);

            for (Uri uri : urisToUpload) {
                try {
                    grantUriPermission(getPackageName(), uri, Intent.FLAG_GRANT_READ_URI_PERMISSION);
                } catch (Exception ignored) {}
            }

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                startForegroundService(serviceIntent);
            } else {
                startService(serviceIntent);
            }

            int count = urisToUpload.size();
            Toast.makeText(this, "Uploading " + count + " file" + (count > 1 ? "s" : "") + " to FileHub...", Toast.LENGTH_SHORT).show();
        } else {
            Toast.makeText(this, "No valid files received", Toast.LENGTH_SHORT).show();
        }

        finish();
    }
}
