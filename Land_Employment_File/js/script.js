document.getElementById('csvFile').addEventListener('change', function(e) {
  const file = e.target.files[0];

  if (file) {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: function(results) {
        const tableBody = document.querySelector("#dataTable tbody");
        tableBody.innerHTML = "";

        results.data.forEach((row, index) => {
          const tr = document.createElement("tr");

          tr.innerHTML = `
            <td>${index + 1}</td>
            <td>${row["Name of the Candidate"]}</td>
            <td>${row["Name of Father"]}</td>
            <td>${row["Project Name"]}</td>
            <td>${row["Present Status of the File"]}</td>
          `;

          tableBody.appendChild(tr);
        });
      }
    });
  }
});
