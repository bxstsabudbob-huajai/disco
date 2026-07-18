const fs = require('fs');
const path = require('path');
const os = require('os');
const { createCanvas, GlobalFonts } = require('@napi-rs/canvas');

const FONT_FAMILY = 'NotoSansThai';
const FONT_PATH = path.join(__dirname, '..', 'assets', 'fonts', 'NotoSansThai.ttf');

// โหลดฟอนต์ไทยแบบฝังไปกับตัวบอท เพื่อให้ข้อความไทยในรูปภาพแสดงผลถูกต้อง
// ไม่ว่าเครื่องที่รันบอทจะมีฟอนต์ไทยติดตั้งอยู่หรือไม่ก็ตาม
if (!GlobalFonts.has(FONT_FAMILY)) {
  try {
    GlobalFonts.registerFromPath(FONT_PATH, FONT_FAMILY);
  } catch (e) {
    console.error('ไม่สามารถโหลดฟอนต์สำหรับสร้างรูปภาพ transcript ได้:', e.message);
  }
}

const WIDTH = 920;
const MARGIN_X = 24;
const BOX_PADDING_X = 16;
const BOX_PADDING_Y = 12;
const LINE_HEIGHT = 22;
const BOX_GAP = 10;
const MAX_MESSAGES_PER_IMAGE = 35;

const COLORS = {
  background: '#313338',
  outerBorder: '#1e1f22',
  boxFill: '#2b2d31',
  boxBorder: '#404249',
  headerFill: '#232428',
  headerBorder: '#404249',
  textPrimary: '#f2f3f5',
  textSecondary: '#949ba4',
  accentBar: '#5865f2',
  attachment: '#00a8fc',
};

const ACCENT_PALETTE = ['#5865f2', '#57f287', '#fee75c', '#eb459e', '#ed4245', '#f0b232', '#3ba55d', '#5865f2'];

function pickAccentColor(id) {
  let hash = 0;
  for (let i = 0; i < String(id).length; i += 1) {
    hash = (hash * 31 + String(id).charCodeAt(i)) >>> 0;
  }
  return ACCENT_PALETTE[hash % ACCENT_PALETTE.length];
}

function wrapText(ctx, text, maxWidth) {
  const rawLines = String(text || '').split('\n');
  const result = [];

  rawLines.forEach((rawLine) => {
    if (rawLine === '') {
      result.push('');
      return;
    }
    const words = rawLine.split(' ');
    let current = '';

    words.forEach((word) => {
      const candidate = current ? `${current} ${word}` : word;
      if (ctx.measureText(candidate).width <= maxWidth) {
        current = candidate;
        return;
      }

      if (current) {
        result.push(current);
        current = '';
      }

      // คำเดี่ยวยาวเกินความกว้างของกล่อง ให้ตัดเป็นช่วง ๆ ตามความกว้างที่พอดี
      if (ctx.measureText(word).width > maxWidth) {
        let piece = '';
        for (const ch of word) {
          const testPiece = piece + ch;
          if (ctx.measureText(testPiece).width > maxWidth && piece) {
            result.push(piece);
            piece = ch;
          } else {
            piece = testPiece;
          }
        }
        current = piece;
      } else {
        current = word;
      }
    });

    if (current) result.push(current);
  });

  return result.length ? result : [''];
}

function drawRoundedRect(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function measureMessageBlock(ctx, entry, contentWidth) {
  const lines = wrapText(ctx, entry.content, contentWidth);
  let extraLines = 0;
  if (entry.attachmentLines.length > 0) extraLines += entry.attachmentLines.length;
  const totalLines = Math.max(lines.length, 1) + extraLines;
  const headerLines = 1; // บรรทัดชื่อผู้ส่ง + เวลา
  const height = BOX_PADDING_Y * 2 + headerLines * LINE_HEIGHT + totalLines * LINE_HEIGHT;
  return { lines, height };
}

function drawHeaderPanel(ctx, x, y, width, ticket, pageInfo) {
  const lines = [
    `หมายเลข Ticket: #${ticket.ticketNumber}`,
    `ประเภท: ${ticket.category}`,
    `ผู้เปิด: ${ticket.openerTag}`,
    `ผู้ปิด: ${ticket.closerTag}`,
    `เปิดเมื่อ: ${ticket.openedAtText}`,
    `ปิดเมื่อ: ${ticket.closedAtText}`,
  ];
  const height = BOX_PADDING_Y * 2 + (lines.length + 1) * LINE_HEIGHT;

  ctx.fillStyle = COLORS.headerFill;
  ctx.strokeStyle = COLORS.headerBorder;
  ctx.lineWidth = 2;
  drawRoundedRect(ctx, x, y, width, height, 10);
  ctx.fill();
  ctx.stroke();

  let cursorY = y + BOX_PADDING_Y + LINE_HEIGHT * 0.7;
  ctx.fillStyle = COLORS.textPrimary;
  ctx.font = `bold 20px ${FONT_FAMILY}`;
  ctx.fillText(`บันทึกการสนทนา Ticket${pageInfo ? ` (${pageInfo})` : ''}`, x + BOX_PADDING_X, cursorY);
  cursorY += LINE_HEIGHT;

  ctx.font = `15px ${FONT_FAMILY}`;
  ctx.fillStyle = COLORS.textSecondary;
  lines.forEach((line) => {
    ctx.fillText(line, x + BOX_PADDING_X, cursorY);
    cursorY += LINE_HEIGHT;
  });

  return height;
}

function drawMessageBox(ctx, x, y, width, entry, block) {
  const accent = pickAccentColor(entry.authorId);

  ctx.fillStyle = COLORS.boxFill;
  ctx.strokeStyle = COLORS.boxBorder;
  ctx.lineWidth = 2;
  drawRoundedRect(ctx, x, y, width, block.height, 10);
  ctx.fill();
  ctx.stroke();

  // แถบสีด้านซ้ายของกล่อง แทนตัวตนของผู้ส่งแต่ละคน
  ctx.fillStyle = accent;
  drawRoundedRect(ctx, x, y, 5, block.height, 3);
  ctx.fill();

  let cursorY = y + BOX_PADDING_Y + LINE_HEIGHT * 0.7;
  const textX = x + BOX_PADDING_X + 6;

  ctx.font = `bold 15px ${FONT_FAMILY}`;
  ctx.fillStyle = COLORS.textPrimary;
  ctx.fillText(entry.authorTag, textX, cursorY);
  const authorWidth = ctx.measureText(entry.authorTag).width;

  ctx.font = `13px ${FONT_FAMILY}`;
  ctx.fillStyle = COLORS.textSecondary;
  ctx.fillText(`  ${entry.timeText}`, textX + authorWidth, cursorY);
  cursorY += LINE_HEIGHT;

  ctx.font = `15px ${FONT_FAMILY}`;
  ctx.fillStyle = COLORS.textPrimary;
  block.lines.forEach((line) => {
    ctx.fillText(line, textX, cursorY);
    cursorY += LINE_HEIGHT;
  });

  ctx.font = `14px ${FONT_FAMILY}`;
  ctx.fillStyle = COLORS.attachment;
  entry.attachmentLines.forEach((line) => {
    ctx.fillText(line, textX, cursorY);
    cursorY += LINE_HEIGHT;
  });
}

function renderPage(entries, ticket, pageIndex, totalPages) {
  // canvas ชั่วคราวไว้สำหรับวัดขนาดข้อความก่อนสร้างภาพจริง
  const measureCanvas = createCanvas(WIDTH, 10);
  const measureCtx = measureCanvas.getContext('2d');
  const contentWidth = WIDTH - MARGIN_X * 2 - BOX_PADDING_X * 2 - 6;

  measureCtx.font = `15px ${FONT_FAMILY}`;
  const blocks = entries.map((entry) => measureMessageBlock(measureCtx, entry, contentWidth));

  const pageInfo = totalPages > 1 ? `หน้า ${pageIndex + 1}/${totalPages}` : null;
  measureCtx.font = `15px ${FONT_FAMILY}`;
  const headerHeight = BOX_PADDING_Y * 2 + 7 * LINE_HEIGHT;

  const footerText = `สร้างโดยระบบ Ticket อัตโนมัติ • ${new Date().toLocaleString('th-TH')}`;
  const footerHeight = BOX_PADDING_Y * 2 + LINE_HEIGHT;

  const totalHeight =
    MARGIN_X * 2 +
    headerHeight +
    BOX_GAP +
    blocks.reduce((sum, b) => sum + b.height + BOX_GAP, 0) +
    footerHeight;

  const canvas = createCanvas(WIDTH, Math.max(totalHeight, 200));
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = COLORS.background;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = COLORS.outerBorder;
  ctx.lineWidth = 3;
  drawRoundedRect(ctx, 6, 6, canvas.width - 12, canvas.height - 12, 14);
  ctx.stroke();

  let y = MARGIN_X;
  const boxX = MARGIN_X;
  const boxWidth = WIDTH - MARGIN_X * 2;

  y += drawHeaderPanel(ctx, boxX, y, boxWidth, ticket, pageInfo) + BOX_GAP;

  entries.forEach((entry, i) => {
    const block = blocks[i];
    drawMessageBox(ctx, boxX, y, boxWidth, entry, block);
    y += block.height + BOX_GAP;
  });

  // กล่องท้ายภาพ
  ctx.fillStyle = COLORS.headerFill;
  ctx.strokeStyle = COLORS.headerBorder;
  ctx.lineWidth = 2;
  drawRoundedRect(ctx, boxX, y, boxWidth, footerHeight, 10);
  ctx.fill();
  ctx.stroke();
  ctx.font = `13px ${FONT_FAMILY}`;
  ctx.fillStyle = COLORS.textSecondary;
  ctx.fillText(footerText, boxX + BOX_PADDING_X, y + footerHeight / 2 + 5);

  return canvas.toBuffer('image/png');
}

/**
 * ดึงข้อความทั้งหมดในช่อง ticket แล้วสร้างเป็นรูปภาพ (PNG) สไตล์กล่อง
 * แบ่งเป็นหลายรูปหากบทสนทนายาวเกินไป คืนค่าเป็น array ของ path ไฟล์รูปภาพ
 */
async function buildTranscript(channel, ticketInfo = {}) {
  let allMessages = [];
  let lastId;

  while (true) {
    const options = { limit: 100 };
    if (lastId) options.before = lastId;
    const messages = await channel.messages.fetch(options);
    if (messages.size === 0) break;
    allMessages = allMessages.concat(Array.from(messages.values()));
    lastId = messages.last().id;
    if (messages.size < 100) break;
  }

  allMessages.reverse();

  const entries = allMessages.map((m) => {
    const attachmentLines = Array.from(m.attachments.values()).map(
      (a) => `[ไฟล์แนบ] ${a.name || a.url}`,
    );
    return {
      authorId: m.author.id,
      authorTag: m.author.tag,
      timeText: new Date(m.createdTimestamp).toLocaleString('th-TH'),
      content: m.content || (attachmentLines.length ? '' : '(ไม่มีข้อความ)'),
      attachmentLines,
    };
  });

  const ticket = {
    ticketNumber: ticketInfo.ticketNumber ?? '-',
    category: ticketInfo.category || '-',
    openerTag: ticketInfo.openerTag || '-',
    closerTag: ticketInfo.closerTag || '-',
    openedAtText: ticketInfo.openedAt ? new Date(ticketInfo.openedAt).toLocaleString('th-TH') : '-',
    closedAtText: ticketInfo.closedAt ? new Date(ticketInfo.closedAt).toLocaleString('th-TH') : '-',
  };

  const chunks = [];
  if (entries.length === 0) {
    chunks.push([
      {
        authorId: 'system',
        authorTag: 'ระบบ',
        timeText: '-',
        content: '(ไม่มีข้อความในตั๋วนี้)',
        attachmentLines: [],
      },
    ]);
  } else {
    for (let i = 0; i < entries.length; i += MAX_MESSAGES_PER_IMAGE) {
      chunks.push(entries.slice(i, i + MAX_MESSAGES_PER_IMAGE));
    }
  }

  const filePaths = [];
  chunks.forEach((chunkEntries, idx) => {
    const buffer = renderPage(chunkEntries, ticket, idx, chunks.length);
    const filePath = path.join(
      os.tmpdir(),
      `transcript-${channel.id}-${Date.now()}-${idx + 1}.png`,
    );
    fs.writeFileSync(filePath, buffer);
    filePaths.push(filePath);
  });

  return filePaths;
}

module.exports = { buildTranscript };
