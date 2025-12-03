"""
Advanced FireBot - Smart Fire Detection & Suppression
Features:
- Smart patrol (explores widely, not circles)
- Prioritizes closest fires first
- Handles large fire scenarios
- Adaptive behavior based on results
"""

import subprocess
import time
import json
from pathlib import Path

Path("logs").mkdir(exist_ok=True)

print("🚀 Starting FireBot...")
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
    """Read fire data from bot"""
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

def calculate_distance(pos1, pos2):
    """Calculate distance between two positions"""
    try:
        dx = pos1.get('x', 0) - pos2.get('x', 0)
        dy = pos1.get('y', 0) - pos2.get('y', 0)
        dz = pos1.get('z', 0) - pos2.get('z', 0)
        return (dx**2 + dy**2 + dz**2) ** 0.5
    except:
        return 0

def log_event(event_type, data):
    """Log events"""
    log_entry = {
        'timestamp': time.time(),
        'type': event_type,
        'data': data
    }
    with open('logs/events.jsonl', 'a') as f:
        f.write(json.dumps(log_entry) + '\n')

def calculate_priority(fire_count):
    """Calculate urgency"""
    if fire_count > 20:
        return 'CRITICAL'
    elif fire_count > 10:
        return 'HIGH'
    elif fire_count > 3:
        return 'MEDIUM'
    elif fire_count > 0:
        return 'LOW'
    else:
        return 'NONE'

# ============================================================================
# STATE MACHINE
# ============================================================================

state = 'PATROL'
last_patrol = 0
last_fire_check = 0
fires_suppressed_total = 0
patrol_cycles = 0
stuck_counter = 0
last_position = None

print("\n" + "="*70)
print("🤖 SMART FIREBOT - ACTIVE")
print("="*70)
print("\nCapabilities:")
print("  ✓ Wide-area patrol (explores randomly)")
print("  ✓ Prioritizes closest fires")
print("  ✓ Smart fire suppression (handles large fires)")
print("  ✓ Gets unstuck automatically")
print("  ✓ Event logging")
print("\n" + "="*70 + "\n")

try:
    while True:
        current_time = time.time()
        data = get_fire_data()
        
        fire_count = data.get('fire_count', 0)
        position = data.get('position', {})
        priority = calculate_priority(fire_count)
        
        # Check if bot is stuck
        if last_position:
            dist_moved = calculate_distance(position, last_position)
            if dist_moved < 1.0:
                stuck_counter += 1
            else:
                stuck_counter = 0
        
        last_position = position.copy()
        
        # Handle stuck situation
        if stuck_counter > 8:
            print("\n⚠️  BOT APPEARS STUCK - Resetting patrol")
            send_command('patrol')
            stuck_counter = 0
            time.sleep(3)
            continue
        
        # Status display
        pos_str = f"({position.get('x', 0):.0f}, {position.get('y', 0):.0f}, {position.get('z', 0):.0f})"
        status = (
            f"\r[{state:10s}] Fires: {fire_count:3d} ({priority:8s}) | "
            f"Pos: {pos_str:20s} | HP: {data.get('health', 20):2.0f} | "
            f"Patrols: {patrol_cycles:3d} | Suppressed: {fires_suppressed_total:3d}"
        )
        print(status, end='', flush=True)
        
        # ====================================================================
        # STATE: PATROL
        # ====================================================================
        if state == 'PATROL':
            if fire_count > 0:
                print(f"\n\n🔥 FIRE DETECTED!")
                print(f"   Fire blocks: {fire_count}")
                print(f"   Priority: {priority}")
                
                log_event('fire_detected', {
                    'fire_count': fire_count,
                    'priority': priority,
                    'position': position
                })
                
                state = 'ASSESS'
            
            else:
                # Continue patrolling
                if current_time - last_patrol > 8:
                    send_command('patrol')
                    patrol_cycles += 1
                    last_patrol = current_time
        
        # ====================================================================
        # STATE: ASSESS (Evaluate fire situation)
        # ====================================================================
        elif state == 'ASSESS':
            fires = data.get('fires', [])
            
            if len(fires) == 0:
                print("\n✓ Fire data not ready, waiting...")
                time.sleep(1)
                continue
            
            # Get closest fire
            closest = fires[0]
            distance = calculate_distance(position, closest)
            
            print(f"\n📊 FIRE ASSESSMENT:")
            print(f"   Total fires: {fire_count}")
            print(f"   Closest fire: ({closest['x']}, {closest['y']}, {closest['z']})")
            print(f"   Distance: {distance:.1f} blocks")
            print(f"   Strategy: {'SUPPRESS IMMEDIATELY' if fire_count < 15 else 'TACKLE IN BATCHES'}")
            
            state = 'RESPOND'
        
        # ====================================================================
        # STATE: RESPOND (Navigate to fire)
        # ====================================================================
        elif state == 'RESPOND':
            fires = data.get('fires', [])
            
            if len(fires) == 0:
                print("\n✓ No fires detected anymore")
                state = 'PATROL'
                continue
            
            closest = fires[0]
            distance = calculate_distance(position, closest)
            
            # If close enough, suppress
            if distance < 8:
                print(f"\n🎯 In range of fire (distance: {distance:.1f}m)")
                state = 'SUPPRESS'
            else:
                print(f"\n🏃 Moving toward fire (distance: {distance:.1f}m)")
                send_command('goto', x=closest['x'], y=closest['y'], z=closest['z'])
                time.sleep(4)
        
        # ====================================================================
        # STATE: SUPPRESS (Attack fires)
        # ====================================================================
        elif state == 'SUPPRESS':
            print("\n⚔️  ENGAGING FIRE SUPPRESSION")
            
            initial_count = fire_count
            
            # Equip weapon first
            send_command('equip_weapon')
            time.sleep(0.5)
            
            # Suppress fires
            send_command('suppress')
            
            # Wait for suppression to complete
            time.sleep(8)
            
            # Check results
            data = get_fire_data()
            remaining = data.get('fire_count', 0)
            destroyed = initial_count - remaining
            
            if destroyed > 0:
                fires_suppressed_total += destroyed
                print(f"\n✅ Progress: {destroyed} fires destroyed")
                print(f"   Remaining: {remaining}")
                print(f"   Total session: {fires_suppressed_total}")
                
                log_event('fire_suppressed', {
                    'destroyed': destroyed,
                    'remaining': remaining,
                    'total': fires_suppressed_total
                })
            
            if remaining > 0:
                print(f"   🔄 {remaining} fires remain - continuing")
                state = 'ASSESS'  # Re-assess situation
            else:
                print(f"\n🎉 ALL FIRES EXTINGUISHED!")
                state = 'PATROL'
        
        time.sleep(1.5)

except KeyboardInterrupt:
    print("\n\n🛑 Shutting down...")
    bot_process.terminate()
    
    print("\n" + "="*70)
    print("📊 SESSION STATISTICS")
    print("="*70)
    print(f"  Fires suppressed:    {fires_suppressed_total}")
    print(f"  Patrol cycles:       {patrol_cycles}")
    print(f"  Logs saved to:       logs/events.jsonl")
    print("="*70)
    print("\n✅ FireBot offline\n")