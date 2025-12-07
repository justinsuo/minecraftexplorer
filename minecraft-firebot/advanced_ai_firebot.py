"""
Multi-Modal AI FireBot - Sensor Fusion + Vision
Mimics real robot with thermal sensors + camera
Collects training data for future fine-tuning
"""

import subprocess
import time
import json
from pathlib import Path
import mss
from PIL import Image
import io
import base64
import ollama
import numpy as np
import csv

# Create directories
Path("logs").mkdir(exist_ok=True)
Path("logs/screenshots").mkdir(exist_ok=True)
Path("training_data").mkdir(exist_ok=True)
Path("training_data/fire_detected").mkdir(exist_ok=True)
Path("training_data/no_fire").mkdir(exist_ok=True)
Path("training_data/smoke_visible").mkdir(exist_ok=True)

print("🚀 Starting Multi-Modal AI FireBot...")
bot_process = subprocess.Popen(['node', 'autobot.js'])
time.sleep(5)

# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

def send_command(action, **kwargs):
    """Send command to bot"""
    cmd = {'action': action, **kwargs}
    with open('command.json', 'w') as f:
        json.dump(cmd, f)
    time.sleep(0.2)

def get_fire_data():
    """Read sensor data (thermal/smoke sensors)"""
    try:
        with open('fire_data.json', 'r') as f:
            return json.load(f)
    except:
        return {
            'fires': [], 
            'fire_count': 0, 
            'position': {'x': 0, 'y': 0, 'z': 0},
            'health': 20,
            'food': 20
        }

def capture_screen():
    """Capture camera feed"""

    with mss.mss() as sct:
        monitor = sct.monitors[1]
        screenshot = sct.grab(monitor)
        img = Image.frombytes('RGB', screenshot.size, screenshot.bgra, 'raw', 'BGRX')

        # OPTION 1: If Minecraft is fullscreen, use this:
        # return img.resize((640, 480))

        # OPTION 2: If Minecraft is windowed, crop to window location
        # Adjust these coordinates to match YOUR Minecraft window position
        # You can find these by moving your mouse to Minecraft window corners
        # and noting the coordinates
        # Example: left=100, top=100, right=1820, bottom=1080
        # img = img.crop((100, 100, 1820, 1080))

        # For now, save full screenshot so you can see what's being captured
        return img.resize((640, 480))

def calculate_distance(pos1, pos2):
    """Calculate distance between positions"""
    try:
        dx = pos1.get('x', 0) - pos2.get('x', 0)
        dy = pos1.get('y', 0) - pos2.get('y', 0)
        dz = pos1.get('z', 0) - pos2.get('z', 0)
        return (dx**2 + dy**2 + dz**2) ** 0.5
    except:
        return 0

# ============================================================================
# MULTI-MODAL AI - Sensor Fusion + Vision
# ============================================================================

def ask_qwen_multimodal(img, sensor_data, last_action):
    """
    AI analyzes: Thermal sensors + Visual camera together
    Like real wildfire robot
    """
    
    fire_count = sensor_data.get('fire_count', 0)
    actual_fires = sensor_data.get('actual_fires', 0)
    lava_count = sensor_data.get('lava_count', 0)
    position = sensor_data.get('position', {})
    fires = sensor_data.get('fires', [])
    health = sensor_data.get('health', 20)
    is_on_fire = sensor_data.get('is_on_fire', False)
    is_in_water = sensor_data.get('is_in_water', False)
    
    # Calculate direction to closest fire (if any)
    fire_direction = "UNKNOWN"
    if len(fires) > 0:
        closest = fires[0]
        dx = closest['x'] - position.get('x', 0)
        dz = closest['z'] - position.get('z', 0)
        angle = np.arctan2(dz, dx) * 180 / np.pi
        
        if -45 <= angle < 45:
            fire_direction = "EAST"
        elif 45 <= angle < 135:
            fire_direction = "SOUTH"
        elif -135 <= angle < -45:
            fire_direction = "NORTH"
        else:
            fire_direction = "WEST"
    
    buffered = io.BytesIO()
    img.save(buffered, format="PNG")
    img_base64 = base64.b64encode(buffered.getvalue()).decode()
    
    # Emergency status
    emergency = ""
    if is_on_fire:
        emergency = "⚠️ EMERGENCY: YOU ARE ON FIRE! "
    elif health < 10:
        emergency = f"⚠️ WARNING: Low health ({health}/20)! "
    elif is_in_water:
        emergency = "💧 Currently in water. "

    prompt = f"""
You are a wildfire patrol robot AI. Your mission: PATROL continuously and SUPPRESS fires immediately when detected.

{emergency}

SENSOR READINGS (Thermal/Smoke Detectors):
- Active fires (spreading): {actual_fires}
- Lava pools (static): {lava_count}
- Total heat signatures: {fire_count}
- Direction to nearest heat: {fire_direction}
- Your position: ({position.get('x', 0):.0f}, {position.get('y', 0):.0f}, {position.get('z', 0):.0f})
- Health: {health}/20
- Status: {"ON FIRE!" if is_on_fire else "In water" if is_in_water else "Normal"}
- Last action: {last_action}

CAMERA FEED:
[See image]

VISUAL ANALYSIS REQUIRED:
Look for these fire indicators:
- GLOW/BRIGHT AREAS (orange, red, yellow light from fire/lava)
- LAVA (bright orange/red liquid blocks)

CORE RULES (FOLLOW STRICTLY):
1. If thermal sensors show {fire_count} > 0 → You MUST respond with "SUPPRESS_FIRE"
2. If thermal sensors show 0 fires → You MUST keep moving (PATROL or MOVE_FORWARD)
3. NEVER stand still - always be moving or suppressing fires
4. If you see the same view as last time → TURN to explore new area
5. Prefer MOVE_FORWARD over PATROL when already moving well

DECISION PRIORITY:
- Fire detected (thermal > 0) → SUPPRESS_FIRE (ALWAYS!)
- No fire + moving well → MOVE_FORWARD (keep exploring)
- No fire + stuck/same view → TURN_RIGHT or TURN_LEFT (unstuck yourself)
- No fire + haven't moved much → PATROL (explore new area)

Think carefully and output EXACTLY:
GLOW_VISIBLE: YES/NO
LAVA_VISIBLE: YES/NO
STUCK: YES/NO (are you seeing the same view as before?)
CONFIDENCE: [0-100]%
ACTION: SUPPRESS_FIRE / TURN_LEFT / TURN_RIGHT / MOVE_FORWARD / PATROL
REASON: [max 15 words why you chose this action]
"""

    try:
        response = ollama.generate(
            model='llava:7b',
            prompt=prompt,
            images=[img_base64],
            options={'temperature': 0.2}  # Lower = more consistent
        )
        return response['response']
    except Exception as e:
        print(f"⚠️  AI error: {e}")
        return f"ACTION: PATROL\nREASON: AI error, exploring area\nVISUAL_MATCHES_SENSORS: NO"

def parse_multimodal_response(response):
    """Extract action and analysis from AI response"""

    response_upper = response.upper()

    # Extract visual analysis
    analysis = {
        'smoke_visible': 'SMOKE_VISIBLE: YES' in response_upper,
        'glow_visible': 'GLOW_VISIBLE: YES' in response_upper,
        'lava_visible': 'LAVA_VISIBLE: YES' in response_upper,
        'visual_matches': 'VISUAL_MATCHES_SENSORS: YES' in response_upper,
        'stuck': 'STUCK: YES' in response_upper
    }

    # Extract action - prioritize suppress, then movement
    if 'SUPPRESS_FIRE' in response_upper or 'SUPPRESS FIRE' in response_upper:
        action = 'suppress'
    elif 'MOVE_FORWARD' in response_upper or 'MOVE FORWARD' in response_upper:
        action = 'move_forward'
    elif 'TURN_LEFT' in response_upper or 'TURN LEFT' in response_upper:
        action = 'turn_left'
    elif 'TURN_RIGHT' in response_upper or 'TURN RIGHT' in response_upper:
        action = 'turn_right'
    elif 'PATROL' in response_upper:
        action = 'patrol'
    else:
        # Default: keep moving forward
        action = 'move_forward'

    return action, analysis

# ============================================================================
# TRAINING DATA COLLECTION
# ============================================================================

def save_training_sample(img, sensor_data, ai_analysis, action, decision_num):
    """Save labeled training data"""

    fire_count = sensor_data.get('fire_count', 0)
    timestamp = int(time.time())

    # Convert RGBA to RGB (fix JPEG error)
    if img.mode == 'RGBA':
        img = img.convert('RGB')

    # Determine label based on SENSOR-VISION CORRELATION
    # Only label as fire_detected if BOTH sensors AND vision agree
    has_visual_fire_signs = (
        ai_analysis.get('glow_visible', False) or
        ai_analysis.get('lava_visible', False)
    )

    # More reliable: sensors detect fire AND glow/lava visible
    # Don't trust AI's visual_matches claim alone - require actual visual signs
    sensor_visual_match = ai_analysis.get('visual_matches', False)

    # FIXED LOGIC: Require BOTH sensors AND visual signs for fire_detected
    if fire_count > 0 and has_visual_fire_signs:
        label = 'fire_detected'
        folder = f'training_data/fire_detected'
    elif fire_count == 0:
        # No sensor fire detected -> no_fire (regardless of visual false positives)
        label = 'no_fire'
        folder = f'training_data/no_fire'
    else:
        # Ambiguous case: sensors say fire but NO visual signs (glow/lava)
        # This catches false sensor readings
        label = 'uncertain'
        folder = f'training_data/uncertain'
        Path(folder).mkdir(exist_ok=True)
    
    # Save image
    filename = f'{folder}/sample_{decision_num}_{timestamp}.jpg'
    img.save(filename)
    
    # Save metadata
    metadata = {
        'filename': filename,
        'timestamp': timestamp,
        'decision_number': decision_num,
        'label': label,
        'fire_count_sensor': fire_count,
        'smoke_visible': ai_analysis['smoke_visible'],
        'glow_visible': ai_analysis['glow_visible'],
        'lava_visible': ai_analysis['lava_visible'],
        'visual_matches_sensors': ai_analysis['visual_matches'],
        'action_taken': action,
        'position': sensor_data.get('position', {})
    }
    
    # Append to CSV
    csv_file = 'training_data/training_log.csv'
    file_exists = Path(csv_file).exists()
    
    with open(csv_file, 'a', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=metadata.keys())
        if not file_exists:
            writer.writeheader()
        writer.writerow(metadata)
    
    return filename

def log_event(event_type, data):
    """Log events for analysis"""
    log_entry = {
        'timestamp': time.time(),
        'type': event_type,
        'data': data
    }
    with open('logs/events.jsonl', 'a') as f:
        f.write(json.dumps(log_entry) + '\n')

# ============================================================================
# MAIN LOOP - Multi-Modal AI Control
# ============================================================================

last_action = 'none'
fires_suppressed = 0
decision_count = 0
training_samples_collected = 0

print("\n" + "="*70)
print("🤖 MULTI-MODAL AI FIREBOT")
print("="*70)
print("\nSensor Fusion: Thermal + Smoke Detectors + Visual Camera")
print("Training data collection: ENABLED")
print("AI Model: Qwen LLaVA 7B")
print("\n" + "="*70 + "\n")

print("⚠️  IMPORTANT: Make sure Minecraft is FULLSCREEN (F11)")
print("   Camera should be following bot (/gamemode spectator, /tp @s FireBot)")
print("\nPress Enter, then you have 5 seconds to switch back to Minecraft...")

input("Press Enter...")

print("\n⏳ Starting in 5 seconds - SWITCH TO MINECRAFT NOW!")
for i in range(5, 0, -1):
    print(f"   {i}...")
    time.sleep(1)

print("🚀 Starting!\n")


try:
    # Start with initial patrol movement
    print("🚶 Starting initial patrol...")
    send_command('patrol')

    patrol_steps = 0  # Track how long we've been patrolling

    while True:
        decision_count += 1

        print(f"\n{'='*70}")
        print(f"DECISION #{decision_count}")
        print(f"{'='*70}")

        # Quick sensor check
        sensor_data = get_fire_data()
        fire_count = sensor_data.get('fire_count', 0)
        fires = sensor_data.get('fires', [])
        position = sensor_data.get('position', {})

        print(f"📍 Position: ({position.get('x', 0):.0f}, {position.get('y', 0):.0f}, {position.get('z', 0):.0f})")
        print(f"🌡️  Thermal sensors: {fire_count} heat signatures")

        # =================================================================
        # FIRE DETECTED - Drop everything and suppress immediately
        # =================================================================
        if fire_count > 0:
            print("🔥🔥🔥 FIRE DETECTED - ENGAGING IMMEDIATELY 🔥🔥🔥")

            # Quick capture for training data (don't wait for AI)
            img = capture_screen()

            # Default analysis (will be updated if AI finishes in time)
            analysis = {'glow_visible': False, 'lava_visible': False, 'stuck': False}

            # Save training data immediately (AI analysis will be default for now)
            try:
                sample_file = save_training_sample(img, sensor_data, analysis, 'suppress', decision_count)
                training_samples_collected += 1
                print(f"💾 Saved: {sample_file}")
            except:
                pass

            # Don't wait - immediately suppress fire
            action = 'suppress'

        # =================================================================
        # NO FIRE - Simple patrol logic (NO AI needed for movement!)
        # =================================================================
        else:
            print(f"✅ No fire - patrolling (step {patrol_steps})")

            # Simple rule-based movement (fast and reliable)
            if patrol_steps % 15 == 0 and patrol_steps > 0:
                # Every 15 steps, turn to explore new direction
                action = 'turn_right'
                print("→ 🔄 TURNING to explore new area")
                patrol_steps = 0
            else:
                # Keep moving forward
                action = 'move_forward'
                print("→ ⬆️  MOVING FORWARD")

            patrol_steps += 1

            # Only capture training data occasionally (every 5th decision)
            if decision_count % 5 == 0:
                print("📸 Capturing training data...")
                img = capture_screen()

                # Default analysis (no AI needed for simple movement)
                analysis = {'glow_visible': False, 'lava_visible': False, 'stuck': False}

                # Save training data
                try:
                    sample_file = save_training_sample(img, sensor_data, analysis, action, decision_count)
                    training_samples_collected += 1
                    print(f"💾 Saved: {sample_file}")
                except:
                    pass

        # =================================================================
        # EXECUTE ACTION - Fast and simple
        # =================================================================
        if action == 'suppress':
            print("→ 💧 SUPPRESSING FIRE")
            send_command('stop')
            time.sleep(0.3)

            # Navigate and suppress
            if len(fires) > 0:
                closest = fires[0]
                distance = calculate_distance(position, closest)
                print(f"   Target: {distance:.1f}m away")

                if distance > 4:
                    send_command('goto', x=closest['x'], y=closest['y'], z=closest['z'])
                    time.sleep(4)  # Faster navigation

                send_command('suppress')
                time.sleep(5)  # Faster suppression
                fires_suppressed += 1

            print("→ 🚶 Resuming patrol")
            send_command('patrol')
            patrol_steps = 0

        elif action == 'move_forward':
            send_command('move_forward')
            time.sleep(0.8)  # Quick forward movement

        elif action == 'turn_right':
            send_command('turn_right')
            time.sleep(1.0)  # Quick turn

        elif action == 'turn_left':
            send_command('turn_left')
            time.sleep(1.0)  # Quick turn

        # Log
        try:
            log_event('multimodal_decision', {
                'decision_number': decision_count,
                'action': action,
                'sensor_fire_count': fire_count,
                'fires_suppressed_total': fires_suppressed
            })
        except:
            pass

        last_action = action

        # Fast loop - keep moving!
        time.sleep(0.2)

except KeyboardInterrupt:
    print("\n\n🛑 Shutting down Multi-Modal AI FireBot...")
    bot_process.terminate()
    
    print("\n" + "="*70)
    print("📊 SESSION STATISTICS")
    print("="*70)
    print(f"  AI decisions made:           {decision_count}")
    print(f"  Fires suppressed:            {fires_suppressed}")
    print(f"  Training samples collected:  {training_samples_collected}")
    print(f"  Training data location:      training_data/")
    print(f"  Training log:                training_data/training_log.csv")
    print("="*70)
    print("\n✅ Multi-Modal AI FireBot offline\n")