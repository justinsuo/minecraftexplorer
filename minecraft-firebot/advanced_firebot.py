"""
Advanced autonomous fire detection and suppression
With all features enabled
"""

import subprocess
import time
import json
import os
from pathlib import Path

# Create logs directory
Path("logs").mkdir(exist_ok=True)

# Start Node.js bot
print("🚀 Starting FireBot...")
bot_process = subprocess.Popen(['node', 'autobot.js'])
time.sleep(5)

def send_command(action, **kwargs):
    """Send command to bot"""
    cmd = {'action': action, **kwargs}
    with open('command.json', 'w') as f:
        json.dump(cmd, f)
    time.sleep(0.5)

def get_fire_data():
    """Read fire data from bot"""
    try:
        with open('fire_data.json', 'r') as f:
            return json.load(f)
    except:
        return {'fires': [], 'fire_count': 0}

def log_event(event_type, data):
    """Log events for analysis"""
    log_entry = {
        'timestamp': time.time(),
        'type': event_type,
        'data': data
    }
    
    with open('logs/events.jsonl', 'a') as f:
        f.write(json.dumps(log_entry) + '\n')

# State machine
state = 'PATROL'
last_fire_check = 0
fires_suppressed = 0
patrol_cycles = 0

print("\n" + "="*60)
print("🤖 ADVANCED FIREBOT - AUTONOMOUS MODE")
print("="*60)
print("\nFeatures enabled:")
print("  ✓ Smart fire prioritization")
print("  ✓ Intelligent pathfinding")
print("  ✓ Water management")
print("  ✓ Patrol system")
print("  ✓ Event logging")
print("\n" + "="*60 + "\n")

try:
    while True:
        current_time = time.time()
        
        # Get current fire situation
        data = get_fire_data()
        fire_count = data.get('fire_count', 0)
        water_buckets = data.get('water_buckets', 0)
        
        # Decision logic
        if state == 'PATROL':
            if fire_count > 0:
                print(f"\n🔥 FIRE DETECTED: {fire_count} fire blocks")
                print(f"   Water supply: {water_buckets} buckets")
                state = 'RESPOND'
                log_event('fire_detected', {'count': fire_count})
            else:
                if current_time - last_fire_check > 10:
                    print(f"✅ Patrol cycle {patrol_cycles} - Area clear")
                    send_command('patrol')
                    patrol_cycles += 1
                    last_fire_check = current_time
        
        elif state == 'RESPOND':
            if fire_count > 0:
                # Navigate to closest fire
                closest_fire = data['fires'][0]
                print(f"🎯 Responding to fire at {closest_fire}")
                send_command('goto', 
                           x=closest_fire['x'], 
                           y=closest_fire['y'], 
                           z=closest_fire['z'])
                
                time.sleep(3)  # Give bot time to navigate
                state = 'SUPPRESS'
            else:
                print("✓ Fire extinguished or out of range")
                state = 'PATROL'
        
        elif state == 'SUPPRESS':
            print("💧 Activating suppression system...")
            send_command('suppress')
            
            time.sleep(8)  # Give time to extinguish fires
            
            # Check if fires remain
            data = get_fire_data()
            remaining_fires = data.get('fire_count', 0)
            
            if remaining_fires > 0:
                print(f"⚠️  {remaining_fires} fires still burning - continuing suppression")
                state = 'RESPOND'
            else:
                fires_suppressed += fire_count
                print(f"✅ All fires extinguished! Total: {fires_suppressed}")
                log_event('fire_suppressed', {
                    'count': fire_count,
                    'total_suppressed': fires_suppressed
                })
                state = 'PATROL'
        
        # Safety checks
        if water_buckets < 10:
            print("⚠️  LOW WATER - Requesting resupply")
            send_command('status')  # Bot will auto-refill
        
        time.sleep(2)

except KeyboardInterrupt:
    print("\n\n🛑 Shutting down FireBot...")
    bot_process.terminate()
    
    print(f"\n📊 Session Statistics:")
    print(f"   Fires suppressed: {fires_suppressed}")
    print(f"   Patrol cycles: {patrol_cycles}")
    print(f"   Logs saved to: logs/events.jsonl")
    
    print("\n✅ FireBot offline")