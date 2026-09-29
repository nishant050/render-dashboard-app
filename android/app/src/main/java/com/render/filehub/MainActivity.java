package com.render.filehub;

import android.annotation.SuppressLint;
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
import android.view.ViewGroup;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.EditText;
import android.widget.FrameLayout;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.Toast;

import androidx.activity.OnBackPressedCallback;
import androidx.annotation.Nullable;
import androidx.appcompat.app.AppCompatActivity;
import androidx.appcompat.widget.Toolbar;
import androidx.recyclerview.widget.LinearLayoutManager;
import androidx.recyclerview.widget.RecyclerView;
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout;

import com.google.android.material.bottomnavigation.BottomNavigationView;
import com.google.android.material.floatingactionbutton.FloatingActionButton;

import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.ArrayList;
import java.util.List;

public class MainActivity extends AppCompatActivity {

    private static final int REQUEST_PICK_FILES = 2001;

    // Navigation Views
    private View viewFilehub;
    private View viewInvesting;
    private View viewSettings;
    private BottomNavigationView bottomNav;

    // FileHub Components
    private TextView tvBreadcrumb;
    private TextView tvStorage;
    private Button btnHome;
    private Button btnUpFolder;
    private SwipeRefreshLayout swipeRefresh;
    private RecyclerView recyclerView;
    private View emptyView;
    private View layoutAuthRequired;
    private View layoutNetworkError;
    private TextView tvAuthTitle;
    private TextView tvAuthDesc;
    private FileAdapter adapter;
    private String currentPath = "";

    // Learn Investing Components
    private static final String INVESTING_PAGE_URL = "file:///android_asset/learn-investing/index.html";
    // Per-load secret written only into the Learn Investing document itself (see loadInvestingCourse).
    private volatile String investingBridgeToken = "";
    private WebView webViewInvesting;
    private ProgressBar progressBarInvesting;
    private boolean isInvestingLoaded = false;
    private FrameLayout customViewContainer;
    private WebChromeClient.CustomViewCallback customViewCallback;
    private View customView;

    // Settings Components
    private EditText etServerUrl;
    private EditText etPassword;

    private SharedPreferences prefs;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        prefs = getSharedPreferences("filehub_prefs", Context.MODE_PRIVATE);

        Toolbar toolbar = findViewById(R.id.toolbar);
        setSupportActionBar(toolbar);

        // Tab Views
        viewFilehub = findViewById(R.id.view_filehub);
        viewInvesting = findViewById(R.id.view_investing);
        viewSettings = findViewById(R.id.view_settings);
        bottomNav = findViewById(R.id.bottom_navigation);

        // FileHub setup
        tvBreadcrumb = findViewById(R.id.tv_breadcrumb);
        tvStorage = findViewById(R.id.tv_storage);
        btnHome = findViewById(R.id.btn_home);
        btnUpFolder = findViewById(R.id.btn_up_folder);
        swipeRefresh = findViewById(R.id.swipe_refresh);
        recyclerView = findViewById(R.id.recycler_files);
        emptyView = findViewById(R.id.empty_view);
        layoutAuthRequired = findViewById(R.id.layout_auth_required);
        layoutNetworkError = findViewById(R.id.layout_network_error);
        tvAuthTitle = findViewById(R.id.tv_auth_title);
        tvAuthDesc = findViewById(R.id.tv_auth_desc);
        FloatingActionButton fabUpload = findViewById(R.id.fab_upload);

        btnHome.setOnClickListener(v -> navigateToHome());
        btnUpFolder.setOnClickListener(v -> navigateUp());
        tvBreadcrumb.setOnClickListener(v -> navigateToHome());

        View btnGoSettings = findViewById(R.id.btn_go_to_settings);
        if (btnGoSettings != null) {
            btnGoSettings.setOnClickListener(v -> bottomNav.setSelectedItemId(R.id.nav_settings));
        }
        View btnRetryFiles = findViewById(R.id.btn_retry_files);
        if (btnRetryFiles != null) {
            btnRetryFiles.setOnClickListener(v -> loadFiles());
        }

        recyclerView.setLayoutManager(new LinearLayoutManager(this));

        // CRITICAL FIX: Ensure SwipeRefreshLayout never intercepts upward scrolling inside RecyclerView
        swipeRefresh.setOnChildScrollUpCallback((parent, child) -> recyclerView.canScrollVertically(-1));
        swipeRefresh.setOnRefreshListener(this::loadFiles);

        fabUpload.setOnClickListener(v -> pickFilesToUpload());

        // Learn Investing setup
        webViewInvesting = findViewById(R.id.webview_investing);
        progressBarInvesting = findViewById(R.id.investing_progress);
        setupInvestingWebView();

        // Settings setup
        etServerUrl = findViewById(R.id.et_settings_server_url);
        etPassword = findViewById(R.id.et_settings_password);
        Button btnSaveSettings = findViewById(R.id.btn_settings_save);
        Button btnTestSettings = findViewById(R.id.btn_settings_test);
        Button btnCheckUpdates = findViewById(R.id.btn_check_updates);

        loadSettingsFields();

        btnSaveSettings.setOnClickListener(v -> saveSettingsFields());
        btnTestSettings.setOnClickListener(v -> testServerConnection());
        btnCheckUpdates.setOnClickListener(v -> AppUpdater.checkForUpdates(MainActivity.this, true));

        // Bottom Navigation listener
        bottomNav.setOnItemSelectedListener(item -> {
            int id = item.getItemId();
            if (id == R.id.nav_filehub) {
                switchTab(0);
                return true;
            } else if (id == R.id.nav_investing) {
                switchTab(1);
                return true;
            } else if (id == R.id.nav_settings) {
                switchTab(2);
                return true;
            }
            return false;
        });

        // Back Press handling
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                if (customView != null) {
                    hideCustomView();
                } else if (viewInvesting.getVisibility() == View.VISIBLE && webViewInvesting.canGoBack()) {
                    webViewInvesting.goBack();
                } else if (viewFilehub.getVisibility() == View.VISIBLE && currentPath != null && !currentPath.isEmpty()) {
                    navigateUp();
                } else {
                    setEnabled(false);
                    getOnBackPressedDispatcher().onBackPressed();
                }
            }
        });

        // Check for updates automatically in the background on startup
        AppUpdater.checkForUpdates(this, false);
    }

    private void switchTab(int tabIndex) {
        viewFilehub.setVisibility(tabIndex == 0 ? View.VISIBLE : View.GONE);
        viewInvesting.setVisibility(tabIndex == 1 ? View.VISIBLE : View.GONE);
        viewSettings.setVisibility(tabIndex == 2 ? View.VISIBLE : View.GONE);

        if (getSupportActionBar() != null) {
            if (tabIndex == 0) {
                getSupportActionBar().setTitle("FileHub");
                loadFiles();
            } else if (tabIndex == 1) {
                getSupportActionBar().setTitle("Learn Investing");
                if (!isInvestingLoaded) {
                    loadInvestingCourse();
                }
            } else {
                getSupportActionBar().setTitle("Settings & Updates");
                loadSettingsFields();
            }
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    private void setupInvestingWebView() {
        WebSettings settings = webViewInvesting.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(true);
        // The page talks to the server only through InvestingBridge, so the local page needs no
        // access to other local files or to other origins.
        settings.setAllowContentAccess(false);
        settings.setAllowFileAccessFromFileURLs(false);
        settings.setAllowUniversalAccessFromFileURLs(false);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setLoadWithOverviewMode(true);
        settings.setUseWideViewPort(true);

        webViewInvesting.addJavascriptInterface(new InvestingBridge(), "AndroidBridge");

        webViewInvesting.setWebViewClient(new WebViewClient() {
            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                progressBarInvesting.setVisibility(View.GONE);
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                if (!request.isForMainFrame()) return false;
                Uri uri = request.getUrl();
                String scheme = uri.getScheme();
                if ("file".equals(scheme)) return false;
                // Other websites (e.g. "Open on YouTube") open in the browser - never inside the
                // WebView that has the AndroidBridge object.
                if ("http".equals(scheme) || "https".equals(scheme)) {
                    try {
                        startActivity(new Intent(Intent.ACTION_VIEW, uri));
                    } catch (Exception ignored) {}
                }
                return true;
            }

            @Override
            public void onReceivedError(WebView view, int errorCode, String description, String failingUrl) {
                super.onReceivedError(view, errorCode, description, failingUrl);
                progressBarInvesting.setVisibility(View.GONE);
                if (failingUrl != null && !failingUrl.startsWith("file:///android_asset/")) {
                    loadInvestingCourse();
                }
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                super.onReceivedError(view, request, error);
                if (request.isForMainFrame()) {
                    progressBarInvesting.setVisibility(View.GONE);
                    String failingUrl = request.getUrl().toString();
                    if (!failingUrl.startsWith("file:///android_asset/")) {
                        loadInvestingCourse();
                    }
                }
            }
        });

        webViewInvesting.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onProgressChanged(WebView view, int newProgress) {
                if (newProgress < 100) {
                    progressBarInvesting.setVisibility(View.VISIBLE);
                } else {
                    progressBarInvesting.setVisibility(View.GONE);
                }
            }

            @Override
            public void onShowCustomView(View view, CustomViewCallback callback) {
                if (customView != null) {
                    callback.onCustomViewHidden();
                    return;
                }
                customView = view;
                customViewCallback = callback;

                FrameLayout decor = (FrameLayout) getWindow().getDecorView();
                customViewContainer = new FrameLayout(MainActivity.this);
                customViewContainer.setBackgroundColor(0xFF000000);
                customViewContainer.addView(customView, new FrameLayout.LayoutParams(
                        ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
                decor.addView(customViewContainer, new FrameLayout.LayoutParams(
                        ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));

                webViewInvesting.setVisibility(View.GONE);
                bottomNav.setVisibility(View.GONE);
                if (getSupportActionBar() != null) getSupportActionBar().hide();
            }

            @Override
            public void onHideCustomView() {
                hideCustomView();
            }
        });
    }

    private void hideCustomView() {
        if (customView == null) return;

        FrameLayout decor = (FrameLayout) getWindow().getDecorView();
        if (customViewContainer != null) {
            decor.removeView(customViewContainer);
            customViewContainer = null;
        }
        customView = null;
        if (customViewCallback != null) {
            customViewCallback.onCustomViewHidden();
            customViewCallback = null;
        }
        webViewInvesting.setVisibility(View.VISIBLE);
        bottomNav.setVisibility(View.VISIBLE);
        if (getSupportActionBar() != null) getSupportActionBar().show();
    }

    private void loadInvestingCourse() {
        progressBarInvesting.setVisibility(View.VISIBLE);

        // Fresh bridge token for every load, written into this document only. Embedded frames
        // (YouTube players) also see the AndroidBridge object, but cannot read this token.
        byte[] random = new byte[24];
        new SecureRandom().nextBytes(random);
        StringBuilder token = new StringBuilder();
        for (byte b : random) {
            token.append(String.format("%02x", b));
        }
        investingBridgeToken = token.toString();

        String html;
        try (InputStream in = getAssets().open("learn-investing/index.html")) {
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            byte[] buffer = new byte[16384];
            int read;
            while ((read = in.read(buffer)) != -1) {
                out.write(buffer, 0, read);
            }
            html = new String(out.toByteArray(), StandardCharsets.UTF_8);
        } catch (IOException e) {
            investingBridgeToken = "";
            webViewInvesting.loadUrl(INVESTING_PAGE_URL);
            isInvestingLoaded = true;
            return;
        }

        String inject = "<script>window.__BRIDGE_TOKEN=" + JSONObject.quote(investingBridgeToken) + ";</script>";
        int headIndex = html.indexOf("<head>");
        html = headIndex >= 0
                ? html.substring(0, headIndex + 6) + inject + html.substring(headIndex + 6)
                : inject + html;
        webViewInvesting.loadDataWithBaseURL(INVESTING_PAGE_URL, html, "text/html", "UTF-8", INVESTING_PAGE_URL);
        isInvestingLoaded = true;
    }

    /**
     * JavaScript bridge for the Learn Investing page. The dashboard password never crosses into
     * JavaScript: the few API calls the page needs are made here, natively, with the password added
     * by the app. Android exposes this object to every frame of the WebView (including embedded
     * YouTube players), so each call must carry the per-load token only the page itself knows, and
     * only the Learn Investing endpoints can be reached. Results go back to the main frame only.
     */
    private class InvestingBridge {
        @JavascriptInterface
        public String getServerUrl() {
            return prefs.getString("server_url", "https://dashboard-mszb.onrender.com");
        }

        @JavascriptInterface
        public void apiRequest(String token, String requestId, String method, String path, String body) {
            String expected = investingBridgeToken;
            if (token == null || expected.isEmpty()
                    || !MessageDigest.isEqual(token.getBytes(StandardCharsets.UTF_8), expected.getBytes(StandardCharsets.UTF_8))) {
                return;
            }
            if (requestId == null || !requestId.matches("[A-Za-z0-9_-]{1,40}")) {
                return;
            }
            String httpMethod = "POST".equals(method) ? "POST" : "GET";
            if (!isAllowedInvestingApiPath(httpMethod, path)) {
                deliverInvestingApiResult(requestId, 403, "{}");
                return;
            }
            ApiClient.getInstance().rawJsonRequest(
                    prefs.getString("server_url", "https://dashboard-mszb.onrender.com"),
                    prefs.getString("dashboard_password", ""),
                    httpMethod,
                    path,
                    body,
                    (status, responseBody) -> deliverInvestingApiResult(requestId, status, responseBody));
        }
    }

    private static boolean isAllowedInvestingApiPath(String method, String path) {
        if (path == null || path.length() > 512 || path.contains("..") || !path.matches("/api/[\\x21-\\x7E]*")) {
            return false;
        }
        if ("POST".equals(method)) {
            return path.equals("/api/learn-investing/state");
        }
        return path.equals("/api/learn-investing/state")
                || path.startsWith("/api/stream/youtube/playlist?")
                || path.startsWith("/api/stream/youtube/token?");
    }

    private void deliverInvestingApiResult(String requestId, int status, String body) {
        runOnUiThread(() -> {
            if (webViewInvesting == null) return;
            String script = "window.__nativeApiResolve&&window.__nativeApiResolve("
                    + JSONObject.quote(requestId) + "," + status + ","
                    + JSONObject.quote(body != null ? body : "") + ")";
            webViewInvesting.evaluateJavascript(script, null);
        });
    }

    private void loadSettingsFields() {
        String server = prefs.getString("server_url", "https://dashboard-mszb.onrender.com");
        String pass = prefs.getString("dashboard_password", "");
        etServerUrl.setText(server);
        etPassword.setText(pass);
    }

    private void saveSettingsFields() {
        String server = etServerUrl.getText().toString().trim();
        String pass = etPassword.getText().toString().trim();

        if (server.isEmpty()) server = "https://dashboard-mszb.onrender.com";

        prefs.edit()
                .putString("server_url", server)
                .putString("dashboard_password", pass)
                .apply();

        Toast.makeText(this, "Settings saved successfully!", Toast.LENGTH_SHORT).show();
    }

    private void testServerConnection() {
        String server = etServerUrl.getText().toString().trim();
        String pass = etPassword.getText().toString().trim();

        if (server.isEmpty()) server = "https://dashboard-mszb.onrender.com";

        Toast.makeText(this, "Testing connection to server...", Toast.LENGTH_SHORT).show();

        ApiClient.getInstance().testConnection(server, pass, new ApiClient.ApiCallback<String>() {
            @Override
            public void onSuccess(String result) {
                Toast.makeText(MainActivity.this, "✓ " + result, Toast.LENGTH_LONG).show();
            }

            @Override
            public void onError(String errorMessage) {
                Toast.makeText(MainActivity.this, "✗ " + errorMessage, Toast.LENGTH_LONG).show();
            }
        });
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
        if (viewFilehub.getVisibility() == View.VISIBLE) {
            updateBreadcrumb();
            loadFiles();
        }
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
        String password = prefs.getString("dashboard_password", "").trim();

        if (password.isEmpty()) {
            swipeRefresh.setRefreshing(false);
            if (recyclerView != null) recyclerView.setVisibility(View.GONE);
            if (emptyView != null) emptyView.setVisibility(View.GONE);
            if (layoutNetworkError != null) layoutNetworkError.setVisibility(View.GONE);
            if (layoutAuthRequired != null) {
                layoutAuthRequired.setVisibility(View.VISIBLE);
                if (tvAuthTitle != null) tvAuthTitle.setText("Master Password Required");
                if (tvAuthDesc != null) tvAuthDesc.setText("Please configure your Master Password in Settings to access FileHub files.");
            }
            return;
        }

        // Hide auth and error screens while fetching
        if (layoutAuthRequired != null) layoutAuthRequired.setVisibility(View.GONE);
        if (layoutNetworkError != null) layoutNetworkError.setVisibility(View.GONE);

        swipeRefresh.setRefreshing(true);

        ApiClient.getInstance().fetchFiles(serverUrl, password, currentPath, new ApiClient.ApiCallback<List<FileItem>>() {
            @Override
            public void onSuccess(List<FileItem> items) {
                swipeRefresh.setRefreshing(false);
                if (layoutAuthRequired != null) layoutAuthRequired.setVisibility(View.GONE);
                if (layoutNetworkError != null) layoutNetworkError.setVisibility(View.GONE);
                if (recyclerView != null) recyclerView.setVisibility(View.VISIBLE);

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
                if (recyclerView != null) recyclerView.setVisibility(View.GONE);
                if (emptyView != null) emptyView.setVisibility(View.GONE);

                if (errorMessage != null && (errorMessage.contains("401") || errorMessage.toLowerCase().contains("unauthorized") || errorMessage.toLowerCase().contains("password"))) {
                    if (layoutNetworkError != null) layoutNetworkError.setVisibility(View.GONE);
                    if (layoutAuthRequired != null) {
                        layoutAuthRequired.setVisibility(View.VISIBLE);
                        if (tvAuthTitle != null) tvAuthTitle.setText("Incorrect Password");
                        if (tvAuthDesc != null) tvAuthDesc.setText("The server rejected your Master Password. Please check Settings.");
                    }
                } else {
                    if (layoutAuthRequired != null) layoutAuthRequired.setVisibility(View.GONE);
                    if (layoutNetworkError != null) layoutNetworkError.setVisibility(View.VISIBLE);
                }
                Toast.makeText(MainActivity.this, errorMessage, Toast.LENGTH_SHORT).show();
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
                // CRITICAL FIX: Pass current folder path so files upload to the active subfolder!
                serviceIntent.putExtra(UploadService.EXTRA_TARGET_FOLDER, currentPath != null ? currentPath : "");

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

                String folderNotice = (currentPath != null && !currentPath.isEmpty()) ? " to /" + currentPath : "";
                Toast.makeText(this, "Uploading " + uris.size() + " file(s)" + folderNotice + "...", Toast.LENGTH_SHORT).show();
            }
        }
    }

    @Override
    public boolean onCreateOptionsMenu(Menu menu) {
        menu.add(0, 1, 0, "Uploads Queue").setIcon(android.R.drawable.stat_sys_upload).setShowAsAction(MenuItem.SHOW_AS_ACTION_ALWAYS);
        return true;
    }

    @Override
    public boolean onOptionsItemSelected(MenuItem item) {
        if (item.getItemId() == 1) {
            startActivity(new Intent(this, UploadQueueActivity.class));
            return true;
        }
        return super.onOptionsItemSelected(item);
    }
}
