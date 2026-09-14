package com.render.filehub;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.app.DownloadManager;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Bitmap;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.view.Menu;
import android.view.MenuItem;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.CookieManager;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.Toast;

import androidx.activity.OnBackPressedCallback;
import androidx.annotation.Nullable;
import androidx.appcompat.app.AppCompatActivity;
import androidx.appcompat.widget.Toolbar;
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout;

import java.io.InputStream;
import java.net.URLEncoder;
import java.util.Collections;
import java.util.HashMap;
import java.util.Map;

import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.Response;

public class DashboardActivity extends AppCompatActivity {

    private static final int FILE_CHOOSER_REQUEST_CODE = 3001;

    private WebView webView;
    private ProgressBar progressBar;
    private SwipeRefreshLayout swipeRefresh;
    private LinearLayout loadingView;
    private FrameLayout customViewContainer;
    private WebChromeClient.CustomViewCallback customViewCallback;
    private View customView;

    private SharedPreferences prefs;
    private ValueCallback<Uri[]> fileChooserCallback;
    private String currentServerUrl;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_dashboard);

        prefs = getSharedPreferences("filehub_prefs", Context.MODE_PRIVATE);

        Toolbar toolbar = findViewById(R.id.toolbar);
        setSupportActionBar(toolbar);
        if (getSupportActionBar() != null) {
            getSupportActionBar().setTitle("Render Dashboard");
        }

        webView = findViewById(R.id.dashboard_webview);
        progressBar = findViewById(R.id.web_progress_bar);
        swipeRefresh = findViewById(R.id.swipe_refresh);
        loadingView = findViewById(R.id.loading_view);

        setupWebView();

        swipeRefresh.setOnRefreshListener(() -> {
            if (webView != null) {
                webView.reload();
            }
        });

        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                if (customView != null) {
                    hideCustomView();
                } else if (webView != null && webView.canGoBack()) {
                    webView.goBack();
                } else {
                    setEnabled(false);
                    getOnBackPressedDispatcher().onBackPressed();
                }
            }
        });

        checkPasswordAndLoad();
    }

    private void setupWebView() {
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setAllowFileAccess(true);
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);
        settings.setUseWideViewPort(true);
        settings.setLoadWithOverviewMode(true);
        settings.setSupportZoom(true);
        settings.setBuiltInZoomControls(true);
        settings.setDisplayZoomControls(false);

        // Append custom identifier so web apps (like learn-investing) know they run inside the Android Dashboard app
        String defaultUA = settings.getUserAgentString();
        settings.setUserAgentString(defaultUA + " RenderDashboardApp/1.0");

        CookieManager.getInstance().setAcceptCookie(true);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            CookieManager.getInstance().setAcceptThirdPartyCookies(webView, true);
        }

        webView.setWebViewClient(new DashboardWebViewClient());
        webView.setWebChromeClient(new DashboardWebChromeClient());

        webView.setDownloadListener((url, userAgent, contentDisposition, mimetype, contentLength) -> {
            try {
                DownloadManager.Request request = new DownloadManager.Request(Uri.parse(url));
                request.setMimeType(mimetype);
                request.addRequestHeader("User-Agent", userAgent);
                request.setDescription("Downloading file from Render Dashboard");
                request.setTitle(URLUtilGuessFileName(url, contentDisposition, mimetype));
                request.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
                request.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, URLUtilGuessFileName(url, contentDisposition, mimetype));
                DownloadManager dm = (DownloadManager) getSystemService(DOWNLOAD_SERVICE);
                if (dm != null) dm.enqueue(request);
                Toast.makeText(DashboardActivity.this, "Download started...", Toast.LENGTH_SHORT).show();
            } catch (Exception e) {
                Toast.makeText(DashboardActivity.this, "Download error: " + e.getMessage(), Toast.LENGTH_SHORT).show();
            }
        });
    }

    private String URLUtilGuessFileName(String url, String contentDisposition, String mimeType) {
        return android.webkit.URLUtil.guessFileName(url, contentDisposition, mimeType);
    }

    private void checkPasswordAndLoad() {
        String password = prefs.getString("dashboard_password", "");
        currentServerUrl = prefs.getString("server_url", "https://dashboard-mszb.onrender.com");

        if (password == null || password.trim().isEmpty()) {
            Toast.makeText(this, "Please configure your Dashboard Master Password first!", Toast.LENGTH_LONG).show();
            startActivity(new Intent(this, SettingsActivity.class));
            return;
        }

        loadDashboardWithAuth();
    }

    private void loadDashboardWithAuth() {
        String serverUrl = currentServerUrl;
        String password = prefs.getString("dashboard_password", "");

        loadingView.setVisibility(View.VISIBLE);

        // Inject headers for initial request
        Map<String, String> extraHeaders = new HashMap<>();
        extraHeaders.put("x-dashboard-password", password);
        extraHeaders.put("x-requested-with", "com.render.dashboard");

        webView.loadUrl(serverUrl, extraHeaders);
    }

    @Override
    protected void onResume() {
        super.onResume();
        String savedUrl = prefs.getString("server_url", "https://dashboard-mszb.onrender.com");
        if (!savedUrl.equals(currentServerUrl)) {
            currentServerUrl = savedUrl;
            loadDashboardWithAuth();
        }
    }

    private class DashboardWebViewClient extends WebViewClient {

        @Override
        public void onPageStarted(WebView view, String url, Bitmap favicon) {
            super.onPageStarted(view, url, favicon);
            progressBar.setVisibility(View.VISIBLE);
        }

        @Override
        public void onPageFinished(WebView view, String url) {
            super.onPageFinished(view, url);
            progressBar.setVisibility(View.GONE);
            swipeRefresh.setRefreshing(false);
            loadingView.setVisibility(View.GONE);

            // Inject window.isRenderApp flag
            view.evaluateJavascript("window.isRenderApp = true; window.dispatchEvent(new Event('render-app-ready'));", null);
        }

        @Override
        public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
            Uri uri = request.getUrl();
            String host = uri.getHost();
            String serverHost = Uri.parse(currentServerUrl).getHost();

            // Internal navigation stays inside the WebView
            if (host != null && host.equalsIgnoreCase(serverHost)) {
                return false;
            }

            // External URLs: load inside WebView through proxy or allow
            return false;
        }

        @Nullable
        @Override
        public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
            Uri uri = request.getUrl();
            String host = uri.getHost();
            String serverHost = Uri.parse(currentServerUrl).getHost();

            // If the request targets an external host (such as YouTube, googlevideo, external CDNs):
            // Intercept and route through Render's /api/proxy so device-level DNS blocks are completely bypassed!
            if (host != null && !host.equalsIgnoreCase(serverHost)) {
                try {
                    String targetUrl = uri.toString();
                    String password = prefs.getString("dashboard_password", "");
                    String proxyUrl = currentServerUrl + "/api/proxy?url=" + URLEncoder.encode(targetUrl, "UTF-8");

                    OkHttpClient client = new OkHttpClient();
                    Request.Builder builder = new Request.Builder()
                            .url(proxyUrl)
                            .addHeader("x-dashboard-password", password)
                            .addHeader("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");

                    Response response = client.newCall(builder.build()).execute();
                    if (response.isSuccessful() && response.body() != null) {
                        String rawContentType = response.header("Content-Type", "text/html");
                        String mimeType = "text/html";
                        String encoding = "UTF-8";
                        if (rawContentType != null) {
                            if (rawContentType.contains(";")) {
                                String[] parts = rawContentType.split(";");
                                mimeType = parts[0].trim();
                            } else {
                                mimeType = rawContentType.trim();
                            }
                        }

                        InputStream is = response.body().byteStream();
                        return new WebResourceResponse(mimeType, encoding, response.code(), "OK", Collections.emptyMap(), is);
                    }
                } catch (Exception ignored) {
                    // Fallback to normal resolution
                }
            }

            return super.shouldInterceptRequest(view, request);
        }
    }

    private class DashboardWebChromeClient extends WebChromeClient {
        @Override
        public void onProgressChanged(WebView view, int newProgress) {
            super.onProgressChanged(view, newProgress);
            progressBar.setProgress(newProgress);
            if (newProgress >= 100) {
                progressBar.setVisibility(View.GONE);
            }
        }

        @Override
        public boolean onShowFileChooser(WebView webView, ValueCallback<Uri[]> filePathCallback, FileChooserParams fileChooserParams) {
            if (fileChooserCallback != null) {
                fileChooserCallback.onReceiveValue(null);
            }
            fileChooserCallback = filePathCallback;

            Intent intent = fileChooserParams.createIntent();
            try {
                startActivityForResult(intent, FILE_CHOOSER_REQUEST_CODE);
            } catch (Exception e) {
                fileChooserCallback = null;
                Toast.makeText(DashboardActivity.this, "Cannot open file chooser", Toast.LENGTH_SHORT).show();
                return false;
            }
            return true;
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
            customViewContainer = new FrameLayout(DashboardActivity.this);
            customViewContainer.setBackgroundColor(0xFF000000);
            customViewContainer.addView(customView, new FrameLayout.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
            decor.addView(customViewContainer, new FrameLayout.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));

            webView.setVisibility(View.GONE);
        }

        @Override
        public void onHideCustomView() {
            hideCustomView();
        }
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
        webView.setVisibility(View.VISIBLE);
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, @Nullable Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == FILE_CHOOSER_REQUEST_CODE) {
            if (fileChooserCallback == null) return;
            Uri[] results = null;
            if (resultCode == Activity.RESULT_OK && data != null) {
                String dataString = data.getDataString();
                if (data.getClipData() != null) {
                    int count = data.getClipData().getItemCount();
                    results = new Uri[count];
                    for (int i = 0; i < count; i++) {
                        results[i] = data.getClipData().getItemAt(i).getUri();
                    }
                } else if (dataString != null) {
                    results = new Uri[]{Uri.parse(dataString)};
                }
            }
            fileChooserCallback.onReceiveValue(results);
            fileChooserCallback = null;
        }
    }

    @Override
    public boolean onCreateOptionsMenu(Menu menu) {
        menu.add(0, 1, 0, "Home").setIcon(android.R.drawable.ic_menu_today).setShowAsAction(MenuItem.SHOW_AS_ACTION_ALWAYS);
        menu.add(0, 2, 1, "FileHub").setShowAsAction(MenuItem.SHOW_AS_ACTION_ALWAYS);
        menu.add(0, 3, 2, "Uploads").setIcon(android.R.drawable.stat_sys_upload).setShowAsAction(MenuItem.SHOW_AS_ACTION_IF_ROOM);
        menu.add(0, 4, 3, "Reload").setIcon(android.R.drawable.ic_menu_rotate).setShowAsAction(MenuItem.SHOW_AS_ACTION_IF_ROOM);
        menu.add(0, 5, 4, "Settings").setIcon(android.R.drawable.ic_menu_preferences).setShowAsAction(MenuItem.SHOW_AS_ACTION_ALWAYS);
        return true;
    }

    @Override
    public boolean onOptionsItemSelected(MenuItem item) {
        switch (item.getItemId()) {
            case 1:
                if (webView != null) {
                    webView.loadUrl(currentServerUrl);
                }
                return true;
            case 2:
                // Open native FileHub explorer directly!
                startActivity(new Intent(this, MainActivity.class));
                return true;
            case 3:
                startActivity(new Intent(this, UploadQueueActivity.class));
                return true;
            case 4:
                if (webView != null) webView.reload();
                return true;
            case 5:
                startActivity(new Intent(this, SettingsActivity.class));
                return true;
        }
        return super.onOptionsItemSelected(item);
    }
}
