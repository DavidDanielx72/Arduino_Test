let alarmStatus = "armed";

export default function handler(req, res) {
  alarmStatus = alarmStatus === "armed" ? "disarmed" : "armed";

  res.status(200).json({
    success: true,
    status: alarmStatus
  });
}
