<?php
// Display the current PHP version and configuration
phpinfo();

// This will show all active PHP configurations, including any overrides applied via .htaccess
?>


<?php
if (in_array('mod_rewrite', apache_get_modules())) {
    echo "mod_rewrite is enabled!";
} else {
    echo "mod_rewrite is not enabled!";
}
?>