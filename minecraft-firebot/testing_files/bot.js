
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
