const { ActivityType } = require('discord.js');

module.exports = {
  name: 'ready',
  once: true,
  execute(client) {
    console.log(`บอทออนไลน์แล้วในชื่อ ${client.user.tag}`);
    console.log('ระบบ: รับยศ | Ticket | กันสแปม — พัฒนาโดย @nongbest');
    client.user.setActivity('พัฒนาระบบโดย @nongbest', { type: ActivityType.Watching });
  },
};
