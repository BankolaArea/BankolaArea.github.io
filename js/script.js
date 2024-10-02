// Sticky Navbar
window.onscroll = function() {stickyNavbar()};

// Get the navbar
var navbar = document.querySelector(".w3-top");

// Get the offset position of the navbar
var sticky = navbar.offsetTop;

// Add the sticky class to the navbar when you reach its scroll position. Remove "sticky" when you leave the scroll position.
function stickyNavbar() {
  if (window.pageYOffset >= sticky) {
    navbar.classList.add("w3-card-4", "sticky");
  } else {
    navbar.classList.remove("w3-card-4", "sticky");
  }
}

// Responsive Navbar Toggle for Small Screens
function toggleNavbar() {
  var x = document.getElementById("navDemo");
  if (x.className.indexOf("w3-show") == -1) {
    x.className += " w3-show";
  } else {
    x.className = x.className.replace(" w3-show", "");
  }
}

// Smooth Scrolling for In-Page Navigation
var links = document.querySelectorAll('a[href^="#"]');
links.forEach(link => {
  link.addEventListener('click', function(event) {
    event.preventDefault();
    var target = document.querySelector(this.getAttribute('href'));
    window.scrollTo({
      top: target.offsetTop - navbar.offsetHeight, // Adjust for navbar height
      behavior: 'smooth'
    });
  });
});


// Function to add fade-in animation when elements are in the viewport
function fadeInOnScroll() {
    const faders = document.querySelectorAll('.fade-in');

    const appearOptions = {
        threshold: 0.1,  // Trigger when 10% of the element is visible
        rootMargin: "0px 0px -50px 0px" // Add some margin at the bottom of the viewport
    };

    const appearOnScroll = new IntersectionObserver(function(entries, appearOnScroll) {
        entries.forEach(entry => {
            if (!entry.isIntersecting) {
                return; // If not visible, do nothing
            } else {
                entry.target.classList.add('visible'); // Add the 'visible' class when the element comes into view
                appearOnScroll.unobserve(entry.target); // Stop observing once it has appeared
            }
        });
    }, appearOptions);

    faders.forEach(fader => {
        appearOnScroll.observe(fader);
    });
}

// Call the fade-in function
fadeInOnScroll();
