// ============================================================
// JAVADI 2.0 – اعلان‌های Real-time با SSE
// ============================================================
const clients = new Set();

function addClient(res) {
  clients.add(res);
  console.log(`🔔 مدیر متصل شد (مجموع: ${clients.size})`);
}

function removeClient(res) {
  clients.delete(res);
  console.log(`🔕 مدیر قطع شد (مجموع: ${clients.size})`);
}

function broadcast(event, data) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  let sent = 0;
  for (const client of clients) {
    try { client.write(payload); sent++; }
    catch { clients.delete(client); }
  }
  if (sent > 0) console.log(`📢 "${event}" → ${sent} مدیر`);
  return sent;
}

function setupSSE(req, res) {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  res.write(`event: connected\ndata: ${JSON.stringify({ ts: Date.now() })}\n\n`);

  const heartbeat = setInterval(() => {
    try { res.write(`: heartbeat\n\n`); } catch { clearInterval(heartbeat); }
  }, 25000);

  req.on('close', () => { clearInterval(heartbeat); removeClient(res); });
}

function countClients() { return clients.size; }

module.exports = { addClient, removeClient, broadcast, setupSSE, countClients };