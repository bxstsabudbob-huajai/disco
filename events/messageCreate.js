const { checkSpam } = require('../utils/antispam');
const { sendLog, baseEmbed } = require('../utils/logger');

module.exports = {
  name: 'messageCreate',
  async execute(message, client) {
    if (message.author.bot || !message.guild) return;

    const reason = checkSpam(message, client.config);
    if (!reason) return;

    // ลบข้อความที่ต้องสงสัยทันที
    if (message.deletable) {
      message.delete().catch(() => {});
    }

    const reasonText =
      {
        flood: 'ส่งข้อความรัวเร็วเกินไป (Flood)',
        mention_spam: 'แท็กสมาชิก/โรลจำนวนมากผิดปกติ',
        invite_link: 'แชร์ลิงก์เชิญ Discord โดยไม่ได้รับอนุญาต',
      }[reason] || 'พฤติกรรมต้องสงสัย';

    let timedOut = false;
    const timeoutMinutes = (client.config.antiSpam && client.config.antiSpam.timeoutMinutes) || 10;
    try {
      if (message.member && message.member.moderatable) {
        await message.member.timeout(timeoutMinutes * 60 * 1000, `กันสแปม: ${reasonText}`);
        timedOut = true;
      }
    } catch (e) {
      console.error('ไม่สามารถ timeout สมาชิกได้:', e.message);
    }

    const embed = baseEmbed('ระบบกันสแปมทำงาน', 0xed4245).addFields(
      { name: 'สมาชิก', value: `<@${message.author.id}> (${message.author.tag})`, inline: true },
      { name: 'ช่อง', value: `<#${message.channel.id}>`, inline: true },
      { name: 'เหตุผล', value: reasonText, inline: false },
      {
        name: 'การดำเนินการ',
        value: timedOut ? `ลบข้อความ + Timeout ${timeoutMinutes} นาที` : 'ลบข้อความ',
        inline: false,
      },
    );

    await sendLog(client, embed);

    message.channel
      .send({ content: `<@${message.author.id}> โปรดหลีกเลี่ยงพฤติกรรมสแปม ระบบได้บันทึกและดำเนินการแล้ว` })
      .then((m) => setTimeout(() => m.delete().catch(() => {}), 5000))
      .catch(() => {});
  },
};
