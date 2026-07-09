// Wait for the window to load
window.addEventListener('load', () => {
  const statusDisplay = document.getElementById('status-display');
  
  if (window.Analyzer) {
    statusDisplay.innerHTML = 'SDK Status: <span style="color: #56d364;">Initialized & Active</span>';
    console.log('[TestApp] Analyzer SDK successfully attached to window.');
  } else {
    statusDisplay.innerHTML = 'SDK Status: <span style="color: #f85149;">Failed (Check if Backend Port 5000 is running and SDK is built)</span>';
    console.error('[TestApp] Analyzer SDK not found on window object.');
  }

  // 1. Trigger Runtime Javascript Error
  document.getElementById('btn-trigger-error').addEventListener('click', () => {
    // This will cause an uncaught ReferenceError
    // We intentionally call a function that does not exist
    nonExistentFunction();
  });

  // 2. Trigger Unhandled Promise Rejection
  document.getElementById('btn-trigger-promise').addEventListener('click', () => {
    // This will trigger an unhandled promise rejection
    Promise.reject(new Error('Intentional unhandled rejection in Test App'));
  });
});
