function isConfigured() {
  return Boolean(process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID);
}

function normalizePhone(phone) {
  const digits = String(phone || "").replace(/\D/g, "");
  // User phone numbers in this system are normally entered as 10-digit Indian mobiles.
  return digits.length === 10 ? `91${digits}` : digits;
}

async function sendManagerWhatsApp(phone, message) {
  const recipient = normalizePhone(phone);
  if (!isConfigured() || !recipient) return { sent: false, reason: "not-configured-or-no-phone" };

  const response = await fetch(
    `https://graph.facebook.com/v22.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ messaging_product: "whatsapp", to: recipient, type: "text", text: { body: message } })
    }
  );
  if (!response.ok) throw new Error(`WhatsApp API returned ${response.status}`);
  return { sent: true };
}

module.exports = { isConfigured, sendManagerWhatsApp };
