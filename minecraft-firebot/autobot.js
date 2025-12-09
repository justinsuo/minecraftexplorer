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

  // Give equipment - clear inventory first, then give dirt and water
  setTimeout(() => {
    console.log('🧹 Clearing inventory and getting equipment...');
    bot.chat('/clear @s');
    setTimeout(() => {
      bot.chat('/give @s minecraft:dirt 64');
      bot.chat('/give @s minecraft:water_bucket 2');
      console.log('✓ Equipment requested: 64 dirt + 2 water buckets');
    }, 2000);
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
    bot.chat('/give @s minecraft:water_bucket 2');
    await sleep(1000);
  }

  // Enhanced swimming for elevated fires
  if (bot.entity.isInWater || bot.entity.isInWater) {
    console.log('🏊 ENHANCED SWIMMING MODE - Checking for elevated fires...');

    // Find ALL fires including high ones when in water
    const allFires = bot.findBlocks({
      matching: (block) => block.name === 'fire',
      maxDistance: 20,  // Much larger range when swimming
      count: 100
    });

    // Filter for fires above current water level
    const elevatedFires = allFires.filter(fire =>
      fire.y > bot.entity.position.y + 2
    );

    if (elevatedFires.length > 0) {
      console.log(`🔥 Found ${elevatedFires.length} elevated fires while swimming! Swimming up to reach them...`);

      // Swim upward to reach highest fire
      const highestFire = elevatedFires.reduce((highest, fire) =>
        fire.y > highest.y ? fire : highest, elevatedFires[0]
      );

      console.log(`🎯 Target fire at height ${highestFire.y}, current height ${bot.entity.position.y}`);

      // Swim up aggressively
      while (bot.entity.position.y < highestFire.y - 1 && bot.entity.isInWater) {
        console.log(`🏊 Swimming up: current ${bot.entity.position.y.toFixed(1)}, target ${highestFire.y}`);
        bot.setControlState('jump', true);
        bot.setControlState('forward', true);
        await sleep(300);
      }

      bot.setControlState('jump', false);
      bot.setControlState('forward', false);

      // Use this enhanced fire list instead of normal one
      fires = elevatedFires;
    } else {
      // Normal fire detection when swimming
      var fires = bot.findBlocks({
        matching: (block) => block.name === 'fire',
        maxDistance: 15,  // Extended range when swimming
        count: 50
      });
    }
  } else {
    // Normal fire detection when not swimming
    var fires = bot.findBlocks({
      matching: (block) => block.name === 'fire',
      maxDistance: 8,  // Increased from 5 to 8 to cover more area
      count: 30
    });
  }

  if (fires.length === 0) {
    console.log('No fires in range');
    bot.chat('No fire detected');
    return 0;
  }

  if (fires.length > 0) {
      console.log(`🚨 FIRE DETECTED: ${fires.length} fires!`);

      // This is handled by navigateToPosition function above
      // No need for duplicate pathfinding code
  }

  console.log(`Found ${fires.length} fire blocks nearby`);

  // Sort fires by height - tackle highest ones first when swimming
  if (bot.entity.isInWater) {
    fires.sort((a, b) => b.y - a.y);  // Sort by height (highest first)
    console.log('🏊 Sorting fires by height for swimming attack');
  }

  let extinguished = 0;

  for (const firePos of fires.slice(0, 30)) {  // Increased for better coverage
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
      
      // Enhanced targeting for swimming
      const fireHeight = firePos.y;
      const botHeight = bot.entity.position.y;
      const heightDiff = fireHeight - botHeight;

      console.log(`🎯 Fire at height ${fireHeight}, bot at ${botHeight.toFixed(1)}, diff: ${heightDiff.toFixed(1)}`);

      // If fire is much higher and we're in water, swim up more aggressively
      if (heightDiff > 3 && bot.entity.isInWater) {
        console.log('🏊 Fire much higher - aggressive swimming up!');
        for (let i = 0; i < 5; i++) {
          bot.setControlState('jump', true);
          bot.setControlState('forward', true);
          await sleep(400);
        }
        bot.setControlState('jump', false);
        bot.setControlState('forward', false);
        await sleep(200);
      }

      // Look at fire with angle compensation for height
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

// ============================================================================
// MOBILE VLM INTEGRATION
// ============================================================================
let lastVLMPlan = null;
let lastPlanTime = 0;

async function getVLMPlan(fires, context = {}) {
  // Only get VLM plan every 10 seconds to avoid spamming
  const now = Date.now();
  if (now - lastPlanTime < 10000 && lastVLMPlan) {
    return lastVLMPlan;
  }

  try {
    // Prepare context for VLM
    const vlmContext = {
      fire_count: fires.length,
      position: {
        x: bot.entity.position.x,
        y: bot.entity.position.y,
        z: bot.entity.position.z
      },
      health: bot.health,
      water_buckets: bot.inventory.items().filter(i => i.name === 'water_bucket').length,
      fires_detected: fires.length > 0,
      mission_time: now,
      ...context
    };

    console.log('🧠 Requesting strategic plan from Mobile VLM...');

    // Call VLM bridge server
    const response = await fetch('http://localhost:5001/plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        image_path: null, // Will be implemented later
        context: vlmContext
      })
    });

    if (response.ok) {
      const plan = await response.json();
      lastVLMPlan = plan;
      lastPlanTime = now;

      // Extract actual strategy from VLM response
      const strategyData = plan.strategy || plan;
      const actualStrategy = strategyData.strategy || strategyData.priority_level?.toLowerCase() || 'unknown';
      console.log(`✅ VLM Strategy: ${actualStrategy}`);
      console.log(`🧠 VLM Priority: ${strategyData.priority_level || 'unknown'}`);
      console.log(`🧠 VLM Building Plan: ${strategyData.building_strategy || 'none'}`);
      console.log(`🧠 VLM Immediate Actions: ${strategyData.immediate_actions?.join(', ') || 'none'}`);

      return plan;
    } else {
      console.log('⚠️ VLM server not responding, using logic mode');
      return { strategy: 'patrol', mock: true };
    }
  } catch (error) {
    console.log('⚠️ VLM planning failed, using fallback logic');
    return { strategy: 'patrol', error: error.message };
  }
}

// ============================================================================
// ENHANCED AUTOMATIC FIRE DETECTION AND RESPONSE
// ============================================================================
let lastFireCheck = 0;
let buildMode = false;
let currentTowerHeight = 0;
let lastDirtRequestTime = 0;

function clusterFires(fires) {
  // Group fires into clusters to find the most important targets
  const clusters = [];
  const used = new Set();
  const clusterDistance = 8; // Distance threshold for clustering

  for (let i = 0; i < fires.length; i++) {
    if (used.has(i)) continue;

    const fire = fires[i];
    const cluster = {
      center: { x: fire.x, y: fire.y, z: fire.z },
      fires: [fire]
    };

    // Find all fires near this one
    for (let j = i + 1; j < fires.length; j++) {
      if (used.has(j)) continue;

      const otherFire = fires[j];
      const distance = Math.sqrt(
        Math.pow(fire.x - otherFire.x, 2) +
        Math.pow(fire.y - otherFire.y, 2) +
        Math.pow(fire.z - otherFire.z, 2)
      );

      if (distance <= clusterDistance) {
        cluster.fires.push(otherFire);
        used.add(j);

        // Update cluster center to average
        cluster.center.x += otherFire.x;
        cluster.center.y += otherFire.y;
        cluster.center.z += otherFire.z;
      }
    }

    // Calculate final cluster center
    cluster.center.x /= cluster.fires.length;
    cluster.center.y /= cluster.fires.length;
    cluster.center.z /= cluster.fires.length;

    clusters.push(cluster);
    used.add(i);
  }

  return clusters;
}

async function checkElevatedFires(fires) {
  // Check if any fires are too high to reach
  for (const fire of fires) {
    if (fire.y > bot.entity.position.y + 3) {
      console.log(`🏗️ Elevated fire detected at height ${fire.y}, need to build!`);
      return fire;
    }
  }
  return null;
}

async function buildTower(targetFire, vlmPlan = {}) {
  const strategy = vlmPlan.building_strategy || 'tower_approach';
  const instructions = vlmPlan.building_instructions || 'Build tower to reach fire';

  console.log(`🏗️ Building tower to reach fire at ${targetFire.x}, ${targetFire.y}, ${targetFire.z}`);
  console.log(`🧠 VLM Strategy: ${strategy}`);
  console.log(`🧠 VLM Instructions: ${instructions}`);
  buildMode = true;

  // Wait a bit to ensure inventory is up to date (especially after /give commands)
  await sleep(1000);

  // First, check what building blocks we have
  console.log('🔍 Checking for building blocks in inventory...');

  // Debug: Print ALL inventory items first
  console.log('🎒 FULL INVENTORY DEBUG:');
  const allItems = bot.inventory.items();
  console.log(`   Total items: ${allItems.length}`);
  if (allItems.length === 0) {
    console.log('   ⚠️ INVENTORY APPEARS EMPTY!');
  } else {
    allItems.forEach((item, index) => {
      console.log(`   ${index + 1}. ${item.name} x${item.count} (type: ${item.type}, id: ${item.id || 'no-id'})`);
    });
  }

  // Direct dirt check
  console.log('🔍 DIRECT DIRT CHECK:');
  const directDirtCheck = bot.inventory.findInventoryItem('dirt');
  console.log(`   findInventoryItem('dirt'): ${directDirtCheck ? 'FOUND' : 'NOT FOUND'}`);
  if (directDirtCheck) {
    console.log(`   Dirt details: ${directDirtCheck.name} x${directDirtCheck.count}`);
  }

  const allDirtItems = bot.inventory.items().filter(item => item.name === 'dirt');
  console.log(`   filter() for dirt: ${allDirtItems.length} items`);
  allDirtItems.forEach((dirt, i) => {
    console.log(`     ${i+1}. ${dirt.name} x${dirt.count}`);
  });

  // Group all blocks by type and count them
  const allBlocks = allItems;
  const blockGroups = {};

  for (const item of allBlocks) {
    // Skip water-related items
    if (item.name.includes('bucket') || item.name.includes('water')) {
      console.log(`   🪣 Skipping water item: ${item.name} x${item.count}`);
      continue;
    }

    if (!blockGroups[item.name]) {
      blockGroups[item.name] = {
        name: item.name,
        count: 0,
        slots: []
      };
    }
    blockGroups[item.name].count += item.count;
    blockGroups[item.name].slots.push(item);
    console.log(`   📦 Added ${item.name} x${item.count} to group ${item.name} (total: ${blockGroups[item.name].count})`);
  }

  console.log('📦 Available building blocks:');
  for (const [blockName, blockData] of Object.entries(blockGroups)) {
    console.log(`   ${blockName}: ${blockData.count} blocks in ${blockData.slots.length} slots`);
  }

  // Pick the best building block (prioritize dirt, then the block with most items)
  let buildingBlock = null;

  // First try to find dirt blocks
  console.log(`🔍 Checking for dirt blocks...`);
  if (blockGroups['dirt']) {
    console.log(`   Found dirt group: ${blockGroups['dirt'].count} blocks`);
    if (blockGroups['dirt'].count > 0) {
      buildingBlock = blockGroups['dirt'];
      console.log(`✅ Using ${buildingBlock.count} dirt blocks`);
    } else {
      console.log(`   ⚠️ Dirt group exists but count is 0`);
    }
  } else {
    console.log(`   ❌ No dirt group found`);
  }

  // Try other dirt variants
  if (!buildingBlock) {
    console.log(`🔍 Checking for coarse_dirt...`);
    if (blockGroups['coarse_dirt']) {
      console.log(`   Found coarse_dirt group: ${blockGroups['coarse_dirt'].count} blocks`);
      if (blockGroups['coarse_dirt'].count > 0) {
        buildingBlock = blockGroups['coarse_dirt'];
        console.log(`✅ Using ${buildingBlock.count} coarse dirt blocks`);
      }
    }
  }

  if (!buildingBlock) {
    console.log(`🔍 Checking for podzol...`);
    if (blockGroups['podzol']) {
      console.log(`   Found podzol group: ${blockGroups['podzol'].count} blocks`);
      if (blockGroups['podzol'].count > 0) {
        buildingBlock = blockGroups['podzol'];
        console.log(`✅ Using ${buildingBlock.count} podzol blocks`);
      }
    }
  }
  // If no dirt, pick the block with most items
  else {
    let maxCount = 0;
    for (const [blockName, blockData] of Object.entries(blockGroups)) {
      if (blockData.count > maxCount) {
        maxCount = blockData.count;
        buildingBlock = blockData;
      }
    }
    if (buildingBlock) {
      console.log(`✅ Using alternative building block: ${buildingBlock.name} x${buildingBlock.count}`);
    }
  }

  // If still no building blocks, request dirt (but not too frequently)
  const now = Date.now();
  if (!buildingBlock || buildingBlock.count === 0) {
    if (now - lastDirtRequestTime > 30000) { // Only request dirt every 30 seconds
      console.log('📦 No building blocks found, requesting dirt...');
      bot.chat('/clear @s');  // Clear inventory first
      await sleep(1000);
      bot.chat('/give @s minecraft:dirt 64');  // Then give dirt
      bot.chat('/give @s minecraft:water_bucket 2');  // And water
      lastDirtRequestTime = now;
      await sleep(3000);  // Wait longer for inventory to update
    } else {
      console.log('📦 No building blocks and recently requested dirt, waiting...');
      buildMode = false;
      return false;
    }

    // Check inventory again after /give
    const allBlocks = bot.inventory.items();
    const blockGroups = {};

    for (const item of allBlocks) {
      if (item.name.includes('bucket') || item.name.includes('water')) {
        continue;
      }

      if (!blockGroups[item.name]) {
        blockGroups[item.name] = {
          name: item.name,
          count: 0,
          slots: []
        };
      }
      blockGroups[item.name].count += item.count;
      blockGroups[item.name].slots.push(item);
    }

    if (blockGroups['dirt'] && blockGroups['dirt'].count > 0) {
      buildingBlock = blockGroups['dirt'];
      console.log(`✅ Received ${buildingBlock.count} dirt blocks`);
    } else {
      console.log('❌ Still no building blocks after /give');
      buildMode = false;
      return false;
    }
  }

  if (!buildingBlock) {
    console.log('❌ No building blocks available');
    buildMode = false;
    return false;
  }

  console.log(`✅ Found ${buildingBlock.count} ${buildingBlock.name} blocks, starting to build...`);

  // Calculate distance and direction to fire
  const firePos = new Vec3(targetFire.x, targetFire.y, targetFire.z);
  const botPos = bot.entity.position;
  const distanceToFire = botPos.distanceTo(firePos);

  console.log(`📍 Distance to fire: ${distanceToFire.toFixed(1)} blocks`);

  // Building strategy based on VLM recommendation
  const targetHeight = Math.max(0, targetFire.y - botPos.y);
  const buildDirection = firePos.minus(botPos).normalize().horizontal();

  console.log(`🏗️ Using ${strategy} building approach`);
  bot.chat(`🏗️ Building strategy: ${strategy}`);

  let totalBlocks = targetHeight + 5;

  // Adjust block count based on strategy
  if (strategy === 'staircase') {
    totalBlocks = targetHeight + 10; // Staircase needs more blocks
  } else if (strategy === 'tower_approach') {
    totalBlocks = targetHeight + 3; // Direct tower needs fewer blocks
  }

  for (let i = 0; i < Math.min(totalBlocks, buildingBlock.count); i++) {
    try {
      // Get building block again (in case stack changed)
      const currentBlock = buildingBlock.slots[0];
      if (!currentBlock) {
        console.log('❌ Ran out of building blocks');
        break;
      }

      // Equip building block
      console.log(`🔧 Equipping ${currentBlock.name}...`);
      try {
        await bot.equip(currentBlock, 'hand');
        console.log(`✅ Equipped ${currentBlock.name}`);
      } catch (equipError) {
        console.log(`⚠️ Equip failed: ${equipError.message}, trying to find another stack...`);
        const altBlock = bot.inventory.findInventoryItem(buildingBlock.name);
        if (altBlock) {
          await bot.equip(altBlock, 'hand');
          console.log(`✅ Equipped alternative ${altBlock.name}`);
        } else {
          console.log('❌ No more building blocks available');
          break;
        }
      }
      await sleep(300);

      // Look down and slightly forward for stair-like placement
      const lookYaw = Math.atan2(buildDirection.x, buildDirection.z);
      await bot.look(lookYaw, Math.PI/3); // Look down at 60 degrees
      await sleep(200);

      // Try to place block at current position or slightly forward
      let placeSuccess = false;

      // Method 1: Try to place block below (standard tower)
      if (!placeSuccess && i < 2) {
        const blockBelow = bot.blockAt(botPos.offset(0, -1, 0));
        if (blockBelow && blockBelow.name !== 'air') {
          try {
            await bot.placeBlock(blockBelow, new Vec3(0, 1, 0));
            placeSuccess = true;
            console.log(`🏗️ Placed block below (level ${i})`);
          } catch (e) {
            console.log(`⚠️ Below placement failed: ${e.message}`);
          }
        }
      }

      // Method 2: Try jump-placing (build while jumping)
      if (!placeSuccess) {
        // Start jumping
        bot.setControlState('jump', true);
        await sleep(200);

        // While in air, look down and place below
        await bot.look(lookYaw, Math.PI/2); // Look straight down
        const blockBelow = bot.blockAt(bot.entity.position.offset(0, -1, 0));

        if (blockBelow && blockBelow.name !== 'air') {
          try {
            await bot.placeBlock(blockBelow, new Vec3(0, 1, 0));
            placeSuccess = true;
            console.log(`🏗️ Jump-placed block (level ${i})`);
          } catch (e) {
            console.log(`⚠️ Jump-place failed: ${e.message}`);
          }
        }

        await sleep(400);
        bot.setControlState('jump', false);
        await sleep(200);
      }

      // Method 3: Try forward placement (staircase)
      if (!placeSuccess && i > 2) {
        const forwardPos = botPos.add(buildDirection.scaled(1));
        const blockBelow = bot.blockAt(forwardPos.offset(0, -1, 0));

        if (blockBelow && (blockBelow.name !== 'air' || blockBelow.name !== 'water')) {
          // Move forward slightly
          bot.setControlState('forward', true);
          await sleep(400);
          bot.setControlState('forward', false);
          await sleep(200);

          // Place block
          try {
            await bot.placeBlock(blockBelow, new Vec3(0, 1, 0));
            placeSuccess = true;
            console.log(`🏗️ Built staircase step (level ${i})`);
          } catch (e) {
            console.log(`⚠️ Staircase placement failed: ${e.message}`);
          }
        }
      }

      if (placeSuccess) {
        currentTowerHeight++;

        // Check if we're high enough to reach the fire
        const currentHeight = bot.entity.position.y;
        if (currentHeight >= targetFire.y - 2) {
          console.log(`✅ Reached target height! Current: ${currentHeight}, Target: ${targetFire.y}`);
          break;
        }

        console.log(`🏗️ Progress: Height ${currentHeight.toFixed(1)}, Tower blocks: ${currentTowerHeight}`);
      }

      // If placement failed, try to move forward and retry
      if (!placeSuccess) {
        console.log(`🚶 Moving forward to find better building spot...`);
        bot.setControlState('forward', true);
        await sleep(300);
        bot.setControlState('forward', false);
      }

    } catch (error) {
      console.log(`⚠️ Building error: ${error.message}`);
      break;
    }
  }

  buildMode = false;
  return currentTowerHeight > 0;
}

async function executeVLMBuildingPlan(targetFire, vlmPlan) {
  console.log(`🏗️ VLM Building Plan: Building tower to reach fire at height ${targetFire.y}`);
  buildMode = true;

  // Stop all movement while building
  bot.pathfinder.setGoal(null);
  bot.clearControlStates();

  // Check for building blocks
  const dirtBlock = bot.inventory.findInventoryItem('dirt');
  if (!dirtBlock || dirtBlock.count < 1) {
    console.log('❌ No dirt blocks available for building');
    buildMode = false;
    return false;
  }

  const currentHeight = bot.entity.position.y;
  const targetHeight = targetFire.y;
  const blocksNeeded = Math.max(0, Math.ceil(targetHeight - currentHeight + 2));

  console.log(`📏 Current: ${currentHeight.toFixed(1)}, Target: ${targetHeight}, Need: ${blocksNeeded} blocks`);
  console.log(`📦 Available dirt: ${dirtBlock.count} blocks`);

  if (blocksNeeded === 0) {
    console.log('✅ Already at sufficient height!');
    buildMode = false;
    return true;
  }

  // Check foundation
  const currentPos = bot.entity.position;
  const blockUnderFeet = bot.blockAt(currentPos.offset(0, -1, 0));

  if (!blockUnderFeet || blockUnderFeet.type === 0) {
    console.log('❌ No solid foundation to build on');
    buildMode = false;
    return false;
  }

  console.log(`🏗️ Starting pillar construction with jump-place technique...`);

  let blocksPlaced = 0;
  let success = true;

  // Equip dirt
  await bot.equip(dirtBlock, 'hand');
  await sleep(200);

  try {
    for (let i = 0; i < Math.min(blocksNeeded, dirtBlock.count, 12); i++) {
      if (bot.interrupt_code) {
        console.log('🛑 Building interrupted');
        break;
      }

      console.log(`🏗️ Placing block ${i + 1}/${blocksNeeded}`);

      // Jump-place technique: Jump and look down to place block under feet
      bot.setControlState('jump', true);
      await sleep(150); // Timing is crucial

      // Look straight down at the block we're standing on
      await bot.look(bot.entity.yaw, Math.PI / 2); // 90 degrees = straight down
      await sleep(50);

      try {
        // Place block on the block beneath us (this creates a pillar)
        await bot.placeBlock(blockUnderFeet, new Vec3(0, 1, 0));
        blocksPlaced++;
        console.log(`✅ Block placed! Height: ${bot.entity.position.y.toFixed(1)}`);

        // Stay in air briefly to land on new block
        await sleep(300);
        bot.setControlState('jump', false);
        await sleep(200);

        // Update the block under our feet for next iteration
        const newBlockUnderFeet = bot.blockAt(bot.entity.position.offset(0, -1, 0));
        if (newBlockUnderFeet && newBlockUnderFeet.type !== 0) {
          // Success - we're on a solid block
          continue;
        } else {
          console.log('⚠️ Pillar failed - not on solid block');
          success = false;
          break;
        }

      } catch (placeError) {
        console.log(`❌ Block placement failed: ${placeError.message}`);
        bot.setControlState('jump', false);
        success = false;
        break;
      }
    }

    const finalHeight = bot.entity.position.y;
    if (finalHeight >= targetHeight - 1) {
      console.log(`🎯 SUCCESS! Reached height ${finalHeight.toFixed(1)} (target: ${targetHeight})`);
    } else {
      console.log(`⚠️ Pillar incomplete: ${finalHeight.toFixed(1)} (target: ${targetHeight})`);
    }

  } catch (error) {
    console.log(`❌ Building error: ${error.message}`);
    success = false;
  } finally {
    bot.clearControlStates();
    buildMode = false;
  }

  console.log(`🏗️ Building complete: ${blocksPlaced} blocks placed, success: ${success}`);
  return success;
}

setInterval(async () => {
  const now = Date.now();

  // Skip fire checking while actively building to prevent conflicts
  if (buildMode) {
    console.log('⏸️ Fire check paused - bot is building...');
    return;
  }

  // Check every 3 seconds for better responsiveness
  if (now - lastFireCheck < 3000) return;
  lastFireCheck = now;

  // Look for fires nearby
  const fires = bot.findBlocks({
    matching: (block) => block.name === 'fire',
    maxDistance: 32,
    count: 20
  });

  // Smart fire prioritization: cluster fires and find the most important target
  let prioritizedFires = [];
  if (fires.length > 0) {
    console.log(`🔍 Analyzing ${fires.length} fires for optimal targeting...`);

    // Group fires by location to find clusters
    const fireClusters = clusterFires(fires);
    console.log(`📊 Found ${fireClusters.length} fire clusters`);

    // Prioritize: biggest clusters first, then highest fires
    prioritizedFires = fireClusters
      .sort((a, b) => {
        // Primary sort: cluster size (more fires = higher priority)
        if (b.fires.length !== a.fires.length) {
          return b.fires.length - a.fires.length;
        }
        // Secondary sort: height (higher fires = higher priority)
        return b.center.y - a.center.y;
      })
      .flatMap(cluster => cluster.fires);

    console.log(`🎯 Target priority: ${prioritizedFires.length} fires ordered by importance`);
  }

  // Get VLM strategic plan
  const vlmPlan = await getVLMPlan(prioritizedFires);

  if (prioritizedFires.length > 0) {
    const strategyData = vlmPlan.strategy || vlmPlan;
    const actualStrategy = strategyData.strategy || strategyData.priority_level?.toLowerCase() || 'unknown';
    console.log(`🚨 AUTOMATIC FIRE DETECTED: ${prioritizedFires.length} fires! VLM Strategy: ${actualStrategy}`);
    bot.chat(`🔥 ${prioritizedFires.length} fires detected - Priority: ${actualStrategy}`);

    // Check for elevated fires
    const elevatedFire = await checkElevatedFires(prioritizedFires);

    if (elevatedFire && !buildMode) {
      // Execute VLM detailed building plan
      const strategyData = vlmPlan.strategy || {};
      console.log(`🧠 VLM Analysis: ${strategyData.visual_analysis || 'Analyzed terrain'}`);
      console.log(`🧠 VLM Materials Needed:`, strategyData.materials_needed || {});
      console.log(`🧠 VLM Building Steps: ${strategyData.building_coordinates?.length || 0} steps planned`);
      console.log(`🧠 VLM Estimated Time: ${strategyData.estimated_completion_time || 'Unknown'}`);

      // Check if we have the required materials
      const requiredMaterials = strategyData.materials_needed || {};
      console.log('🎒 Checking required materials...');

      let materialsOK = true;
      for (const [material, count] of Object.entries(requiredMaterials)) {
        const existingItems = bot.inventory.items().filter(item => item.name.includes(material));
        const totalItems = existingItems.reduce((sum, item) => sum + item.count, 0);

        if (totalItems < count) {
          console.log(`⚠️ Need ${count} ${material}, have ${totalItems}`);
          materialsOK = false;
        } else {
          console.log(`✅ ${material}: ${totalItems}/${count}`);
        }
      }

      if (!materialsOK) {
        console.log('📦 Requesting required materials...');
        bot.chat(`/give @s minecraft:dirt ${requiredMaterials.dirt || 20}`);
        await sleep(2000);
      }

      const success = await executeVLMBuildingPlan(elevatedFire, strategyData);
      if (success) {
        bot.chat('🏗️ VLM plan executed - attacking elevated fire!');
        await navigateToPosition(elevatedFire.x, elevatedFire.y, elevatedFire.z);
        await suppressWithWater();
      }
    } else if (!buildMode) {
      // Handle normal fire based on VLM strategy - use prioritized target
      const targetFire = prioritizedFires[0];
      const strategyData = vlmPlan.strategy || {};
      const actualStrategy = strategyData.strategy || 'unknown';

      console.log(`🎯 Targeting priority fire at (${targetFire.x}, ${targetFire.y}, ${targetFire.z})`);

      if (actualStrategy === 'suppress' || actualStrategy.includes('suppress')) {
        await navigateToPosition(targetFire.x, targetFire.y, targetFire.z);
        await suppressWithWater();
      } else if (strategyData.immediate_actions) {
        // Handle VLM suggested actions
        if (strategyData.immediate_actions.includes('suppress')) {
          await navigateToPosition(targetFire.x, targetFire.y, targetFire.z);
          await suppressWithWater();
        } else {
          console.log(`🧠 VLM suggests: ${strategyData.immediate_actions.join(', ')}`);
        }
      } else {
        // Default action
        await navigateToPosition(targetFire.x, targetFire.y, targetFire.z);
        await suppressWithWater();
      }
    }
  } else {
    // No fires - follow VLM or patrol
    const strategyData = vlmPlan.strategy || {};
    const actualStrategy = strategyData.strategy || 'unknown';

    if (actualStrategy && actualStrategy !== 'patrol') {
      console.log(`🧠 VLM Strategy: ${actualStrategy}`);
      bot.chat(`🧠 Following VLM: ${actualStrategy}`);

      // Execute VLM suggested patrol pattern
      if (actualStrategy === 'scan') {
        await scan360();
      } else if (actualStrategy === 'search') {
        await patrol();
      }
    } else {
      // Regular patrol (10% chance)
      if (Math.random() < 0.1) {
        console.log('🚶 No fires - patrolling...');
        await patrol();
      }
    }
  }
}, 2000);

console.log('✅ Automatic fire detection enabled!');
console.log('🤖 AI FireBot starting...');
console.log('Connecting to localhost:52900 (Minecraft 1.19.4)');