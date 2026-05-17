import { addHistory } from "./_shared.js";

export default function handler(req, res) {
    global.alarmStatus = "armed";

    addHistory("MANUAL ARM", "Dashboard", "Armed");

    res.json({ success: true });
}
