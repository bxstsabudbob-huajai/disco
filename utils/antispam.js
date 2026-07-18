// เก็บ timestamp ข้อความล่าสุดของแต่ละคนไว้ในหน่วยความจำ
const cache = new Map(); // userId -> [timestamps]

function isAdminOrWhitelist(member, config) {
  if (!member) return false;
  if (member.permissions.has('Administrator')) return true;
  const wl = config.antiSpam.whitelistRoleIds || [];
  return member.roles.cache.some((r) => wl.includes(r.id));
}

/**
 * ตรวจสอบข้อความว่ามีพฤติกรรมสแปมหรือไม่
 * คืนค่า: 'flood' | 'mention_spam' | 'invite_link' | null
 */
function checkSpam(message, config) {
  const { antiSpam } = config;
  if (!antiSpam || !antiSpam.enabled) return null;
  if (isAdminOrWhitelist(message.member, config)) return null;

  const now = Date.now();
  const windowMs = (antiSpam.timeWindowSeconds || 5) * 1000;
  const userId = message.author.id;

  const arr = (cache.get(userId) || []).filter((t) => now - t < windowMs);
  arr.push(now);
  cache.set(userId, arr);

  if (arr.length > (antiSpam.maxMessages || 5)) {
    cache.set(userId, []); // รีเซ็ตหลังจับได้ครั้งหนึ่ง กันสแปมซ้ำรัว ๆ
    return 'flood';
  }

  const mentionCount = message.mentions.users.size + message.mentions.roles.size;
  if (mentionCount > (antiSpam.maxMentions || 5)) {
    return 'mention_spam';
  }

  if (antiSpam.deleteInvites) {
    const inviteRegex = /(discord\.gg|discord(app)?\.com\/invite)\/[a-zA-Z0-9-]+/i;
    if (inviteRegex.test(message.content)) return 'invite_link';
  }

  return null;
}

module.exports = { checkSpam };
