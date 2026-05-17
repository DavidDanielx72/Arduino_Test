let history = [];

export default function handler(req, res) {
  const body = req.body;

  if (body?.type === "intrusion") {
    history.push({
      description: "INTRUSION DETECTED",
      source: "Sensor",
      datetime: new Date().toLocaleString()
    });
  }

  if (body?.type === "rfid_tap" && body.status === "toggle") {
    history.push({
      description: "RFID TOGGLE",
      source: "Arduino",
      datetime: new Date().toLocaleString()
    });
  }

  res.status(200).json({ success: true });
}
