let alarmStatus = "armed";

export default function handler(req, res) {

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Only POST allowed" });
  }

  alarmStatus = alarmStatus === "armed" ? "disarmed" : "armed";

  return res.status(200).json({
    success: true,
    status: alarmStatus
  });
}
