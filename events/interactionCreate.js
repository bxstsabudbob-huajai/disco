const fs = require('fs');
const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits,
  ChannelType,
  AttachmentBuilder,
} = require('discord.js');
const { sendLog, baseEmbed } = require('../utils/logger');
const { loadJSON, saveJSON } = require('../utils/storage');
const { buildTranscript } = require('../utils/transcript');

function isAdmin(member, client) {
  if (!member) return false;
  if (member.permissions.has(PermissionFlagsBits.Administrator)) return true;
  const adminRoleId = client.config.adminRoleId;
  if (adminRoleId && member.roles.cache.has(adminRoleId)) return true;
  return false;
}

module.exports = {
  name: 'interactionCreate',
  async execute(interaction, client) {
    // ---------- Slash Commands ----------
    if (interaction.isChatInputCommand()) {
      const command = client.commands.get(interaction.commandName);
      if (!command) return;
      try {
        await command.execute(interaction, client);
      } catch (err) {
        console.error(err);
        const payload = { content: 'เกิดข้อผิดพลาดขณะรันคำสั่งนี้', ephemeral: true };
        if (interaction.replied || interaction.deferred) await interaction.followUp(payload).catch(() => {});
        else await interaction.reply(payload).catch(() => {});
      }
      return;
    }

    // ---------- ปุ่มรับยศ ----------
    if (interaction.isButton() && interaction.customId.startsWith('role_')) {
      const roleId = interaction.customId.replace('role_', '');
      const member = interaction.member;
      const role = interaction.guild.roles.cache.get(roleId);
      if (!role) return interaction.reply({ content: 'ไม่พบยศนี้ในเซิร์ฟเวอร์ (โปรดแจ้งแอดมิน)', ephemeral: true });

      try {
        let action;
        if (member.roles.cache.has(roleId)) {
          await member.roles.remove(roleId);
          action = 'ถอดยศ';
        } else {
          await member.roles.add(roleId);
          action = 'รับยศ';
        }

        await interaction.reply({ content: `${action} **${role.name}** เรียบร้อยแล้ว`, ephemeral: true });

        // เด้ง DM แจ้งเตือนหลังรับ/ถอดยศเสร็จ
        member
          .send({
            embeds: [
              new EmbedBuilder()
                .setTitle(action === 'รับยศ' ? 'คุณได้รับยศใหม่!' : 'ยศถูกถอดออกแล้ว')
                .setDescription(`ยศ **${role.name}** ในเซิร์ฟเวอร์ **${interaction.guild.name}**`)
                .setColor(action === 'รับยศ' ? 0x57f287 : 0xed4245)
                .setFooter({ text: 'ระบบพัฒนาโดย @nongbest' })
                .setTimestamp(),
            ],
          })
          .catch(() => {}); // เผื่อผู้ใช้ปิดรับ DM จากสมาชิกเซิร์ฟเวอร์

        const logEmbed = baseEmbed(`${action}ยศ`, action === 'รับยศ' ? 0x57f287 : 0xed4245).addFields(
          { name: 'สมาชิก', value: `<@${member.id}>`, inline: true },
          { name: 'ยศ', value: `<@&${roleId}>`, inline: true },
        );
        await sendLog(client, logEmbed);
      } catch (e) {
        interaction.reply({ content: `ไม่สามารถดำเนินการได้: ${e.message}`, ephemeral: true }).catch(() => {});
      }
      return;
    }

    // ---------- เลือกประเภท Ticket ----------
    if (interaction.isStringSelectMenu() && interaction.customId === 'ticket_select') {
      await interaction.deferReply({ ephemeral: true });

      const value = interaction.values[0];
      const category = (client.config.ticketCategories || []).find((c) => c.value === value);
      if (!category) return interaction.editReply({ content: 'ไม่พบประเภทนี้' });

      const tickets = loadJSON('tickets.json', {});
      const existing = Object.values(tickets).find(
        (t) => t.openerId === interaction.user.id && t.status === 'open',
      );
      if (existing) {
        return interaction.editReply({ content: `คุณมี Ticket ที่เปิดอยู่แล้ว: <#${existing.channelId}>` });
      }

      const counter = loadJSON('counter.json', { n: 0 });
      counter.n += 1;
      saveJSON('counter.json', counter);

      const overwrites = [
        { id: interaction.guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
        {
          id: interaction.user.id,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.AttachFiles,
            PermissionFlagsBits.ReadMessageHistory,
          ],
        },
        {
          id: client.user.id,
          allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels],
        },
      ];
      if (client.config.adminRoleId) {
        overwrites.push({
          id: client.config.adminRoleId,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.AttachFiles,
            PermissionFlagsBits.ReadMessageHistory,
          ],
        });
      }

      const channelOptions = {
        name: `ticket-${counter.n}-${interaction.user.username}`.slice(0, 90),
        type: ChannelType.GuildText,
        permissionOverwrites: overwrites,
      };
      if (category.categoryId) channelOptions.parent = category.categoryId;

      const channel = await interaction.guild.channels.create(channelOptions);

      tickets[channel.id] = {
        ticketNumber: counter.n,
        channelId: channel.id,
        category: category.label,
        openerId: interaction.user.id,
        openedAt: Date.now(),
        claimedBy: null,
        respondedBy: null,
        closedBy: null,
        closedAt: null,
        status: 'open',
      };
      saveJSON('tickets.json', tickets);

      const embed = new EmbedBuilder()
        .setTitle(`Ticket #${counter.n} — ${category.label}`)
        .setDescription(
          `สวัสดี <@${interaction.user.id}> ทีมงานจะเข้ามาช่วยเหลือคุณโดยเร็วที่สุด\nสามารถส่งข้อความหรือรูปภาพเพื่ออธิบายปัญหาได้เลย`,
        )
        .setColor(0x5865f2)
        .setFooter({ text: 'ระบบพัฒนาโดย @nongbest' })
        .setTimestamp();

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('ticket_claim').setLabel('รับเรื่อง').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('ticket_close').setLabel('ปิด Ticket').setStyle(ButtonStyle.Danger),
      );

      await channel.send({ content: `<@${interaction.user.id}>`, embeds: [embed], components: [row] });

      const logEmbed = baseEmbed('เปิด Ticket ใหม่', 0x5865f2).addFields(
        { name: 'หมายเลข', value: `#${counter.n}`, inline: true },
        { name: 'ประเภท', value: category.label, inline: true },
        { name: 'ผู้เปิด', value: `<@${interaction.user.id}>`, inline: true },
        { name: 'ช่อง', value: `<#${channel.id}>`, inline: true },
      );
      await sendLog(client, logEmbed);

      return interaction.editReply({ content: `เปิด Ticket เรียบร้อยแล้ว: <#${channel.id}>` });
    }

    // ---------- ปุ่มรับเรื่อง (Claim) ----------
    if (interaction.isButton() && interaction.customId === 'ticket_claim') {
      const tickets = loadJSON('tickets.json', {});
      const ticket = tickets[interaction.channel.id];
      if (!ticket) return interaction.reply({ content: 'ไม่พบข้อมูล Ticket นี้', ephemeral: true });

      if (!isAdmin(interaction.member, client)) {
        return interaction.reply({ content: 'เฉพาะแอดมิน/ทีมงานเท่านั้นที่รับเรื่องได้', ephemeral: true });
      }

      ticket.claimedBy = interaction.user.id;
      if (!ticket.respondedBy) ticket.respondedBy = interaction.user.id;
      saveJSON('tickets.json', tickets);

      await interaction.reply({ content: `<@${interaction.user.id}> รับเรื่องนี้แล้ว` });

      const logEmbed = baseEmbed('รับเรื่อง Ticket', 0xfee75c).addFields(
        { name: 'หมายเลข', value: `#${ticket.ticketNumber}`, inline: true },
        { name: 'รับเรื่องโดย', value: `<@${interaction.user.id}>`, inline: true },
        { name: 'ช่อง', value: `<#${interaction.channel.id}>`, inline: true },
      );
      await sendLog(client, logEmbed);
      return;
    }

    // ---------- ปุ่มปิด Ticket ----------
    if (interaction.isButton() && interaction.customId === 'ticket_close') {
      const tickets = loadJSON('tickets.json', {});
      const ticket = tickets[interaction.channel.id];
      if (!ticket) return interaction.reply({ content: 'ไม่พบข้อมูล Ticket นี้', ephemeral: true });

      const canClose = isAdmin(interaction.member, client) || interaction.user.id === ticket.openerId;
      if (!canClose) {
        return interaction.reply({ content: 'คุณไม่มีสิทธิ์ปิด Ticket นี้', ephemeral: true });
      }

      await interaction.reply({ content: 'กำลังปิด Ticket และบันทึกประวัติ...' });

      const opener = await interaction.guild.members.fetch(ticket.openerId).catch(() => null);
      const closer = interaction.member;

      let transcriptPaths = [];
      try {
        transcriptPaths = await buildTranscript(interaction.channel, {
          ticketNumber: ticket.ticketNumber,
          category: ticket.category,
          openerTag: opener ? opener.user.tag : ticket.openerId,
          closerTag: closer ? closer.user.tag : interaction.user.tag,
          openedAt: ticket.openedAt,
          closedAt: Date.now(),
        });
      } catch (e) {
        console.error('สร้าง transcript ไม่สำเร็จ:', e.message);
      }

      ticket.status = 'closed';
      ticket.closedBy = interaction.user.id;
      ticket.closedAt = Date.now();
      saveJSON('tickets.json', tickets);

      const logEmbed = baseEmbed(`ปิด Ticket #${ticket.ticketNumber}`, 0xed4245).addFields(
        { name: 'ประเภท', value: ticket.category, inline: true },
        { name: 'ผู้เปิด', value: `<@${ticket.openerId}>`, inline: true },
        { name: 'ผู้รับ/ตอบเรื่อง', value: ticket.respondedBy ? `<@${ticket.respondedBy}>` : 'ไม่มี', inline: true },
        { name: 'ผู้ปิด', value: `<@${ticket.closedBy}>`, inline: true },
        { name: 'เปิดเมื่อ', value: `<t:${Math.floor(ticket.openedAt / 1000)}:f>`, inline: true },
        { name: 'ปิดเมื่อ', value: `<t:${Math.floor(ticket.closedAt / 1000)}:f>`, inline: true },
      );

      const files = transcriptPaths.map(
        (p, i) => new AttachmentBuilder(p, { name: `transcript-ticket-${ticket.ticketNumber}-${i + 1}.png` }),
      );

      const logChannelId = client.config.logChannelId;
      if (logChannelId) {
        const logChannel = await client.channels.fetch(logChannelId).catch(() => null);
        if (logChannel) await logChannel.send({ embeds: [logEmbed], files });
      }

      // เด้งกลับไปหาผู้เปิด Ticket พร้อมแนบบันทึกการสนทนาเป็นรูปภาพ
      if (opener) {
        const dmEmbed = baseEmbed(`Ticket #${ticket.ticketNumber} ของคุณถูกปิดแล้ว`, 0xed4245)
          .setDescription(`ประเภท: ${ticket.category}\nปิดโดย: ${closer ? closer.user.tag : interaction.user.tag}`)
          .addFields(
            { name: 'เปิดเมื่อ', value: `<t:${Math.floor(ticket.openedAt / 1000)}:f>`, inline: true },
            { name: 'ปิดเมื่อ', value: `<t:${Math.floor(ticket.closedAt / 1000)}:f>`, inline: true },
          );

        const dmFiles = transcriptPaths.map(
          (p, i) => new AttachmentBuilder(p, { name: `transcript-ticket-${ticket.ticketNumber}-${i + 1}.png` }),
        );

        await opener.send({ embeds: [dmEmbed], files: dmFiles }).catch(() => {});
      }

      setTimeout(() => {
        interaction.channel.delete().catch(() => {});
        transcriptPaths.forEach((p) => fs.unlink(p, () => {}));
      }, 5000);
      return;
    }
  },
};
