
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
