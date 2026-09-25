const express = require('express');
const session = require('express-session');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const bodyParser = require('body-parser');

const app = express();
const PORT = process.env.PORT || 8080;

// Create upload directories
const uploadDirs = {
  images: path.join(__dirname, 'uploads', 'images'),
  videos: path.join(__dirname, 'uploads', 'videos'),
  archives: path.join(__dirname, 'uploads', 'archives'),
  documents: path.join(__dirname, 'uploads', 'documents'),
  others: path.join(__dirname, 'uploads', 'others')
};

Object.values(uploadDirs).forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase();
    let uploadPath = uploadDirs.others;

    // Categorize by file type
    if (['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.svg'].includes(ext)) {
      uploadPath = uploadDirs.images;
    } else if (['.mp4', '.avi', '.mov', '.wmv', '.flv', '.mkv', '.webm'].includes(ext)) {
      uploadPath = uploadDirs.videos;
    } else if (['.zip', '.rar', '.7z', '.tar', '.gz', '.bz2'].includes(ext)) {
      uploadPath = uploadDirs.archives;
    } else if (['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.txt'].includes(ext)) {
      uploadPath = uploadDirs.documents;
    }

    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 500 * 1024 * 1024 // 500MB limit
  }
});

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(session({
  secret: 'numan-upload-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 24 * 60 * 60 * 1000 } // 24 hours
}));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Authentication middleware
function isAuthenticated(req, res, next) {
  if (req.session.isAuthenticated) {
    return next();
  }
  res.redirect('/');
}

// Get all files with metadata
function getAllFiles() {
  const files = [];

  Object.keys(uploadDirs).forEach(category => {
    const dir = uploadDirs[category];
    if (fs.existsSync(dir)) {
      const fileNames = fs.readdirSync(dir);
      fileNames.forEach(fileName => {
        const filePath = path.join(dir, fileName);
        const stats = fs.statSync(filePath);
        files.push({
          name: fileName,
          category: category,
          size: stats.size,
          uploadDate: stats.mtime,
          path: filePath
        });
      });
    }
  });

  return files.sort((a, b) => b.uploadDate - a.uploadDate);
}

// Routes
app.get('/', (req, res) => {
  if (req.session.isAuthenticated) {
    return res.redirect('/dashboard');
  }
  res.render('login', { error: null });
});

app.post('/login', (req, res) => {
  const { username, password } = req.body;

  if (username === 'numan' && password === 'numan114') {
    req.session.isAuthenticated = true;
    res.redirect('/dashboard');
  } else {
    res.render('login', { error: 'Invalid username or password' });
  }
});

app.get('/dashboard', isAuthenticated, (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const perPage = 10;

  const allFiles = getAllFiles();
  const totalFiles = allFiles.length;
  const totalPages = Math.ceil(totalFiles / perPage);
  const startIndex = (page - 1) * perPage;
  const endIndex = startIndex + perPage;
  const paginatedFiles = allFiles.slice(startIndex, endIndex);

  res.render('dashboard', {
    files: paginatedFiles,
    currentPage: page,
    totalPages: totalPages,
    totalFiles: totalFiles
  });
});

app.post('/upload', isAuthenticated, upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'No file uploaded' });
  }
  res.json({ success: true, message: 'File uploaded successfully', file: req.file });
});

app.get('/download/:category/:filename', isAuthenticated, (req, res) => {
  const { category, filename } = req.params;
  const filePath = path.join(uploadDirs[category], filename);

  if (fs.existsSync(filePath)) {
    res.download(filePath);
  } else {
    res.status(404).send('File not found');
  }
});

app.get('/view/:category/:filename', isAuthenticated, (req, res) => {
  const { category, filename } = req.params;
  const filePath = path.join(uploadDirs[category], filename);

  if (fs.existsSync(filePath)) {
    const fileInfo = {
      name: filename,
      category: category,
      size: fs.statSync(filePath).size,
      path: `/download/${category}/${filename}`
    };
    res.render('view', { file: fileInfo });
  } else {
    res.status(404).send('File not found');
  }
});

app.delete('/delete/:category/:filename', isAuthenticated, (req, res) => {
  const { category, filename } = req.params;
  const filePath = path.join(uploadDirs[category], filename);

  if (fs.existsSync(filePath)) {
    try {
      fs.unlinkSync(filePath);
      res.json({ success: true, message: 'File deleted successfully' });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Error deleting file' });
    }
  } else {
    res.status(404).json({ success: false, message: 'File not found' });
  }
});

app.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/');
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
