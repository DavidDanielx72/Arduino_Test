import { addHistory } from "./_shared.js";

export default function handler(req, res) {
    global.alarmStatus = "disarmed";

    addHistory("MANUAL DISARM", "Dashboard", "Disarmed");

    res.json({ success: true });
}
