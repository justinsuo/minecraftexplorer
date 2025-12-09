# Setup Mobile VLM for FireBot

## 🚀 Quick Setup

### Step 1: Install Python Dependencies
```bash
# Activate your virtual environment if you have one
# or install system-wide

pip install transformers torch flask qwen-vl-utils pillow numpy
```

### Step 2: Start VLM Bridge Server
```bash
# Terminal 1: Start the VLM bridge
python3 mobile_vlm_bridge.py
```

### Step 3: Start Your Enhanced FireBot
```bash
# Terminal 2: Start the FireBot with VLM
node autobot.js
```

## 🧠 What It Does Now

### With Mobile VLM:
- 🧠 **Strategic Planning**: AI analyzes situation and plans actions
- 🏗️ **Building**: Automatically builds towers for elevated fires
- 🎯 **Smart Decisions**: VLM suggests optimal response strategies
- 📊 **Context Awareness**: Understands bot's current situation

### Without VLM (fallback):
- ✅ **Logic-only mode**: Still works perfectly
- 🔥 **Fire detection**: Accurate fire detection
- 💧 **Suppression**: Effective fire fighting
- 🏗️ **Building**: Tower building still works

## 🔥 Test Scenarios

### Elevated Fire Test:
1. Start a fire on a rooftop or high structure
2. Bot will: "Elevated fire detected - building tower!"
3. Builds dirt tower to reach fire
4. Suppresses fire from above

### VLM Strategy Test:
1. Bot will request strategic plans every 10 seconds
2. Follows VLM suggestions for patrol patterns
3. Adapts response based on situation

## 🛠️ Troubleshooting

If VLM doesn't work:
- Bot still works perfectly in logic-only mode
- Install dependencies with: `pip install transformers torch flask`
- Check that VLM server is running on port 5000

Your FireBot is now **super intelligent** with AI strategic planning! 🚀