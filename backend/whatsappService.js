const makeWASocket = require("@whiskeysockets/baileys").default;
const {
  useMultiFileAuthState,
  DisconnectReason
} = require("@whiskeysockets/baileys");

const qrcode = require("qrcode-terminal");
const path = require("path");

const AUTH_DIR = path.join(__dirname, "auth_info_baileys");

let sock = null;
let isWhatsAppReady = false;
let connectionStarting = false;

function normalizePhone(phone) {
  const digits = String(phone || "").replace(/\D/g, "");

  if (!digits) return "";

  // Indian 10-digit number
  if (digits.length === 10) {
    return `91${digits}`;
  }

  // Already has country code
  return digits;
}

function isConfigured() {
  return true;
}

async function startWhatsApp() {
  if (connectionStarting) return;

  connectionStarting = true;

  try {
    const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);

    sock = makeWASocket({
      auth: state,
      printQRInTerminal: false,
      browser: ["SAI Ticketing System", "Chrome", "1.0.0"]
    });

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("connection.update", async (update) => {
      const {
        connection,
        lastDisconnect,
        qr
      } = update;

      if (qr) {
        console.log("\n========================================");
        console.log("       SAI WHATSAPP QR CODE");
        console.log("========================================\n");

        qrcode.generate(qr, { small: true });

        console.log("\n========================================");
        console.log("Scan using WhatsApp > Linked Devices");
        console.log("========================================\n");
      }

      if (connection === "open") {
        isWhatsAppReady = true;
        connectionStarting = false;

        console.log("========================================");
        console.log("✅ WhatsApp connected successfully");
        console.log("========================================");
      }

      if (connection === "close") {
        isWhatsAppReady = false;
        connectionStarting = false;

        const statusCode =
          lastDisconnect?.error?.output?.statusCode;

        console.error(
          "❌ WhatsApp connection closed:",
          statusCode || "unknown"
        );

        if (statusCode === DisconnectReason.loggedOut) {
          console.error(
            "⚠️ WhatsApp logged out. A new QR scan is required."
          );
          return;
        }

        console.log("🔄 Reconnecting WhatsApp in 5 seconds...");

        setTimeout(() => {
          startWhatsApp().catch((error) => {
            console.error(
              "WhatsApp reconnect error:",
              error
            );
          });
        }, 5000);
      }
    });

  } catch (error) {
    connectionStarting = false;
    isWhatsAppReady = false;

    console.error(
      "❌ WhatsApp startup error:",
      error
    );

    setTimeout(() => {
      startWhatsApp().catch(console.error);
    }, 5000);
  }
}

async function sendManagerWhatsApp(phone, message) {
  const recipient = normalizePhone(phone);

  if (!recipient) {
    return {
      sent: false,
      reason: "no-phone"
    };
  }

  if (!isWhatsAppReady || !sock) {
    console.warn(
      `⚠️ WhatsApp not ready — message skipped for ${recipient}`
    );

    return {
      sent: false,
      reason: "whatsapp-not-ready"
    };
  }

  try {
    const jid = `${recipient}@s.whatsapp.net`;

    await sock.sendMessage(jid, {
      text: String(message || "")
    });

    console.log(
      `✅ WhatsApp sent → ${recipient}`
    );

    return {
      sent: true
    };

  } catch (error) {
    console.error(
      `❌ WhatsApp send failed → ${recipient}`,
      error
    );

    return {
      sent: false,
      reason: "send-error",
      error: error.message
    };
  }
}

// Start WhatsApp when backend starts
startWhatsApp().catch((error) => {
  console.error(
    "❌ WhatsApp initialization failed:",
    error
  );
});

module.exports = {
  isConfigured,
  sendManagerWhatsApp
};
