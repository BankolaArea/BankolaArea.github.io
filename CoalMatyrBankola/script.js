document.addEventListener("DOMContentLoaded", function() {
    fetch("martyrs.csv")
        .then(response => response.text())
        .then(data => {
            const rows = data.split("\n").slice(1); // Skip header row
            const table = document.getElementById("martyrsTable");

            rows.forEach(row => {
                const cols = row.split(",");
                if (cols.length === 3) {
                    let tr = document.createElement("tr");

                    cols.forEach(col => {
                        let td = document.createElement("td");
                        td.textContent = col.trim();
                        tr.appendChild(td);
                    });

                    table.appendChild(tr);
                }
            });
        })
        .catch(error => console.error("Error loading the CSV file:", error));
});
