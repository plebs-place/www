// Version check for PWA updates
(function() {
  'use strict';

  // Current version stored locally
  var STORAGE_KEY = 'app_version';
  var currentVersion = localStorage.getItem(STORAGE_KEY) || '0.0.0';

  // Flag to track if update is available
  window.updateAvailable = false;
  window.newVersion = null;
  window.releaseNotes = null;

  // Callback function that Flutter will set
  window.onUpdateAvailable = null;

  // Function to apply update (called from Flutter)
  window.applyUpdate = function() {
    // Save new version to prevent showing again
    if (window.newVersion) {
      localStorage.setItem(STORAGE_KEY, window.newVersion);
    }

    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      // Tell the waiting service worker to activate
      navigator.serviceWorker.controller.postMessage({ type: 'SKIP_WAITING' });
    }
    // Reload the page to get new version
    window.location.reload(true);
  };

  // Compare semantic versions (returns 1 if a > b, -1 if a < b, 0 if equal)
  function compareVersions(a, b) {
    var partsA = a.split('.').map(Number);
    var partsB = b.split('.').map(Number);

    for (var i = 0; i < Math.max(partsA.length, partsB.length); i++) {
      var numA = partsA[i] || 0;
      var numB = partsB[i] || 0;
      if (numA > numB) return 1;
      if (numA < numB) return -1;
    }
    return 0;
  }

  // Notify about update
  function notifyUpdate(version, notes) {
    window.updateAvailable = true;
    window.newVersion = version;
    window.releaseNotes = notes;

    // Notify Flutter if callback is set
    if (typeof window.onUpdateAvailable === 'function') {
      window.onUpdateAvailable();
    }

    // Also dispatch custom event
    window.dispatchEvent(new CustomEvent('pwaUpdateAvailable', {
      detail: { version: version, notes: notes }
    }));
  }

  // Check manifest.json for updates
  function checkVersionFile() {
    fetch('manifest.json?t=' + Date.now())
      .then(function(response) {
        if (!response.ok) throw new Error('manifest.json not found');
        return response.json();
      })
      .then(function(data) {
        var serverVersion = data.version || '0.0.0';

        // Compare with stored version
        if (compareVersions(serverVersion, currentVersion) > 0) {
          notifyUpdate(serverVersion, '');
        }
      })
      .catch(function(err) {
        // Fallback to service worker detection only
        console.log('Version check via manifest skipped:', err.message);
      });
  }

  // Check for service worker updates
  function checkServiceWorker() {
    if (!('serviceWorker' in navigator)) {
      return;
    }

    navigator.serviceWorker.ready.then(function(registration) {
      // Check for updates
      registration.update();

      // Listen for new service worker installing
      registration.addEventListener('updatefound', function() {
        var newWorker = registration.installing;

        if (newWorker) {
          newWorker.addEventListener('statechange', function() {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // New version available via service worker!
              // Only notify if version.json hasn't already notified
              if (!window.updateAvailable) {
                notifyUpdate('nova', 'Atualizacao disponivel');
              }
            }
          });
        }
      });
    });

    // Listen for controller change (when new SW takes over)
    navigator.serviceWorker.addEventListener('controllerchange', function() {
      window.location.reload();
    });
  }

  // Check for updates on page load
  function init() {
    checkVersionFile();
    checkServiceWorker();
  }

  if (document.readyState === 'complete') {
    init();
  } else {
    window.addEventListener('load', init);
  }

  // Check periodically (every 5 minutes)
  setInterval(function() {
    checkVersionFile();

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then(function(registration) {
        registration.update();
      });
    }
  }, 5 * 60 * 1000);
})();
