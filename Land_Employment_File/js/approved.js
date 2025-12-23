document.addEventListener("DOMContentLoaded", function() {
    const searchInput = document.getElementById("searchInput");
    const tableBody = document.querySelector("#dataTable tbody");

    fetch("data/approved.csv")
        .then(response => response.text())
        .then(data => {
            const rows = data.trim().split("\n").slice(1); 

            rows.forEach(row => {
                const cols = row.split(",");
                if (cols.length === 3) {
                    let tr = document.createElement("tr");

                    
                    cols.forEach(col => {
                        let td = document.createElement("td");
                        td.textContent = col.trim();
                        tr.appendChild(td);
                    });

                    tableBody.appendChild(tr);
                }
            });
        })
        .catch(error => console.error("Error loading CSV:", error));

    // --- NEW SEARCH LOGIC ---
    searchInput.addEventListener("keyup", function() {
        const filter = searchInput.value.toLowerCase();
        const trs = tableBody.getElementsByTagName("tr");

        for (let i = 0; i < trs.length; i++) {
            // Get all text content from the row and make it lowercase
            const rowText = trs[i].textContent.toLowerCase();
            
            // If the search text matches anything in the row, show it
            if (rowText.includes(filter)) {
                trs[i].style.display = "";
            } else {
                trs[i].style.display = "none";
            }
        }
    });
});
