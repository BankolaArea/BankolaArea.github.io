/**
 * dataLoader.js
 * 
 * Shared data loading module for the Land Employment File portal.
 * Reads data/config.json to determine whether to fetch table data
 * from local CSV files or from a public Google Sheet.
 * 
 * Usage: Call loadTableData("tableKey") from any page-specific JS file.
 */

/**
 * Loads table data based on config.json settings.
 * Reads the config, determines the source (CSV or Google Sheet),
 * fetches the data, parses it, and populates the HTML table.
 *
 * @param {string} tableKey - The key in config.tables (e.g., "approved", "under_process")
 */
async function loadTableData(tableKey) {
    const tableBody = document.querySelector("#dataTable tbody");
    const searchInput = document.getElementById("searchInput");

    try {
        // 1. Fetch and read config
        const configResponse = await fetch("data/config.json");
        if (!configResponse.ok) {
            throw new Error("Failed to load config.json");
        }
        const config = await configResponse.json();

        // 2. Determine the fetch URL based on dataSource setting
        const tableConfig = config.tables[tableKey];
        if (!tableConfig) {
            throw new Error(`Table key "${tableKey}" not found in config.json`);
        }

        let fetchUrl;

        if (config.dataSource === "gsheet") {
            const sheetName = config.googleSheet.sheets[tableKey];
            if (!sheetName) {
                throw new Error(`Google Sheet tab name not found for "${tableKey}" in config.json`);
            }
            fetchUrl = `https://docs.google.com/spreadsheets/d/${config.googleSheet.sheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}`;
        } else {
            // Default: local CSV
            fetchUrl = tableConfig.csvPath;
        }

        // 3. Fetch CSV data (both sources return CSV text)
        const dataResponse = await fetch(fetchUrl);
        if (!dataResponse.ok) {
            throw new Error(`Failed to fetch data from: ${fetchUrl}`);
        }
        const data = await dataResponse.text();

        // 4. Parse CSV and populate table
        const rows = data.trim().split("\n").slice(1); // skip header row

        rows.forEach(row => {
            // Handle quoted CSV fields (Google Sheets wraps values in quotes)
            const cols = parseCSVRow(row);
            if (cols.length === tableConfig.columns) {
                let tr = document.createElement("tr");
                cols.forEach(col => {
                    let td = document.createElement("td");
                    td.textContent = col.trim();
                    tr.appendChild(td);
                });
                tableBody.appendChild(tr);
            }
        });

    } catch (error) {
        console.error(`Error loading data for "${tableKey}":`, error);
        tableBody.innerHTML =
            '<tr><td colspan="99" style="text-align:center; color:red; padding:1rem;">' +
            'Failed to load data. Please try again later.</td></tr>';
    }

    // 5. Search functionality
    if (searchInput) {
        searchInput.addEventListener("keyup", function () {
            const filter = searchInput.value.toLowerCase();
            const trs = tableBody.getElementsByTagName("tr");
            for (let i = 0; i < trs.length; i++) {
                const rowText = trs[i].textContent.toLowerCase();
                trs[i].style.display = rowText.includes(filter) ? "" : "none";
            }
        });
    }
}

/**
 * Parses a single CSV row, handling quoted fields.
 * Google Sheets CSV export wraps fields containing commas in double-quotes.
 * Local CSVs may not. This handles both cases.
 * 
 * @param {string} row - A single line from a CSV file
 * @returns {string[]} Array of field values
 */
function parseCSVRow(row) {
    const result = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < row.length; i++) {
        const char = row[i];
        if (char === '"') {
            if (inQuotes && i + 1 < row.length && row[i + 1] === '"') {
                // Escaped quote ("") inside a quoted field
                current += '"';
                i++; // skip the next quote
            } else {
                inQuotes = !inQuotes;
            }
        } else if (char === ',' && !inQuotes) {
            result.push(current.trim());
            current = "";
        } else if (char === '\r') {
            // Skip carriage return characters
            continue;
        } else {
            current += char;
        }
    }
    result.push(current.trim());
    return result;
}
