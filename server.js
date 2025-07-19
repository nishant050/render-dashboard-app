const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir);
}

// --- Multer Configuration ---
// This tells Multer where to store uploaded files and how to name them.
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/');
    },
    filename: function (req, file, cb) {
        // Use the original filename
        cb(null, file.originalname);
    }
});
const upload = multer({ storage: storage });

// --- Middleware ---
// Serve the static front-end files (dashboard, css, and the filehub app)
app.use(express.static(path.join(__dirname)));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// --- API Routes ---

// 1. Handle File Uploads
app.post('/upload', upload.single('file'), (req, res) => {
    if (!req.file) {
        return res.status(400).send('No file uploaded.');
    }
    console.log(`File uploaded: ${req.file.originalname}`);
    res.json({ 
        message: 'File uploaded successfully!', 
        filename: req.file.originalname 
    });
});

// 2. List Uploaded Files
app.get('/files', (req, res) => {
    fs.readdir(uploadsDir, (err, files) => {
        if (err) {
            console.error('Could not list the directory.', err);
            return res.status(500).send('Server error.');
        }
        res.json(files);
    });
});

// --- Server Start ---
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});