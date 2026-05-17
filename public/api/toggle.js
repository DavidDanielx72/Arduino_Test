import { alarmStatus, addHistory } from "./_shared.js";

export default function handler(req, res) {
    if (req.method !== "POST") {
        return res.status(405).json({ error: "Method not allowed" });
    }

    // toggle logic (UNCHANGED)
    if (global.alarmStatus === "armed") {
        global.alarmStatus = "disarmed";
    } else {
        global.alarmStatus = "armed";
    }

    addHistory(
        `MANUAL TOGGLE ${global.alarmStatus.toUpperCase()}`,
        "Dashboard",
        global.alarmStatus === "armed" ? "Armed" : "Disarmed"
    );

    res.json({
        success: true,
        status: global.alarmStatus
    });
}
