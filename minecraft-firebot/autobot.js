const mineflayer = require('mineflayer');
const pathfinder = require('mineflayer-pathfinder').pathfinder;
const Movements = require('mineflayer-pathfinder').Movements;
const { GoalNear, GoalBlock } = require('mineflayer-pathfinder').goals;
const Vec3 = require('vec3').Vec3;
const fs = require('fs');

const bot = mineflayer.createBot({
  host: 'localhost',
  port: 52900,
  username: 'FireBot',
  version: '1.19.4'
});

bot.loadPlugin(pathfinder);

let mcData;
bot.once('spawn', () => {
  mcData = require('minecraft-data')(bot.version);
  bot.chat('✅ FireBot online!');
  
  // Give bot equipment
  setTimeout(() => {
    bot.chat('/give @s minecraft:diamond_sword 1');
    bot.chat('/give @s minecraft:diamond_axe 1');
    bot.chat('/give @s minecraft:water_bucket 10');
    bot.chat('/give @s minecraft:bow 1');
    bot.chat('/give @s minecraft:arrow 64');
  }, 500);
});

// ============================================================================
// EQUIPMENT MANAGEMENT
// ============================================================================
async function equipItem(itemName) {
  const item = bot.inventory.items().find(i => 
    i.name.includes(itemName)
  );
  
  if (!item) {
    bot.chat(`⚠️ Don't have ${itemName}`);
    
    // Auto-request item
    bot.chat(`/give @s minecraft:${itemName} 1`);
    await sleep(500);
    
    const newItem = bot.inventory.items().find(i => i.name.includes(itemName));
    if (newItem) {
      await bot.equip(newItem, 'hand');
      return true;
    }
    return false;
  }
  
  await bot.equip(item, 'hand');
  bot.chat(`✓ Equipped ${item.name}`);
  return true;
}

// ============================================================================
// PATROL SYSTEM
// ============================================================================
let patrolIndex = 0;
let patrolPoints = [];
let patrolCenter = null;

function generatePatrolRoute() {
  if (!patrolCenter) {
    patrolCenter = bot.entity.position.clone();
  }
  
  const radius = 50;
  patrolPoints = [];
  
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2;
    patrolPoints.push({
      x: Math.floor(patrolCenter.x + Math.cos(angle) * radius),
      y: Math.floor(patrolCenter.y),
      z: Math.floor(patrolCenter.z + Math.sin(angle) * radius)
    });
  }
  
  bot.chat(`📍 Patrol route generated: 8 waypoints`);
}

async function patrol() {
  if (patrolPoints.length === 0) {
    generatePatrolRoute();
  }
  
  const target = patrolPoints[patrolIndex];
  
  const movements = new Movements(bot, mcData);
  movements.canDig = false;
  movements.allow1by1towers = false;
  
  bot.pathfinder.setMovements(movements);
  
  const goal = new GoalNear(target.x, target.y, target.z, 5);
  
  try {
    bot.pathfinder.setGoal(goal);
    patrolIndex = (patrolIndex + 1) % patrolPoints.length;
  } catch (err) {
    bot.chat(`⚠️ Patrol error: ${err.message}`);
    patrolIndex = (patrolIndex + 1) % patrolPoints.length;
  }
}

// ============================================================================
// NAVIGATION
// ============================================================================
async function navigateToFire(firePos) {
  const movements = new Movements(bot, mcData);
  movements.canDig = false;
  movements.allow1by1towers = false;
  
  bot.pathfinder.setMovements(movements);
  
  const goal = new GoalNear(firePos.x, firePos.y, firePos.z, 2);
  
  try {
    await bot.pathfinder.goto(goal);
    return true;
  } catch (err) {
    bot.chat(`⚠️ Can't reach fire: ${err.message}`);
    return false;
  }
}

// ============================================================================
// FIRE SUPPRESSION (with sword)
// ============================================================================
async function suppressFire() {
  bot.chat('⚔️ Attacking fires!');
  
  const fires = bot.findBlocks({
    matching: (block) => block.name === 'fire',
    maxDistance: 5,
    count: 30
  });
  
  if (fires.length === 0) {
    bot.chat('No fire nearby');
    return;
  }
  
  bot.chat(`Found ${fires.length} fires`);
  
  // Equip sword
  await equipItem('sword');
  
  let extinguished = 0;
  
  for (const firePos of fires) {
    try {
      const fireBlock = bot.blockAt(firePos);
      
      if (fireBlock && fireBlock.name === 'fire') {
        await bot.lookAt(firePos.offset(0.5, 0.5, 0.5));
        await sleep(50);
        
        await bot.dig(fireBlock);
        
        extinguished++;
        
        if (extinguished % 5 === 0) {
          bot.chat(`⚔️ ${extinguished}/${fires.length} destroyed`);
        }
        
        await sleep(100);
      }
    } catch (err) {
      console.log(`Failed: ${err.message}`);
    }
  }
  
  bot.chat(`✅ ${extinguished} fires extinguished!`);
}

// ============================================================================
// COMMAND HANDLER
// ============================================================================
setInterval(async () => {
  if (!fs.existsSync('command.json')) return;
  
  const cmd = JSON.parse(fs.readFileSync('command.json', 'utf8'));
  fs.unlinkSync('command.json');
  
  if (cmd.action === 'goto') {
    await navigateToFire(new Vec3(cmd.x, cmd.y, cmd.z));
  }
  
  if (cmd.action === 'suppress') {
    await suppressFire();
  }
  
  if (cmd.action === 'patrol') {
    await patrol();
  }
  
  if (cmd.action === 'equip') {
    await equipItem(cmd.item);
  }
  
  if (cmd.action === 'reset_patrol') {
    patrolCenter = bot.entity.position.clone();
    patrolPoints = [];
    generatePatrolRoute();
  }
  
}, 500);

// ============================================================================
// FIRE SCANNER
// ============================================================================
setInterval(() => {
  const fires = bot.findBlocks({
    matching: (block) => block.name === 'fire' || block.name === 'lava',
    maxDistance: 32,
    count: 50
  });
  
  // Convert positions to objects with x,y,z
  const firePositions = fires.map(pos => ({
    x: pos.x,
    y: pos.y,
    z: pos.z
  }));
  
  fs.writeFileSync('fire_data.json', JSON.stringify({
    fires: firePositions,  // Changed this line
    fire_count: fires.length,
    position: bot.entity ? bot.entity.position : {},
    water_buckets: bot.inventory.items()
      .filter(i => i.name === 'water_bucket')
      .reduce((sum, i) => sum + i.count, 0),
    timestamp: Date.now()
  }));
}, 1000);

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

bot.on('error', (err) => console.error('❌ Bot error:', err));
bot.on('kicked', (reason) => console.log('🚫 Kicked:', reason));

console.log('🤖 FireBot starting...');