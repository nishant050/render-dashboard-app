package com.render.filehub;

import android.app.Activity;
import android.app.AlertDialog;
import android.app.ProgressDialog;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.widget.Toast;

import androidx.core.content.FileProvider;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.concurrent.TimeUnit;

import okhttp3.Call;
import okhttp3.Callback;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.Response;

public class AppUpdater {

    private static final String GITHUB_RELEASE_API =
            "https://api.github.com/repos/nishant050/render-dashboard-app/releases/latest";

    private static final OkHttpClient client = new OkHttpClient.Builder()
            .connectTimeout(15, TimeUnit.SECONDS)
            .readTimeout(60, TimeUnit.SECONDS)
            .build();

    private static final Handler mainHandler = new Handler(Looper.getMainLooper());

    public static void checkForUpdates(Activity activity, boolean showFeedbackIfUpToDate) {
        if (activity == null || activity.isFinishing()) return;

        if (showFeedbackIfUpToDate) {
            Toast.makeText(activity, "Checking for latest update...", Toast.LENGTH_SHORT).show();
        }

        Request request = new Request.Builder()
                .url(GITHUB_RELEASE_API)
                .header("User-Agent", "RenderApps-Android-Updater")
                .get()
                .build();

        client.newCall(request).enqueue(new Callback() {
            @Override
            public void onFailure(Call call, IOException e) {
                if (showFeedbackIfUpToDate) {
                    mainHandler.post(() -> {
                        if (!activity.isFinishing()) {
                            Toast.makeText(activity, "Failed to check for updates: " + e.getMessage(), Toast.LENGTH_LONG).show();
                        }
                    });
                }
            }

            @Override
            public void onResponse(Call call, Response response) throws IOException {
                if (!response.isSuccessful()) {
                    if (showFeedbackIfUpToDate) {
                        mainHandler.post(() -> {
                            if (!activity.isFinishing()) {
                                Toast.makeText(activity, "Server returned HTTP " + response.code(), Toast.LENGTH_SHORT).show();
                            }
                        });
                    }
                    return;
                }

                String body = response.body() != null ? response.body().string() : "";
                try {
                    JSONObject release = new JSONObject(body);
                    String tagName = release.optString("tag_name", "");
                    String releaseName = release.optString("name", "New Update");
                    String notes = release.optString("body", "");
                    String publishedAt = release.optString("published_at", "");

                    JSONArray assets = release.optJSONArray("assets");
                    String downloadUrl = null;
                    if (assets != null) {
                        for (int i = 0; i < assets.length(); i++) {
                            JSONObject asset = assets.getJSONObject(i);
                            String name = asset.optString("name", "");
                            if (name.endsWith(".apk")) {
                                downloadUrl = asset.optString("browser_download_url", null);
                                // Prefer current flavor APK if matching, otherwise any apk
                                if (name.toLowerCase().contains("filehub") || name.toLowerCase().contains("render")) {
                                    break;
                                }
                            }
                        }
                    }

                    if (downloadUrl == null) {
                        if (showFeedbackIfUpToDate) {
                            mainHandler.post(() -> Toast.makeText(activity, "No APK asset found in latest release.", Toast.LENGTH_SHORT).show());
                        }
                        return;
                    }

                    SharedPreferences prefs = activity.getSharedPreferences("filehub_prefs", Context.MODE_PRIVATE);
                    String lastInstalledTag = prefs.getString("installed_release_tag", "");
                    String dismissedTag = prefs.getString("dismissed_release_tag", "");

                    String currentVersion = "";
                    try {
                        currentVersion = activity.getPackageManager().getPackageInfo(activity.getPackageName(), 0).versionName;
                    } catch (Exception ignored) {}

                    String remoteVersion = extractSemanticVersion(releaseName);
                    if (remoteVersion.isEmpty()) {
                        remoteVersion = extractSemanticVersion(tagName);
                    }
                    String localSemantic = extractSemanticVersion(currentVersion);
                    if (localSemantic.isEmpty()) localSemantic = currentVersion;

                    boolean isNewer = false;
                    if (!remoteVersion.isEmpty() && !localSemantic.isEmpty()) {
                        isNewer = compareVersionStrings(remoteVersion, localSemantic) > 0;
                    } else {
                        String cleanTag = tagName.replaceAll("^[vV]", "").trim();
                        String cleanCurrent = currentVersion.replaceAll("^[vV]", "").trim();
                        isNewer = !cleanCurrent.isEmpty() && !cleanCurrent.equalsIgnoreCase(cleanTag)
                                && !lastInstalledTag.equalsIgnoreCase(tagName);
                    }

                    if (!isNewer) {
                        if (showFeedbackIfUpToDate) {
                            final String displayVer = !localSemantic.isEmpty() ? localSemantic : currentVersion;
                            mainHandler.post(() -> {
                                if (!activity.isFinishing()) {
                                    Toast.makeText(activity, "App is up to date (v" + displayVer + ")", Toast.LENGTH_SHORT).show();
                                }
                            });
                        }
                        return;
                    }

                    // If it's an automatic background check and user previously dismissed this exact version, don't nag
                    if (!showFeedbackIfUpToDate && tagName.equals(dismissedTag)) {
                        return;
                    }

                    final String finalDownloadUrl = downloadUrl;
                    final String finalNotes = notes;

                    mainHandler.post(() -> {
                        if (activity.isFinishing()) return;

                        new AlertDialog.Builder(activity)
                                .setTitle("App Update Available (" + tagName + ")")
                                .setMessage(releaseName + "\n\n" + (finalNotes.isEmpty() ? "Latest stability fixes and updates." : finalNotes))
                                .setPositiveButton("Download & Update", (dialog, which) -> {
                                    downloadAndInstallApk(activity, finalDownloadUrl, tagName);
                                })
                                .setNegativeButton("Later", (dialog, which) -> {
                                    prefs.edit().putString("dismissed_release_tag", tagName).apply();
                                })
                                .show();
                    });

                } catch (Exception e) {
                    if (showFeedbackIfUpToDate) {
                        mainHandler.post(() -> Toast.makeText(activity, "Error parsing update info: " + e.getMessage(), Toast.LENGTH_SHORT).show());
                    }
                }
            }
        });
    }

    private static void downloadAndInstallApk(Activity activity, String downloadUrl, String tagName) {
        ProgressDialog progressDialog = new ProgressDialog(activity);
        progressDialog.setTitle("Downloading Update");
        progressDialog.setMessage("Please wait...");
        progressDialog.setProgressStyle(ProgressDialog.STYLE_HORIZONTAL);
        progressDialog.setMax(100);
        progressDialog.setCancelable(false);
        progressDialog.show();

        Request request = new Request.Builder()
                .url(downloadUrl)
                .header("User-Agent", "RenderApps-Android-Updater")
                .get()
                .build();

        client.newCall(request).enqueue(new Callback() {
            @Override
            public void onFailure(Call call, IOException e) {
                mainHandler.post(() -> {
                    progressDialog.dismiss();
                    Toast.makeText(activity, "Download failed: " + e.getMessage(), Toast.LENGTH_LONG).show();
                });
            }

            @Override
            public void onResponse(Call call, Response response) throws IOException {
                if (!response.isSuccessful()) {
                    mainHandler.post(() -> {
                        progressDialog.dismiss();
                        Toast.makeText(activity, "Download server error HTTP " + response.code(), Toast.LENGTH_SHORT).show();
                    });
                    return;
                }

                long totalBytes = response.body() != null ? response.body().contentLength() : -1;
                File apkFile = new File(activity.getCacheDir(), "latest_app_update.apk");
                if (apkFile.exists()) apkFile.delete();

                try (InputStream is = response.body().byteStream();
                     FileOutputStream fos = new FileOutputStream(apkFile)) {

                    byte[] buffer = new byte[8192];
                    long bytesReadSoFar = 0;
                    int read;

                    while ((read = is.read(buffer)) != -1) {
                        fos.write(buffer, 0, read);
                        bytesReadSoFar += read;

                        if (totalBytes > 0) {
                            final int progress = (int) ((bytesReadSoFar * 100) / totalBytes);
                            mainHandler.post(() -> progressDialog.setProgress(progress));
                        }
                    }
                    fos.flush();

                    // Save tag so we know this version was installed
                    SharedPreferences prefs = activity.getSharedPreferences("filehub_prefs", Context.MODE_PRIVATE);
                    prefs.edit().putString("installed_release_tag", tagName).apply();

                    mainHandler.post(() -> {
                        progressDialog.dismiss();
                        launchApkInstaller(activity, apkFile);
                    });

                } catch (Exception e) {
                    mainHandler.post(() -> {
                        progressDialog.dismiss();
                        Toast.makeText(activity, "Failed saving update: " + e.getMessage(), Toast.LENGTH_LONG).show();
                    });
                }
            }
        });
    }

    private static void launchApkInstaller(Activity activity, File apkFile) {
        if (!apkFile.exists()) {
            Toast.makeText(activity, "Update APK not found", Toast.LENGTH_SHORT).show();
            return;
        }

        try {
            Uri apkUri;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                apkUri = FileProvider.getUriForFile(
                        activity,
                        activity.getPackageName() + ".fileprovider",
                        apkFile
                );
            } else {
                apkUri = Uri.fromFile(apkFile);
            }

            Intent intent = new Intent(Intent.ACTION_VIEW);
            intent.setDataAndType(apkUri, "application/vnd.android.package-archive");
            intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);

            activity.startActivity(intent);
        } catch (Exception e) {
            Toast.makeText(activity, "Failed to launch installer: " + e.getMessage(), Toast.LENGTH_LONG).show();
        }
    }

    private static String extractSemanticVersion(String text) {
        if (text == null) return "";
        java.util.regex.Matcher m = java.util.regex.Pattern.compile("[vV]?(\\d+\\.\\d+(?:\\.\\d+)?)").matcher(text);
        if (m.find()) {
            return m.group(1);
        }
        return "";
    }

    private static int compareVersionStrings(String v1, String v2) {
        String[] parts1 = v1.split("\\.");
        String[] parts2 = v2.split("\\.");
        int len = Math.max(parts1.length, parts2.length);
        for (int i = 0; i < len; i++) {
            int p1 = (i < parts1.length) ? parseSafeInt(parts1[i]) : 0;
            int p2 = (i < parts2.length) ? parseSafeInt(parts2[i]) : 0;
            if (p1 != p2) {
                return Integer.compare(p1, p2);
            }
        }
        return 0;
    }

    private static int parseSafeInt(String s) {
        try {
            return Integer.parseInt(s.replaceAll("[^0-9]", ""));
        } catch (Exception e) {
            return 0;
        }
    }
}
