package com.render.filehub;

public class FileItem {
    private String name;
    private boolean isDirectory;
    private long size;

    public FileItem(String name, boolean isDirectory) {
        this.name = name;
        this.isDirectory = isDirectory;
        this.size = 0;
    }

    public FileItem(String name, boolean isDirectory, long size) {
        this.name = name;
        this.isDirectory = isDirectory;
        this.size = size;
    }

    public String getName() {
        return name != null ? name : "";
    }

    public boolean isDirectory() {
        return isDirectory;
    }

    public long getSize() {
        return size;
    }

    public String getIcon() {
        if (isDirectory) return "📁";
        String lower = getName().toLowerCase();
        if (lower.endsWith(".jpg") || lower.endsWith(".jpeg") || lower.endsWith(".png") || lower.endsWith(".webp") || lower.endsWith(".gif")) {
            return "🖼️";
        } else if (lower.endsWith(".mp4") || lower.endsWith(".mkv") || lower.endsWith(".webm") || lower.endsWith(".mov")) {
            return "🎬";
        } else if (lower.endsWith(".mp3") || lower.endsWith(".wav") || lower.endsWith(".m4a") || lower.endsWith(".flac")) {
            return "🎵";
        } else if (lower.endsWith(".pdf")) {
            return "📕";
        } else if (lower.endsWith(".zip") || lower.endsWith(".tar") || lower.endsWith(".gz") || lower.endsWith(".rar") || lower.endsWith(".7z")) {
            return "📦";
        } else if (lower.endsWith(".html") || lower.endsWith(".js") || lower.endsWith(".json") || lower.endsWith(".css") || lower.endsWith(".py")) {
            return "💻";
        } else if (lower.endsWith(".txt") || lower.endsWith(".md") || lower.endsWith(".csv")) {
            return "📝";
        } else if (lower.endsWith(".apk")) {
            return "📱";
        }
        return "📄";
    }

    public String getDetails(String currentPath) {
        if (isDirectory) {
            return "Folder";
        }
        if (size > 0) {
            return formatSize(size);
        }
        return "File";
    }

    private String formatSize(long bytes) {
        if (bytes < 1024) return bytes + " B";
        int exp = (int) (Math.log(bytes) / Math.log(1024));
        String pre = "KMGTPE".charAt(exp - 1) + "";
        return String.format("%.1f %sB", bytes / Math.pow(1024, exp), pre);
    }
}
