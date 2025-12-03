"""
Simple fire detection bot for Minecraft
Combines all previous tests into one system
"""

import subprocess
import time
import mss
import ollama
import base64
from PIL import Image
import io
import json

# Start the Node.js bot in background
bot_process = None

def start_minecraft_bot():
    """Launch the Node.js bot"""
    global bot_process
    
    # Create bot.js file
    bot_code = """
const mineflayer = require('mineflayer');
const fs = require('fs');

const bot = mineflayer.createBot({
  host: 'localhost',
  port: 52900,
  username: 'FireBot'
});

bot.on('spawn', () => {
  console.log('FireBot connected!');
  
  // Save bot state to file so Python can read it
  function saveState() {
    const state = {
      position: bot.entity.position,
      health: bot.health,
      timestamp: Date.now()
    };
    
    fs.writeFileSync('bot_state.json', JSON.stringify(state));
  }
  
  // Update state every second
  setInterval(saveState, 1000);
  
  // Listen for commands from Python
  function checkCommands() {
    try {
      if (fs.existsSync('bot_command.txt')) {
        const command = fs.readFileSync('bot_command.txt', 'utf8').trim();
        
        if (command === 'forward') {
          bot.setControlState('forward', true);
          setTimeout(() => bot.setControlState('forward', false), 1000);
        } else if (command === 'back') {
          bot.setControlState('back', true);
          setTimeout(() => bot.setControlState('back', false), 1000);
        } else if (command === 'left') {
          bot.setControlState('left', true);
          setTimeout(() => bot.setControlState('left', false), 500);
        } else if (command === 'right') {
          bot.setControlState('right', true);
          setTimeout(() => bot.setControlState('right', false), 500);
        } else if (command === 'jump') {
          bot.setControlState('jump', true);
          setTimeout(() => bot.setControlState('jump', false), 100);
        } else if (command === 'scan') {
          // Scan for fire
          const fires = bot.findBlocks({
            matching: (block) => block.name === 'fire' || block.name === 'lava',
            maxDistance: 32,
            count: 100
          });
          
          fs.writeFileSync('fire_scan.json', JSON.stringify({
            fire_count: fires.length,
            positions: fires
          }));
        }
        
        // Clear command
        fs.unlinkSync('bot_command.txt');
      }
    } catch (err) {
      // Ignore
    }
  }
  
  setInterval(checkCommands, 100);
});

console.log('Bot starting...');
"""
    
    # Save bot code
    with open('bot.js', 'w') as f:
        f.write(bot_code)
    
    # Start bot process
    bot_process = subprocess.Popen(['node', 'bot.js'])
    print("✅ Minecraft bot started")
    time.sleep(3)  # Give it time to connect

def send_bot_command(command):
    """Send command to the bot"""
    with open('bot_command.txt', 'w') as f:
        f.write(command)
    
    # Wait for bot to execute
    time.sleep(0.5)

def scan_for_fire():
    """Ask bot to scan for fire blocks"""
    send_bot_command('scan')
    time.sleep(0.2)
    
    try:
        with open('fire_scan.json', 'r') as f:
            data = json.load(f)
            return data
    except:
        return {'fire_count': 0, 'positions': []}

def capture_screen():
    """Take screenshot"""
    with mss.mss() as sct:
        monitor = sct.monitors[1]
        screenshot = sct.grab(monitor)
        img = Image.frombytes('RGB', screenshot.size, screenshot.bgra, 'raw', 'BGRX')
        return img.resize((640, 480))

def ask_ai(img, fire_data):
    """Ask AI about the scene"""
    buffered = io.BytesIO()
    img.save(buffered, format="PNG")
    img_base64 = base64.b64encode(buffered.getvalue()).decode()
    
    prompt = f"""
    Fire Detection Report:
    - Block scanner found: {fire_data['fire_count']} fire blocks
    
    Looking at this Minecraft scene:
    1. Do you SEE fire or lava? (YES/NO)
    2. Should I move forward? (YES/NO)
    3. What should I do? (FORWARD/LEFT/RIGHT/BACK/INVESTIGATE)
    
    Be brief.
    """
    
    response = ollama.generate(
        model='llava:7b',
        prompt=prompt,
        images=[img_base64]
    )
    
    return response['response']

def decide_action(ai_response, fire_data):
    """Decide what to do based on AI + fire data"""
    
    # If block scanner found fire
    if fire_data['fire_count'] > 0:
        print(f"🔥 FIRE DETECTED: {fire_data['fire_count']} blocks")
        return 'investigate'
    
    # If AI sees fire
    if 'YES' in ai_response and 'fire' in ai_response.lower():
        print("🔥 AI SEES FIRE")
        return 'investigate'
    
    # If AI says move forward
    if 'FORWARD' in ai_response.upper():
        return 'forward'
    
    # Default: patrol
    return 'forward'

def execute_action(action):
    """Execute the decided action"""
    
    if action == 'forward':
        print("→ Moving forward")
        send_bot_command('forward')
    
    elif action == 'investigate':
        print("🔍 Investigating fire")
        send_bot_command('forward')
        time.sleep(0.5)
        send_bot_command('forward')
    
    elif action == 'left':
        print("← Turning left")
        send_bot_command('left')
    
    elif action == 'right':
        print("→ Turning right")
        send_bot_command('right')

# MAIN LOOP
print("="*60)
print("MINECRAFT FIRE DETECTION BOT")
print("="*60)
print("\n1. Start Minecraft")
print("2. Open world to LAN (port 52900)")
print("3. Press Enter when ready")
input()

# Start bot
start_minecraft_bot()

print("\n✅ Bot is running!")
print("Place some fire blocks to test detection\n")

step = 0
try:
    while True:
        step += 1
        print(f"\n{'='*50} STEP {step} {'='*50}")
        
        # 1. Scan for fire blocks (fast)
        fire_data = scan_for_fire()
        
        # 2. Capture screen
        img = capture_screen()
        
        # 3. Ask AI (only if needed)
        if fire_data['fire_count'] > 0:
            ai_response = ask_ai(img, fire_data)
            print(f"AI: {ai_response[:100]}")
        else:
            ai_response = "All clear"
            print("✅ No fire detected")
        
        # 4. Decide action
        action = decide_action(ai_response, fire_data)
        
        # 5. Execute
        execute_action(action)
        
        # 6. Wait
        time.sleep(3)

except KeyboardInterrupt:
    print("\n\nStopping bot...")
    if bot_process:
        bot_process.terminate()
    print("Bot stopped")