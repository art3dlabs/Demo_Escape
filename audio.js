import * as THREE from 'three';

let listener;
const audioLoader = new THREE.AudioLoader();
const sounds = {}; // Cache loaded sounds { name: Audio Object }
const soundSources = { // Map names to file paths (PLACEHOLDER PATHS)
    'pickup_item': 'assets/sounds/pickup_item.wav',
    'place_object': 'assets/sounds/place_object.wav',
    'item_drop': 'assets/sounds/item_drop.wav',
    'pickup_clue': 'assets/sounds/pickup_clue.wav', // e.g., paper rustle
    'unlock_short': 'assets/sounds/unlock_short.wav',
    'unlock_heavy': 'assets/sounds/unlock_heavy.wav', // e.g., chest, door
    'locked_drawer': 'assets/sounds/locked_drawer.wav',
    'button_press': 'assets/sounds/button_press.wav',
    'book_slide': 'assets/sounds/book_slide.wav',
    'unscrew': 'assets/sounds/unscrew.wav',
    'uv_reveal': 'assets/sounds/uv_reveal.wav', // e.g., magical chime
    'projector_on': 'assets/sounds/projector_on.wav',
    'insert_item': 'assets/sounds/insert_item.wav',
    'cloth_rustle': 'assets/sounds/cloth_rustle.wav', // For rug
    'slide_heavy': 'assets/sounds/slide_heavy.wav', // For picture
    'success': 'assets/sounds/success.wav', // Generic success
    'success_chime': 'assets/sounds/success_chime.wav', // Specific chime
    'error_short': 'assets/sounds/error_short.wav', // Generic fail/incorrect
    'click_soft': 'assets/sounds/click_soft.wav', // UI or minor interact
    'ui_open': 'assets/sounds/ui_open.wav', // Open modal/minigame
    'ui_cancel': 'assets/sounds/ui_cancel.wav', // Close modal/cancel
    'ui_confirm': 'assets/sounds/ui_confirm.wav', // Confirm action (like help)
    'inventory_select': 'assets/sounds/inventory_select.wav',
    'inventory_deselect': 'assets/sounds/inventory_deselect.wav',
    'jump': 'assets/sounds/jump.wav',
    'victory_fanfare': 'assets/sounds/victory_fanfare.wav',
    'game_over': 'assets/sounds/game_over.wav', // Time up
    'background_ambient': 'assets/sounds/background_ambient.mp3', // Looping background
    // Add more sounds as needed
};

export function setupAudio(camera) {
    try {
        listener = new THREE.AudioListener();
        camera.add(listener); // Attach listener to camera
        console.log("Audio listener attached to camera.");
        // Preload common sounds (optional)
        // preloadSound('click_soft');
        // preloadSound('error_short');
    } catch (error) {
        console.error("Error setting up audio listener:", error);
    }
}

function preloadSound(name) {
    if (!listener) return;
    if (sounds[name]) return; // Already loaded or loading

    const source = soundSources[name];
    if (!source) {
        console.warn(`Sound source not defined for: ${name}`); return;
    }

    console.log(`Preloading sound: ${name}`);
    sounds[name] = 'loading'; // Mark as loading to prevent multiple requests
    audioLoader.load(source, (buffer) => {
        const audio = new THREE.Audio(listener);
        audio.setBuffer(buffer);
        sounds[name] = audio; // Store the loaded Audio object
         console.log(`Sound preloaded successfully: ${name}`);
    }, undefined, (err) => {
        console.error(`Error preloading sound ${name}:`, err);
        sounds[name] = null; // Mark as failed
    });
}


export function playSound(name, loop = false, volume = 0.5) {
    if (!listener) { console.warn("Audio listener not ready."); return; }

    const source = soundSources[name];
    if (!source) { console.warn(`Sound source not defined for: ${name}`); return; }

    try {
        // Check cache first
        const cachedSound = sounds[name];

        if (cachedSound && cachedSound !== 'loading') {
            if (cachedSound.isPlaying) {
                 if(!loop) cachedSound.stop(); // Stop previous instance if not looping
                 else return; // Don't restart loop if already playing
            }
            cachedSound.setLoop(loop);
            cachedSound.setVolume(volume);
            cachedSound.play();
            // console.log(`Playing cached sound: ${name}`);
        } else if (cachedSound === 'loading') {
             console.log(`Sound ${name} is still loading, cannot play yet.`);
        } else {
            // Load and play on demand
            audioLoader.load(source, (buffer) => {
                 const audio = new THREE.Audio(listener);
                 audio.setBuffer(buffer);
                 audio.setLoop(loop);
                 audio.setVolume(volume);
                 audio.play();
                 sounds[name] = audio; // Cache it after loading
                 // console.log(`Loaded and playing sound: ${name}`);
            }, undefined, (err) => {
                 console.error(`Error loading sound ${name}:`, err);
                 sounds[name] = null; // Mark load failed
            });
        }
    } catch (error) {
        console.error(`Error playing sound ${name}:`, error);
    }
}

export function stopSound(name) {
    const cachedSound = sounds[name];
    if (cachedSound && cachedSound !== 'loading' && cachedSound.isPlaying) {
        cachedSound.stop();
        console.log(`Stopped sound: ${name}`);
    }
}

// Add functions for pauseSound, setGlobalVolume etc. if needed