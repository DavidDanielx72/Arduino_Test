document.addEventListener("DOMContentLoaded", () => {
  const tableBody = document.getElementById("history-body");

  async function loadHistory() {
    try {
      const res = await fetch("/api/history");
      const data = await res.json();

      tableBody.innerHTML = "";

      const sortedData = [...data].reverse();

      sortedData.forEach(event => {
        const row = document.createElement("tr");
        row.className = "hover:bg-white/5 transition-colors";

        row.innerHTML = `
          <td class="px-8 py-5 text-sm text-gray-200">${event.description}</td>
          <td class="px-6 py-5 text-sm text-gray-400">${event.source}</td>
          <td class="px-6 py-5">
            <span class="px-3 py-1 rounded-full text-[10px] font-bold uppercase
              ${event.status === "Triggered"
                ? "bg-red-500/10 text-red-400 border border-red-500/30"
                : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"}">
              ${event.status}
            </span>
          </td>
          <td class="px-6 py-5 text-sm text-gray-400">${event.datetime}</td>
          <td class="px-6 py-5 text-center text-gray-500">...</td>
        `;

        tableBody.appendChild(row);
      });

    } catch (err) {
      console.error("Failed to load history:", err);
    }
  }

  loadHistory();
});