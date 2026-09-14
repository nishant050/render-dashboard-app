package com.render.filehub;

import android.app.Activity;
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
        String action = intent.getAction();
        String type = intent.getType();

        ArrayList<Uri> urisToUpload = new ArrayList<>();

        if (Intent.ACTION_SEND.equals(action) && type != null) {
            Uri imageUri = intent.getParcelableExtra(Intent.EXTRA_STREAM);
            if (imageUri != null) {
                urisToUpload.add(imageUri);
            }
        } else if (Intent.ACTION_SEND_MULTIPLE.equals(action) && type != null) {
            ArrayList<Uri> imageUris = intent.getParcelableArrayListExtra(Intent.EXTRA_STREAM);
            if (imageUris != null) {
                urisToUpload.addAll(imageUris);
            }
        }

        if (!urisToUpload.isEmpty()) {
            Intent serviceIntent = new Intent(this, UploadService.class);
            serviceIntent.setAction(UploadService.ACTION_ENQUEUE);
            serviceIntent.putParcelableArrayListExtra(UploadService.EXTRA_URIS, urisToUpload);

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
