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
    if (['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.svg', '.heic', '.heif'].includes(ext)) {
      uploadPath = uploadDirs.images;
    } else if (['.mp4', '.avi', '.mov', '.wmv', '.flv', '.mkv', '.webm', '.3gp', '.m4v', '.ts'].includes(ext)) {
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

// Serve uploaded files statically so mobile apps can access/display photos directly
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// CORS middleware for API routes to allow requests from mobile apps / web clients
app.use('/api', (req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

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

// Helper: Get file category by extension
function getFileCategory(filename) {
  const ext = path.extname(filename).toLowerCase();
  if (['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.svg', '.heic', '.heif'].includes(ext)) {
    return 'images';
  } else if (['.mp4', '.avi', '.mov', '.wmv', '.flv', '.mkv', '.webm', '.3gp'].includes(ext)) {
    return 'videos';
  } else if (['.zip', '.rar', '.7z', '.tar', '.gz', '.bz2'].includes(ext)) {
    return 'archives';
  } else if (['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.txt'].includes(ext)) {
    return 'documents';
  }
  return 'others';
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
          url: `/uploads/${category}/${fileName}`,
          path: filePath
        });
      });
    }
  });

  return files.sort((a, b) => b.uploadDate - a.uploadDate);
}

// ==========================================
// UNAUTHENTICATED MOBILE API ENDPOINTS
// ==========================================

/**
 * @route POST /api/upload
 * @desc Auto-sync / upload single or multiple photos from mobile app without authentication
 * @accepts Any field name (file, photo, image, files, etc.)
 */
app.post('/api/upload', upload.any(), (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'No file uploaded. Please attach image/photo in request body.'
    });
  }

  const uploadedFiles = req.files.map(file => {
    const category = getFileCategory(file.filename);
    return {
      filename: file.filename,
      originalname: file.originalname,
      category: category,
      size: file.size,
      mimetype: file.mimetype,
      url: `/uploads/${category}/${file.filename}`
    };
  });

  res.status(200).json({
    success: true,
    message: `${uploadedFiles.length} file(s) synced successfully`,
    count: uploadedFiles.length,
    files: uploadedFiles
  });
});

/**
 * @route GET /api/files
 * @desc Get list of uploaded files/photos (JSON format for mobile app)
 * @query category (optional), limit (optional), page (optional)
 */
app.get('/api/files', (req, res) => {
  let files = getAllFiles();
  const { category, limit, page } = req.query;

  if (category) {
    files = files.filter(f => f.category === category);
  }

  if (limit) {
    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 20;
    const startIndex = (pageNum - 1) * limitNum;
    const paginated = files.slice(startIndex, startIndex + limitNum);
    return res.json({
      success: true,
      total: files.length,
      page: pageNum,
      limit: limitNum,
      files: paginated
    });
  }

  res.json({
    success: true,
    total: files.length,
    files: files
  });
});

/**
 * @route POST /api/check-sync
 * @desc Check which files are already synced to avoid re-uploading duplicate photos
 * @body { originalNames: ["IMG_001.jpg", "IMG_002.jpg"] }
 */
app.post('/api/check-sync', (req, res) => {
  const { originalNames } = req.body;
  if (!Array.isArray(originalNames)) {
    return res.status(400).json({ success: false, message: 'originalNames array required' });
  }

  const existingFiles = getAllFiles();
  const syncedMap = {};

  originalNames.forEach(name => {
    const found = existingFiles.some(f => f.name.endsWith(`-${name}`) || f.name === name);
    syncedMap[name] = found;
  });

  res.json({
    success: true,
    syncedMap: syncedMap
  });
});

/**
 * @route DELETE /api/files/:category/:filename
 * @desc Delete file via API without authentication
 */
app.delete('/api/files/:category/:filename', (req, res) => {
  const { category, filename } = req.params;
  const targetCategoryDir = uploadDirs[category];

  if (!targetCategoryDir) {
    return res.status(400).json({ success: false, message: 'Invalid category' });
  }

  const filePath = path.join(targetCategoryDir, filename);
  if (fs.existsSync(filePath)) {
    try {
      fs.unlinkSync(filePath);
      return res.json({ success: true, message: 'File deleted successfully' });
    } catch (error) {
      return res.status(500).json({ success: false, message: 'Error deleting file' });
    }
  } else {
    return res.status(404).json({ success: false, message: 'File not found' });
  }
});

// ==========================================
// WEB DASHBOARD ROUTES (AUTHENTICATED)
// ==========================================

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
  const search = (req.query.search || '').trim();
  const perPage = 10;

  let allFiles = getAllFiles();
  if (search) {
    const query = search.toLowerCase();
    allFiles = allFiles.filter(f => f.name.toLowerCase().includes(query));
  }

  const totalFiles = allFiles.length;
  const totalPages = Math.ceil(totalFiles / perPage) || 1;
  const startIndex = (page - 1) * perPage;
  const endIndex = startIndex + perPage;
  const paginatedFiles = allFiles.slice(startIndex, endIndex);

  res.render('dashboard', {
    files: paginatedFiles,
    currentPage: page,
    totalPages: totalPages,
    totalFiles: totalFiles,
    search: search
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
  const targetDir = uploadDirs[category];

  if (targetDir) {
    const filePath = path.join(targetDir, filename);
    if (fs.existsSync(filePath)) {
      const fileInfo = {
        name: filename,
        category: category,
        size: fs.statSync(filePath).size,
        path: `/uploads/${category}/${encodeURIComponent(filename)}`,
        downloadPath: `/download/${category}/${encodeURIComponent(filename)}`
      };
      return res.render('view', { file: fileInfo });
    }
  }
  res.status(404).send('File not found');
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

