const mineflayer = require('mineflayer');

const bot = mineflayer.createBot({
  host: 'localhost',
  port: 52900,
  username: 'VisionBot'
});

bot.on('spawn', () => {
  console.log('✅ Bot spawned!');
  
  // Look for blocks nearby
  setInterval(() => {
    // Find all blocks within 20 blocks
    const blocks = bot.findBlocks({
      matching: (block) => {
        return block.name === 'fire' || 
               block.name === 'lava' || 
               block.name === 'campfire';
      },
      maxDistance: 20,
      count: 10
    });
    
    if (blocks.length > 0) {
      console.log(`🔥 FIRE DETECTED! Found ${blocks.length} fire blocks`);
      
      // Get closest fire
      const closest = blocks[0];
      const distance = bot.entity.position.distanceTo(closest);
      
      console.log(`   Closest fire: ${Math.round(distance)} blocks away`);
      console.log(`   Location: X=${closest.x} Y=${closest.y} Z=${closest.z}`);
      
      bot.chat(`I see fire ${Math.round(distance)} blocks away!`);
    } else {
      console.log('✅ No fire detected - area is clear');
    }
  }, 3000); // Check every 3 seconds
});

console.log('Connecting...');