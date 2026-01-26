# Manual Deployment Cheat Sheet for AWS EC2

If the GitHub Automation fails or you just want to update the site immediately yourself, follow these steps.

## 1. Connect to your AWS EC2 Instance
Open your terminal/SSH client.

## 2. Navigate and Pull Latest Code
```bash
cd ~/SchoolSoftware
git pull origin main
```
*Note: If it says "Already up to date", you are good. If it downloads files, you have new code.*

## 3. Build the Website
Go to the frontend folder and build the React app.
```bash
cd frontend
npm install
npm run build
```

## 4. Deploy (Copy Files)
This replaces the live website files with your new build.
```bash
sudo cp -r dist/* /var/www/school_app/
```

## 5. Restart Server (Optional but Recommended)
```bash
sudo systemctl restart nginx
```

## 6. Verify
Go to `http://52.66.13.31/` in your browser.
