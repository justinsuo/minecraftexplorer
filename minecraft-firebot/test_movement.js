const mineflayer = require('mineflayer');

const bot = mineflayer.createBot({
  host: 'localhost',
  port: 52900,
  username: 'MoveBot'
});

bot.on('spawn', () => {
  console.log('✅ Bot spawned!');
  
  // Wait 2 seconds, then move
  setTimeout(() => {
    console.log('Moving forward...');
    
    // Press 'W' key (forward) for 2 seconds
    bot.setControlState('forward', true);
    
    setTimeout(() => {
      bot.setControlState('forward', false);
      console.log('Stopped moving');
      
      // Jump!
      bot.setControlState('jump', true);
      setTimeout(() => {
        bot.setControlState('jump', false);
        console.log('Jumped!');
      }, 500);
      
    }, 2000);
  }, 2000);
});

console.log('Connecting...');