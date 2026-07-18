require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { REST, Routes } = require('discord.js');

const commands = [];
const commandsPath = path.join(__dirname, 'commands');
for (const file of fs.readdirSync(commandsPath).filter((f) => f.endsWith('.js'))) {
  const command = require(path.join(commandsPath, file));
  commands.push(command.data.toJSON());
}

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    console.log(`กำลังลงทะเบียนคำสั่ง (${commands.length} คำสั่ง)...`);

    if (process.env.GUILD_ID) {
      await rest.put(
        Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
        { body: commands },
      );
      console.log('ลงทะเบียนคำสั่งระดับเซิร์ฟเวอร์สำเร็จ (ใช้งานได้ทันที)');
    } else {
      await rest.put(
        Routes.applicationCommands(process.env.CLIENT_ID),
        { body: commands },
      );
      console.log('ลงทะเบียนคำสั่งระดับ Global สำเร็จ (อาจใช้เวลาถึง 1 ชั่วโมง)');
    }
  } catch (error) {
    console.error('ลงทะเบียนคำสั่งล้มเหลว:', error);
  }
})();
