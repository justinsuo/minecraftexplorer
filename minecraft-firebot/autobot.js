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
  version: '1.19.4',
  checkTimeoutInterval: 60000,  // Increase timeout check to 60 seconds
  hideErrors: false
});

bot.loadPlugin(pathfinder);

// Keep connection alive
setInterval(() => {
  if (bot && bot.entity) {
    // Small movement to keep server from timing out
    // This doesn't actually move the bot, just keeps connection active
  }
}, 15000); // Every 15 seconds

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
  movements.scafoldingBlocks = [];

  // CRITICAL: Allow swimming through water to reach fires
  movements.allowSprinting = true;
  movements.allowParkour = false;

  bot.pathfinder.setMovements(movements);

  const goal = new GoalNear(x, y, z, 3);  // Get within 3 blocks

  try {
    await bot.pathfinder.goto(goal);
    console.log('✓ Reached destination');
    return true;
  } catch (err) {
    console.log(`⚠️ Navigation failed: ${err.message}`);
    // Try moving forward manually if pathfinding fails
    bot.setControlState('forward', true);
    await sleep(2000);
    bot.setControlState('forward', false);
    return false;
  }
}

// ============================================================================
// SUPPRESS WITH WATER
// ============================================================================
async function suppressWithWater() {
  console.log('💧 Suppressing fire with water...');
  bot.chat('💧 Deploying water!');

  // Smart swimming: if underwater, swim up
  if (bot.entity.isInWater) {
    console.log('  🏊 In water, swimming up...');
    bot.setControlState('jump', true);
    await sleep(500);
    bot.setControlState('jump', false);
  }

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

  // Find fires near bot (increased range to handle water better)
  const fires = bot.findBlocks({
    matching: (block) => block.name === 'fire',
    maxDistance: 8,  // Increased from 5 to 8 to cover more area
    count: 30
  });

  if (fires.length === 0) {
    console.log('No fires in range');
    bot.chat('No fire detected');
    return 0;
  }

  console.log(`Found ${fires.length} fire blocks nearby`);

  let extinguished = 0;

  for (const firePos of fires.slice(0, 20)) {  // Increased from 10 to 20
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
      await sleep(300);

      console.log(`  Placing water at (${firePos.x}, ${firePos.y}, ${firePos.z})`);

      // Try placing water on the block NEXT to the fire, not on the fire itself
      // Water needs a solid block to be placed on
      const blockBelow = bot.blockAt(firePos.offset(0, -1, 0));

      if (blockBelow && blockBelow.name !== 'air' && blockBelow.name !== 'fire') {
        try {
          // Place water on top of the block below the fire
          await bot.placeBlock(blockBelow, new Vec3(0, 1, 0));
          await sleep(800);
          console.log(`  ✓ Water placed on block below fire`);
        } catch (err) {
          // If placeBlock fails, try looking slightly away and using activateItem
          console.log(`  placeBlock failed, trying alternative method...`);
          await bot.lookAt(blockBelow.position.offset(0.5, 1, 0.5));
          await sleep(200);
          bot.activateItem();
          await sleep(800);
        }
      } else {
        // No solid block below, try finding adjacent solid block
        console.log(`  No solid block below, trying adjacent blocks...`);
        const offsets = [
          new Vec3(1, 0, 0), new Vec3(-1, 0, 0),
          new Vec3(0, 0, 1), new Vec3(0, 0, -1),
          new Vec3(0, -1, 0)
        ];

        for (const offset of offsets) {
          const adjacentBlock = bot.blockAt(firePos.offset(offset.x, offset.y, offset.z));
          if (adjacentBlock && adjacentBlock.name !== 'air' && adjacentBlock.name !== 'fire') {
            try {
              const faceVector = new Vec3(-offset.x, -offset.y, -offset.z);
              await bot.placeBlock(adjacentBlock, faceVector);
              await sleep(800);
              console.log(`  ✓ Water placed on adjacent block`);
              break;
            } catch (err) {
              continue;
            }
          }
        }
      }

      // Check if fire is gone
      const checkBlock = bot.blockAt(firePos);
      if (checkBlock && checkBlock.name === 'fire') {
        console.log(`  ⚠️ Fire still burning after water!`);
      } else {
        console.log(`  ✓ Fire extinguished`);
        extinguished++;
      }

      // Don't pick up water - waste of time, just keep suppressing fires

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

    if (cmd.action === 'stop') {
      console.log('🛑 Stopping all movement');
      bot.pathfinder.setGoal(null);
      bot.clearControlStates();
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

  // Smart detection: prioritize actual fires over lava (fires spread, lava doesn't)
  const actualFires = bot.findBlocks({
    matching: (block) => block.name === 'fire',
    maxDistance: 64,
    count: 200
  });

  const lavaBlocks = bot.findBlocks({
    matching: (block) => block.name === 'lava',
    maxDistance: 64,
    count: 50
  });

  // Prioritize fires, then add lava (lava is lower priority since it doesn't spread)
  const fires = [...actualFires, ...lavaBlocks];

  const firePositions = fires.map(pos => ({
    x: pos.x,
    y: pos.y,
    z: pos.z,
    type: actualFires.includes(pos) ? 'fire' : 'lava'  // Track type
  }));

  // Group fires into clusters to detect "houses burning" vs single fires
  const fireClusters = [];
  const clusterRadius = 8;  // Fires within 8 blocks = same cluster

  for (const fire of firePositions) {
    let addedToCluster = false;

    for (const cluster of fireClusters) {
      const center = cluster.center;
      const dist = Math.sqrt(
        (fire.x - center.x) ** 2 +
        (fire.y - center.y) ** 2 +
        (fire.z - center.z) ** 2
      );

      if (dist <= clusterRadius) {
        cluster.fires.push(fire);
        // Recalculate cluster center (average position)
        cluster.center.x = cluster.fires.reduce((sum, f) => sum + f.x, 0) / cluster.fires.length;
        cluster.center.y = cluster.fires.reduce((sum, f) => sum + f.y, 0) / cluster.fires.length;
        cluster.center.z = cluster.fires.reduce((sum, f) => sum + f.z, 0) / cluster.fires.length;
        addedToCluster = true;
        break;
      }
    }

    if (!addedToCluster) {
      fireClusters.push({
        center: { x: fire.x, y: fire.y, z: fire.z },
        fires: [fire]
      });
    }
  }

  // Sort clusters by size (biggest threat first) then by distance
  fireClusters.sort((a, b) => {
    // Prioritize bigger fires (more dangerous)
    if (b.fires.length !== a.fires.length) {
      return b.fires.length - a.fires.length;
    }
    // If same size, pick closest
    const posA = new Vec3(a.center.x, a.center.y, a.center.z);
    const posB = new Vec3(b.center.x, b.center.y, b.center.z);
    return bot.entity.position.distanceTo(posA) - bot.entity.position.distanceTo(posB);
  });

  // Create sorted fire list: start with biggest cluster, then next biggest, etc.
  const sortedFirePositions = [];
  for (const cluster of fireClusters) {
    // Sort fires within cluster by distance
    cluster.fires.sort((a, b) => {
      const posA = new Vec3(a.x, a.y, a.z);
      const posB = new Vec3(b.x, b.y, b.z);
      return bot.entity.position.distanceTo(posA) - bot.entity.position.distanceTo(posB);
    });
    sortedFirePositions.push(...cluster.fires);
  }
  
  const data = {
    fires: sortedFirePositions,  // Use sorted fires (biggest clusters first)
    fire_count: fires.length,
    actual_fires: actualFires.length,  // Only spreading fires
    lava_count: lavaBlocks.length,     // Static lava
    fire_clusters: fireClusters.length,
    biggest_cluster_size: fireClusters.length > 0 ? fireClusters[0].fires.length : 0,
    position: {
      x: bot.entity.position.x,
      y: bot.entity.position.y,
      z: bot.entity.position.z
    },
    yaw: bot.entity.yaw,
    pitch: bot.entity.pitch,
    health: bot.health,
    food: bot.food,
    is_in_water: bot.entity.isInWater,
    is_on_fire: bot.entity.onFire,
    oxygen: bot.oxygenLevel,
    timestamp: Date.now()
  };
  
  fs.writeFileSync('fire_data.json', JSON.stringify(data));

}, 2000);  // Reduced from 1000ms to 2000ms to reduce server load

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

// ============================================================================
// SMART SURVIVAL - Auto-respond to danger
// ============================================================================
setInterval(() => {
  if (!bot.entity) return;

  // Emergency: Bot is on fire!
  if (bot.entity.onFire) {
    console.log('🔥 BOT IS ON FIRE! Emergency response...');

    // Try to find water nearby
    const waterBlocks = bot.findBlocks({
      matching: (block) => block.name === 'water',
      maxDistance: 10,
      count: 5
    });

    if (waterBlocks.length > 0) {
      console.log('  💧 Water found nearby, jumping in...');
      const waterPos = waterBlocks[0];
      bot.pathfinder.setGoal(new GoalNear(waterPos.x, waterPos.y, waterPos.z, 1));
    } else {
      // No water nearby, place water on self
      const waterBucket = bot.inventory.items().find(i => i.name === 'water_bucket');
      if (waterBucket) {
        console.log('  💧 Placing water to extinguish self...');
        bot.equip(waterBucket, 'hand').then(() => {
          bot.activateItem();
        });
      }
    }
  }

  // Low health warning
  if (bot.health < 10) {
    console.log(`⚠️ LOW HEALTH: ${bot.health}/20`);
    bot.chat(`Low health: ${bot.health}`);
  }

  // Drowning warning
  if (bot.entity.isInWater && bot.oxygenLevel < 5) {
    console.log('💨 LOW OXYGEN! Swimming up...');
    bot.setControlState('jump', true);
  } else if (bot.entity.isInWater && bot.oxygenLevel >= 15) {
    bot.setControlState('jump', false);
  }
}, 1000);

console.log('🤖 AI FireBot starting...');
console.log('Connecting to localhost:52900 (Minecraft 1.19.4)');