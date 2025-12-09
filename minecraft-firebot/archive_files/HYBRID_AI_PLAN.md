# Hybrid AI Architecture: Mobile VLM + CNN
*Fast Planning + Instant Detection for Real Robots*

## 🎯 Architecture Overview

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Mobile VLM    │    │      CNN         │    │   Robot Control │
│   (Planner)     │───▶│  (Detector)      │───▶│    (Actions)    │
│                 │    │                  │    │                 │
│ • Strategy      │    │ • Fire Detection │    │ • Movement      │
│ • Navigation    │    │ • Obstacles      │    │ • Suppression   │
│ • Decision      │    │ • Real-time      │    │ • Safety        │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

## 🚀 Key Benefits

| Component | Speed | Size | Use Case | Examples |
|-----------|-------|------|----------|----------|
| **Mobile VLM** | 100-500ms | 1-2GB | Strategic planning | Route planning, emergency assessment |
| **CNN** | 10-50ms | 1-5MB | Instant detection | Fire detection, obstacle avoidance |
| **Combined** | 20-100ms | 1-3GB | Full autonomy | Complete firefighting mission |

## 📱 Mobile VLM Options

### **Top Recommendations:**

1. **Qwen-VL (Mobile)**
   - Size: 1.8GB → 300MB (quantized)
   - Speed: 200-400ms
   - Great for: Strategic planning, route optimization

2. **LLaVA-1.5-7B (4-bit quantized)**
   - Size: 4GB → 1.2GB
   - Speed: 150-300ms
   - Great for: Complex decision making

3. **Phi-3-Vision**
   - Size: 2.2GB → 500MB
   - Speed: 100-250ms
   - Great for: Fast planning with good reasoning

4. **MobileVLM (专为移动端设计)**
   - Size: 1.1GB
   - Speed: 80-150ms
   - Great for: Real-time strategy adjustments

## ⚡ CNN Tasks (Instant Detection)

### **CNN Handles (10-50ms):**
- ✅ **Fire detection** (primary)
- ✅ **Smoke detection**
- ✅ **Human/people detection**
- ✅ **Obstacle detection**
- ✅ **Water source detection**
- ✅ **Path clearance**
- ✅ **Temperature hotspots**

### **VLM Handles (100-500ms):**
- ✅ **Strategic planning** (which fire to prioritize)
- ✅ **Route optimization** (best path through burning area)
- ✅ **Emergency assessment** (evacuation routes)
- ✅ **Multi-step coordination** (team planning)
- ✅ **Complex decision making** (save person vs suppress fire)

## 🔧 Task Delegation System

### **Real-Time Loop (20-60 FPS):**
```python
def main_loop():
    while mission_active:
        # 1. CNN: Instant detection (10-50ms)
        fire_detected = cnn.predict(current_frame)
        obstacles = cnn.detect_obstacles(current_frame)
        people = cnn.detect_people(current_frame)

        # 2. VLM: Strategic planning (every 1-2 seconds)
        if time_since_last_plan > 1.0:
            strategy = mobile_vlm.plan(
                context="fires=" + str(fire_detected),
                goal="suppress_fires_and_save_people"
            )

        # 3. Execute actions (instant)
        execute_actions(strategy, fire_detected, obstacles, people)
```

### **Decision Flow:**
```
📷 Camera Feed
    ├─► CNN (10ms): "FIRE DETECTED at (x,y)"
    │   └─► Immediate action: "Move to fire"
    │
    ├─► CNN (15ms): "PERSON DETECTED at (a,b)"
    │   └─► Immediate action: "Approach person"
    │
    └─► VLM (200ms): "STRATEGY: Save person first, then fire"
        └─► Adjusts long-term plan
```

## 🎮 Implementation Plan

### **Phase 1: CNN Infrastructure** (Already done ✅)
- [x] Fire detection CNN
- [x] Training pipeline
- [x] Online learning system

### **Phase 2: Mobile VLM Integration**
- [ ] Install Mobile VLM (Qwen-VL or Phi-3-Vision)
- [ ] Create planning interface
- [ ] Implement task delegation system
- [ ] Test planning latency

### **Phase 3: Hybrid System**
- [ ] Combine CNN + VLM responses
- [ ] Optimize task switching
- [ ] Real-world testing
- [ ] Performance tuning

## 💻 Mobile VLM Setup

### **Option 1: Qwen-VL Mobile**
```bash
# Install Qwen-VL
pip install transformers accelerate
pip install qwen-vl-utils

# Model setup
from transformers import AutoModelForCausalLM, AutoTokenizer
model = AutoModelForCausalLM.from_pretrained(
    "Qwen/Qwen-VL-Chat",
    device_map="auto",
    load_in_4bit=True  # Reduces from 7GB to 2GB
)
```

### **Option 2: Phi-3-Vision**
```bash
# Install Phi-3
pip install transformers torch
pip install flash-attn  # For speed

# Model setup
from transformers import AutoModelForCausalLM
model = AutoModelForCausalLM.from_pretrained(
    "microsoft/Phi-3-vision-128k-instruct",
    device_map="auto",
    torch_dtype="auto",
    trust_remote_code=True
)
```

## 🤖 Integration Code Structure

### **Hybrid AI Manager:**
```python
class HybridAIManager:
    def __init__(self):
        # Fast CNN components
        self.fire_cnn = FireCNN("models/fire_cnn_trained.h5")
        self.obstacle_cnn = ObstacleCNN("models/obstacle_cnn.h5")

        # Smart VLM planner
        self.mobile_vlm = MobileVLM("Qwen/Qwen-VL-Chat")

        # Task management
        self.last_plan_time = 0
        self.current_strategy = None

    def process_frame(self, frame):
        # Instant CNN detections (10-50ms total)
        fire_result = self.fire_cnn.predict(frame)
        obstacles = self.obstacle_cnn.detect(frame)

        # Strategic VLM planning (every 1-2 seconds)
        current_time = time.time()
        if current_time - self.last_plan_time > 1.5:
            self.current_strategy = self.mobile_vlm.plan(
                frame,
                context=f"Fire: {fire_result}, Obstacles: {len(obstacles)}"
            )
            self.last_plan_time = current_time

        # Combined action decision
        return self.decide_actions(fire_result, obstacles, self.current_strategy)
```

## 📊 Performance Targets

| Operation | Target | Current (LLaVA) | Improvement |
|-----------|--------|------------------|-------------|
| **Fire Detection** | 20ms | 2000-5000ms | **100-250x faster** |
| **Strategic Planning** | 200ms | 2000-5000ms | **10-25x faster** |
| **Full Loop** | 250ms | 5000-10000ms | **20-40x faster** |
| **Memory Usage** | 3GB | 8GB | **2.5x less** |
| **Model Size** | 2GB | 5GB | **2.5x smaller** |

## 🎯 Real Robot Deployment

### **Jetson Orin Setup:**
```bash
# Install optimized versions
pip install torch-jetson
pip install transformers[tensorrt]

# Enable TensorRT acceleration
model = AutoModelForCausalLM.from_pretrained(
    "Qwen/Qwen-VL-Chat",
    device_map="auto",
    torch_dtype=torch.float16,
    tensorrt_dir="tensorrt_cache"
)
```

### **Expected Real-World Performance:**
- **Fire detection**: <50ms (instant response)
- **Planning response**: <300ms (strategic decisions)
- **Total autonomy**: <400ms latency
- **Battery life**: 3-4 hours continuous
- **Range**: 500m wireless control

## 🔄 Training Strategy

### **CNN Training** (Immediate):
```bash
# Train on fire/real-world data
python3 models/train_minecraft_cnn.py --real-fire-data

# Expected: 95%+ accuracy, <50ms inference
```

### **VLM Fine-tuning** (Advanced):
```bash
# Fine-tune planning on Minecraft videos
python3 fine_tune_planner.py --minecraft-footage

# Expected: Good strategic decisions, <300ms planning
```

## 🚀 Next Steps

1. **Choose Mobile VLM** (Qwen-VL recommended)
2. **Install Mobile VLM** in virtual environment
3. **Create hybrid integration** code
4. **Test combined system** on Minecraft
5. **Optimize for Jetson** deployment
6. **Real-world testing**

## 💡 Why This Architecture Works

### **For Minecraft Testing:**
- ✅ **Fast learning** in controlled environment
- ✅ **Safe testing** of dangerous scenarios
- ✅ **Rapid iteration** on algorithms
- ✅ **Easy data collection**

### **For Real Robots:**
- ✅ **Real-time performance** under 100ms
- ✅ **Strategic intelligence** for complex situations
- ✅ **Energy efficient** for mobile deployment
- ✅ **Scalable** to multiple robots

---

**🎉 This hybrid approach gives you the best of both worlds: CNN speed + VLM intelligence!**