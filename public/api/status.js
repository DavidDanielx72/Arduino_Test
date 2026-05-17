import { alarmStatus, autoArmTime, autoDisarmTime, autoMode } from "./_shared.js";

export default function handler(req, res) {
    res.status(200).json({
        status: alarmStatus,
        autoArmTime,
        autoDisarmTime,
        autoMode
    });
}
