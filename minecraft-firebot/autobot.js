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
  bot.chat('✅ FireBot online - Ready to fight fires!');
  
  // Give bot equipment
  setTimeout(() => {
    bot.chat('/give @s minecraft:water_bucket 64');
    bot.chat('/give @s minecraft:bucket 10');
  }, 1000);
});

// ============================================================================
// FEATURE 1: Smart Fire Prioritization
// ============================================================================
function prioritizeFires(fires) {
  return fires
    .map(pos => ({
      pos: pos,
      distance: bot.entity.position.distanceTo(pos),
      priority: calculatePriority(pos)
    }))
    .sort((a, b) => b.priority - a.priority || a.distance - b.distance)
    .map(f => f.pos);
}

function calculatePriority(firePos) {
  // Check for flammable blocks nearby (high priority)
  const flammable = ['oak_log', 'oak_planks', 'spruce_log', 'spruce_planks', 
                     'birch_log', 'birch_planks', 'wool', 'oak_leaves'];
  
  const nearbyBlocks = [
    firePos.offset(1, 0, 0), firePos.offset(-1, 0, 0),
    firePos.offset(0, 0, 1), firePos.offset(0, 0, -1),
    firePos.offset(0, 1, 0), firePos.offset(0, -1, 0)
  ];
  
  let flammableCount = 0;
  nearbyBlocks.forEach(pos => {
    const block = bot.blockAt(pos);
    if (block && flammable.includes(block.name)) {
      flammableCount++;
    }
  });
  
  if (flammableCount > 3) return 100; // CRITICAL
  if (flammableCount > 1) return 50;  // HIGH
  return 10; // NORMAL
}

// ============================================================================
// FEATURE 2: Smart Pathfinding
// ============================================================================
async function navigateToFire(firePos) {
  const movements = new Movements(bot, mcData);
  movements.canDig = false;
  movements.allow1by1towers = false;
  movements.scafoldingBlocks = [];
  
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
// FEATURE 3: Water Management
// ============================================================================
function checkWaterSupply() {
  const buckets = bot.inventory.items().filter(i => 
    i.name === 'water_bucket'
  );
  
  const bucketCount = buckets.reduce((sum, item) => sum + item.count, 0);
  
  if (bucketCount < 5) {
    bot.chat(`⚠️ LOW WATER: ${bucketCount} buckets remaining`);
    return 'LOW';
  }
  
  return 'OK';
}

// ============================================================================
// FEATURE 4: Improved Fire Suppression
// ============================================================================
async function suppressFire() {
  bot.chat('🚒 Starting suppression...');
  
  // Find fires
  const fires = bot.findBlocks({
    matching: (block) => block.name === 'fire',
    maxDistance: 5,
    count: 20
  });
  
  if (fires.length === 0) {
    bot.chat('No fire nearby');
    return;
  }
  
  bot.chat(`Found ${fires.length} fires`);
  
  // Equip water bucket
  const waterBucket = bot.inventory.items().find(i => i.name === 'water_bucket');
  
  if (!waterBucket) {
    bot.chat('/give @s minecraft:water_bucket 64');
    await sleep(50);
  }
  
  await bot.equip(waterBucket, 'hand');
  
  // Simple approach: activate water bucket while looking at fire
  let extinguished = 0;
  
  for (const firePos of fires.slice(0, 10)) {
    try {
      // Look at fire
      await bot.lookAt(firePos.offset(0.5, 0.5, 0.5));
      await sleep(200);
      
      // Right-click (use item)
      bot.activateItem();
      await sleep(500);
      
      extinguished++;
      bot.chat(`💧 Extinguished ${extinguished}/${fires.length}`);
      
    } catch (err) {
      console.log(`Error: ${err.message}`);
    }
  }
  
  bot.chat(`✅ Done! ${extinguished} fires out`);
}

// ============================================================================
// FEATURE 5: Patrol System
// ============================================================================
let patrolIndex = 0;
const patrolPoints = [];

function generatePatrolRoute() {
  const center = bot.entity.position;
  const radius = 40;
  
  // Create 8 patrol points in a circle
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2;
    patrolPoints.push({
      x: Math.floor(center.x + Math.cos(angle) * radius),
      y: Math.floor(center.y),
      z: Math.floor(center.z + Math.sin(angle) * radius)
    });
  }
  
  bot.chat(`📍 Patrol route generated: ${patrolPoints.length} waypoints`);
}

async function patrol() {
  if (patrolPoints.length === 0) {
    generatePatrolRoute();
  }
  
  const target = patrolPoints[patrolIndex];
  patrolIndex = (patrolIndex + 1) % patrolPoints.length;
  
  const movements = new Movements(bot, mcData);
  movements.canDig = false;
  bot.pathfinder.setMovements(movements);
  
  const goal = new GoalNear(target.x, target.y, target.z, 3);
  
  try {
    await bot.pathfinder.goto(goal);
    bot.chat(`✓ Reached waypoint ${patrolIndex}/${patrolPoints.length}`);
  } catch (err) {
    bot.chat(`⚠️ Patrol stuck, recalculating...`);
    patrolIndex = (patrolIndex + 1) % patrolPoints.length;
  }
}

// ============================================================================
// Command Handler
// ============================================================================
setInterval(async () => {
  if (!fs.existsSync('command.json')) return;
  
  const cmd = JSON.parse(fs.readFileSync('command.json', 'utf8'));
  fs.unlinkSync('command.json');
  
  if (cmd.action === 'goto') {
    bot.chat(`🎯 Navigating to fire...`);
    await navigateToFire(new Vec3(cmd.x, cmd.y, cmd.z));
  }
  
  if (cmd.action === 'suppress') {
    await suppressFire();
  }
  
  if (cmd.action === 'patrol') {
    await patrol();
  }
  
  if (cmd.action === 'status') {
    const waterCount = bot.inventory.items()
      .filter(i => i.name === 'water_bucket')
      .reduce((sum, i) => sum + i.count, 0);
    
    bot.chat(`Status: ${waterCount} water buckets, Position: ${bot.entity.position}`);
  }
  
}, 500);

// ============================================================================
// Fire Scanner (runs continuously)
// ============================================================================
setInterval(() => {
  const fires = bot.findBlocks({
    matching: (block) => block.name === 'fire' || block.name === 'lava',
    maxDistance: 32,
    count: 50
  });
  
  const prioritized = fires.length > 0 ? prioritizeFires(fires) : [];
  
  fs.writeFileSync('fire_data.json', JSON.stringify({
    fires: prioritized,
    fire_count: fires.length,
    position: bot.entity.position,
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
bot.on('kicked', (reason) => console.log('🚫 Bot kicked:', reason));
bot.on('end', () => console.log('Bot disconnected'));

console.log('🤖 FireBot starting...');