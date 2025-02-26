document.addEventListener("DOMContentLoaded", function() {
    const martyrs = [
        { name: "Rajesh Kumar", year: 2015 },
        { name: "Suresh Singh", year: 2018 },
        { name: "Anil Verma", year: 2020 },
        { name: "Deepak Sharma", year: 2022 }
    ];

    const list = document.getElementById("martyrsList");
    
    martyrs.forEach(martyr => {
        let li = document.createElement("li");
        li.textContent = `${martyr.name} - ${martyr.year}`;
        list.appendChild(li);
    });
});

function filterMartyrs() {
    let input = document.getElementById("searchInput").value.toLowerCase();
    let items = document.querySelectorAll("#martyrsList li");

    items.forEach(item => {
        item.style.display = item.textContent.toLowerCase().includes(input) ? "" : "none";
    });
}
