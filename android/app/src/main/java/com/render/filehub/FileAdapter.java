package com.render.filehub;

import android.app.AlertDialog;
import android.app.DownloadManager;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.net.Uri;
import android.os.Environment;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.ImageButton;
import android.widget.PopupMenu;
import android.widget.TextView;
import android.widget.Toast;

import androidx.annotation.NonNull;
import androidx.recyclerview.widget.RecyclerView;

import java.util.ArrayList;
import java.util.List;

public class FileAdapter extends RecyclerView.Adapter<FileAdapter.ViewHolder> {

    public interface OnItemClickListener {
        void onItemClick(FileItem item);
        void onFileDeleted();
    }

    private final Context context;
    private final String serverUrl;
    private final String password;
    private final String currentPath;
    private List<FileItem> items = new ArrayList<>();
    private final OnItemClickListener listener;

    public FileAdapter(Context context, String serverUrl, String password, String currentPath, OnItemClickListener listener) {
        this.context = context;
        this.serverUrl = serverUrl;
        this.password = password;
        this.currentPath = currentPath;
        this.listener = listener;
    }

    public void setItems(List<FileItem> newItems) {
        this.items = newItems != null ? newItems : new ArrayList<>();
        notifyDataSetChanged();
    }

    @NonNull
    @Override
    public ViewHolder onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
        View v = LayoutInflater.from(parent.getContext()).inflate(R.layout.item_file, parent, false);
        return new ViewHolder(v);
    }

    @Override
    public void onBindViewHolder(@NonNull ViewHolder holder, int position) {
        FileItem item = items.get(position);
        holder.tvIcon.setText(item.getIcon());
        holder.tvName.setText(item.getName());
        holder.tvDetails.setText(item.getDetails(currentPath));

        holder.itemView.setOnClickListener(v -> {
            if (listener != null) listener.onItemClick(item);
        });

        holder.btnMenu.setOnClickListener(v -> showItemMenu(v, item));
    }

    private void showItemMenu(View anchor, FileItem item) {
        PopupMenu popup = new PopupMenu(context, anchor);

        if (!item.isDirectory()) {
            popup.getMenu().add(0, 1, 0, "🔗 Copy Direct Link");
            popup.getMenu().add(0, 2, 1, "⬇️ Download to Device");
        }
        popup.getMenu().add(0, 3, 2, "🗑️ Delete");

        popup.setOnMenuItemClickListener(menuItem -> {
            int id = menuItem.getItemId();
            String fullPath = (currentPath == null || currentPath.isEmpty())
                    ? item.getName()
                    : currentPath + "/" + item.getName();

            if (id == 1) {
                // Copy Direct Share Link (signed)
                ApiClient.getInstance().getShareLink(serverUrl, password, fullPath, new ApiClient.ApiCallback<String>() {
                    @Override
                    public void onSuccess(String shareUrl) {
                        ClipboardManager clipboard = (ClipboardManager) context.getSystemService(Context.CLIPBOARD_SERVICE);
                        ClipData clip = ClipData.newPlainText("FileHub Direct Link", shareUrl);
                        clipboard.setPrimaryClip(clip);
                        Toast.makeText(context, "Direct link copied! (No password needed for recipient)", Toast.LENGTH_LONG).show();
                    }

                    @Override
                    public void onError(String errorMessage) {
                        Toast.makeText(context, "Error: " + errorMessage, Toast.LENGTH_SHORT).show();
                    }
                });
                return true;
            } else if (id == 2) {
                // Download file
                downloadFile(item, fullPath);
                return true;
            } else if (id == 3) {
                // Delete file
                confirmDelete(item, fullPath);
                return true;
            }
            return false;
        });

        popup.show();
    }

    private void downloadFile(FileItem item, String fullPath) {
        ApiClient.getInstance().getShareLink(serverUrl, password, fullPath, new ApiClient.ApiCallback<String>() {
            @Override
            public void onSuccess(String shareUrl) {
                try {
                    DownloadManager dm = (DownloadManager) context.getSystemService(Context.DOWNLOAD_SERVICE);
                    DownloadManager.Request req = new DownloadManager.Request(Uri.parse(shareUrl))
                            .setTitle(item.getName())
                            .setDescription("Downloading from FileHub")
                            .setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
                            .setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, item.getName());
                    dm.enqueue(req);
                    Toast.makeText(context, "Download started...", Toast.LENGTH_SHORT).show();
                } catch (Exception e) {
                    Toast.makeText(context, "Download failed: " + e.getMessage(), Toast.LENGTH_SHORT).show();
                }
            }

            @Override
            public void onError(String errorMessage) {
                Toast.makeText(context, "Download error: " + errorMessage, Toast.LENGTH_SHORT).show();
            }
        });
    }

    private void confirmDelete(FileItem item, String fullPath) {
        new AlertDialog.Builder(context)
                .setTitle("Delete " + (item.isDirectory() ? "Folder" : "File"))
                .setMessage("Are you sure you want to delete '" + item.getName() + "'?")
                .setPositiveButton("Delete", (dialog, which) -> {
                    ApiClient.getInstance().deleteItem(serverUrl, password, currentPath, item.getName(), new ApiClient.ApiCallback<String>() {
                        @Override
                        public void onSuccess(String result) {
                            Toast.makeText(context, "Deleted '" + item.getName() + "'", Toast.LENGTH_SHORT).show();
                            if (listener != null) listener.onFileDeleted();
                        }

                        @Override
                        public void onError(String errorMessage) {
                            Toast.makeText(context, "Delete failed: " + errorMessage, Toast.LENGTH_SHORT).show();
                        }
                    });
                })
                .setNegativeButton("Cancel", null)
                .show();
    }

    @Override
    public int getItemCount() {
        return items.size();
    }

    static class ViewHolder extends RecyclerView.ViewHolder {
        TextView tvIcon, tvName, tvDetails;
        ImageButton btnMenu;

        public ViewHolder(@NonNull View itemView) {
            super(itemView);
            tvIcon = itemView.findViewById(R.id.tv_icon);
            tvName = itemView.findViewById(R.id.tv_name);
            tvDetails = itemView.findViewById(R.id.tv_details);
            btnMenu = itemView.findViewById(R.id.btn_menu);
        }
    }
}
