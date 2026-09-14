package com.render.filehub;

import android.os.Handler;
import android.os.Looper;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.TimeUnit;

import okhttp3.Call;
import okhttp3.Callback;
import okhttp3.MediaType;
import okhttp3.MultipartBody;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.RequestBody;
import okhttp3.Response;
import okio.BufferedSink;
import okio.Okio;
import okio.Source;

public class ApiClient {

    private static ApiClient instance;
    private final OkHttpClient client;
    private final Handler mainHandler;

    public interface ApiCallback<T> {
        void onSuccess(T result);
        void onError(String errorMessage);
    }

    public interface ProgressListener {
        void onProgress(int percent);
    }

    private ApiClient() {
        client = new OkHttpClient.Builder()
                .connectTimeout(30, TimeUnit.SECONDS)
                .readTimeout(60, TimeUnit.SECONDS)
                .writeTimeout(120, TimeUnit.SECONDS)
                .build();
        mainHandler = new Handler(Looper.getMainLooper());
    }

    public static synchronized ApiClient getInstance() {
        if (instance == null) {
            instance = new ApiClient();
        }
        return instance;
    }

    private String cleanBaseUrl(String url) {
        if (url == null || url.trim().isEmpty()) {
            return "https://dashboard-mszb.onrender.com";
        }
        String clean = url.trim();
        while (clean.endsWith("/")) {
            clean = clean.substring(0, clean.length() - 1);
        }
        return clean;
    }

    public void testConnection(String serverUrl, String password, ApiCallback<String> callback) {
        String base = cleanBaseUrl(serverUrl);
        Request request = new Request.Builder()
                .url(base + "/api/auth/status")
                .addHeader("x-dashboard-password", password != null ? password : "")
                .get()
                .build();

        client.newCall(request).enqueue(new Callback() {
            @Override
            public void onFailure(Call call, IOException e) {
                mainHandler.post(() -> callback.onError("Network error: " + e.getMessage()));
            }

            @Override
            public void onResponse(Call call, Response response) throws IOException {
                String body = response.body() != null ? response.body().string() : "";
                if (response.isSuccessful()) {
                    try {
                        JSONObject json = new JSONObject(body);
                        boolean auth = json.optBoolean("authenticated", false);
                        if (auth) {
                            mainHandler.post(() -> callback.onSuccess("Connected & Authenticated successfully!"));
                        } else {
                            mainHandler.post(() -> callback.onError("Server reachable, but master password was rejected."));
                        }
                    } catch (Exception e) {
                        mainHandler.post(() -> callback.onSuccess("Server reached: " + response.code()));
                    }
                } else if (response.code() == 401) {
                    mainHandler.post(() -> callback.onError("Incorrect master password. Check app settings."));
                } else {
                    mainHandler.post(() -> callback.onError("Server returned error: HTTP " + response.code()));
                }
            }
        });
    }

    public void fetchFiles(String serverUrl, String password, String path, ApiCallback<List<FileItem>> callback) {
        String base = cleanBaseUrl(serverUrl);
        String url = base + "/api/files?path=" + (path != null ? android.net.Uri.encode(path) : "");

        Request request = new Request.Builder()
                .url(url)
                .addHeader("x-dashboard-password", password != null ? password : "")
                .get()
                .build();

        client.newCall(request).enqueue(new Callback() {
            @Override
            public void onFailure(Call call, IOException e) {
                mainHandler.post(() -> callback.onError("Failed to load files: " + e.getMessage()));
            }

            @Override
            public void onResponse(Call call, Response response) throws IOException {
                if (!response.isSuccessful()) {
                    if (response.code() == 401) {
                        mainHandler.post(() -> callback.onError("Unauthorized. Check dashboard password in settings."));
                    } else {
                        mainHandler.post(() -> callback.onError("Server error HTTP " + response.code()));
                    }
                    return;
                }

                String body = response.body() != null ? response.body().string() : "";
                try {
                    JSONArray arr = new JSONArray(body);
                    List<FileItem> items = new ArrayList<>();
                    for (int i = 0; i < arr.length(); i++) {
                        JSONObject obj = arr.getJSONObject(i);
                        String name = obj.optString("name", "");
                        boolean isDir = obj.optBoolean("isDirectory", false);
                        long size = obj.optLong("size", 0);
                        items.add(new FileItem(name, isDir, size));
                    }
                    mainHandler.post(() -> callback.onSuccess(items));
                } catch (Exception e) {
                    mainHandler.post(() -> callback.onError("Error parsing files list: " + e.getMessage()));
                }
            }
        });
    }

    public void getShareLink(String serverUrl, String password, String path, ApiCallback<String> callback) {
        String base = cleanBaseUrl(serverUrl);
        String url = base + "/api/share-link?path=" + android.net.Uri.encode(path);

        Request request = new Request.Builder()
                .url(url)
                .addHeader("x-dashboard-password", password != null ? password : "")
                .get()
                .build();

        client.newCall(request).enqueue(new Callback() {
            @Override
            public void onFailure(Call call, IOException e) {
                mainHandler.post(() -> callback.onError("Failed to generate link: " + e.getMessage()));
            }

            @Override
            public void onResponse(Call call, Response response) throws IOException {
                String body = response.body() != null ? response.body().string() : "";
                if (response.isSuccessful()) {
                    try {
                        JSONObject json = new JSONObject(body);
                        String shareUrl = json.optString("shareUrl", "");
                        mainHandler.post(() -> callback.onSuccess(shareUrl));
                    } catch (Exception e) {
                        mainHandler.post(() -> callback.onError("Invalid server response"));
                    }
                } else {
                    mainHandler.post(() -> callback.onError("Server error HTTP " + response.code()));
                }
            }
        });
    }

    public void deleteItem(String serverUrl, String password, String path, String name, ApiCallback<String> callback) {
        String base = cleanBaseUrl(serverUrl);
        JSONObject bodyJson = new JSONObject();
        try {
            bodyJson.put("path", path != null ? path : "");
            bodyJson.put("name", name);
        } catch (Exception ignored) {}

        RequestBody body = RequestBody.create(
                bodyJson.toString(),
                MediaType.parse("application/json; charset=utf-8")
        );

        Request request = new Request.Builder()
                .url(base + "/api/delete")
                .addHeader("x-dashboard-password", password != null ? password : "")
                .delete(body)
                .build();

        client.newCall(request).enqueue(new Callback() {
            @Override
            public void onFailure(Call call, IOException e) {
                mainHandler.post(() -> callback.onError("Delete failed: " + e.getMessage()));
            }

            @Override
            public void onResponse(Call call, Response response) {
                if (response.isSuccessful()) {
                    mainHandler.post(() -> callback.onSuccess("Deleted successfully"));
                } else {
                    mainHandler.post(() -> callback.onError("Delete error HTTP " + response.code()));
                }
            }
        });
    }

    public Response uploadFile(
            String serverUrl,
            String password,
            String targetPath,
            String filename,
            InputStream inputStream,
            long fileSize,
            String mimeType,
            ProgressListener progressListener
    ) throws IOException {
        String base = cleanBaseUrl(serverUrl);
        MediaType mediaType = MediaType.parse(mimeType != null ? mimeType : "application/octet-stream");

        RequestBody fileBody = new RequestBody() {
            @Override
            public MediaType contentType() {
                return mediaType;
            }

            @Override
            public long contentLength() {
                return fileSize > 0 ? fileSize : -1;
            }

            @Override
            public void writeTo(BufferedSink sink) throws IOException {
                Source source = Okio.source(inputStream);
                long totalBytesRead = 0;
                long read;
                byte[] buffer = new byte[8192];
                while ((read = inputStream.read(buffer)) != -1) {
                    sink.write(buffer, 0, (int) read);
                    totalBytesRead += read;
                    if (fileSize > 0 && progressListener != null) {
                        int percent = (int) ((totalBytesRead * 100) / fileSize);
                        progressListener.onProgress(percent);
                    }
                }
            }
        };

        MultipartBody multipartBody = new MultipartBody.Builder()
                .setType(MultipartBody.FORM)
                .addFormDataPart("path", targetPath != null ? targetPath : "")
                .addFormDataPart("file", filename, fileBody)
                .build();

        Request request = new Request.Builder()
                .url(base + "/api/upload")
                .addHeader("x-dashboard-password", password != null ? password : "")
                .post(multipartBody)
                .build();

        return client.newCall(request).execute();
    }
}
