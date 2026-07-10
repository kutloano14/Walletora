#!/bin/bash
# Create HTTP Basic Auth password file for admin dashboards
# Run this on your production server

echo "🔐 Creating admin authentication..."

# Create .htpasswd file (replace 'admin' and 'your_secure_password' with actual values)
htpasswd -c /path/to/secure/.htpasswd admin

echo "✅ Admin password file created"
echo "📝 Update .htaccess with correct path to .htpasswd file"
echo "⚠️  Remember to:"
echo "   1. Store .htpasswd outside web root for security"
echo "   2. Set proper file permissions (chmod 600)"
echo "   3. Use strong passwords for production"