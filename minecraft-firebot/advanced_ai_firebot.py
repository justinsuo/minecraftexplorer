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
You are a wildfire detection AI with MULTIPLE SENSORS (like a real firefighting robot).

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

Your mission: CORRELATE sensors with vision to make accurate decisions.

PRIORITY RULES:
1. Active FIRES are more urgent than static LAVA (fires spread and destroy)
2. If you're on fire or low health, retreat is acceptable
3. Focus on biggest fire clusters first (houses burning down)

If thermal sensors detect {fire_count} heat sources, you should see visual signs:
- SMOKE (gray/white clouds or haze)
- ORANGE/RED GLOW (fire light)
- LAVA (bright orange/red liquid)
- HEAT SHIMMER or bright areas
- FLAMES (orange/yellow flickering)

CRITICAL ANALYSIS:
1. Do you see SMOKE (gray/white haze, clouds)? → YES/NO
2. Do you see GLOW/BRIGHT AREAS (orange, red, yellow)? → YES/NO
3. Do you see LAVA (liquid orange/red)? → YES/NO
4. Does the visual match thermal reading of {fire_count} heat sources? → YES/NO

DECISION RULES:
- If thermal={fire_count} > 0 AND you see visual signs → SUPPRESS_FIRE (go put it out!)
- If thermal > 0 but NO visual signs → TURN_{fire_direction} (turn to face fire)
- If thermal=0 (no fire) → PATROL (explore new area) OR MOVE_FORWARD (keep exploring)
- If stuck (same view as before) → TURN_LEFT or TURN_RIGHT

Think carefully and output EXACTLY:
SMOKE_VISIBLE: YES/NO
GLOW_VISIBLE: YES/NO
LAVA_VISIBLE: YES/NO
VISUAL_MATCHES_SENSORS: YES/NO
CONFIDENCE: [0-100]%
ACTION: SUPPRESS_FIRE / TURN_LEFT / TURN_RIGHT / MOVE_FORWARD / PATROL / SCAN_360
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
        'smoke_visible': 'YES' in response and 'SMOKE_VISIBLE: YES' in response_upper,
        'glow_visible': 'YES' in response and 'GLOW_VISIBLE: YES' in response_upper,
        'lava_visible': 'YES' in response and 'LAVA_VISIBLE: YES' in response_upper,
        'visual_matches': 'VISUAL_MATCHES_SENSORS: YES' in response_upper
    }
    
    # Extract action
    if 'SUPPRESS_FIRE' in response_upper:
        action = 'suppress'
    elif 'TURN_LEFT' in response_upper:
        action = 'turn_left'
    elif 'TURN_RIGHT' in response_upper:
        action = 'turn_right'
    elif 'TURN_NORTH' in response_upper or 'TURN_SOUTH' in response_upper or 'TURN_EAST' in response_upper or 'TURN_WEST' in response_upper:
        action = 'turn_right'  # Generic turn
    elif 'MOVE_FORWARD' in response_upper:
        action = 'move_forward'
    elif 'SCAN_360' in response_upper:
        action = 'scan_360'
    elif 'PATROL' in response_upper:
        action = 'patrol'
    else:
        action = 'patrol'
    
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

    # More reliable: sensors detect fire AND (glow or lava visible)
    # OR sensors detect fire AND visual_matches is True
    sensor_visual_match = ai_analysis.get('visual_matches', False)

    if fire_count > 0 and (has_visual_fire_signs or sensor_visual_match):
        label = 'fire_detected'
        folder = f'training_data/fire_detected'
    elif fire_count == 0 and not has_visual_fire_signs:
        label = 'no_fire'
        folder = f'training_data/no_fire'
    else:
        # Ambiguous case: sensors say fire but no visual, or visual but no sensors
        # Save to a separate folder for manual review
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
    while True:
        decision_count += 1

        # CRITICAL: Do 360° scan first to detect fires in all directions
        if decision_count % 3 == 0:  # Every 3 decisions, do a full scan
            print("\n👁️  Performing 360° scan...")
            send_command('scan_360')
            time.sleep(3)

        # Get sensor data (thermal/smoke)
        sensor_data = get_fire_data()
        fire_count = sensor_data.get('fire_count', 0)
        fires = sensor_data.get('fires', [])
        position = sensor_data.get('position', {})
        
        # Capture visual camera
        img = capture_screen()
        
        print(f"\n{'='*70}")
        print(f"DECISION #{decision_count}")
        print(f"{'='*70}")
        print(f"📍 Position: ({position.get('x', 0):.0f}, {position.get('y', 0):.0f}, {position.get('z', 0):.0f})")
        print(f"🌡️  Thermal sensors: {fire_count} heat signatures")
        print(f"🔙 Last action: {last_action}")
        
        # Multi-modal AI decision
        print("🤖 AI analyzing: Sensors + Vision...")
        ai_response = ask_qwen_multimodal(img, sensor_data, last_action)
        
        print(f"\n💭 AI MULTI-MODAL ANALYSIS:")
        print("-" * 70)
        print(ai_response)
        print("-" * 70)
        
        # Parse decision
        action, analysis = parse_multimodal_response(ai_response)
        
        print(f"\n📊 SENSOR-VISION CORRELATION:")
        print(f"   Smoke visible: {analysis['smoke_visible']}")
        print(f"   Glow visible: {analysis['glow_visible']}")
        print(f"   Lava visible: {analysis['lava_visible']}")
        print(f"   Visual matches sensors: {analysis['visual_matches']}")
        print(f"\n✅ ACTION DECIDED: {action.upper()}")
        
        # Save training data
        sample_file = save_training_sample(img, sensor_data, analysis, action, decision_count)
        training_samples_collected += 1
        print(f"💾 Training sample saved: {sample_file}")
        
        # Execute action
        if action == 'suppress':
            print("→ 💧 SUPPRESSING ALL FIRES")

            # Stop any ongoing movement/patrol
            send_command('stop')
            time.sleep(0.5)

            # Keep fighting fires until none remain
            fires_this_round = 0
            max_attempts = 10  # Safety limit
            attempts = 0

            while attempts < max_attempts:
                attempts += 1

                # Do a quick 360° scan to detect all fires (especially behind us)
                send_command('scan_360')
                time.sleep(2)

                # Refresh fire data
                sensor_data = get_fire_data()
                fires = sensor_data.get('fires', [])
                fire_count = sensor_data.get('fire_count', 0)
                position = sensor_data.get('position', {})
                biggest_cluster = sensor_data.get('biggest_cluster_size', 0)

                if fire_count == 0:
                    print(f"   ✅ All fires extinguished! (suppressed {fires_this_round} fires)")
                    break

                print(f"\n   🔥 Round {attempts}: {fire_count} fires remaining")
                print(f"   🏠 Biggest fire cluster: {biggest_cluster} fires")

                # Navigate to closest fire from biggest cluster (fires are pre-sorted)
                if len(fires) > 0:
                    closest = fires[0]
                    distance = calculate_distance(position, closest)
                    print(f"   → Target: ({closest['x']}, {closest['y']}, {closest['z']}) - {distance:.1f}m away")

                    # ALWAYS navigate to fire - need to be within 8 blocks for suppress to work
                    if distance > 4:  # Only navigate if far away
                        print(f"   🏃 Navigating to fire...")
                        send_command('goto', x=closest['x'], y=closest['y'], z=closest['z'])
                        time.sleep(8)  # Wait for navigation to complete
                    else:
                        print(f"   ✓ Already close enough")
                        time.sleep(0.5)

                    # Suppress fires in range (may need to swim through water)
                    print(f"   💧 Deploying water...")
                    send_command('suppress')
                    time.sleep(8)  # Wait for suppress to complete (including all water placements)

                    fires_this_round += 1
                else:
                    break

            fires_suppressed += fires_this_round
            print(f"\n   ✅ Fire suppression complete: {fires_this_round} fires put out")
            time.sleep(2)
        
        elif action == 'patrol':
            print("→ 🚶 EXPLORING NEW AREA")
            send_command('patrol')
            time.sleep(6)
        
        elif action == 'scan_360':
            print("→ 👁️  SCANNING 360°")
            send_command('scan_360')
            time.sleep(5)
        
        elif action == 'move_forward':
            print("→ ⬆️  MOVING FORWARD")
            send_command('move_forward')
            time.sleep(2)
        
        elif action == 'turn_left':
            print("→ ⬅️  TURNING LEFT")
            send_command('turn_left')
            time.sleep(1)
        
        elif action == 'turn_right':
            print("→ ➡️  TURNING RIGHT")
            send_command('turn_right')
            time.sleep(1)
        
        # Log
        log_event('multimodal_decision', {
            'decision_number': decision_count,
            'action': action,
            'sensor_fire_count': fire_count,
            'visual_analysis': analysis,
            'last_action': last_action,
            'fires_suppressed_total': fires_suppressed
        })
        
        last_action = action
        
        time.sleep(1.5)

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