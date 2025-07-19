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

    // --- State ---
    let currentPath = '';
    let modalConfirmAction = null;
    let draggedItem = null;

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

    // --- Rendering ---
    const renderBreadcrumb = () => {
        breadcrumb.innerHTML = '';
        const parts = currentPath.split('/').filter(p => p);
        let path = '';

        const createBreadcrumbLink = (text, linkPath) => {
            const link = document.createElement('a');
            link.href = '#';
            link.textContent = text;
            link.onclick = (e) => { e.preventDefault(); navigateTo(linkPath); };

            // Add drop support for moving items up the directory tree
            link.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (draggedItem) { // Only show highlight if an internal item is being dragged
                    link.style.backgroundColor = '#e9f5ff';
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

                    // Prevent dropping an item into its own current directory via breadcrumb
                    if (pathJoin(currentPath) === linkPath) return;

                    try {
                        await apiCall('/api/move', 'PUT', { sourcePath, targetPath });
                        renderFiles(); // Refresh the view
                    } catch (error) {
                        alert(`Error moving file: ${error.message}`);
                    }
                }
            });
            return link;
        };

        breadcrumb.appendChild(createBreadcrumbLink('Root', ''));

        parts.forEach(part => {
            path += `${part}/`;
            const currentPartPath = path.slice(0, -1);
            breadcrumb.appendChild(document.createTextNode(' / '));
            breadcrumb.appendChild(createBreadcrumbLink(part, currentPartPath));
        });
    };

    const getFileIcon = (filename) => {
        const ext = filename.split('.').pop().toLowerCase();
        const filePath = `/uploads/${pathJoin(currentPath, filename)}`;
        if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) {
            // Add draggable="false" to prevent browser's native image drag behavior
            return `<img src="${filePath}" alt="${filename}" loading="lazy" draggable="false">`;
        }
        if (['mp4', 'webm'].includes(ext)) {
            // Add draggable="false" for consistency
            return `<video src="${filePath}#t=0.1" preload="metadata" draggable="false"></video>`;
        }
        return '📄'; // Default icon
    };

    const renderFiles = async () => {
        try {
            const items = await apiCall(`/api/files?path=${encodeURIComponent(currentPath)}`);
            fileExplorer.innerHTML = '';
            renderBreadcrumb();
            items.sort((a, b) => {
                if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
                return a.name.localeCompare(b.name);
            });
            items.forEach(item => {
                const itemEl = document.createElement('div');
                itemEl.className = 'item';
                itemEl.draggable = true;
                itemEl.dataset.name = item.name;
                itemEl.dataset.type = item.isDirectory ? 'folder' : 'file';

                const icon = item.isDirectory ? '📁' : getFileIcon(item.name);
                itemEl.innerHTML = `<div class="icon">${icon}</div><div class="name">${item.name}</div>`;

                if (item.isDirectory) {
                    itemEl.onclick = () => navigateTo(pathJoin(currentPath, item.name));
                } else {
                    itemEl.onclick = () => showPreview(item.name);
                }
                itemEl.oncontextmenu = (e) => { e.preventDefault(); showContextMenu(e, item); };
                fileExplorer.appendChild(itemEl);
            });
        } catch (error) {
            console.error('Error rendering files:', error);
            alert(`Error: ${error.message}`);
        }
    };

    // --- Navigation ---
    const navigateTo = (path) => { currentPath = path; renderFiles(); };
    const pathJoin = (...parts) => parts.filter(p => p).join('/');

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
    newFileBtn.onclick = () => { textEditorModal.style.display = 'flex'; textEditorFilename.focus(); };
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

    // --- File Upload & Clear All ---
    const uploadFiles = async (files, targetPath) => {
        const formData = new FormData();
        formData.append('path', targetPath);
        for (const file of files) {
            formData.set('file', file);
            try {
                await apiCall('/api/upload', 'POST', formData);
            } catch (error) { alert(`Error uploading ${file.name}: ${error.message}`); }
        }
        renderFiles();
    };
    uploadBtn.onclick = () => fileInput.click();
    fileInput.onchange = () => {
        if (fileInput.files.length > 0) uploadFiles(fileInput.files, currentPath);
        fileInput.value = '';
    };
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
        }
    });

    fileExplorer.addEventListener('dragend', (e) => {
        // This is the central cleanup location for any drag operation.
        draggedItem = null;
        // Clean up visual styles
        document.querySelectorAll('.item').forEach(item => item.style.backgroundColor = '');
        fileExplorer.classList.remove('drag-over');
    });

    fileExplorer.addEventListener('dragover', (e) => {
        e.preventDefault();
        const target = e.target.closest('.item');
        if (target && target.dataset.type === 'folder' && target !== draggedItem) {
            target.style.backgroundColor = '#e9f5ff';
        }
        fileExplorer.classList.add('drag-over');
    });

    fileExplorer.addEventListener('dragleave', (e) => {
        const target = e.target.closest('.item');
        if (target) {
            target.style.backgroundColor = '';
        }
        // Only remove the main class if leaving the entire explorer area
        if (e.currentTarget.contains(e.relatedTarget)) return;
        fileExplorer.classList.remove('drag-over');
    });

    fileExplorer.addEventListener('drop', async (e) => {
        e.preventDefault();
        fileExplorer.classList.remove('drag-over');
        const dropTarget = e.target.closest('.item');
        if (dropTarget) { dropTarget.style.backgroundColor = ''; }

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
            // IMPORTANT: Return here to prevent falling through to the upload logic.
            // The draggedItem state will be cleaned up by the 'dragend' event.
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
            linkBtn.textContent = 'Copy Direct Link';
            linkBtn.onclick = () => {
                menu.remove();
                const fileUrl = `${window.location.origin}/uploads/${pathJoin(currentPath, item.name)}`;
                navigator.clipboard.writeText(fileUrl).then(() => {
                    alert('Direct link copied to clipboard!');
                }).catch(err => {
                    alert('Failed to copy link.');
                });
            };
            menu.appendChild(linkBtn);
        }

        const renameBtn = document.createElement('div');
        renameBtn.textContent = 'Rename';
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
        deleteBtn.textContent = 'Delete';
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
        document.addEventListener('click', () => menu.remove(), { once: true });
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
                previewBody.innerHTML = `<pre><code>${text.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</code></pre>`;
            } catch (error) { previewBody.innerHTML = `<p>Could not load file content.</p>`; }
        } else {
            previewBody.innerHTML = `<p>Cannot preview this file type.</p><a href="${filePath}" download="${filename}">Download '${filename}'</a>`;
        }
        previewModal.style.display = 'flex';
    };
    previewCloseBtn.onclick = () => {
        previewModal.style.display = 'none';
        previewBody.innerHTML = '';
    };

    // --- Initial Load ---
    navigateTo('');
});
