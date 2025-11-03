// ==UserScript==
// @name         DZMM Voice File Uploader
// @namespace    https://github.com/kuma-dzmm
// @version      1.1.0
// @description  Add custom audio file upload capability to DZMM.ai chat
// @author       kuma
// @match        https://www.dzmm.ai/*
// @match        https://*.dzmm.ai/*
// @match        https://www.dzmm.io/*
// @match        https://*.dzmm.io/*
// @match        https://www.laopo.ai/*
// @match        https://*.laopo.ai/*
// @match        https://www.xn--i8s951di30azba.com/*
// @match        https://*.xn--i8s951di30azba.com/*
// @match        https://www.电子魅魔.com/*
// @match        https://*.电子魅魔.com/*
// @grant        GM_addStyle
// @grant        unsafeWindow
// @run-at       document-end
// @updateURL    https://raw.githubusercontent.com/kuma-dzmm/dzmm-patch/refs/heads/main/dzmm-voice-uploader.user.js
// @downloadURL  https://raw.githubusercontent.com/kuma-dzmm/dzmm-patch/refs/heads/main/dzmm-voice-uploader.user.js
// ==/UserScript==

(function() {
    'use strict';

    console.log('🎤 [INIT] DZMM Voice Uploader script started');

    // ===== CONFIGURATION =====
    const DEBUG = false;
    const SUPPORTED_AUDIO_FORMATS = ['audio/*', '.m4a', '.mp3', '.ogg', '.wav', '.webm'];
    const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

    // ===== STYLES =====
    if (typeof GM_addStyle !== 'undefined') {
        GM_addStyle(`
            .voice-upload-loading {
                opacity: 0.5;
                pointer-events: none;
            }
            .voice-upload-success {
                animation: voice-upload-pulse 0.3s ease-in-out;
            }
            @keyframes voice-upload-pulse {
                0%, 100% { transform: scale(1); }
                50% { transform: scale(1.1); }
            }
        `);
    }

    // ===== UTILITY FUNCTIONS =====

    /**
     * Calculate audio duration from file
     */
    async function getAudioDuration(file) {
        return new Promise((resolve, reject) => {
            const audio = new Audio();
            const url = URL.createObjectURL(file);

            audio.addEventListener('loadedmetadata', () => {
                URL.revokeObjectURL(url);
                resolve(audio.duration);
            });

            audio.addEventListener('error', (e) => {
                URL.revokeObjectURL(url);
                reject(new Error('Failed to load audio file: ' + (e.message || 'Unknown error')));
            });

            audio.src = url;
        });
    }

    /**
     * Upload voice file to DZMM API
     */
    async function uploadVoiceFile(file, duration) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('duration', String(duration));

        if (DEBUG) {
            console.log('🎤 [UPLOAD] Uploading file:', {
                name: file.name,
                type: file.type,
                size: file.size,
                duration: duration
            });
        }

        try {
            const response = await fetch('/api/chat/voice-messages', {
                method: 'POST',
                body: formData,
                credentials: 'include',
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Upload failed: ${response.status} ${response.statusText} - ${errorText}`);
            }

            const data = await response.json();

            if (DEBUG) {
                console.log('🎤 [UPLOAD] Success:', data);
            }

            return {
                voiceId: data.voiceId || undefined,
                url: data.url,
                path: data.path,
                duration: data.duration,
                fileType: data.fileType,
                fileSize: data.fileSize,
                transcript: data.transcript || undefined,
                waveform: data.waveform || undefined,
            };
        } catch (error) {
            console.error('🎤 [UPLOAD] Error:', error);
            throw error;
        }
    }

    /**
     * Show toast notification (fallback to alert if no toast system)
     */
    function showNotification(message, type = 'info') {
        // Try to find DZMM's toast system
        // This is a placeholder - actual implementation depends on DZMM's UI framework
        console.log(`🎤 [${type.toUpperCase()}] ${message}`);

        // Fallback to alert for errors
        if (type === 'error') {
            alert(`❌ ${message}`);
        } else if (type === 'success') {
            // Create a temporary success message
            const toast = document.createElement('div');
            toast.style.cssText = `
                position: fixed;
                bottom: 20px;
                right: 20px;
                background: #10b981;
                color: white;
                padding: 12px 24px;
                border-radius: 8px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                z-index: 10000;
                font-size: 14px;
                font-weight: 500;
            `;
            toast.textContent = `✅ ${message}`;
            document.body.appendChild(toast);
            setTimeout(() => toast.remove(), 3000);
        }
    }

    /**
     * Find and trigger the voice send callback
     */
    function triggerVoiceSend(voiceData) {
        // Try to find React component instance and call onVoiceReady
        // This uses React internals to find the component
        const voiceButton = document.querySelector(
            'button[aria-label*="说话"], button[title*="说话"]'
        );

        if (voiceButton) {
            // Get React fiber node
            const fiberKey = Object.keys(voiceButton).find(key =>
                key.startsWith('__reactFiber') || key.startsWith('__reactInternalInstance')
            );

            if (fiberKey) {
                let fiber = voiceButton[fiberKey];
                // Walk up the fiber tree to find the component with onVoiceReady
                while (fiber) {
                    if (fiber.memoizedProps?.onVoiceReady) {
                        if (DEBUG) {
                            console.log('🎤 [SUCCESS] Found onVoiceReady callback, triggering send...');
                        }
                        fiber.memoizedProps.onVoiceReady(voiceData);
                        return true;
                    }
                    fiber = fiber.return;
                }
            }
        }

        // Fallback: dispatch custom event
        if (DEBUG) {
            console.log('🎤 [WARN] Could not find onVoiceReady callback, dispatching event...');
        }
        const event = new CustomEvent('dzmm-voice-uploaded', {
            detail: voiceData,
            bubbles: true,
            cancelable: true
        });
        window.dispatchEvent(event);
        document.dispatchEvent(event);
        return false;
    }

    /**
     * Handle file upload
     */
    async function handleFileUpload(file, uploadButton) {
        // Validate file
        if (!file.type.startsWith('audio/')) {
            showNotification('Please select an audio file', 'error');
            return;
        }

        if (file.size > MAX_FILE_SIZE) {
            showNotification(`File too large. Maximum size: ${MAX_FILE_SIZE / 1024 / 1024}MB`, 'error');
            return;
        }

        // Show loading state
        uploadButton.classList.add('voice-upload-loading');
        uploadButton.disabled = true;

        try {
            // Get audio duration
            const duration = await getAudioDuration(file);

            if (DEBUG) {
                console.log('🎤 [INFO] File details:', {
                    name: file.name,
                    type: file.type,
                    size: (file.size / 1024).toFixed(1) + 'KB',
                    duration: duration.toFixed(1) + 's'
                });
            }

            // Upload file
            const result = await uploadVoiceFile(file, duration);

            // Trigger voice message send through React callback
            const sent = triggerVoiceSend(result);

            // Show success notification
            if (sent) {
                showNotification(
                    `Voice sent: ${duration.toFixed(1)}s, ${(result.fileSize / 1024).toFixed(1)}KB`,
                    'success'
                );
            } else {
                showNotification(
                    `Voice uploaded (manual send required): ${duration.toFixed(1)}s`,
                    'success'
                );
            }

            // Visual feedback
            uploadButton.classList.add('voice-upload-success');
            setTimeout(() => {
                uploadButton.classList.remove('voice-upload-success');
            }, 300);

        } catch (error) {
            console.error('🎤 [ERROR] Upload failed:', error);
            showNotification(
                error.message || 'Upload failed. Please try again.',
                'error'
            );
        } finally {
            // Reset button state
            uploadButton.classList.remove('voice-upload-loading');
            uploadButton.disabled = false;
        }
    }

    /**
     * Create file input and upload button
     */
    function createUploadComponents() {
        // Create hidden file input
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = SUPPORTED_AUDIO_FORMATS.join(',');
        fileInput.style.display = 'none';
        fileInput.id = 'dzmm-voice-file-input';

        // Create upload button (styled to match DZMM UI)
        const uploadButton = document.createElement('button');
        uploadButton.type = 'button';
        uploadButton.className = 'rounded-full size-9 p-2 dark:bg-black bg-white hover:bg-zinc-100 dark:hover:bg-zinc-800';
        uploadButton.title = '上传音频文件';
        uploadButton.setAttribute('aria-label', '上传音频文件');

        // Upload icon SVG
        uploadButton.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="17 8 12 3 7 8"></polyline>
                <line x1="12" y1="3" x2="12" y2="15"></line>
            </svg>
        `;

        // Handle file selection
        fileInput.addEventListener('change', async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;

            await handleFileUpload(file, uploadButton);

            // Clear file input
            fileInput.value = '';
        });

        // Handle button click
        uploadButton.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            fileInput.click();
        });

        return { fileInput, uploadButton };
    }

    /**
     * Inject upload button into the chat interface
     */
    function injectUploadButton() {
        // Look for the voice recorder button
        // Pattern: button with microphone icon or voice-related aria-label
        const voiceButton = document.querySelector(
            'button[aria-label*="说话"], button[title*="说话"], button[aria-label*="voice"], button[title*="voice"]'
        );

        if (!voiceButton) {
            if (DEBUG) {
                console.log('🎤 [INFO] Voice button not found, retrying...');
            }
            return false;
        }

        // Check if upload button already exists
        if (document.getElementById('dzmm-voice-file-input')) {
            if (DEBUG) {
                console.log('🎤 [INFO] Upload button already exists');
            }
            return true;
        }

        // Get the parent container
        const container = voiceButton.parentElement;
        if (!container) {
            console.error('🎤 [ERROR] No parent container found for voice button');
            return false;
        }

        // Create upload components
        const { fileInput, uploadButton } = createUploadComponents();

        // Insert upload button before the voice recorder button
        container.insertBefore(fileInput, voiceButton);
        container.insertBefore(uploadButton, voiceButton);

        console.log('🎤 [SUCCESS] Upload button injected!');
        return true;
    }

    /**
     * Try to inject button with retries
     */
    function tryInjectButton() {
        let attempts = 0;
        const maxAttempts = 20;

        const interval = setInterval(() => {
            if (injectUploadButton() || attempts >= maxAttempts) {
                clearInterval(interval);
                if (attempts >= maxAttempts) {
                    console.log('🎤 [WARN] Max injection attempts reached');
                }
            }
            attempts++;
        }, 500);
    }

    // ===== INITIALIZATION =====

    // Start injection after DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            setTimeout(tryInjectButton, 1000);
        });
    } else {
        setTimeout(tryInjectButton, 1000);
    }

    // Watch for navigation changes (SPA)
    let lastUrl = location.href;
    const observer = new MutationObserver(() => {
        const currentUrl = location.href;
        if (currentUrl !== lastUrl) {
            lastUrl = currentUrl;
            if (DEBUG) {
                console.log('🎤 [INFO] Navigation detected, re-injecting button');
            }
            setTimeout(tryInjectButton, 500);
        }
    });

    // Observe URL changes
    if (document.querySelector('title')) {
        observer.observe(document.querySelector('title'), {
            childList: true,
            subtree: true
        });
    }

    // Also observe body for dynamic content changes
    const bodyObserver = new MutationObserver(() => {
        // Re-inject if button is missing
        if (!document.getElementById('dzmm-voice-file-input')) {
            setTimeout(() => {
                if (!document.getElementById('dzmm-voice-file-input')) {
                    injectUploadButton();
                }
            }, 300);
        }
    });

    bodyObserver.observe(document.body, {
        childList: true,
        subtree: true
    });

    console.log(
        '%c🎤 DZMM Voice Uploader Active',
        'color: #10b981; font-weight: bold; font-size: 14px;'
    );
    console.log(
        '%c✓ Voice Upload: Click the upload button next to the microphone',
        'color: #10b981; font-size: 12px;'
    );

})();
