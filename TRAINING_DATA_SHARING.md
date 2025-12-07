# How to Share Training Data with Justin

## DON'T Put Training Data in Git

**Why NOT?**
- Training data is HUGE (thousands of screenshots = hundreds of MB)
- GitHub has file size limits
- Slows down git clone/pull
- Not code - doesn't belong in version control

## DO Share Training Data This Way

### Option 1: Cloud Storage (Recommended)
Upload your `training_data/` folder to:
- **Google Drive**: Share folder link with Justin
- **Dropbox**: Share folder
- **iCloud Drive**: Share folder
- **AWS S3 / Google Cloud**: For larger datasets

**Steps:**
```bash
# Zip your training data
cd /Users/elsatsia/VS\ Code/minecraftexplorer/minecraft-firebot
tar -czf training_data_$(date +%Y%m%d).tar.gz training_data/

# Upload to Google Drive/Dropbox
# Share link with Justin
```

### Option 2: Direct File Transfer
If on same network:
```bash
# On your Mac (sender):
cd minecraft-firebot
python3 -m http.server 8000

# Justin's computer (receiver):
# Go to http://YOUR_IP:8000 in browser
# Download training_data folder
```

### Option 3: Combine Datasets
Both collect data separately, then merge:

**Your workflow:**
1. Collect 500 images in `training_data/`
2. Share with Justin via Google Drive

**Justin's workflow:**
1. Collect 500 images in `training_data/`
2. Download your data
3. Merge datasets:
```bash
# Justin's computer:
cp -r your_training_data/* training_data/fire_detected/
cp -r your_training_data/* training_data/no_fire/
```

## Dataset Organization

Keep datasets organized:
```
training_data/
  fire_detected/
    sample_1_1765028627.jpg  # Your data
    sample_2_1765028628.jpg
    justin_sample_1_xxx.jpg  # Justin's data
    justin_sample_2_xxx.jpg
  no_fire/
    sample_1_1765028627.jpg
    justin_sample_1_xxx.jpg
  training_log.csv  # Merged metadata
```

## Best Practice

1. **Each person collects data independently**
2. **Periodically sync datasets** (weekly/monthly)
3. **Use cloud storage** (not Git)
4. **Keep backups** - training data is valuable!

## .gitignore Already Configured

Your `.gitignore` already excludes:
```
training_data/
screenshots/
logs/
```

This means:
- ✅ You can freely collect data locally
- ✅ Won't accidentally commit to Git
- ✅ Each person's data stays separate until manually merged
