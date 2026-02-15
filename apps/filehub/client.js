document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const fileExplorer = document.getElementById('file-explorer');
    const breadcrumb = document.getElementById('breadcrumb');
    const uploadBtn = document.getElementById('upload-btn');
    const fileInput = document.getElementById('file-input');
    const newFolderBtn = document.getElementById('new-folder-btn');
    const newFileBtn = document.getElementById('new-file-btn');
    const clearAllBtn = document.getElementById('clear-all-btn');
    const modal = document.getElementById('modal');
    const modalTitle = document.getElementById('modal-title');
    const modalInput = document.getElementById('modal-input');
    const modalCancelBtn = document.getElementById('modal-cancel-btn');
    const modalConfirmBtn = document.getElementById('modal-confirm-btn');
    const textEditorModal = document.getElementById('text-editor-modal');
    const textEditorFilename = document.getElementById('text-editor-filename');
    const textEditorContent = document.getElementById('text-editor-content');
    const textEditorCancelBtn = document.getElementById('text-editor-cancel-btn');
    const textEditorSaveBtn = document.getElementById('text-editor-save-btn');
    const previewModal = document.getElementById('preview-modal');
    const previewBody = document.getElementById('preview-body');
    const previewCloseBtn = document.getElementById('preview-close-btn');
    const uploadProgressPanel = document.getElementById('upload-progress-panel');
    const uploadQueue = document.getElementById('upload-queue');
    const closeUploadPanelBtn = document.getElementById('close-upload-panel');
    const storageUsed = document.getElementById('storage-used');

    // --- State ---
    let currentPath = '';
    let modalConfirmAction = null;
    let draggedItem = null;

    // --- File Type Icons Mapping ---
    const getFileTypeIcon = (filename) => {
        const ext = filename.split('.').pop().toLowerCase();
        const iconMap = {
            // Images
            'jpg': 'fa-image',
            'jpeg': 'fa-image',
            'png': 'fa-image',
            'gif': 'fa-image',
            'webp': 'fa-image',
            'svg': 'fa-image',
            'bmp': 'fa-image',
            // Videos
            'mp4': 'fa-video',
            'webm': 'fa-video',
            'avi': 'fa-video',
            'mov': 'fa-video',
            'mkv': 'fa-video',
            // Audio
            'mp3': 'fa-music',
            'wav': 'fa-music',
            'ogg': 'fa-music',
            'flac': 'fa-music',
            'aac': 'fa-music',
            // Documents
            'pdf': 'fa-file-pdf',
            'doc': 'fa-file-word',
            'docx': 'fa-file-word',
            'xls': 'fa-file-excel',
            'xlsx': 'fa-file-excel',
            'ppt': 'fa-file-powerpoint',
            'pptx': 'fa-file-powerpoint',
            'txt': 'fa-file-lines',
            'rtf': 'fa-file-lines',
            // Code
            'html': 'fa-code',
            'css': 'fa-code',
            'js': 'fa-code',
            'json': 'fa-code',
            'xml': 'fa-code',
            'py': 'fa-code',
            'java': 'fa-code',
            'cpp': 'fa-code',
            'c': 'fa-code',
            'php': 'fa-code',
            'rb': 'fa-code',
            'go': 'fa-code',
            'rs': 'fa-code',
            // Archives
            'zip': 'fa-file-zipper',
            'rar': 'fa-file-zipper',
            '7z': 'fa-file-zipper',
            'tar': 'fa-file-zipper',
            'gz': 'fa-file-zipper',
        };
        return iconMap[ext] || 'fa-file';
    };

    const getFileTypeClass = (filename) => {
        const ext = filename.split('.').pop().toLowerCase();
        const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'];
        const videoExts = ['mp4', 'webm', 'avi', 'mov', 'mkv'];
        const audioExts = ['mp3', 'wav', 'ogg', 'flac', 'aac'];
        const docExts = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'rtf'];
        const codeExts = ['html', 'css', 'js', 'json', 'xml', 'py', 'java', 'cpp', 'c', 'php', 'rb', 'go', 'rs'];
        const archiveExts = ['zip', 'rar', '7z', 'tar', 'gz'];

        if (imageExts.includes(ext)) return 'file-image';
        if (videoExts.includes(ext)) return 'file-video';
        if (audioExts.includes(ext)) return 'file-audio';
        if (docExts.includes(ext)) return 'file-document';
        if (codeExts.includes(ext)) return 'file-code';
        if (archiveExts.includes(ext)) return 'file-archive';
        return 'file-default';
    };

    const getFileIconColor = (filename) => {
        const ext = filename.split('.').pop().toLowerCase();
        const colorMap = {
            'jpg': 'linear-gradient(135deg, #10b981, #059669)',
            'jpeg': 'linear-gradient(135deg, #10b981, #059669)',
            'png': 'linear-gradient(135deg, #10b981, #059669)',
            'gif': 'linear-gradient(135deg, #10b981, #059669)',
            'webp': 'linear-gradient(135deg, #10b981, #059669)',
            'svg': 'linear-gradient(135deg, #10b981, #059669)',
            'mp4': 'linear-gradient(135deg, #ef4444, #dc2626)',
            'webm': 'linear-gradient(135deg, #ef4444, #dc2626)',
            'mp3': 'linear-gradient(135deg, #8b5cf6, #7c3aed)',
            'wav': 'linear-gradient(135deg, #8b5cf6, #7c3aed)',
            'pdf': 'linear-gradient(135deg, #ef4444, #dc2626)',
            'doc': 'linear-gradient(135deg, #3b82f6, #2563eb)',
            'docx': 'linear-gradient(135deg, #3b82f6, #2563eb)',
            'zip': 'linear-gradient(135deg, #6366f1, #4f46e5)',
            'rar': 'linear-gradient(135deg, #6366f1, #4f46e5)',
        };
        return colorMap[ext] || 'linear-gradient(135deg, #64748b, #475569)';
    };

    // --- Utility Functions ---
    const formatFileSize = (bytes) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    const pathJoin = (...parts) => parts.filter(p => p).join('/');

    // --- API Helper ---
    const apiCall = async (endpoint, method = 'GET', body = null) => {
        const options = { method };
        if (body) {
            if (body instanceof FormData) {
                options.body = body;
            } else {
                options.headers = { 'Content-Type': 'application/json' };
                options.body = JSON.stringify(body);
            }
        }
        const response = await fetch(endpoint, options);
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(errorText || 'API call failed');
        }
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.indexOf("application/json") !== -1) {
            return response.json();
        }
        return {};
    };

    // --- Render Breadcrumb ---
    const renderBreadcrumb = () => {
        breadcrumb.innerHTML = '';
        const parts = currentPath.split('/').filter(p => p);
        let path = '';

        const createBreadcrumbLink = (text, linkPath) => {
            const link = document.createElement('a');
            link.href = '#';
            link.textContent = text;
            link.onclick = (e) => { e.preventDefault(); navigateTo(linkPath); };

            link.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (draggedItem) {
                    link.style.backgroundColor = 'rgba(99, 102, 241, 0.2)';
                }
            });
            link.addEventListener('dragleave', (e) => {
                e.stopPropagation();
                link.style.backgroundColor = '';
            });
            link.addEventListener('drop', async (e) => {
                e.preventDefault();
                e.stopPropagation();
                link.style.backgroundColor = '';
                if (draggedItem) {
                    const sourcePath = pathJoin(currentPath, draggedItem.dataset.name);
                    const targetPath = pathJoin(linkPath, draggedItem.dataset.name);

                    if (pathJoin(currentPath) === linkPath) return;

                    try {
                        await apiCall('/api/move', 'PUT', { sourcePath, targetPath });
                        renderFiles();
                    } catch (error) {
                        alert(`Error moving file: ${error.message}`);
                    }
                }
            });
            return link;
        };

        breadcrumb.appendChild(createBreadcrumbLink('<i class="fas fa-home"></i> Root', ''));

        parts.forEach(part => {
            path += `${part}/`;
            const currentPartPath = path.slice(0, -1);
            const separator = document.createElement('span');
            separator.textContent = ' / ';
            breadcrumb.appendChild(separator);
            breadcrumb.appendChild(createBreadcrumbLink(part, currentPartPath));
        });
    };

    // --- Get File Icon (for preview) ---
    const getFileIcon = (filename, isDirectory = false) => {
        if (isDirectory) {
            return '<i class="fas fa-folder"></i>';
        }
        
        const ext = filename.split('.').pop().toLowerCase();
        const filePath = `/uploads/${pathJoin(currentPath, filename)}`;
        
        if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) {
            return `<img src="${filePath}" alt="${filename}" loading="lazy" draggable="false">`;
        }
        if (['mp4', 'webm'].includes(ext)) {
            return `<video src="${filePath}#t=0.1" preload="metadata" draggable="false"></video>`;
        }
        return `<i class="fas ${getFileTypeIcon(filename)}"></i>`;
    };

    // --- Render Files ---
    const renderFiles = async () => {
        try {
            const items = await apiCall(`/api/files?path=${encodeURIComponent(currentPath)}`);
            fileExplorer.innerHTML = '';
            renderBreadcrumb();
            updateStorageInfo();
            
            if (items.length === 0) {
                const emptyMsg = document.createElement('div');
                emptyMsg.className = 'empty-state';
                emptyMsg.innerHTML = `
                    <i class="fas fa-folder-open" style="font-size: 4rem; color: var(--glass-border);"></i>
                    <p style="color: var(--text-secondary); margin-top: 1rem;">This folder is empty</p>
                    <p style="color: var(--text-secondary); font-size: 0.85rem;">Drop files here or click Upload</p>
                `;
                emptyMsg.style.cssText = 'grid-column: 1 / -1; text-align: center; padding: 3rem;';
                fileExplorer.appendChild(emptyMsg);
                return;
            }

            items.sort((a, b) => {
                if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
                return a.name.localeCompare(b.name);
            });

            // Fetch file sizes
            for (const item of items) {
                const itemEl = document.createElement('div');
                itemEl.className = `item ${item.isDirectory ? 'folder' : getFileTypeClass(item.name)}`;
                itemEl.draggable = true;
                itemEl.dataset.name = item.name;
                itemEl.dataset.type = item.isDirectory ? 'folder' : 'file';

                const iconHtml = item.isDirectory 
                    ? '<i class="fas fa-folder"></i>' 
                    : `<i class="fas ${getFileTypeIcon(item.name)}"></i>`;
                
                let sizeHtml = '';
                if (!item.isDirectory) {
                    // We'll show size after fetching
                    sizeHtml = '<div class="size">Loading...</div>';
                }

                itemEl.innerHTML = `
                    <div class="icon">${iconHtml}</div>
                    <div class="name" title="${item.name}">${item.name}</div>
                    ${sizeHtml}
                `;

                // Fetch file size
                if (!item.isDirectory) {
                    fetchFileSize(item.name, itemEl);
                }

                if (item.isDirectory) {
                    itemEl.onclick = () => navigateTo(pathJoin(currentPath, item.name));
                } else {
                    itemEl.onclick = () => showPreview(item.name);
                }
                itemEl.oncontextmenu = (e) => { e.preventDefault(); showContextMenu(e, item); };
                fileExplorer.appendChild(itemEl);
            }
        } catch (error) {
            console.error('Error rendering files:', error);
            alert(`Error: ${error.message}`);
        }
    };

    // --- Fetch File Size ---
    const fetchFileSize = async (filename, itemEl) => {
        try {
            const filePath = `/uploads/${pathJoin(currentPath, filename)}`;
            const response = await fetch(filePath, { method: 'HEAD' });
            const size = response.headers.get('content-length');
            const sizeEl = itemEl.querySelector('.size');
            if (sizeEl && size) {
                sizeEl.textContent = formatFileSize(parseInt(size));
            }
        } catch (error) {
            const sizeEl = itemEl.querySelector('.size');
            if (sizeEl) sizeEl.textContent = '';
        }
    };

    // --- Update Storage Info ---
    const updateStorageInfo = async () => {
        try {
            const response = await fetch('/api/storage-info');
            const data = await response.json();
            if (data.used !== undefined) {
                storageUsed.textContent = `${formatFileSize(data.used)} used`;
            }
        } catch (error) {
            storageUsed.textContent = 'N/A';
        }
    };

    // --- Navigation ---
    const navigateTo = (path) => { currentPath = path; renderFiles(); };

    // --- Modals ---
    const showModal = (title, placeholder, confirmText, action) => {
        modalTitle.textContent = title;
        modalInput.value = '';
        modalInput.placeholder = placeholder;
        modalConfirmBtn.textContent = confirmText;
        modalConfirmAction = action;
        modal.style.display = 'flex';
        modalInput.focus();
    };
    
    const hideModal = () => { modal.style.display = 'none'; modalConfirmAction = null; };
    
    modalCancelBtn.onclick = hideModal;
    modalConfirmBtn.onclick = async () => {
        if (modalConfirmAction) {
            try {
                await modalConfirmAction(modalInput.value);
                hideModal();
                renderFiles();
            } catch (error) { alert(`Error: ${error.message}`); }
        }
    };
    
    // --- Folder Creation ---
    newFolderBtn.onclick = () => {
        showModal('Create New Folder', 'Folder name', 'Create', async (name) => {
            if (name) {
                await apiCall('/api/folders', 'POST', { name, path: currentPath });
            }
        });
    };

    // --- Text File Creation ---
    newFileBtn.onclick = () => { 
        textEditorModal.style.display = 'flex'; 
        textEditorFilename.focus(); 
    };
    
    textEditorCancelBtn.onclick = () => { textEditorModal.style.display = 'none'; };
    
    textEditorSaveBtn.onclick = async () => {
        const filename = textEditorFilename.value;
        const content = textEditorContent.value;
        if (!filename) { alert('Filename is required.'); return; }
        try {
            await apiCall('/api/text-file', 'POST', { filename, content, path: currentPath });
            textEditorModal.style.display = 'none';
            textEditorFilename.value = '';
            textEditorContent.value = '';
            renderFiles();
        } catch (error) { alert(`Error creating file: ${error.message}`); }
    };

    // --- Upload with Progress Tracking ---
    const uploadFiles = async (files, targetPath) => {
        // Show upload panel
        uploadProgressPanel.classList.add('active');
        
        // Create upload items for each file
        const uploadItems = [];
        
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const uploadId = `upload-${Date.now()}-${i}`;
            
            const uploadItem = createUploadItemElement(uploadId, file);
            uploadQueue.appendChild(uploadItem);
            uploadItems.push({ id: uploadId, file, element: uploadItem });
        }

        // Upload each file with progress tracking
        for (const item of uploadItems) {
            await uploadFileWithProgress(item.id, item.file, targetPath);
        }

        // Refresh file list after all uploads complete
        renderFiles();
    };

    // --- Create Upload Item Element ---
    const createUploadItemElement = (id, file) => {
        const div = document.createElement('div');
        div.className = 'upload-item';
        div.id = id;
        
        const iconClass = getFileTypeIcon(file.name);
        const iconColor = getFileIconColor(file.name);
        
        div.innerHTML = `
            <div class="upload-item-header">
                <div class="upload-item-icon" style="background: ${iconColor}">
                    <i class="fas ${iconClass}"></i>
                </div>
                <div class="upload-item-info">
                    <div class="upload-item-name" title="${file.name}">${file.name}</div>
                    <div class="upload-item-size">${formatFileSize(file.size)}</div>
                </div>
                <div class="upload-item-status uploading">
                    <i class="fas fa-spinner fa-spin"></i> Uploading
                </div>
            </div>
            <div class="progress-bar-container">
                <div class="progress-bar" style="width: 0%"></div>
            </div>
        `;
        
        return div;
    };

    // --- Upload Single File with Progress ---
    const uploadFileWithProgress = (uploadId, file, targetPath) => {
        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            const formData = new FormData();
            formData.append('path', targetPath);
            formData.append('file', file);

            const uploadItem = document.getElementById(uploadId);
            const progressBar = uploadItem.querySelector('.progress-bar');
            const statusEl = uploadItem.querySelector('.upload-item-status');

            // Progress event
            xhr.upload.addEventListener('progress', (e) => {
                if (e.lengthComputable) {
                    const percentComplete = (e.loaded / e.total) * 100;
                    progressBar.style.width = percentComplete + '%';
                }
            });

            // Load event (success)
            xhr.addEventListener('load', () => {
                if (xhr.status >= 200 && xhr.status < 300) {
                    progressBar.classList.add('completed');
                    progressBar.style.width = '100%';
                    statusEl.className = 'upload-item-status completed';
                    statusEl.innerHTML = '<i class="fas fa-check"></i> Completed';
                    resolve();
                } else {
                    statusEl.className = 'upload-item-status error';
                    statusEl.innerHTML = '<i class="fas fa-times"></i> Error';
                    reject(new Error('Upload failed'));
                }
            });

            // Error event
            xhr.addEventListener('error', () => {
                statusEl.className = 'upload-item-status error';
                statusEl.innerHTML = '<i class="fas fa-times"></i> Error';
                reject(new Error('Upload failed'));
            });

            // Abort event
            xhr.addEventListener('abort', () => {
                statusEl.className = 'upload-item-status error';
                statusEl.innerHTML = '<i class="fas fa-times"></i> Cancelled';
                reject(new Error('Upload cancelled'));
            });

            xhr.open('POST', '/api/upload');
            xhr.send(formData);
        });
    };

    // --- Close Upload Panel ---
    closeUploadPanelBtn.onclick = () => {
        uploadProgressPanel.classList.remove('active');
    };

    // --- Upload Button Event ---
    uploadBtn.onclick = () => fileInput.click();
    
    fileInput.onchange = () => {
        if (fileInput.files.length > 0) {
            uploadFiles(fileInput.files, currentPath);
        }
        fileInput.value = '';
    };

    // --- Clear All ---
    clearAllBtn.onclick = async () => {
        if (confirm('WARNING: This will permanently delete ALL files and folders. Are you sure?')) {
            try {
                await apiCall('/api/clear-all', 'DELETE');
                navigateTo('');
            } catch (error) { alert(`Error: ${error.message}`); }
        }
    };

    // --- Drag and Drop ---
    fileExplorer.addEventListener('dragstart', (e) => {
        if (e.target.classList.contains('item')) {
            draggedItem = e.target;
            e.target.style.opacity = '0.5';
        }
    });

    fileExplorer.addEventListener('dragend', (e) => {
        draggedItem = null;
        if (e.target.classList.contains('item')) {
            e.target.style.opacity = '1';
        }
        document.querySelectorAll('.item').forEach(item => item.style.backgroundColor = '');
        fileExplorer.classList.remove('drag-over');
    });

    fileExplorer.addEventListener('dragover', (e) => {
        e.preventDefault();
        const target = e.target.closest('.item');
        if (target && target.dataset.type === 'folder' && target !== draggedItem) {
            target.style.backgroundColor = 'rgba(99, 102, 241, 0.2)';
        }
        fileExplorer.classList.add('drag-over');
    });

    fileExplorer.addEventListener('dragleave', (e) => {
        const target = e.target.closest('.item');
        if (target) {
            target.style.backgroundColor = '';
        }
        if (e.currentTarget.contains(e.relatedTarget)) return;
        fileExplorer.classList.remove('drag-over');
    });

    fileExplorer.addEventListener('drop', async (e) => {
        e.preventDefault();
        fileExplorer.classList.remove('drag-over');
        
        const dropTarget = e.target.closest('.item');
        if (dropTarget) { 
            dropTarget.style.backgroundColor = ''; 
        }

        // Handle internal drag-and-drop (MOVE)
        if (draggedItem) {
            if (dropTarget && dropTarget.dataset.type === 'folder' && dropTarget !== draggedItem) {
                const sourcePath = pathJoin(currentPath, draggedItem.dataset.name);
                const targetFolderPath = pathJoin(currentPath, dropTarget.dataset.name);
                const targetPath = pathJoin(targetFolderPath, draggedItem.dataset.name);
                try {
                    await apiCall('/api/move', 'PUT', { sourcePath, targetPath });
                    renderFiles();
                } catch (error) { alert(`Error moving file: ${error.message}`); }
            }
            return;
        }

        // Handle external drag-and-drop (UPLOAD)
        let uploadPath = currentPath;
        if (dropTarget && dropTarget.dataset.type === 'folder') {
            uploadPath = pathJoin(currentPath, dropTarget.dataset.name);
        }
        if (e.dataTransfer.files.length > 0) {
            uploadFiles(e.dataTransfer.files, uploadPath);
        }
    });

    // --- Context Menu ---
    const showContextMenu = (event, item) => {
        const existingMenu = document.querySelector('.context-menu');
        if (existingMenu) existingMenu.remove();
        
        const menu = document.createElement('div');
        menu.className = 'context-menu';
        menu.style.top = `${event.pageY}px`;
        menu.style.left = `${event.pageX}px`;

        if (!item.isDirectory) {
            const linkBtn = document.createElement('div');
            linkBtn.innerHTML = '<i class="fas fa-link"></i> Copy Direct Link';
            linkBtn.onclick = () => {
                menu.remove();
                const fileUrl = `${window.location.origin}/uploads/${pathJoin(currentPath, item.name)}`;
                navigator.clipboard.writeText(fileUrl).then(() => {
                    showNotification('Direct link copied to clipboard!');
                }).catch(err => {
                    showNotification('Failed to copy link.', 'error');
                });
            };
            menu.appendChild(linkBtn);

            const downloadBtn = document.createElement('div');
            downloadBtn.innerHTML = '<i class="fas fa-download"></i> Download';
            downloadBtn.onclick = () => {
                menu.remove();
                const fileUrl = `/uploads/${pathJoin(currentPath, item.name)}`;
                const a = document.createElement('a');
                a.href = fileUrl;
                a.download = item.name;
                a.click();
            };
            menu.appendChild(downloadBtn);
        }

        const renameBtn = document.createElement('div');
        renameBtn.innerHTML = '<i class="fas fa-edit"></i> Rename';
        renameBtn.onclick = () => {
            menu.remove();
            showModal(`Rename '${item.name}'`, 'New name', 'Rename', async (newName) => {
                if (newName && newName !== item.name) {
                    await apiCall('/api/rename', 'PUT', { oldName: item.name, newName, path: currentPath });
                }
            });
        };
        menu.appendChild(renameBtn);

        const deleteBtn = document.createElement('div');
        deleteBtn.innerHTML = '<i class="fas fa-trash"></i> Delete';
        deleteBtn.onclick = () => {
            menu.remove();
            if (confirm(`Are you sure you want to delete '${item.name}'?`)) {
                apiCall('/api/delete', 'DELETE', { name: item.name, path: currentPath })
                    .then(renderFiles)
                    .catch(err => alert(`Error: ${err.message}`));
            }
        };
        menu.appendChild(deleteBtn);
        
        document.body.appendChild(menu);
        
        // Adjust menu position if it goes off screen
        const menuRect = menu.getBoundingClientRect();
        if (menuRect.right > window.innerWidth) {
            menu.style.left = `${event.pageX - menuRect.width}px`;
        }
        if (menuRect.bottom > window.innerHeight) {
            menu.style.top = `${event.pageY - menuRect.height}px`;
        }
        
        document.addEventListener('click', () => menu.remove(), { once: true });
    };

    // --- Show Notification ---
    const showNotification = (message, type = 'success') => {
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 16px 24px;
            background: ${type === 'success' ? 'linear-gradient(135deg, #10b981, #059669)' : 'linear-gradient(135deg, #ef4444, #dc2626)'};
            color: white;
            border-radius: 12px;
            font-weight: 500;
            z-index: 10000;
            animation: slideInRight 0.3s ease;
            box-shadow: 0 10px 40px rgba(0,0,0,0.3);
        `;
        notification.textContent = message;
        document.body.appendChild(notification);
        setTimeout(() => {
            notification.style.animation = 'slideOutRight 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    };

    // --- File Preview ---
    const showPreview = async (filename) => {
        const fileExt = filename.split('.').pop().toLowerCase();
        const filePath = `/uploads/${pathJoin(currentPath, filename)}`;
        previewBody.innerHTML = '';
        
        if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(fileExt)) {
            previewBody.innerHTML = `<img src="${filePath}" alt="${filename}">`;
        } else if (['mp4', 'webm', 'ogg'].includes(fileExt)) {
            previewBody.innerHTML = `<video src="${filePath}" controls autoplay></video>`;
        } else if (['txt', 'js', 'css', 'html', 'json', 'md'].includes(fileExt)) {
            try {
                const response = await fetch(filePath);
                const text = await response.text();
                previewBody.innerHTML = `<pre><code>${text.replace(/</g, "<").replace(/>/g, ">")}</code></pre>`;
            } catch (error) { 
                previewBody.innerHTML = `<p style="text-align: center; color: var(--text-secondary);">Could not load file content.</p>
                <a href="${filePath}" download="${filename}" style="display: block; text-align: center; margin-top: 1rem; color: var(--primary-color);">
                    <i class="fas fa-download"></i> Download '${filename}'
                </a>`; 
            }
        } else {
            previewBody.innerHTML = `
                <div style="text-align: center; padding: 2rem;">
                    <i class="fas ${getFileTypeIcon(filename)}" style="font-size: 4rem; color: var(--glass-border); margin-bottom: 1rem;"></i>
                    <p style="color: var(--text-secondary);">Cannot preview this file type</p>
                    <a href="${filePath}" download="${filename}" class="primary-btn" style="display: inline-flex; margin-top: 1rem; text-decoration: none;">
                        <i class="fas fa-download"></i> Download '${filename}'
                    </a>
                </div>
            `;
        }
        previewModal.style.display = 'flex';
    };
    
    previewCloseBtn.onclick = () => {
        previewModal.style.display = 'none';
        previewBody.innerHTML = '';
    };

    // --- Close modals on outside click ---
    modal.onclick = (e) => { if (e.target === modal) hideModal(); };
    textEditorModal.onclick = (e) => { if (e.target === textEditorModal) textEditorModal.style.display = 'none'; };
    previewModal.onclick = (e) => { if (e.target === previewModal) previewModal.style.display = 'none'; };

    // --- Initial Load ---
    navigateTo('');
});
