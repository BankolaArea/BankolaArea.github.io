document.addEventListener("DOMContentLoaded", function() {
    fetch("data/sample-data.csv")
        .then(response => response.text())
        .then(data => {
            const rows = data.trim().split("\n").slice(1); // Skip header row
            const table = document.querySelector("#dataTable tbody");

            rows.forEach(row => {
                const cols = row.split(",");
                if (cols.length === 4) {
                    let tr = document.createElement("tr");

                    // Add index number as Sl No
                    let tdIndex = document.createElement("td");
                    tdIndex.textContent = table.children.length + 1;
                    tr.appendChild(tdIndex);

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
