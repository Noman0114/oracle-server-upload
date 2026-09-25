# File Upload Server

A secure file upload system with authentication, organized file storage, and pagination.

## Features

- ✅ User authentication (username: numan, password: numan114)
- ✅ File upload with drag & drop support
- ✅ Large file support (up to 500MB)
- ✅ Automatic file categorization by type
- ✅ Organized folder structure (images, videos, archives, documents, others)
- ✅ Pagination for file listing
- ✅ View and download files
- ✅ Responsive design

## Installation Steps

### Step 1: Install Node.js on Oracle Server

```bash
# Update system
sudo yum update -y

# Install Node.js 18.x (LTS)
curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
sudo yum install -y nodejs

# Verify installation
node --version
npm --version
```

### Step 2: Install PM2 (Process Manager)

```bash
# Install PM2 globally
sudo npm install -g pm2

# Verify installation
pm2 --version
```

### Step 3: Upload Project to Server

```bash
# Create project directory on server
mkdir -p /home/opc/file-upload-server
cd /home/opc/file-upload-server

# Upload all project files to this directory
# Use SCP, SFTP, or your preferred method
```

### Step 4: Install Dependencies

```bash
# Navigate to project directory
cd /home/opc/file-upload-server

# Install all dependencies
npm install
```

### Step 5: Configure Firewall

```bash
# Open port 3000 (or your chosen port)
sudo firewall-cmd --permanent --add-port=3000/tcp
sudo firewall-cmd --reload

# For Oracle Cloud, also configure Security List in OCI Console:
# 1. Go to Networking -> Virtual Cloud Networks
# 2. Select your VCN
# 3. Click Security Lists
# 4. Add Ingress Rule:
#    - Source CIDR: 0.0.0.0/0
#    - Destination Port: 3000
#    - Protocol: TCP
```

### Step 6: Start the Server with PM2

```bash
# Start the application
pm2 start server.js --name "file-upload-server"

# Save PM2 process list
pm2 save

# Setup PM2 to start on system boot
pm2 startup

# Follow the command output to complete startup configuration
```

## PM2 Commands

```bash
# View running processes
pm2 list

# View logs
pm2 logs file-upload-server

# Restart application
pm2 restart file-upload-server

# Stop application
pm2 stop file-upload-server

# Delete from PM2
pm2 delete file-upload-server

# Monitor application
pm2 monit
```

## Environment Variables (Optional)

Create a `.env` file for custom configuration:

```bash
PORT=3000
SESSION_SECRET=your-secret-key-here
```

## File Structure

```
file-upload-server/
├── server.js                 # Main server file
├── package.json             # Dependencies
├── views/
│   ├── login.ejs           # Login page
│   ├── dashboard.ejs       # Main dashboard
│   └── view.ejs            # File view page
├── uploads/                # Uploaded files directory
│   ├── images/            # Image files
│   ├── videos/            # Video files
│   ├── archives/          # ZIP, RAR, etc.
│   ├── documents/         # PDF, DOC, etc.
│   └── others/            # Other file types
└── README.md              # This file
```

## Supported File Types

### Images
- .jpg, .jpeg, .png, .gif, .bmp, .webp, .svg

### Videos
- .mp4, .avi, .mov, .wmv, .flv, .mkv, .webm

### Archives
- .zip, .rar, .7z, .tar, .gz, .bz2

### Documents
- .pdf, .doc, .docx, .xls, .xlsx, .ppt, .pptx, .txt

### Others
- All other file types

## Access the Application

After starting the server:
- Local: http://localhost:3000
- Server: http://YOUR_SERVER_IP:3000

**Login Credentials:**
- Username: `numan`
- Password: `numan114`

## Security Notes

1. Change the session secret in production
2. Use HTTPS with SSL certificate (recommended: Let's Encrypt)
3. Consider adding rate limiting for uploads
4. Implement file size validation on backend
5. Add virus scanning for uploaded files (recommended: ClamAV)

## Troubleshooting

### Port already in use
```bash
# Find process using port 3000
sudo lsof -i :3000

# Kill the process
sudo kill -9 <PID>
```

### Permission issues
```bash
# Give proper permissions to upload directory
sudo chown -R $USER:$USER /home/opc/file-upload-server
chmod -R 755 /home/opc/file-upload-server/uploads
```

### PM2 not starting on boot
```bash
# Recreate startup script
pm2 unstartup
pm2 startup
pm2 save
```

## Logs Location

```bash
# PM2 logs
~/.pm2/logs/

# View real-time logs
pm2 logs file-upload-server --lines 100
```

## Backup Strategy

Regular backup of uploads directory:
```bash
# Create backup
tar -czf uploads-backup-$(date +%Y%m%d).tar.gz uploads/

# Restore backup
tar -xzf uploads-backup-YYYYMMDD.tar.gz
```

## Updates

To update the application:
```bash
cd /home/opc/file-upload-server
pm2 stop file-upload-server
git pull  # if using git
npm install  # if dependencies changed
pm2 restart file-upload-server
```

## Support

For issues or questions, check the logs first:
```bash
pm2 logs file-upload-server
```
