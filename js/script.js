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

// Automatic Slideshow with Pause on Hover
var slideIndex = 0;
var slideInterval;
var slides = document.getElementsByClassName("mySlides");

function showSlides() {
  for (var i = 0; i < slides.length; i++) {
    slides[i].style.display = "none";
  }
  slideIndex++;
  if (slideIndex > slides.length) {slideIndex = 1}
  slides[slideIndex - 1].style.display = "block";
  slideInterval = setTimeout(showSlides, 4000); // Change image every 4 seconds
}

// Initialize slideshow
showSlides();

// Pause slideshow when hovering
for (var i = 0; i < slides.length; i++) {
  slides[i].addEventListener('mouseenter', function() {
    clearTimeout(slideInterval);
  });
  
  slides[i].addEventListener('mouseleave', function() {
    slideInterval = setTimeout(showSlides, 4000);
  });
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

// Dynamic Responsive Elements
function adjustElementSizes() {
  var contentSections = document.querySelectorAll('.w3-container');
  var windowWidth = window.innerWidth;

  contentSections.forEach(section => {
    if (windowWidth < 600) {
      section.style.padding = '10px';
    } else if (windowWidth < 900) {
      section.style.padding = '20px';
    } else {
      section.style.padding = '40px';
    }
  });
}

// Initialize and Update on Resize
adjustElementSizes();
window.onresize = adjustElementSizes;
