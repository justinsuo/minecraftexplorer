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
  bot.chat('✅ AI FireBot ready!');

  console.log(`Bot game mode: ${bot.game.gameMode}`);

  // Give equipment
  setTimeout(() => {
    bot.chat('/give @s minecraft:water_bucket 64');
    bot.chat('/give @s minecraft:bucket 64');
    console.log('✓ Equipment requested');
  }, 3000);
});

// ============================================================================
// 360° SCAN - Look in all directions for fire
// ============================================================================
async function scan360() {
  console.log('👁️  Scanning 360° for fire...');
  bot.chat('Scanning area...');
  
  const angles = [0, Math.PI/2, Math.PI, -Math.PI/2]; // N, E, S, W
  
  for (const angle of angles) {
    await bot.look(angle, 0); // Look at angle, level pitch
    await sleep(500); // Give camera time to update
    
    console.log(`  Looked at ${Math.round(angle * 180 / Math.PI)}°`);
  }
  
  console.log('✓ 360° scan complete');
}

// ============================================================================
// SMART PATROL - Random walk with scanning
// ============================================================================
let lastPatrolTime = 0;

async function patrol() {
  const now = Date.now();
  
  if (now - lastPatrolTime < 8000) return;
  lastPatrolTime = now;
  
  const currentPos = bot.entity.position;
  
  // Random direction, medium distance
  const distance = 20 + Math.random() * 20;
  const angle = Math.random() * Math.PI * 2;
  
  const targetX = Math.floor(currentPos.x + Math.cos(angle) * distance);
  const targetZ = Math.floor(currentPos.z + Math.sin(angle) * distance);
  const targetY = Math.floor(currentPos.y);
  
  console.log(`🚶 Patrolling to (${targetX}, ${targetY}, ${targetZ})`);
  bot.chat(`Exploring area...`);
  
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
// NAVIGATE TO POSITION
// ============================================================================
async function navigateToPosition(x, y, z) {
  console.log(`🎯 Navigating to (${x}, ${y}, ${z})`);
  
  const movements = new Movements(bot, mcData);
  movements.canDig = false;
  movements.allow1by1towers = false;
  
  bot.pathfinder.setMovements(movements);
  
  const goal = new GoalNear(x, y, z, 2);
  
  try {
    await bot.pathfinder.goto(goal);
    console.log('✓ Reached destination');
    return true;
  } catch (err) {
    console.log(`⚠️ Navigation failed: ${err.message}`);
    return false;
  }
}

// ============================================================================
// SUPPRESS WITH WATER
// ============================================================================
async function suppressWithWater() {
  console.log('💧 Suppressing fire with water...');
  bot.chat('💧 Deploying water!');

  // Check inventory
  const waterBuckets = bot.inventory.items().filter(i => i.name === 'water_bucket');
  const emptyBuckets = bot.inventory.items().filter(i => i.name === 'bucket');
  console.log(`Inventory: ${waterBuckets.length} water buckets, ${emptyBuckets.length} empty buckets`);

  if (waterBuckets.length === 0) {
    console.log('❌ NO WATER BUCKETS IN INVENTORY!');
    bot.chat('No water buckets!');
    bot.chat('/give @s minecraft:water_bucket 64');
    await sleep(1000);
  }

  // Find fires in front of bot
  const fires = bot.findBlocks({
    matching: (block) => block.name === 'fire',
    maxDistance: 5,
    count: 20
  });

  if (fires.length === 0) {
    console.log('No fires in range');
    bot.chat('No fire detected');
    return 0;
  }

  console.log(`Found ${fires.length} fire blocks nearby`);
  
  let extinguished = 0;
  
  for (const firePos of fires.slice(0, 10)) {
    const fireBlock = bot.blockAt(firePos);
    if (!fireBlock || fireBlock.name !== 'fire') continue;
    
    try {
      // Equip water bucket
      let waterBucket = bot.inventory.items().find(item => item.name === 'water_bucket');
      
      if (!waterBucket) {
        console.log('Out of water');
        break;
      }
      
      await bot.equip(waterBucket, 'hand');
      await sleep(200);
      
      // Look at fire
      await bot.lookAt(firePos.offset(0.5, 0.5, 0.5));
      await sleep(200);

      console.log(`  Placing water at (${firePos.x}, ${firePos.y}, ${firePos.z})`);

      // Try to place water on a block next to the fire
      const targetBlock = bot.blockAt(firePos.offset(0, -1, 0)); // Block below fire
      if (targetBlock) {
        try {
          await bot.placeBlock(targetBlock, new Vec3(0, 1, 0)); // Place on top face
          console.log(`  ✓ Water placed via placeBlock`);
        } catch (err) {
          console.log(`  placeBlock failed: ${err.message}, trying activateItem...`);
          bot.activateItem();
        }
      } else {
        console.log(`  No target block, using activateItem...`);
        bot.activateItem();
      }

      await sleep(800); // Give water time to flow and extinguish fire

      // Check if fire is gone
      const checkBlock = bot.blockAt(firePos);
      if (checkBlock && checkBlock.name === 'fire') {
        console.log(`  ⚠️ Fire still burning after water!`);
      } else {
        console.log(`  ✓ Fire extinguished`);
        extinguished++;
      }

      // Pick up water
      const emptyBucket = bot.inventory.items().find(item => item.name === 'bucket');
      if (emptyBucket) {
        await bot.equip(emptyBucket, 'hand');
        await sleep(200);
        bot.activateItem();
        await sleep(300);
      }
      
    } catch (err) {
      console.log(`Suppression error: ${err.message}`);
    }
  }
  
  console.log(`✓ Extinguished ${extinguished} fires`);
  bot.chat(`✅ Put out ${extinguished} fires!`);
  
  return extinguished;
}

// ============================================================================
// COMMAND HANDLER
// ============================================================================
setInterval(async () => {
  if (!fs.existsSync('command.json')) return;
  
  try {
    const cmd = JSON.parse(fs.readFileSync('command.json', 'utf8'));
    fs.unlinkSync('command.json');
    
    console.log(`📨 Command: ${cmd.action}`);
    
    if (cmd.action === 'scan_360') {
      await scan360();
    }
    
    if (cmd.action === 'patrol') {
      await patrol();
    }
    
    if (cmd.action === 'goto') {
      await navigateToPosition(cmd.x, cmd.y, cmd.z);
    }
    
    if (cmd.action === 'suppress') {
      await suppressWithWater();
    }
    
    if (cmd.action === 'move_forward') {
      console.log('Moving forward...');
      bot.setControlState('forward', true);
      await sleep(1500);
      bot.setControlState('forward', false);
    }
    
    if (cmd.action === 'move_backward') {
      console.log('Moving backward...');
      bot.setControlState('back', true);
      await sleep(1000);
      bot.setControlState('back', false);
    }
    
    if (cmd.action === 'turn_left') {
      console.log('Turning left...');
      const currentYaw = bot.entity.yaw;
      await bot.look(currentYaw - Math.PI/4, 0);
      await sleep(300);
    }
    
    if (cmd.action === 'turn_right') {
      console.log('Turning right...');
      const currentYaw = bot.entity.yaw;
      await bot.look(currentYaw + Math.PI/4, 0);
      await sleep(300);
    }
    
    if (cmd.action === 'jump') {
      console.log('Jumping...');
      bot.setControlState('jump', true);
      await sleep(500);
      bot.setControlState('jump', false);
    }
    
    if (cmd.action === 'pickup_water') {
      console.log('🧹 Picking up water...');
      
      const waterBlocks = bot.findBlocks({
        matching: (block) => block.name === 'water',
        maxDistance: 3,
        count: 10
      });
      
      if (waterBlocks.length === 0) {
        console.log('No water nearby');
        return;
      }
      
      let emptyBucket = bot.inventory.items().find(i => i.name === 'bucket');
      
      if (!emptyBucket) {
        bot.chat('/give @s minecraft:bucket 32');
        await sleep(1000);
        emptyBucket = bot.inventory.items().find(i => i.name === 'bucket');
      }
      
      if (!emptyBucket) {
        console.log('No empty buckets');
        return;
      }
      
      await bot.equip(emptyBucket, 'hand');
      await sleep(300);
      
      let collected = 0;
      
      for (const waterPos of waterBlocks.slice(0, 5)) {
        try {
          await bot.lookAt(waterPos.offset(0.5, 0.5, 0.5));
          await sleep(100);
          bot.activateItem();
          await sleep(300);
          collected++;
          
          const nextBucket = bot.inventory.items().find(i => i.name === 'bucket');
          if (nextBucket) {
            await bot.equip(nextBucket, 'hand');
          }
        } catch (err) {
          console.log(`Pickup failed: ${err.message}`);
        }
      }
      
      console.log(`✓ Collected ${collected} water`);
      bot.chat(`Collected ${collected} water`);
    }
    
  } catch (err) {
    console.log(`Command error: ${err.message}`);
  }
  
}, 300);

// ============================================================================
// FIRE SCANNER (for Python to read)
// ============================================================================
setInterval(() => {
  if (!bot.entity) return;
  
  const fires = bot.findBlocks({
    matching: (block) => block.name === 'fire' || block.name === 'lava',
    maxDistance: 32,
    count: 100
  });
  
  const firePositions = fires.map(pos => ({
    x: pos.x,
    y: pos.y,
    z: pos.z
  }));
  
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
    yaw: bot.entity.yaw,
    pitch: bot.entity.pitch,
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
  console.log('🚫 Kicked:', reason);
});

bot.on('death', () => {
  console.log('💀 Bot died');
  bot.chat('Respawning...');
});

console.log('🤖 AI FireBot starting...');
console.log('Connecting to localhost:52900 (Minecraft 1.19.4)');