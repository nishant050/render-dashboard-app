package com.render.filehub;

import android.content.Context;
import android.content.SharedPreferences;
import android.os.Bundle;
import android.widget.Button;
import android.widget.EditText;
import android.widget.TextView;
import android.widget.Toast;

import androidx.appcompat.app.AppCompatActivity;

public class SettingsActivity extends AppCompatActivity {

    private EditText etServerUrl;
    private EditText etPassword;
    private EditText etUploadFolder;
    private TextView tvStatus;
    private SharedPreferences prefs;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_settings);

        prefs = getSharedPreferences("filehub_prefs", Context.MODE_PRIVATE);

        etServerUrl = findViewById(R.id.et_server_url);
        etPassword = findViewById(R.id.et_password);
        etUploadFolder = findViewById(R.id.et_upload_folder);
        tvStatus = findViewById(R.id.tv_connection_status);
        Button btnTest = findViewById(R.id.btn_test_connection);
        Button btnSave = findViewById(R.id.btn_save_settings);

        // Load saved values
        etServerUrl.setText(prefs.getString("server_url", "https://dashboard-mszb.onrender.com"));
        etPassword.setText(prefs.getString("dashboard_password", ""));
        etUploadFolder.setText(prefs.getString("upload_folder", ""));

        btnTest.setOnClickListener(v -> testConnection());
        btnSave.setOnClickListener(v -> saveSettings());
    }

    private void testConnection() {
        String url = etServerUrl.getText().toString().trim();
        String pass = etPassword.getText().toString();

        tvStatus.setText("Connecting to server...");
        tvStatus.setTextColor(getColor(R.color.accent));

        ApiClient.getInstance().testConnection(url, pass, new ApiClient.ApiCallback<String>() {
            @Override
            public void onSuccess(String result) {
                tvStatus.setText("✓ " + result);
                tvStatus.setTextColor(getColor(R.color.emerald));
            }

            @Override
            public void onError(String errorMessage) {
                tvStatus.setText("✗ " + errorMessage);
                tvStatus.setTextColor(getColor(R.color.danger));
            }
        });
    }

    private void saveSettings() {
        String url = etServerUrl.getText().toString().trim();
        String pass = etPassword.getText().toString();
        String folder = etUploadFolder.getText().toString().trim();

        if (url.isEmpty()) {
            url = "https://dashboard-mszb.onrender.com";
        }

        prefs.edit()
                .putString("server_url", url)
                .putString("dashboard_password", pass)
                .putString("upload_folder", folder)
                .apply();

        Toast.makeText(this, "Settings saved successfully!", Toast.LENGTH_SHORT).show();
        finish();
    }
}
