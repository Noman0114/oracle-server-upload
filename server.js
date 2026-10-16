try {
  require('dotenv').config();
} catch (e) {
  // Dotenv optional fallback
}
const express = require('express');
const session = require('express-session');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const bodyParser = require('body-parser');

const app = express();
const PORT = process.env.PORT || 8080;
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'numan';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'numan114';
const SESSION_SECRET = process.env.SESSION_SECRET || 'numan-upload-secret-key';

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
  storage: storage
  // Unlimited file size: no limits configured
});

// Global CORS middleware - allows Next.js frontend (localhost:3000 / Vercel) and mobile apps
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Body parsing with higher limits
app.use(bodyParser.urlencoded({ extended: true, limit: '500mb' }));
app.use(bodyParser.json({ limit: '500mb' }));

// Serve uploaded files statically with CORS and byte range support
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use(session({
  secret: SESSION_SECRET,
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
  } else if (['.mp4', '.avi', '.mov', '.wmv', '.flv', '.mkv', '.webm', '.3gp', '.m4v', '.ts'].includes(ext)) {
    return 'videos';
  } else if (['.zip', '.rar', '.7z', '.tar', '.gz', '.bz2'].includes(ext)) {
    return 'archives';
  } else if (['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.txt'].includes(ext)) {
    return 'documents';
  }
  return 'others';
}

// Auto-migrate any loose files sitting in the root of uploads/ into categorized folders
function autoMigrateRootUploads() {
  const uploadsRoot = path.join(__dirname, 'uploads');
  if (!fs.existsSync(uploadsRoot)) return;

  try {
    const entries = fs.readdirSync(uploadsRoot, { withFileTypes: true });
    entries.forEach(entry => {
      if (entry.isFile()) {
        const cat = getFileCategory(entry.name);
        const targetDir = uploadDirs[cat] || uploadDirs.others;
        if (!fs.existsSync(targetDir)) {
          fs.mkdirSync(targetDir, { recursive: true });
        }
        const srcPath = path.join(uploadsRoot, entry.name);
        const destPath = path.join(targetDir, entry.name);
        try {
          if (!fs.existsSync(destPath)) {
            fs.renameSync(srcPath, destPath);
          }
        } catch (err) {
          console.error('Error migrating legacy file:', entry.name, err);
        }
      }
    });
  } catch (err) {
    console.error('Error scanning uploads root directory:', err);
  }
}

// Get all files with metadata
function getAllFiles() {
  autoMigrateRootUploads();

  const files = [];

  Object.keys(uploadDirs).forEach(category => {
    const dir = uploadDirs[category];
    if (fs.existsSync(dir)) {
      const fileNames = fs.readdirSync(dir);
      fileNames.forEach(fileName => {
        const filePath = path.join(dir, fileName);
        try {
          const stats = fs.statSync(filePath);
          if (stats.isFile()) {
            files.push({
              name: fileName,
              category: category,
              size: stats.size,
              uploadDate: stats.mtime,
              url: `/uploads/${category}/${encodeURIComponent(fileName)}`,
              path: filePath
            });
          }
        } catch (err) {
          // ignore unreadable
        }
      });
    }
  });

  return files.sort((a, b) => b.uploadDate - a.uploadDate);
}

// Helper: Safely delete single file from disk
function deleteFileOnServer(category, rawFilename) {
  if (!category || !rawFilename || !uploadDirs[category]) {
    return { success: false, message: 'Invalid category or filename' };
  }
  
  let safeFilename = path.basename(rawFilename);
  try {
    safeFilename = path.basename(decodeURIComponent(rawFilename));
  } catch (err) {
    safeFilename = path.basename(rawFilename);
  }

  let filePath = path.join(uploadDirs[category], safeFilename);

  if (!fs.existsSync(filePath)) {
    const rawSafe = path.basename(rawFilename);
    const rawPath = path.join(uploadDirs[category], rawSafe);
    if (fs.existsSync(rawPath)) {
      filePath = rawPath;
    } else {
      return { success: false, message: 'File not found' };
    }
  }

  try {
    fs.unlinkSync(filePath);
    return { success: true, message: 'File deleted successfully' };
  } catch (error) {
    console.error(`Error deleting file ${filePath}:`, error);
    return { success: false, message: 'Error deleting file from disk' };
  }
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
 * @desc Get list of uploaded files/photos (JSON format for mobile app & Next.js SSR)
 * @query category (optional), limit (optional), page (optional), search (optional)
 */
app.get('/api/files', (req, res) => {
  const allFiles = getAllFiles();
  const { category, limit, page, search } = req.query;
  const searchQuery = (search || '').trim().toLowerCase();
  const cat = (category || 'all').trim().toLowerCase();

  // 1. Search filter
  let searchedFiles = allFiles;
  if (searchQuery) {
    searchedFiles = allFiles.filter(f => f.name.toLowerCase().includes(searchQuery));
  }

  // 2. Pre-calculate category counts based on search results
  const categoryCounts = {
    all: searchedFiles.length,
    images: 0,
    videos: 0,
    documents: 0,
    archives: 0,
    others: 0
  };

  searchedFiles.forEach(file => {
    if (categoryCounts[file.category] !== undefined) {
      categoryCounts[file.category]++;
    } else {
      categoryCounts.others = (categoryCounts.others || 0) + 1;
    }
  });

  // 3. Category filter
  let filteredFiles = searchedFiles;
  if (cat && cat !== 'all' && uploadDirs[cat]) {
    filteredFiles = searchedFiles.filter(f => f.category === cat);
  }

  // 4. Pagination
  const totalFiles = filteredFiles.length;
  if (limit !== undefined || page !== undefined) {
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.max(1, parseInt(limit) || 30);
    const totalPages = Math.ceil(totalFiles / limitNum) || 1;
    const validPage = Math.min(pageNum, totalPages);
    const startIndex = (validPage - 1) * limitNum;
    const paginated = filteredFiles.slice(startIndex, startIndex + limitNum);

    return res.json({
      success: true,
      total: totalFiles,
      totalAllFiles: allFiles.length,
      page: validPage,
      limit: limitNum,
      totalPages: totalPages,
      currentCategory: cat,
      search: search || '',
      categoryCounts: categoryCounts,
      files: paginated
    });
  }

  res.json({
    success: true,
    total: totalFiles,
    totalAllFiles: allFiles.length,
    currentCategory: cat,
    categoryCounts: categoryCounts,
    files: filteredFiles
  });
});

/**
 * @route GET /api/file/:category/:filename
 * @desc Get single file details and related files for Next.js watch/view page
 */
app.get('/api/file/:category/:filename', (req, res) => {
  const { category, filename } = req.params;
  const targetDir = uploadDirs[category];

  if (targetDir) {
    const decoded = decodeURIComponent(filename);
    let safeFilename = path.basename(decoded);
    let filePath = path.join(targetDir, safeFilename);

    if (!fs.existsSync(filePath)) {
      safeFilename = path.basename(filename);
      filePath = path.join(targetDir, safeFilename);
    }

    if (fs.existsSync(filePath)) {
      const stats = fs.statSync(filePath);
      const fileInfo = {
        name: safeFilename,
        category: category,
        size: stats.size,
        uploadDate: stats.mtime,
        url: `/uploads/${category}/${encodeURIComponent(safeFilename)}`,
        path: `/uploads/${category}/${encodeURIComponent(safeFilename)}`,
        downloadPath: `/download/${category}/${encodeURIComponent(safeFilename)}`
      };

      const allFiles = getAllFiles();
      const relatedFiles = allFiles
        .filter(f => !(f.category === category && f.name === safeFilename))
        .slice(0, 15);

      return res.json({
        success: true,
        file: fileInfo,
        relatedFiles: relatedFiles
      });
    }
  }
  res.status(404).json({ success: false, message: 'File not found' });
});

/**
 * @route POST /api/login
 * @desc API login verification for Next.js Server Action
 */
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
    return res.json({ success: true, message: 'Authenticated successfully', user: { username: ADMIN_USERNAME } });
  }
  res.status(401).json({ success: false, message: 'Invalid username or password' });
});

/**
 * @route GET /api/download/:category/:filename
 * @desc Download file endpoint
 */
app.get('/api/download/:category/:filename', (req, res) => {
  const { category, filename } = req.params;
  const targetDir = uploadDirs[category];
  if (!targetDir) {
    return res.status(400).send('Invalid category');
  }

  const decoded = decodeURIComponent(filename);
  let safeFilename = path.basename(decoded);
  let filePath = path.join(targetDir, safeFilename);

  if (!fs.existsSync(filePath)) {
    safeFilename = path.basename(filename);
    filePath = path.join(targetDir, safeFilename);
  }

  if (fs.existsSync(filePath)) {
    res.download(filePath);
  } else {
    res.status(404).send('File not found');
  }
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
  const result = deleteFileOnServer(category, filename);
  if (result.success) {
    return res.json({ success: true, message: result.message });
  } else {
    const statusCode = result.message === 'File not found' ? 404 : 400;
    return res.status(statusCode).json({ success: false, message: result.message });
  }
});

/**
 * @route POST /api/delete-multiple
 * @desc Bulk delete multiple files via API
 * @body { files: [{ category: 'images', filename: '...' }] }
 */
app.post('/api/delete-multiple', (req, res) => {
  const { files } = req.body;
  if (!Array.isArray(files) || files.length === 0) {
    return res.status(400).json({ success: false, message: 'No files provided for deletion' });
  }

  let deletedCount = 0;
  let failedCount = 0;

  files.forEach(item => {
    const category = item.category;
    const filename = item.filename || item.name;
    const result = deleteFileOnServer(category, filename);
    if (result.success) {
      deletedCount++;
    } else {
      failedCount++;
    }
  });

  res.json({
    success: true,
    message: `${deletedCount} file(s) deleted successfully` + (failedCount > 0 ? ` (${failedCount} failed)` : ''),
    deletedCount,
    failedCount
  });
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

  if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
    req.session.isAuthenticated = true;
    res.redirect('/dashboard');
  } else {
    res.render('login', { error: 'Invalid username or password' });
  }
});

app.get('/dashboard', isAuthenticated, (req, res) => {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const search = (req.query.search || '').trim();
  const perPage = Math.max(1, parseInt(req.query.limit) || 30); // Default pagination limit is 30
  const category = (req.query.category || 'all').trim().toLowerCase();

  let allFiles = getAllFiles();

  // Search filter
  let searchedFiles = allFiles;
  if (search) {
    const query = search.toLowerCase();
    searchedFiles = allFiles.filter(f => f.name.toLowerCase().includes(query));
  }

  // Pre-calculate counts for all categories based on searched files
  const categoryCounts = {
    all: searchedFiles.length,
    images: 0,
    videos: 0,
    documents: 0,
    archives: 0,
    others: 0
  };

  searchedFiles.forEach(file => {
    if (categoryCounts[file.category] !== undefined) {
      categoryCounts[file.category]++;
    } else {
      categoryCounts.others = (categoryCounts.others || 0) + 1;
    }
  });

  // Category filter
  let filteredFiles = searchedFiles;
  if (category && category !== 'all' && uploadDirs[category]) {
    filteredFiles = searchedFiles.filter(f => f.category === category);
  }

  const totalFiles = filteredFiles.length;
  const totalPages = Math.ceil(totalFiles / perPage) || 1;
  const validPage = Math.min(page, totalPages);
  const startIndex = (validPage - 1) * perPage;
  const endIndex = startIndex + perPage;
  const paginatedFiles = filteredFiles.slice(startIndex, endIndex);

  res.render('dashboard', {
    files: paginatedFiles,
    currentPage: validPage,
    totalPages: totalPages,
    totalFiles: totalFiles,
    totalAllFiles: allFiles.length,
    search: search,
    perPage: perPage,
    currentCategory: category,
    categoryCounts: categoryCounts
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
  const targetDir = uploadDirs[category];
  if (!targetDir) {
    return res.status(400).send('Invalid category');
  }

  let safeFilename = path.basename(filename);
  try {
    safeFilename = path.basename(decodeURIComponent(filename));
  } catch (e) {
    safeFilename = path.basename(filename);
  }
  let filePath = path.join(targetDir, safeFilename);

  if (!fs.existsSync(filePath)) {
    filePath = path.join(targetDir, path.basename(filename));
  }

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
    let safeFilename = path.basename(filename);
    try {
      safeFilename = path.basename(decodeURIComponent(filename));
    } catch (e) {
      safeFilename = path.basename(filename);
    }
    let filePath = path.join(targetDir, safeFilename);

    if (!fs.existsSync(filePath)) {
      filePath = path.join(targetDir, path.basename(filename));
    }

    if (fs.existsSync(filePath)) {
      const stats = fs.statSync(filePath);
      const actualFilename = path.basename(filePath);
      const fileInfo = {
        name: actualFilename,
        category: category,
        size: stats.size,
        uploadDate: stats.mtime,
        path: `/uploads/${category}/${encodeURIComponent(actualFilename)}`,
        downloadPath: `/download/${category}/${encodeURIComponent(actualFilename)}`
      };
      
      const allFiles = getAllFiles();
      const relatedFiles = allFiles.filter(f => !(f.category === category && f.name === actualFilename)).slice(0, 12);

      return res.render('view', { file: fileInfo, relatedFiles: relatedFiles });
    }
  }
  res.status(404).send('File not found');
});

// Single file deletion
app.delete('/delete/:category/:filename', isAuthenticated, (req, res) => {
  const { category, filename } = req.params;
  const result = deleteFileOnServer(category, filename);
  if (result.success) {
    res.json({ success: true, message: result.message });
  } else {
    const statusCode = result.message === 'File not found' ? 404 : 400;
    res.status(statusCode).json({ success: false, message: result.message });
  }
});

// Multiple file deletion (Bulk delete from server)
app.post('/delete-multiple', isAuthenticated, (req, res) => {
  const { files } = req.body;
  if (!Array.isArray(files) || files.length === 0) {
    return res.status(400).json({ success: false, message: 'No files provided for deletion' });
  }

  let deletedCount = 0;
  let failedCount = 0;

  files.forEach(item => {
    const category = item.category;
    const filename = item.filename || item.name;
    const result = deleteFileOnServer(category, filename);
    if (result.success) {
      deletedCount++;
    } else {
      failedCount++;
    }
  });

  res.json({
    success: true,
    message: `${deletedCount} file(s) deleted permanently from server` + (failedCount > 0 ? ` (${failedCount} failed)` : ''),
    deletedCount,
    failedCount
  });
});

app.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/');
});

// Global error handling middleware (catches URIError, malformed requests, etc.)
app.use((err, req, res, next) => {
  if (err instanceof URIError) {
    return res.status(400).json({ success: false, message: 'Bad request: URI malformed' });
  }
  console.error('Unhandled server error:', err);
  res.status(500).json({ success: false, message: 'Internal server error' });
});

const server = app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

// Disable timeout so large and unlimited file uploads are not prematurely interrupted
server.timeout = 0;
server.keepAliveTimeout = 60000;
if (server.requestTimeout !== undefined) {
  server.requestTimeout = 0;
}

