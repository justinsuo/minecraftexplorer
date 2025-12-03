"""
Bot automatically patrols and responds to fire
"""

import subprocess
import time
import json
import os

# Start Node.js bot
bot_code = """
const mineflayer = require('mineflayer');
const pathfinder = require('mineflayer-pathfinder').pathfinder;
const { GoalNear } = require('mineflayer-pathfinder').goals;
const fs = require('fs');

const bot = mineflayer.createBot({
  host: 'localhost',
  port: 52900,
  username: 'AutoFireBot',
  version: '1.19.4'
});

bot.loadPlugin(pathfinder);

bot.on('spawn', () => {
  console.log('AutoFireBot ready!');
  
  // Command handler
  setInterval(() => {
    if (!fs.existsSync('command.json')) return;
    
    const cmd = JSON.parse(fs.readFileSync('command.json', 'utf8'));
    fs.unlinkSync('command.json');
    
    if (cmd.action === 'goto') {
      const goal = new GoalNear(cmd.x, cmd.y, cmd.z, 2);
      bot.pathfinder.setGoal(goal);
      bot.chat(`Going to fire at ${cmd.x}, ${cmd.y}, ${cmd.z}`);
    }
    
    if (cmd.action === 'suppress') {
      // Place water
      bot.chat('Suppressing fire!');
    }
    
    if (cmd.action === 'patrol') {
      // Random walk
      const x = bot.entity.position.x + (Math.random() - 0.5) * 20;
      const z = bot.entity.position.z + (Math.random() - 0.5) * 20;
      const goal = new GoalNear(x, bot.entity.position.y, z, 1);
      bot.pathfinder.setGoal(goal);
    }
    
  }, 500);
  
  // Fire scanner
  setInterval(() => {
    const fires = bot.findBlocks({
      matching: (block) => block.name === 'fire' || block.name === 'lava',
      maxDistance: 32,
      count: 10
    });
    
    fs.writeFileSync('fire_data.json', JSON.stringify({
      fires: fires,
      position: bot.entity.position
    }));
  }, 1000);
});
"""

with open('autobot.js', 'w') as f:
    f.write(bot_code)

subprocess.Popen(['node', 'autobot.js'])
time.sleep(3)

def send_command(action, **kwargs):
    cmd = {'action': action, **kwargs}
    with open('command.json', 'w') as f:
        json.dump(cmd, f)

def get_fire_data():
    if not os.path.exists('fire_data.json'):
        return {'fires': []}
    with open('fire_data.json', 'r') as f:
        return json.load(f)

# Main patrol loop
print("🤖 AutoFireBot active - patrolling for fires...")

while True:
    time.sleep(3)
    
    data = get_fire_data()
    
    if len(data['fires']) > 0:
        fire = data['fires'][0]
        print(f"🔥 FIRE DETECTED at {fire}")
        send_command('goto', x=fire['x'], y=fire['y'], z=fire['z'])
        time.sleep(5)
        send_command('suppress')
    else:
        print("✅ No fires - continuing patrol")
        send_command('patrol')