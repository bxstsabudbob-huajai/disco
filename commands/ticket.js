const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
} = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ticket')
    .setDescription('ระบบ Ticket (เฉพาะแอดมิน)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand((sub) =>
      sub
        .setName('setup')
        .setDescription('สร้างกล่องเปิด Ticket ในช่องนี้ (เลือกได้ 3 ประเภท)')
        .addStringOption((opt) => opt.setName('หัวข้อ').setDescription('หัวข้อของกล่อง Ticket').setRequired(false))
        .addStringOption((opt) =>
          opt.setName('คำอธิบาย').setDescription('คำอธิบายของกล่อง Ticket').setRequired(false),
        )
        .addAttachmentOption((opt) =>
          opt.setName('รูปภาพ').setDescription('รูปภาพประกอบกล่อง Ticket').setRequired(false),
        ),
    ),

  async execute(interaction, client) {
    const sub = interaction.options.getSubcommand();
    if (sub !== 'setup') return;

    const categories = client.config.ticketCategories || [];
    if (categories.length === 0) {
      return interaction.reply({ content: 'ยังไม่ได้ตั้งค่าประเภท Ticket ใน config.json', ephemeral: true });
    }

    const title = interaction.options.getString('หัวข้อ') || 'ระบบแจ้งปัญหา / ติดต่อทีมงาน';
    const desc =
      interaction.options.getString('คำอธิบาย') ||
      'เลือกหัวข้อด้านล่างเพื่อเปิด Ticket ทีมงานจะตอบกลับโดยเร็วที่สุด';
    const image = interaction.options.getAttachment('รูปภาพ');

    const embed = new EmbedBuilder()
      .setTitle(title)
      .setDescription(desc)
      .setColor(0x5865f2)
      .setFooter({ text: 'ระบบพัฒนาโดย @nongbest' })
      .setTimestamp();
    if (image) embed.setImage(image.url);

    const menu = new StringSelectMenuBuilder()
      .setCustomId('ticket_select')
      .setPlaceholder('เลือกหัวข้อที่ต้องการติดต่อ')
      .addOptions(
        categories.slice(0, 3).map((c) => ({
          label: c.label,
          value: c.value,
        })),
      );

    const row = new ActionRowBuilder().addComponents(menu);

    await interaction.channel.send({ embeds: [embed], components: [row] });
    return interaction.reply({ content: 'สร้างกล่อง Ticket เรียบร้อยแล้ว', ephemeral: true });
  },
};
