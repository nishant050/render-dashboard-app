const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const fsPromises = require('fs').promises;

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware to parse JSON bodies
app.use(express.json());

const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir);
}

// --- Multer Configuration ---
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        // Get subfolder from the request body, default to root uploads directory
        const subfolder = req.body.path || '';
        const fullPath = path.join(uploadsDir, subfolder);
        // Create the subfolder if it doesn't exist
        fs.mkdirSync(fullPath, { recursive: true });
        cb(null, fullPath);
    },
    filename: function (req, file, cb) {
        cb(null, file.originalname);
    }
});
const upload = multer({ storage: storage });


// --- Static File Serving ---
app.use(express.static(path.join(__dirname)));
app.use('/uploads', express.static(uploadsDir));


// --- API Routes ---

// 1. LIST contents of a directory
app.get('/api/files', async (req, res) => {
    try {
        const directoryPath = req.query.path ? path.join(uploadsDir, req.query.path) : uploadsDir;

        // Security check to prevent directory traversal
        if (!directoryPath.startsWith(uploadsDir)) {
            return res.status(403).send('Forbidden');
        }

        const items = await fsPromises.readdir(directoryPath, { withFileTypes: true });
        
        const files = items.map(item => ({
            name: item.name,
            isDirectory: item.isDirectory(),
        }));
        
        res.json(files);
    } catch (error) {
        console.error('Error listing files:', error);
        res.status(500).send('Server error while listing files.');
    }
});

// 2. UPLOAD a file
app.post('/api/upload', upload.single('file'), (req, res) => {
    if (!req.file) {
        return res.status(400).send('No file uploaded.');
    }
    res.json({ message: `File '${req.file.originalname}' uploaded successfully!` });
});

// 3. CREATE a new folder
app.post('/api/folders', async (req, res) => {
    try {
        const { name, path: currentPath } = req.body;
        if (!name) {
            return res.status(400).send('Folder name is required.');
        }

        const newFolderPath = path.join(uploadsDir, currentPath || '', name);

        if (!newFolderPath.startsWith(uploadsDir)) {
            return res.status(403).send('Forbidden');
        }

        await fsPromises.mkdir(newFolderPath);
        res.status(201).json({ message: `Folder '${name}' created successfully!` });
    } catch (error) {
        console.error('Error creating folder:', error);
        res.status(500).send('Server error while creating folder.');
    }
});

// 4. DELETE a file or folder
app.delete('/api/delete', async (req, res) => {
    try {
        const { name, path: currentPath } = req.body;
        if (!name) {
            return res.status(400).send('Item name is required.');
        }

        const itemPath = path.join(uploadsDir, currentPath || '', name);

        if (!itemPath.startsWith(uploadsDir)) {
            return res.status(403).send('Forbidden');
        }

        const stats = await fsPromises.stat(itemPath);
        if (stats.isDirectory()) {
            await fsPromises.rm(itemPath, { recursive: true, force: true });
        } else {
            await fsPromises.unlink(itemPath);
        }

        res.json({ message: `Item '${name}' deleted successfully!` });
    } catch (error) {
        console.error('Error deleting item:', error);
        res.status(500).send('Server error while deleting item.');
    }
});

// 5. RENAME a file or folder
app.put('/api/rename', async (req, res) => {
    try {
        const { oldName, newName, path: currentPath } = req.body;
        if (!oldName || !newName) {
            return res.status(400).send('Old and new names are required.');
        }

        const oldPath = path.join(uploadsDir, currentPath || '', oldName);
        const newPath = path.join(uploadsDir, currentPath || '', newName);

        if (!oldPath.startsWith(uploadsDir) || !newPath.startsWith(uploadsDir)) {
            return res.status(403).send('Forbidden');
        }

        await fsPromises.rename(oldPath, newPath);
        res.json({ message: `Renamed '${oldName}' to '${newName}' successfully!` });
    } catch (error) {
        console.error('Error renaming item:', error);
        res.status(500).send('Server error while renaming item.');
    }
});

// 6. CREATE a new text file
app.post('/api/text-file', async (req, res) => {
    try {
        const { filename, content, path: currentPath } = req.body;
        if (!filename) {
            return res.status(400).send('Filename is required.');
        }

        // Ensure the filename ends with .txt
        const finalFilename = filename.endsWith('.txt') ? filename : `${filename}.txt`;
        const newFilePath = path.join(uploadsDir, currentPath || '', finalFilename);

        if (!newFilePath.startsWith(uploadsDir)) {
            return res.status(403).send('Forbidden');
        }

        await fsPromises.writeFile(newFilePath, content || '');
        res.status(201).json({ message: `File '${finalFilename}' created successfully!` });
    } catch (error) {
        console.error('Error creating text file:', error);
        res.status(500).send('Server error while creating text file.');
    }
});

// 7. MOVE a file or folder
app.put('/api/move', async (req, res) => {
    try {
        const { sourcePath, targetPath } = req.body;
        if (!sourcePath || !targetPath) {
            return res.status(400).send('Source and target paths are required.');
        }

        const fullSourcePath = path.join(uploadsDir, sourcePath);
        const fullTargetPath = path.join(uploadsDir, targetPath);

        if (!fullSourcePath.startsWith(uploadsDir) || !fullTargetPath.startsWith(uploadsDir)) {
            return res.status(403).send('Forbidden');
        }

        // Ensure target directory exists
        await fsPromises.mkdir(path.dirname(fullTargetPath), { recursive: true });
        
        // Rename (move) the file
        await fsPromises.rename(fullSourcePath, fullTargetPath);

        res.json({ message: `Moved '${sourcePath}' to '${targetPath}' successfully!` });
    } catch (error) {
        console.error('Error moving item:', error);
        res.status(500).send('Server error while moving item.');
    }
});

// 8. CLEAR ALL files and folders
app.delete('/api/clear-all', async (req, res) => {
    try {
        const entries = await fsPromises.readdir(uploadsDir);
        for (const entry of entries) {
            const entryPath = path.join(uploadsDir, entry);
            const stats = await fsPromises.stat(entryPath);
            if (stats.isDirectory()) {
                await fsPromises.rm(entryPath, { recursive: true, force: true });
            } else {
                await fsPromises.unlink(entryPath);
            }
        }
        res.json({ message: 'All files and folders have been cleared.' });
    } catch (error) {
        console.error('Error clearing storage:', error);
        res.status(500).send('Server error while clearing storage.');
    }
});

// --- Server Start ---
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});