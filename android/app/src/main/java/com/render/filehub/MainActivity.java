package com.render.filehub;

import android.app.Activity;
import android.content.ClipData;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.Menu;
import android.view.MenuItem;
import android.view.View;
import android.widget.Button;
import android.widget.TextView;
import android.widget.Toast;

import androidx.activity.OnBackPressedCallback;
import androidx.annotation.Nullable;
import androidx.appcompat.app.AppCompatActivity;
import androidx.appcompat.widget.Toolbar;
import androidx.recyclerview.widget.LinearLayoutManager;
import androidx.recyclerview.widget.RecyclerView;
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout;

import com.google.android.material.floatingactionbutton.FloatingActionButton;

import java.util.ArrayList;
import java.util.List;

public class MainActivity extends AppCompatActivity {

    private static final int REQUEST_PICK_FILES = 2001;

    private TextView tvBreadcrumb;
    private TextView tvStorage;
    private Button btnHome;
    private Button btnUpFolder;
    private SwipeRefreshLayout swipeRefresh;
    private RecyclerView recyclerView;
    private View emptyView;
    private FileAdapter adapter;

    private String currentPath = "";
    private SharedPreferences prefs;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        prefs = getSharedPreferences("filehub_prefs", Context.MODE_PRIVATE);

        Toolbar toolbar = findViewById(R.id.toolbar);
        setSupportActionBar(toolbar);

        tvBreadcrumb = findViewById(R.id.tv_breadcrumb);
        tvStorage = findViewById(R.id.tv_storage);
        btnHome = findViewById(R.id.btn_home);
        btnUpFolder = findViewById(R.id.btn_up_folder);
        swipeRefresh = findViewById(R.id.swipe_refresh);
        recyclerView = findViewById(R.id.recycler_files);
        emptyView = findViewById(R.id.empty_view);
        FloatingActionButton fabUpload = findViewById(R.id.fab_upload);

        btnHome.setOnClickListener(v -> navigateToHome());
        btnUpFolder.setOnClickListener(v -> navigateUp());
        tvBreadcrumb.setOnClickListener(v -> navigateToHome());

        recyclerView.setLayoutManager(new LinearLayoutManager(this));

        swipeRefresh.setOnRefreshListener(this::loadFiles);

        fabUpload.setOnClickListener(v -> pickFilesToUpload());

        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                if (currentPath != null && !currentPath.isEmpty()) {
                    navigateUp();
                } else {
                    setEnabled(false);
                    getOnBackPressedDispatcher().onBackPressed();
                }
            }
        });

        // Check if master password configured
        String password = prefs.getString("dashboard_password", "");
        if (password == null || password.trim().isEmpty()) {
            startActivity(new Intent(this, SettingsActivity.class));
        }
    }

    private void navigateToHome() {
        if (currentPath != null && !currentPath.isEmpty()) {
            currentPath = "";
            updateBreadcrumb();
            loadFiles();
        }
    }

    private void navigateUp() {
        if (currentPath != null && !currentPath.isEmpty()) {
            int lastSlash = currentPath.lastIndexOf('/');
            if (lastSlash >= 0) {
                currentPath = currentPath.substring(0, lastSlash);
            } else {
                currentPath = "";
            }
            updateBreadcrumb();
            loadFiles();
        }
    }

    @Override
    protected void onResume() {
        super.onResume();
        updateBreadcrumb();
        loadFiles();
    }

    private void updateBreadcrumb() {
        if (currentPath == null || currentPath.isEmpty()) {
            tvBreadcrumb.setText("/ Root");
            if (btnUpFolder != null) btnUpFolder.setVisibility(View.GONE);
        } else {
            tvBreadcrumb.setText("/ " + currentPath);
            if (btnUpFolder != null) btnUpFolder.setVisibility(View.VISIBLE);
        }
    }

    private void loadFiles() {
        String serverUrl = prefs.getString("server_url", "https://dashboard-mszb.onrender.com");
        String password = prefs.getString("dashboard_password", "");

        swipeRefresh.setRefreshing(true);

        ApiClient.getInstance().fetchFiles(serverUrl, password, currentPath, new ApiClient.ApiCallback<List<FileItem>>() {
            @Override
            public void onSuccess(List<FileItem> items) {
                swipeRefresh.setRefreshing(false);
                adapter = new FileAdapter(MainActivity.this, serverUrl, password, currentPath, new FileAdapter.OnItemClickListener() {
                    @Override
                    public void onItemClick(FileItem item) {
                        if (item.isDirectory()) {
                            if (currentPath == null || currentPath.isEmpty()) {
                                currentPath = item.getName();
                            } else {
                                currentPath = currentPath + "/" + item.getName();
                            }
                            updateBreadcrumb();
                            loadFiles();
                        }
                    }

                    @Override
                    public void onFileDeleted() {
                        loadFiles();
                    }
                });
                adapter.setItems(items);
                recyclerView.setAdapter(adapter);

                if (items.isEmpty()) {
                    emptyView.setVisibility(View.VISIBLE);
                } else {
                    emptyView.setVisibility(View.GONE);
                }
            }

            @Override
            public void onError(String errorMessage) {
                swipeRefresh.setRefreshing(false);
                Toast.makeText(MainActivity.this, errorMessage, Toast.LENGTH_LONG).show();
            }
        });
    }

    private void pickFilesToUpload() {
        Intent intent = new Intent(Intent.ACTION_GET_CONTENT);
        intent.setType("*/*");
        intent.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true);
        startActivityForResult(Intent.createChooser(intent, "Select Files to Upload"), REQUEST_PICK_FILES);
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, @Nullable Intent data) {
        super.onActivityResult(requestCode, resultCode, data);

        if (requestCode == REQUEST_PICK_FILES && resultCode == Activity.RESULT_OK && data != null) {
            ArrayList<Uri> uris = new ArrayList<>();
            if (data.getClipData() != null) {
                int count = data.getClipData().getItemCount();
                for (int i = 0; i < count; i++) {
                    uris.add(data.getClipData().getItemAt(i).getUri());
                }
            } else if (data.getData() != null) {
                uris.add(data.getData());
            }

            if (!uris.isEmpty()) {
                Intent serviceIntent = new Intent(this, UploadService.class);
                serviceIntent.setAction(UploadService.ACTION_ENQUEUE);
                serviceIntent.putParcelableArrayListExtra(UploadService.EXTRA_URIS, uris);

                // Forward URI permissions to background service via ClipData and flags
                ClipData clipData = ClipData.newRawUri("FileHub Upload", uris.get(0));
                for (int i = 1; i < uris.size(); i++) {
                    clipData.addItem(new ClipData.Item(uris.get(i)));
                }
                serviceIntent.setClipData(clipData);
                serviceIntent.setData(uris.get(0));
                serviceIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);

                for (Uri uri : uris) {
                    try {
                        grantUriPermission(getPackageName(), uri, Intent.FLAG_GRANT_READ_URI_PERMISSION);
                    } catch (Exception ignored) {}
                }

                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    startForegroundService(serviceIntent);
                } else {
                    startService(serviceIntent);
                }

                Toast.makeText(this, "Uploading " + uris.size() + " file(s) to FileHub...", Toast.LENGTH_SHORT).show();
            }
        }
    }

    @Override
    public boolean onCreateOptionsMenu(Menu menu) {
        menu.add(0, 3, 0, "Home").setShowAsAction(MenuItem.SHOW_AS_ACTION_IF_ROOM);
        menu.add(0, 1, 1, "Uploads").setIcon(android.R.drawable.stat_sys_upload).setShowAsAction(MenuItem.SHOW_AS_ACTION_ALWAYS);
        menu.add(0, 2, 2, "Settings").setIcon(android.R.drawable.ic_menu_preferences).setShowAsAction(MenuItem.SHOW_AS_ACTION_ALWAYS);
        return true;
    }

    @Override
    public boolean onOptionsItemSelected(MenuItem item) {
        if (item.getItemId() == 1) {
            startActivity(new Intent(this, UploadQueueActivity.class));
            return true;
        } else if (item.getItemId() == 2) {
            startActivity(new Intent(this, SettingsActivity.class));
            return true;
        } else if (item.getItemId() == 3) {
            navigateToHome();
            return true;
        }
        return super.onOptionsItemSelected(item);
    }
}
