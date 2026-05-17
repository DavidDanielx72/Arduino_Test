let alarmStatus = "armed";

export default function handler(req, res) {
  res.status(200).json({
    status: alarmStatus,
    autoArmTime: "16:00",
    autoDisarmTime: "06:30",
    autoMode: true
  });
}
