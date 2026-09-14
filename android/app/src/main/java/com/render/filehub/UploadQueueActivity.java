package com.render.filehub;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.os.Build;
import android.os.Bundle;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.ProgressBar;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;
import androidx.appcompat.widget.Toolbar;
import androidx.recyclerview.widget.LinearLayoutManager;
import androidx.recyclerview.widget.RecyclerView;

import java.util.List;

public class UploadQueueActivity extends AppCompatActivity {

    private RecyclerView recyclerView;
    private QueueAdapter adapter;

    private final BroadcastReceiver progressReceiver = new BroadcastReceiver() {
        @Override
        public void onReceive(Context context, Intent intent) {
            if (adapter != null) {
                adapter.notifyDataSetChanged();
            }
        }
    };

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_upload_queue);

        Toolbar toolbar = findViewById(R.id.toolbar);
        setSupportActionBar(toolbar);
        if (getSupportActionBar() != null) {
            getSupportActionBar().setTitle("Upload Queue");
            getSupportActionBar().setDisplayHomeAsUpEnabled(true);
        }

        recyclerView = findViewById(R.id.recycler_queue);
        recyclerView.setLayoutManager(new LinearLayoutManager(this));
        adapter = new QueueAdapter(UploadService.uploadQueue);
        recyclerView.setAdapter(adapter);
    }

    @Override
    protected void onResume() {
        super.onResume();
        IntentFilter filter = new IntentFilter(UploadService.ACTION_UPLOAD_PROGRESS);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            registerReceiver(progressReceiver, filter, Context.RECEIVER_NOT_EXPORTED);
        } else {
            registerReceiver(progressReceiver, filter);
        }
        if (adapter != null) adapter.notifyDataSetChanged();
    }

    @Override
    protected void onPause() {
        super.onPause();
        unregisterReceiver(progressReceiver);
    }

    @Override
    public boolean onSupportNavigateUp() {
        finish();
        return true;
    }

    private static class QueueAdapter extends RecyclerView.Adapter<QueueAdapter.ViewHolder> {
        private final List<UploadService.UploadTask> list;

        public QueueAdapter(List<UploadService.UploadTask> list) {
            this.list = list;
        }

        @NonNull
        @Override
        public ViewHolder onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
            View v = LayoutInflater.from(parent.getContext()).inflate(R.layout.item_upload, parent, false);
            return new ViewHolder(v);
        }

        @Override
        public void onBindViewHolder(@NonNull ViewHolder holder, int position) {
            UploadService.UploadTask task;
            synchronized (list) {
                if (position >= list.size()) return;
                task = list.get(position);
            }

            holder.tvFilename.setText(task.filename);
            holder.tvStatus.setText(task.status + ("Uploading".equals(task.status) ? " (" + task.progress + "%)" : ""));
            holder.progressBar.setProgress(task.progress);

            if ("Error".equals(task.status)) {
                holder.tvError.setVisibility(View.VISIBLE);
                holder.tvError.setText(task.errorMessage != null ? task.errorMessage : "Upload failed");
                holder.tvStatus.setTextColor(0xFFEF4444); // red
            } else if ("Completed".equals(task.status)) {
                holder.tvError.setVisibility(View.GONE);
                holder.tvStatus.setTextColor(0xFF10B981); // emerald
            } else {
                holder.tvError.setVisibility(View.GONE);
                holder.tvStatus.setTextColor(0xFF8B5CF6); // purple
            }
        }

        @Override
        public int getItemCount() {
            synchronized (list) {
                return list.size();
            }
        }

        static class ViewHolder extends RecyclerView.ViewHolder {
            TextView tvFilename;
            TextView tvStatus;
            TextView tvError;
            ProgressBar progressBar;

            public ViewHolder(@NonNull View itemView) {
                super(itemView);
                tvFilename = itemView.findViewById(R.id.tv_upload_filename);
                tvStatus = itemView.findViewById(R.id.tv_upload_status);
                tvError = itemView.findViewById(R.id.tv_upload_error);
                progressBar = itemView.findViewById(R.id.progress_upload);
            }
        }
    }
}
