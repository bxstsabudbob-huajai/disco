const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');
const { sendLog, baseEmbed } = require('../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('giverole')
    .setDescription('ระบบรับยศ (เฉพาะแอดมิน)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand((sub) =>
      sub
        .setName('setup')
        .setDescription('สร้างกล่องรับยศในช่องนี้')
        .addStringOption((opt) => opt.setName('หัวข้อ').setDescription('หัวข้อของกล่องรับยศ').setRequired(false))
        .addStringOption((opt) =>
          opt.setName('คำอธิบาย').setDescription('คำอธิบายของกล่องรับยศ').setRequired(false),
        )
        .addAttachmentOption((opt) =>
          opt.setName('รูปภาพ').setDescription('รูปภาพประกอบกล่องรับยศ').setRequired(false),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName('give')
        .setDescription('มอบยศให้สมาชิกโดยตรง')
        .addUserOption((opt) => opt.setName('สมาชิก').setDescription('สมาชิกที่ต้องการมอบยศ').setRequired(true))
        .addRoleOption((opt) => opt.setName('ยศ').setDescription('ยศที่ต้องการมอบ').setRequired(true)),
    ),

  async execute(interaction, client) {
    const sub = interaction.options.getSubcommand();

    // ---------- /giverole setup : สร้างกล่องปุ่มให้สมาชิกกดรับยศเอง ----------
    if (sub === 'setup') {
      const roles = client.config.roles || [];
      const validRoles = roles.filter((r) => r.roleId && r.roleId !== 'ใส่ROLE_ID_ที่นี่');
      if (validRoles.length === 0) {
        return interaction.reply({
          content: 'ยังไม่ได้ตั้งค่ายศใน config.json (roles) กรุณาใส่ roleId ให้ครบก่อน',
          ephemeral: true,
        });
      }

      const title = interaction.options.getString('หัวข้อ') || 'ระบบรับยศ';
      const desc = interaction.options.getString('คำอธิบาย') || 'กดปุ่มด้านล่างเพื่อรับ/ถอดยศที่ต้องการ';
      const image = interaction.options.getAttachment('รูปภาพ');

      const embed = new EmbedBuilder()
        .setTitle(title)
        .setDescription(desc)
        .setColor(0x5865f2)
        .setFooter({ text: 'ระบบพัฒนาโดย @nongbest' })
        .setTimestamp();

      if (image) embed.setImage(image.url);

      const rows = [];
      for (let i = 0; i < validRoles.length; i += 5) {
        const row = new ActionRowBuilder();
        validRoles.slice(i, i + 5).forEach((r) => {
          row.addComponents(
            new ButtonBuilder()
              .setCustomId(`role_${r.roleId}`)
              .setLabel(r.label)
              .setStyle(ButtonStyle[r.style] || ButtonStyle.Secondary),
          );
        });
        rows.push(row);
        if (rows.length === 5) break; // Discord จำกัด 5 rows ต่อข้อความ
      }

      await interaction.channel.send({ embeds: [embed], components: rows });
      return interaction.reply({ content: 'สร้างกล่องรับยศเรียบร้อยแล้ว', ephemeral: true });
    }

    // ---------- /giverole give : แอดมินมอบยศให้สมาชิกโดยตรง ----------
    if (sub === 'give') {
      const member = interaction.options.getMember('สมาชิก');
      const role = interaction.options.getRole('ยศ');

      if (!member) return interaction.reply({ content: 'ไม่พบสมาชิก', ephemeral: true });

      try {
        await member.roles.add(role);
      } catch (e) {
        return interaction.reply({ content: `ไม่สามารถมอบยศได้: ${e.message}`, ephemeral: true });
      }

      const logEmbed = baseEmbed('มอบยศด้วยคำสั่ง', 0x57f287).addFields(
        { name: 'สมาชิก', value: `<@${member.id}>`, inline: true },
        { name: 'ยศ', value: `<@&${role.id}>`, inline: true },
        { name: 'โดยแอดมิน', value: `<@${interaction.user.id}>`, inline: true },
      );
      await sendLog(client, logEmbed);

      member
        .send({
          content: `คุณได้รับยศ **${role.name}** ในเซิร์ฟเวอร์ **${interaction.guild.name}** เรียบร้อยแล้ว`,
        })
        .catch(() => {});

      return interaction.reply({ content: `มอบยศ ${role} ให้ ${member} เรียบร้อยแล้ว`, ephemeral: true });
    }
  },
};
