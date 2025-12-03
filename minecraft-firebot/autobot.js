const mineflayer = require('mineflayer');
const pathfinder = require('mineflayer-pathfinder').pathfinder;
const Movements = require('mineflayer-pathfinder').Movements;
const { GoalNear } = require('mineflayer-pathfinder').goals;
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
  bot.chat('✅ FireBot ready to fight fires!');
  
  // Give equipment after spawn
  setTimeout(() => {
    bot.chat('/give @s minecraft:diamond_sword 1');
    bot.chat('/give @s minecraft:stone_axe 1');
    bot.chat('/give @s minecraft:water_bucket 16');
    console.log('✓ Equipment requested');
  }, 3000);
});

// ============================================================================
// SMART PATROL - Random walk, not circles
// ============================================================================
let lastPatrolTime = 0;

async function patrol() {
  const now = Date.now();
  
  // Don't patrol too frequently
  if (now - lastPatrolTime < 5000) return;
  lastPatrolTime = now;
  
  const currentPos = bot.entity.position;
  
  // Random direction, far distance (30-60 blocks)
  const distance = 30 + Math.random() * 30;
  const angle = Math.random() * Math.PI * 2;
  
  const targetX = Math.floor(currentPos.x + Math.cos(angle) * distance);
  const targetZ = Math.floor(currentPos.z + Math.sin(angle) * distance);
  const targetY = Math.floor(currentPos.y);
  
  console.log(`🚶 Patrolling to (${targetX}, ${targetY}, ${targetZ})`);
  
  const movements = new Movements(bot, mcData);
  movements.canDig = false;
  movements.allow1by1towers = false;
  movements.scafoldingBlocks = [];
  
  bot.pathfinder.setMovements(movements);
  
  const goal = new GoalNear(targetX, targetY, targetZ, 3);
  
  try {
    bot.pathfinder.setGoal(goal);
  } catch (err) {
    console.log(`Patrol error: ${err.message}`);
  }
}

// ============================================================================
// NAVIGATE TO FIRE
// ============================================================================
async function navigateToFire(firePos) {
  console.log(`🎯 Navigating to fire at (${firePos.x}, ${firePos.y}, ${firePos.z})`);
  
  const movements = new Movements(bot, mcData);
  movements.canDig = false;
  movements.allow1by1towers = false;
  
  bot.pathfinder.setMovements(movements);
  
  const goal = new GoalNear(firePos.x, firePos.y, firePos.z, 3);
  
  try {
    await bot.pathfinder.goto(goal);
    console.log('✓ Reached fire location');
    return true;
  } catch (err) {
    console.log(`⚠️ Navigation failed: ${err.message}`);
    return false;
  }
}

// ============================================================================
// EQUIPMENT MANAGEMENT
// ============================================================================
async function equipBestWeapon() {
  // Try to find best weapon in inventory
  const weapons = ['diamond_sword', 'iron_sword', 'stone_sword', 'wooden_sword'];
  
  for (const weaponName of weapons) {
    const weapon = bot.inventory.items().find(item => item.name === weaponName);
    if (weapon) {
      try {
        await bot.equip(weapon, 'hand');
        console.log(`✓ Equipped ${weapon.name}`);
        return true;
      } catch (err) {
        console.log(`Failed to equip ${weaponName}: ${err.message}`);
      }
    }
  }
  
  console.log('⚠️ No weapon found in inventory');
  
  // Request sword if none found
  bot.chat('/give @s minecraft:diamond_sword 1');
  await sleep(1000);
  
  const sword = bot.inventory.items().find(item => item.name.includes('sword'));
  if (sword) {
    await bot.equip(sword, 'hand');
    return true;
  }
  
  return false;
}

// ============================================================================
// SMART FIRE SUPPRESSION - Sword for small, Water for large
// ============================================================================
async function suppressFire() {
  console.log('⚔️ Starting smart fire suppression...');
  
  // Find all nearby fires
  const fires = bot.findBlocks({
    matching: (block) => block.name === 'fire',
    maxDistance: 6,
    count: 50
  });
  
  if (fires.length === 0) {
    console.log('No fires in range');
    bot.chat('No fires nearby');
    return;
  }
  
  console.log(`Found ${fires.length} fire blocks`);
  
  // DECISION: Sword for small fires (<10), Water for large fires (10+)
  if (fires.length < 10) {
    console.log('Strategy: SWORD (small fire)');
    bot.chat(`⚔️ Attacking ${fires.length} fires with sword!`);
    return await suppressWithSword(fires);
  } else {
    console.log('Strategy: WATER (large fire)');
    bot.chat(`💧 Using water on ${fires.length} fires!`);
    return await suppressWithWater(fires);
  }
}

// ============================================================================
// SUPPRESS WITH SWORD
// ============================================================================
async function suppressWithSword(fires) {
  // Equip sword
  const sword = bot.inventory.items().find(item => item.name.includes('sword'));
  
  if (!sword) {
    bot.chat('/give @s minecraft:diamond_sword 1');
    await sleep(1000);
  }
  
  const weapon = bot.inventory.items().find(item => item.name.includes('sword'));
  if (weapon) {
    await bot.equip(weapon, 'hand');
    console.log(`✓ Equipped ${weapon.name}`);
  }
  
  let destroyed = 0;
  
  for (const firePos of fires) {
    const fireBlock = bot.blockAt(firePos);
    if (!fireBlock || fireBlock.name !== 'fire') continue;
    
    try {
      await bot.lookAt(firePos.offset(0.5, 0.5, 0.5));
      await sleep(100);
      await bot.dig(fireBlock);
      destroyed++;
      
      if (destroyed % 3 === 0) {
        bot.chat(`⚔️ ${destroyed}/${fires.length}`);
      }
      await sleep(150);
    } catch (err) {
      console.log(`Failed: ${err.message}`);
    }
  }
  
  bot.chat(`✅ Destroyed ${destroyed} fires with sword!`);
  return destroyed;
}

// ============================================================================
// SUPPRESS WITH WATER
// ============================================================================
async function suppressWithWater(fires) {
  // Equip water bucket
  let waterBucket = bot.inventory.items().find(item => item.name === 'water_bucket');
  
  if (!waterBucket) {
    bot.chat('/give @s minecraft:water_bucket 16');
    await sleep(1000);
  }
  
  waterBucket = bot.inventory.items().find(item => item.name === 'water_bucket');
  if (waterBucket) {
    await bot.equip(waterBucket, 'hand');
    console.log('✓ Equipped water bucket');
  }
  
  const waterPlaced = [];
  let extinguished = 0;
  
  // Place water on fires
  for (const firePos of fires.slice(0, 15)) {
    const fireBlock = bot.blockAt(firePos);
    if (!fireBlock || fireBlock.name !== 'fire') continue;
    
    try {
      await bot.lookAt(firePos.offset(0.5, 0.5, 0.5));
      await sleep(100);
      
      // Place water
      bot.activateItem();
      await sleep(300);
      
      waterPlaced.push(firePos);
      extinguished++;
      
      if (extinguished % 3 === 0) {
        bot.chat(`💧 ${extinguished}/${fires.length}`);
      }
      
      // Re-equip water bucket if we have more
      const newBucket = bot.inventory.items().find(i => i.name === 'water_bucket');
      if (newBucket) {
        await bot.equip(newBucket, 'hand');
      }
      
    } catch (err) {
      console.log(`Water placement failed: ${err.message}`);
    }
  }
  
  bot.chat(`✅ Water placed on ${extinguished} fires!`);
  
  // Now clean up water
  await sleep(2000);
  await cleanupWater(waterPlaced);
  
  return extinguished;
}

// ============================================================================
// CLEANUP WATER WITH EMPTY BUCKET
// ============================================================================
async function cleanupWater(waterPositions) {
  if (waterPositions.length === 0) return;
  
  console.log('🧹 Cleaning up water...');
  bot.chat('🧹 Collecting water...');
  
  // Equip empty bucket
  let emptyBucket = bot.inventory.items().find(item => item.name === 'bucket');
  
  if (!emptyBucket) {
    bot.chat('/give @s minecraft:bucket 16');
    await sleep(1000);
  }
  
  emptyBucket = bot.inventory.items().find(item => item.name === 'bucket');
  if (emptyBucket) {
    await bot.equip(emptyBucket, 'hand');
    console.log('✓ Equipped empty bucket');
  }
  
  let collected = 0;
  
  for (const waterPos of waterPositions) {
    try {
      const block = bot.blockAt(waterPos);
      
      if (block && block.name === 'water') {
        await bot.lookAt(waterPos.offset(0.5, 0.5, 0.5));
        await sleep(100);
        
        // Right-click to collect water
        bot.activateItem();
        await sleep(200);
        
        collected++;
        
        // Re-equip empty bucket
        const newBucket = bot.inventory.items().find(i => i.name === 'bucket');
        if (newBucket) {
          await bot.equip(newBucket, 'hand');
        }
      }
    } catch (err) {
      // Water might have flowed away
    }
  }
  
  console.log(`✓ Collected ${collected} water blocks`);
  bot.chat(`✓ Cleaned up ${collected} water blocks`);
}

// ============================================================================
// COMMAND HANDLER
// ============================================================================
setInterval(async () => {
  if (!fs.existsSync('command.json')) return;
  
  try {
    const cmd = JSON.parse(fs.readFileSync('command.json', 'utf8'));
    fs.unlinkSync('command.json');
    
    console.log(`📨 Received command: ${cmd.action}`);
    
    if (cmd.action === 'patrol') {
      await patrol();
    }
    
    if (cmd.action === 'goto') {
      await navigateToFire(new Vec3(cmd.x, cmd.y, cmd.z));
    }
    
    if (cmd.action === 'suppress') {
      await suppressFire();
    }
    
    if (cmd.action === 'equip_weapon') {
      await equipBestWeapon();
    }
    
  } catch (err) {
    console.log(`Command error: ${err.message}`);
  }
  
}, 300);

// ============================================================================
// FIRE SCANNER - Continuously scan for fires
// ============================================================================
setInterval(() => {
  if (!bot.entity) return;
  
  const fires = bot.findBlocks({
    matching: (block) => block.name === 'fire' || block.name === 'lava',
    maxDistance: 32,
    count: 100
  });
  
  // Convert Vec3 to plain objects
  const firePositions = fires.map(pos => ({
    x: pos.x,
    y: pos.y,
    z: pos.z
  }));
  
  // Sort by distance
  firePositions.sort((a, b) => {
    const posA = new Vec3(a.x, a.y, a.z);
    const posB = new Vec3(b.x, b.y, b.z);
    return bot.entity.position.distanceTo(posA) - bot.entity.position.distanceTo(posB);
  });
  
  const data = {
    fires: firePositions,
    fire_count: fires.length,
    position: {
      x: bot.entity.position.x,
      y: bot.entity.position.y,
      z: bot.entity.position.z
    },
    health: bot.health,
    food: bot.food,
    timestamp: Date.now()
  };
  
  fs.writeFileSync('fire_data.json', JSON.stringify(data));
  
}, 1000);

// ============================================================================
// HELPERS
// ============================================================================
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

bot.on('error', (err) => {
  console.error('❌ Bot error:', err);
});

bot.on('kicked', (reason) => {
  console.log('🚫 Bot kicked:', reason);
});

bot.on('death', () => {
  console.log('💀 Bot died');
  bot.chat('I died! Respawning...');
});

console.log('🤖 FireBot starting...');
console.log('Connecting to localhost:52900 (Minecraft 1.19.4)');