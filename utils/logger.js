const { EmbedBuilder } = require('discord.js');

async function sendLog(client, embed) {
  const logChannelId = client.config.logChannelId;
  if (!logChannelId) return;
  try {
    const channel = await client.channels.fetch(logChannelId);
    if (channel) await channel.send({ embeds: [embed] });
  } catch (e) {
    console.error('ส่ง log ไม่สำเร็จ:', e.message);
  }
}

function baseEmbed(title, color = 0x5865f2) {
  return new EmbedBuilder()
    .setTitle(title)
    .setColor(color)
    .setTimestamp()
    .setFooter({ text: 'ระบบพัฒนาโดย @nongbest' });
}

module.exports = { sendLog, baseEmbed };
