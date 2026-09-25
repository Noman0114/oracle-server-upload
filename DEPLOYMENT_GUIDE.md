# 🚀 Complete Deployment Guide - File Upload Server

## ✅ Project Features

### **Authentication System**
- Username: `numan`
- Password: `numan114`
- Session-based authentication (24-hour session)

### **File Upload**
- ✓ Drag & drop support
- ✓ Multiple file upload
- ✓ Large file support (up to 500MB)
- ✓ Real-time upload progress
- ✓ Automatic file categorization

### **File Management**
- ✓ **View** - Open detailed file information page
- ✓ **Download** - Download files directly
- ✓ **Delete** - Remove files from server (with confirmation)
- ✓ Pagination (10 files per page)

### **File Organization**
Files are automatically organized into folders by type:
```
uploads/
├── images/      → .jpg, .jpeg, .png, .gif, .bmp, .webp, .svg
├── videos/      → .mp4, .avi, .mov, .wmv, .flv, .mkv, .webm
├── archives/    → .zip, .rar, .7z, .tar, .gz, .bz2
├── documents/   → .pdf, .doc, .docx, .xls, .xlsx, .ppt, .pptx, .txt
└── others/      → All other file types
```

---

## 📋 Oracle Server Deployment Steps

### **Step 1: Connect to Oracle Instance**
```bash
# SSH into your Oracle server
ssh opc@YOUR_SERVER_IP

# Or use your custom username
ssh username@YOUR_SERVER_IP
```

### **Step 2: Install Node.js**
```bash
# Update system packages
sudo yum update -y

# Install Node.js 18.x LTS
curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
sudo yum install -y nodejs

# Verify installation
node --version   # Should show v18.x.x
npm --version    # Should show 9.x.x or higher
```

### **Step 3: Install PM2 Process Manager**
```bash
# Install PM2 globally
sudo npm install -g pm2

# Verify PM2 installation
pm2 --version

# Setup PM2 to start on system boot
pm2 startup
# Run the command it outputs (starts with 'sudo env PATH=...')
```

### **Step 4: Create Project Directory**
```bash
# Create directory for the project
sudo mkdir -p /home/opc/file-upload-server
sudo chown -R $USER:$USER /home/opc/file-upload-server
cd /home/opc/file-upload-server
```

### **Step 5: Upload Project Files**

**Option A: Using SCP (from your local Windows machine)**
```bash
# Open PowerShell on your local machine
scp -r C:\Users\Webseowiz12\Pictures\upload\* opc@YOUR_SERVER_IP:/home/opc/file-upload-server/
```

**Option B: Using WinSCP or FileZilla**
1. Connect to your server
2. Upload all files from `C:\Users\Webseowiz12\Pictures\upload\` to `/home/opc/file-upload-server/`

**Option C: Using Git**
```bash
# On server
cd /home/opc/file-upload-server
git clone YOUR_GIT_REPO_URL .
```

### **Step 6: Install Dependencies**
```bash
cd /home/opc/file-upload-server
npm install
```

### **Step 7: Configure Firewall**

**Oracle Linux Firewall:**
```bash
# Check if firewalld is running
sudo systemctl status firewalld

# Add port 8080 (or 3000) to firewall
sudo firewall-cmd --permanent --add-port=8080/tcp
sudo firewall-cmd --reload

# Verify the rule
sudo firewall-cmd --list-ports
```

**Oracle Cloud Infrastructure (OCI) Security List:**
1. Login to OCI Console: https://cloud.oracle.com
2. Navigate to: **Networking → Virtual Cloud Networks**
3. Click on your VCN name
4. Click on **Security Lists** (left sidebar)
5. Click on the default security list
6. Click **Add Ingress Rules**
7. Fill in:
   - **Source CIDR:** `0.0.0.0/0`
   - **IP Protocol:** `TCP`
   - **Destination Port Range:** `8080` (or 3000)
   - **Description:** `File Upload Server`
8. Click **Add Ingress Rules**

### **Step 8: Start Server with PM2**
```bash
# Start the application using ecosystem file
pm2 start ecosystem.config.js

# Or start directly
pm2 start server.js --name "file-upload-server"

# Save PM2 process list
pm2 save

# View running processes
pm2 list
```

### **Step 9: Access Your Application**
```
http://YOUR_SERVER_IP:8080
```

**Login with:**
- Username: `numan`
- Password: `numan114`

---

## 🔧 PM2 Management Commands

### **View & Monitor**
```bash
# List all running processes
pm2 list

# View real-time logs
pm2 logs file-upload-server

# View last 100 log lines
pm2 logs file-upload-server --lines 100

# Monitor CPU/Memory usage
pm2 monit

# Show detailed process info
pm2 show file-upload-server
```

### **Control**
```bash
# Restart application
pm2 restart file-upload-server

# Stop application
pm2 stop file-upload-server

# Delete from PM2
pm2 delete file-upload-server

# Reload (zero-downtime restart)
pm2 reload file-upload-server
```

### **Logs Management**
```bash
# Clear logs
pm2 flush

# View error logs only
pm2 logs file-upload-server --err

# View output logs only
pm2 logs file-upload-server --out
```

---

## 🔐 Security Recommendations

### **1. Change Session Secret**
Edit `server.js` and change the session secret:
```javascript
secret: 'YOUR-STRONG-SECRET-KEY-HERE'
```

### **2. Setup HTTPS with SSL Certificate**
```bash
# Install Certbot
sudo yum install -y certbot

# Get SSL certificate (you need a domain name)
sudo certbot certonly --standalone -d yourdomain.com

# Update server.js to use HTTPS
# Add SSL configuration
```

### **3. Setup Nginx Reverse Proxy (Recommended)**
```bash
# Install Nginx
sudo yum install -y nginx

# Configure Nginx
sudo nano /etc/nginx/conf.d/file-upload.conf
```

Add this configuration:
```nginx
server {
    listen 80;
    server_name yourdomain.com;

    client_max_body_size 500M;

    location / {
        proxy_pass http://localhost:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
# Start Nginx
sudo systemctl start nginx
sudo systemctl enable nginx
```

### **4. Regular Backups**
```bash
# Create backup script
nano /home/opc/backup.sh
```

Add:
```bash
#!/bin/bash
BACKUP_DIR="/home/opc/backups"
DATE=$(date +%Y%m%d-%H%M%S)

mkdir -p $BACKUP_DIR
tar -czf $BACKUP_DIR/uploads-$DATE.tar.gz /home/opc/file-upload-server/uploads/

# Keep only last 7 days of backups
find $BACKUP_DIR -name "uploads-*.tar.gz" -mtime +7 -delete
```

```bash
# Make executable
chmod +x /home/opc/backup.sh

# Add to crontab (daily at 2 AM)
crontab -e
# Add: 0 2 * * * /home/opc/backup.sh
```

---

## 🐛 Troubleshooting

### **Problem: Port Already in Use**
```bash
# Find process using the port
sudo lsof -i :8080

# Kill the process
sudo kill -9 <PID>

# Or find and kill
sudo fuser -k 8080/tcp
```

### **Problem: Permission Denied**
```bash
# Fix ownership
sudo chown -R $USER:$USER /home/opc/file-upload-server

# Fix permissions
chmod -R 755 /home/opc/file-upload-server
chmod -R 755 /home/opc/file-upload-server/uploads
```

### **Problem: Can't Access from Browser**
```bash
# Check if server is running
pm2 list

# Check if port is open
sudo netstat -tulpn | grep 8080

# Check firewall
sudo firewall-cmd --list-ports

# Check OCI Security List (via OCI Console)
```

### **Problem: Upload Fails**
```bash
# Check disk space
df -h

# Check uploads directory permissions
ls -la uploads/

# Check PM2 logs
pm2 logs file-upload-server --lines 50
```

### **Problem: PM2 Not Starting on Boot**
```bash
# Remove old startup script
pm2 unstartup

# Create new startup script
pm2 startup

# Run the command it outputs

# Save current PM2 list
pm2 save

# Reboot to test
sudo reboot
```

---

## 📊 File Structure
```
file-upload-server/
├── server.js                    # Main server file
├── package.json                 # Dependencies
├── ecosystem.config.js          # PM2 configuration
├── README.md                   # Project documentation
├── DEPLOYMENT_GUIDE.md         # This file
├── .gitignore                  # Git ignore file
├── views/
│   ├── login.ejs              # Login page
│   ├── dashboard.ejs          # File management dashboard
│   └── view.ejs               # Individual file view page
├── uploads/                    # Auto-created on first run
│   ├── images/
│   ├── videos/
│   ├── archives/
│   ├── documents/
│   └── others/
└── logs/                       # PM2 logs (auto-created)
    ├── err.log
    ├── out.log
    └── combined.log
```

---

## 🎯 Quick Commands Reference

```bash
# Start server
pm2 start ecosystem.config.js

# View logs
pm2 logs file-upload-server

# Restart
pm2 restart file-upload-server

# Stop
pm2 stop file-upload-server

# Status
pm2 list

# Save configuration
pm2 save

# Update code
cd /home/opc/file-upload-server
git pull  # if using git
npm install
pm2 restart file-upload-server
```

---

## 📞 Support & Maintenance

### **Check Server Health**
```bash
# System resources
htop

# Disk usage
df -h
du -sh /home/opc/file-upload-server/uploads/*

# Memory usage
free -h

# PM2 status
pm2 status
```

### **Update Node.js**
```bash
# Update to latest LTS
curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
sudo yum update -y nodejs
```

### **Clean Up Old Files**
```bash
# Find files older than 30 days
find /home/opc/file-upload-server/uploads -type f -mtime +30

# Delete files older than 30 days (be careful!)
find /home/opc/file-upload-server/uploads -type f -mtime +30 -delete
```

---

## ✨ Features Summary

| Feature | Status | Description |
|---------|--------|-------------|
| Authentication | ✅ | Login with username/password |
| File Upload | ✅ | Drag & drop, multiple files, up to 500MB |
| File View | ✅ | Detailed file information page |
| File Download | ✅ | Direct download from server |
| File Delete | ✅ | Remove files with confirmation |
| Auto-categorization | ✅ | Files organized by type |
| Pagination | ✅ | 10 files per page |
| Responsive Design | ✅ | Works on mobile & desktop |
| Session Management | ✅ | 24-hour sessions |
| Progress Bar | ✅ | Real-time upload progress |

---

## 📝 Notes

1. **Default port:** Changed to 8080 in ecosystem.config.js (can be modified)
2. **File size limit:** 500MB per file
3. **Session duration:** 24 hours
4. **Files per page:** 10 (can be changed in server.js line 124)

---

**Deployment Date:** 2026-09-25
**Version:** 1.0.0
**Node.js Version:** 18.x LTS
**PM2 Version:** Latest

---

🎉 **Your file upload server is ready for production!**
