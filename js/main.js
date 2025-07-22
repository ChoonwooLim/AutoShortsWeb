// --- Main Application Entry Point for Web ---

// Core modules
import { initializeApiManagement } from './api.js';
import { state } from './state.js';
import { googleConfig } from './config.js';
import lazyLoader from './utils/lazy-loader.js';

// Feature modules
import { setupFileEventListeners } from './ui-file.js';
import { applyInitialTheme, setupThemeEventListeners } from './ui-theme.js';
import { initializeSettingsUI, setupSettingsEventListeners } from './ui-settings.js';
import { setupChatEventListeners } from './ui-chat.js';

// Expose state globally for easier debugging
window.state = state;

// Global function for lazy loading file-related modules
window.loadFileModules = async function() {
    if (window.loadFileModules.loaded) return true;
    try {
        const { setupProcessingEventListeners, updateProcessButtonState } = await lazyLoader.loadModule('ui-processing', () => import('./ui-processing.js'));
        await setupProcessingEventListeners();
        updateProcessButtonState();
        window.loadFileModules.loaded = true;
        console.log('📦 File processing modules loaded.');
        return true;
    } catch (error) {
        console.error('❌ Failed to load file processing modules:', error);
        return false;
    }
};

/**
 * Initializes the web application.
 */
async function main() {
    console.log('🚀 AutoShorts Web Initializing...');
    
    try {
        // 1. Apply theme and set up theme toggling immediately
        applyInitialTheme();
        setupThemeEventListeners();
        console.log('🎨 Theme system initialized.');

        // 2. Set up file handling events
        setupFileEventListeners();
        console.log('📁 File upload system initialized.');

        // 3. Initialize API keys and services
        await initializeApiManagement();
        console.log('🔑 API keys loaded.');
        
        // 4. Initialize settings UI and event listeners
        initializeSettingsUI();
        setupSettingsEventListeners();
        console.log('⚙️ Settings UI initialized.');

        // 5. Setup chat event listeners
        setupChatEventListeners();
        console.log('💬 Chat system initialized.');

        // 6. Preload non-critical modules in the background
        setupBackgroundPreloading();
        
        console.log('✅ AutoShorts Web successfully initialized.');
        
    } catch (error) {
        console.error('❌ Application initialization failed:', error);
        alert(`Failed to initialize the application.\n\nError: ${error.message}\nPlease refresh the page.`);
    }
}

/**
 * Preloads non-critical modules in the background to improve performance.
 */
function setupBackgroundPreloading() {
    lazyLoader.addToPreloadQueue('ui-processing', () => import('./ui-processing.js'));
    lazyLoader.addToPreloadQueue('simple-transcription', () => import('./simple-transcription.js'));
    lazyLoader.addToPreloadQueue('shorts-processing', () => import('./shorts-processing-real.js'));
    lazyLoader.addToPreloadQueue('face-analyzer-new', () => import('./face-analyzer-new.js'));

    setTimeout(() => {
        lazyLoader.startPreloading();
    }, 1500); // Start preloading after a short delay
}

// --- Google Auth Initialization ---
window.handleGapiLoaded = async () => {
  try {
    const api = await lazyLoader.loadModule('api', () => import('./api.js'));
    gapi.load('client', api.initializeGapiClient);
  } catch (error) {
    console.error('Google API initialization failed:', error);
  }
};

window.handleGisLoaded = async () => {
  try {
    const clientId = googleConfig.getClientId();
    console.log(`🔐 Initializing Google Auth with client ID from: ${googleConfig.getCurrentIdInfo().source}`);
    const api = await lazyLoader.loadModule('api', () => import('./api.js'));
    api.initializeGis(clientId);
  } catch (error) {
    console.error('Google Identity Services initialization failed:', error);
  }
};


// Run the main initialization function when the DOM is ready.
document.addEventListener('DOMContentLoaded', main);