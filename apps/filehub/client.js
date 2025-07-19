document.addEventListener('DOMContentLoaded', () => {
    const uploadForm = document.getElementById('upload-form');
    const fileInput = document.getElementById('file-input');
    const statusMessage = document.getElementById('status-message');
    const fileList = document.getElementById('file-list');

    // --- Function to fetch and display the list of files ---
    const fetchFiles = async () => {
        try {
            const response = await fetch('/files');
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            const files = await response.json();
            
            fileList.innerHTML = ''; // Clear the list before repopulating

            if (files.length === 0) {
                fileList.innerHTML = '<p>No files uploaded yet.</p>';
            } else {
                files.forEach(file => {
                    const fileItem = document.createElement('div');
                    fileItem.className = 'file-item';

                    const fileName = document.createElement('span');
                    fileName.textContent = file;

                    // The download link points directly to the file in the uploads directory
                    const downloadLink = document.createElement('a');
                    downloadLink.href = `/uploads/${file}`;
                    downloadLink.textContent = 'Download';
                    downloadLink.setAttribute('download', file); // This attribute prompts download

                    fileItem.appendChild(fileName);
                    fileItem.appendChild(downloadLink);
                    fileList.appendChild(fileItem);
                });
            }
        } catch (error) {
            console.error('Error fetching files:', error);
            fileList.innerHTML = '<p>Could not load files.</p>';
        }
    };

    // --- Handle the form submission for file uploads ---
    uploadForm.addEventListener('submit', async (event) => {
        event.preventDefault(); // Prevent the default form submission

        const file = fileInput.files[0];
        if (!file) {
            statusMessage.textContent = 'Please select a file to upload.';
            statusMessage.style.color = 'red';
            return;
        }

        const formData = new FormData();
        formData.append('file', file);

        statusMessage.textContent = 'Uploading...';
        statusMessage.style.color = 'blue';

        try {
            const response = await fetch('/upload', {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                throw new Error('Upload failed.');
            }

            const result = await response.json();
            statusMessage.textContent = result.message;
            statusMessage.style.color = 'green';
            
            uploadForm.reset(); // Clear the file input
            fetchFiles(); // Refresh the file list

        } catch (error) {
            console.error('Error uploading file:', error);
            statusMessage.textContent = 'Error uploading file. Please try again.';
            statusMessage.style.color = 'red';
        }
    });

    // --- Initial fetch of files when the page loads ---
    fetchFiles();
});