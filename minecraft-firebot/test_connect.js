// Simple test: Can we connect a bot?

const mineflayer = require('mineflayer');

const bot = mineflayer.createBot({
  host: 'localhost',     // Your computer
  port: 52900,           // The port from "Open to LAN"
  username: 'TestBot',   // Bot's name (any name works)
  auth: 'offline',       // Don't need Microsoft login for LAN
});

// When bot joins
bot.on('spawn', () => {
  console.log('✅ Bot connected to Minecraft!');
  console.log(`Bot position: ${bot.entity.position}`);
  
  // Make bot say hello in game
  bot.chat('Hello! I am a test bot!');
});

// If connection fails
bot.on('error', (err) => {
  console.error('❌ Error:', err);
});

// When bot gets kicked
bot.on('kicked', (reason) => {
  console.log('Bot was kicked:', reason);
});

console.log('Connecting to Minecraft...');