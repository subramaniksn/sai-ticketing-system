// backend/whatsappService.js
// ✅ WhatsApp via Baileys — same pattern as attendance system

const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  Browsers
} = require('@whiskeysockets/baileys');

const qrcode = require('qrcode-terminal');

let sock = null;
let isWhatsAppReady = false;

// ─── Connect ────────────────────────────────────────────────────────────────
async function connectToWhatsApp() {
  const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');

  const { version, isLatest } = await fetchLatestBaileysVersion();
  console.log('📦 Using WA Version:', version, '| Latest:', isLatest);

  sock = makeWASocket({
    auth: state,
    printQRInTerminal: false,
    version,
    browser: Browsers.macOS('Chrome')
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      console.log('📱 Scan this QR with your WhatsApp:');
      qrcode.generate(qr, { small: true });
    }

    if (connection === 'open') {
      console.log('✅ WhatsApp CONNECTED & READY');
      isWhatsAppReady = true;
    }

    if (connection === 'close') {
      isWhatsAppReady = false;
      const reason = lastDisconnect?.error?.output?.statusCode;
      console.log('🔴 WhatsApp disconnected, reason:', reason);

      if (reason === DisconnectReason.loggedOut) {
        console.log('⚠️ Logged out. Delete auth_info_baileys folder and restart.');
      } else {
        console.log('🔄 Reconnecting in 5 seconds...');
        setTimeout(connectToWhatsApp, 5000);
      }
    }
  });
}

// ─── Core sender ────────────────────────────────────────────────────────────
/**
 * Send a WhatsApp message to a phone number
 * @param {string} phone - Indian mobile e.g. "9876543210" or "+919876543210"
 * @param {string} message - text body
 */
const sendWhatsApp = async (phone, message) => {
  if (!phone) {
    console.warn('⚠️ No phone number — WhatsApp skipped');
    return;
  }

  if (!isWhatsAppReady || !sock) {
    console.warn('⚠️ WhatsApp not ready — message skipped for', phone);
    return;
  }

  try {
    // Normalize: strip leading + or 0, ensure 91 country code
    const digits = phone.replace(/\D/g, '');
    const normalized = digits.startsWith('91') ? digits : `91${digits}`;
    const jid = `${normalized}@s.whatsapp.net`;

    await sock.sendMessage(jid, { text: message });
    console.log(`✅ WhatsApp sent → ${normalized}`);
  } catch (err) {
    console.error(`❌ WhatsApp send failed for ${phone}:`, err.message);
  }
};

// ─── Message Templates ───────────────────────────────────────────────────────

/**
 * 1️⃣ Ticket Created → Engineer
 */
const notifyEngineerTicketCreated = async (phone, engineerName, ticket) => {
  const msg =
`🎫 *New Ticket Assigned — SAI Automation*

👤 Engineer: *${engineerName}*
🎟️ Ticket No: *${ticket.ticketNo}*
🏢 Customer: *${ticket.customerName}*
📍 Site: *${ticket.siteName}*
⚠️ Priority: *${ticket.priority}*
🕒 Created: *${ticket.createdTime}* (IST)

📋 Issue:
${ticket.issueDetails}

🔐 Login & take action:
${process.env.APP_URL || 'http://your-app-url.com'}

⏰ Please start within 20 minutes to avoid escalation.`;

  await sendWhatsApp(phone, msg);
};

/**
 * 2️⃣ 20-min Reminder → Engineer (ticket still Open)
 */
const notifyEngineerReminder = async (phone, engineerName, ticket) => {
  const msg =
`⏰ *Reminder — Ticket Not Started!*

👤 Engineer: *${engineerName}*
🎟️ Ticket No: *${ticket.ticketNo}*
🏢 Customer: *${ticket.customerName}*
⚠️ Priority: *${ticket.priority}*

🚨 This ticket was assigned 20 minutes ago and has NOT been started yet.

Please login immediately:
${process.env.APP_URL || 'http://your-app-url.com'}`;

  await sendWhatsApp(phone, msg);
};

/**
 * 3️⃣ SLA Breached → Manager escalation
 */
const notifyManagerSlaBreached = async (phone, managerName, ticket, engineerName) => {
  const slaHours = { High: 2, Medium: 8, Low: 24 }[ticket.priority] || 8;

  const msg =
`🚨 *SLA ESCALATION — SAI Automation*

👔 Manager: *${managerName}*

Ticket has breached SLA!

🎟️ Ticket No: *${ticket.ticketNo}*
🏢 Customer: *${ticket.customerName}*
📍 Site: *${ticket.siteName}*
⚠️ Priority: *${ticket.priority}* (SLA: ${slaHours}h)
👷 Engineer: *${engineerName}*
🕒 Created: *${ticket.createdTime}* (IST)
📊 Status: *${ticket.status}*

📋 Issue:
${ticket.issueDetails}

🔐 Review on dashboard:
${process.env.APP_URL || 'http://your-app-url.com'}`;

  await sendWhatsApp(phone, msg);
};

module.exports = {
  connectToWhatsApp,
  sendWhatsApp,
  notifyEngineerTicketCreated,
  notifyEngineerReminder,
  notifyManagerSlaBreached,
  getIsReady: () => isWhatsAppReady
};