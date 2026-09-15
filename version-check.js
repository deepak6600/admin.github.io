// version-check.js — Admin Panel
// यह script server पर नया version check करती है और auto-reload करती है

(function() {
    const CHECK_INTERVAL = 30000; // 30 seconds

    let currentVersion = null;

    try {
        const scriptSrc = document.currentScript ? document.currentScript.src : import.meta.url;
        const currentVersionMatch = scriptSrc.match(/v=(\d+)/);
        currentVersion = currentVersionMatch ? parseInt(currentVersionMatch[1]) : null;
    } catch (e) {
        console.warn("Admin Version Check: Could not determine script source.");
    }

    if (!currentVersion) {
        console.warn("Admin Version Check: Could not determine current version from script tag.");
        return;
    }

    console.log(`Admin Version Check: Current version is ${currentVersion}. Monitoring for updates...`);

    async function checkForUpdates() {
        try {
            const response = await fetch(`version.json?t=${new Date().getTime()}`, { cache: 'no-store' });

            if (!response.ok) {
                console.warn("Admin Version Check: Could not fetch version.json");
                return;
            }

            const data = await response.json();
            const latestVersion = parseInt(data.version);

            console.log(`Admin Version Check: Latest version on server is ${latestVersion}`);

            if (latestVersion > currentVersion) {
                console.log("Admin Version Check: New version found! Reloading...");
                window.location.reload(true);
            }
        } catch (error) {
            console.error("Admin Version Check: Error checking for updates:", error);
        }
    }

    // Load पर तुरंत check करो
    checkForUpdates();

    // हर 30 seconds पर check करो
    setInterval(checkForUpdates, CHECK_INTERVAL);

    // Tab पर वापस आने पर check करो
    document.addEventListener("visibilitychange", () => {
        if (!document.hidden) {
            checkForUpdates();
        }
    });

})();
