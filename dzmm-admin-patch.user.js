// ==UserScript==
// @name         DZMM Admin Role Patch + Time Travel
// @namespace    https://github.com/kuma-dzmm
// @version      3.0.1
// @description  Auto-inject admin role + Time Travel for message backtracking with 'before' parameter
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
// @run-at       document-start
// @updateURL    https://raw.githubusercontent.com/kuma-dzmm/dzmm-patch/refs/heads/main/dzmm-admin-patch.user.js
// @downloadURL  https://raw.githubusercontent.com/kuma-dzmm/dzmm-patch/refs/heads/main/dzmm-admin-patch.user.js
// ==/UserScript==

(function () {
    "use strict";

    console.log("🚀 [INIT] DZMM Patch script started", {
        runAt: "document-start",
        readyState: document.readyState,
        fetchType: typeof window.fetch
    });

    // ===== CONFIGURATION =====
    // Set to true to enable detailed logging
    const DEBUG = false;

    // ===== TIME TRAVEL FEATURE =====
    let timeTravelTimestamp = null;

    // ===== CURRENT USER DETECTION =====
    let currentUserId = null;

    // Try to get user ID from cookie (fastest method)
    function getUserIdFromCookie() {
        try {
            const cookieMatch = document.cookie.match(
                /sb-rls-auth-token=([^;]+)/,
            );
            if (cookieMatch) {
                // Decode URI component first, then base64
                const decoded = decodeURIComponent(cookieMatch[1]);
                const tokenData = JSON.parse(atob(decoded));
                if (tokenData.user?.id) {
                    return tokenData.user.id;
                }
            }
        } catch (e) {
            if (DEBUG) console.error("[DZMM PATCH] Failed to parse cookie:", e);
        }
        return null;
    }

    // Fetch user ID from API if cookie parsing fails
    async function fetchCurrentUserId() {
        try {
            const response = await fetch("/api/me");
            const data = await response.json();
            if (data.id) {
                currentUserId = data.id;
                if (DEBUG) {
                    console.log(
                        "[DZMM PATCH] Current user ID detected:",
                        currentUserId,
                    );
                }
                return currentUserId;
            }
        } catch (e) {
            if (DEBUG) {
                console.error("[DZMM PATCH] Failed to fetch user ID:", e);
            }
        }
        return null;
    }

    // Try to get user ID immediately
    currentUserId = getUserIdFromCookie();
    if (currentUserId && DEBUG) {
        console.log("[DZMM PATCH] User ID from cookie:", currentUserId);
    }

    // If cookie parsing failed, fetch from API
    if (!currentUserId) {
        fetchCurrentUserId();
    }

    // ===== MONKEY PATCH =====
    // Intercept at multiple levels to catch all fetch calls
    const originalFetch = window.fetch;
    const originalWindowFetch = Window.prototype.fetch;

    console.log("🔧 [INIT] Installing fetch interceptor...", {
        originalFetch: typeof originalFetch,
        windowFetch: typeof window.fetch,
        prototypeFetch: typeof Window.prototype.fetch,
        globalThis: typeof globalThis?.fetch
    });

    // Intercept at instance level
    const interceptedFetch = async function (...args) {
        const url = typeof args[0] === "string" ? args[0] : args[0]?.url;

        // TIME TRAVEL: Intercept message fetch requests and add 'before' parameter
        // Check for various possible URL patterns
        const isMessageRequest = url && (
            url.includes("/api/chatroom/") && url.includes("/messages") ||
            url.includes("/messages") && url.includes("chatroom") ||
            url.match(/\/api\/.*\/messages/)
        );

        if (isMessageRequest) {
            const globalScope = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;
            const globalState = globalScope.__timeTravelState;

            // Check both local variable and global state
            const activeTimestamp = timeTravelTimestamp || globalState?.timestamp;
            if (activeTimestamp) {
                const urlObj = new URL(url, window.location.origin);
                const originalBefore = urlObj.searchParams.get("before");

                // Skip if no 'before' parameter exists (initial load)
                if (!originalBefore) {
                    if (DEBUG) {
                        console.log("⚠️ [TIME TRAVEL] Skipped: No 'before' parameter in request");
                    }
                } else {
                    // Convert numeric timestamp to ISO format if needed
                    let targetBeforeValue = activeTimestamp;
                    if (/^\d+$/.test(activeTimestamp)) {
                        targetBeforeValue = new Date(parseInt(activeTimestamp)).toISOString();
                    }

                    // Parse timestamps for comparison
                    const targetTime = new Date(targetBeforeValue).getTime();
                    const originalTime = new Date(originalBefore).getTime();

                    // Only replace if original 'before' is LATER than our target time
                    // (i.e., we want to go back further in time)
                    if (originalTime > targetTime) {
                        urlObj.searchParams.set("before", targetBeforeValue);

                        if (DEBUG) {
                            console.log(
                                "✅ [TIME TRAVEL] Intercepted:",
                                {
                                    originalBefore,
                                    newBefore: targetBeforeValue,
                                    originalTime: new Date(originalTime).toLocaleString(),
                                    targetTime: new Date(targetTime).toLocaleString(),
                                },
                            );
                        }

                        // Modify the request
                        if (typeof args[0] === "string") {
                            args[0] = urlObj.toString();
                        } else if (args[0] instanceof Request) {
                            args[0] = new Request(urlObj.toString(), args[0]);
                        }
                    } else if (DEBUG) {
                        console.log(
                            "⚠️ [TIME TRAVEL] Skipped: Request already at or before target time",
                            {
                                originalTime: new Date(originalTime).toLocaleString(),
                                targetTime: new Date(targetTime).toLocaleString(),
                            }
                        );
                    }
                }
            }
        }

        const response = await originalFetch.apply(this, args);

        // Intercept /api/me to capture current user ID
        if (url && url.includes("/api/me")) {
            const clonedResponse = response.clone();
            try {
                const data = await clonedResponse.json();
                if (data.id && !currentUserId) {
                    currentUserId = data.id;
                    if (DEBUG) {
                        console.log(
                            "[DZMM PATCH] User ID captured from /api/me:",
                            currentUserId,
                        );
                    }
                }
            } catch (e) {
                // Ignore parsing errors
            }
        }

        // Intercept /api/user/* requests
        if (url && url.includes("/api/user/")) {
            const clonedResponse = response.clone();

            try {
                const data = await clonedResponse.json();

                // Inject admin role for the current user
                if (data && currentUserId && data.id === currentUserId) {
                    // Add metadata with admin role
                    if (!data.metadata) {
                        data.metadata = {};
                    }
                    data.metadata.role = "admin";

                    if (DEBUG) {
                        console.log(
                            "✅ [DZMM PATCH] Admin role injected for user:",
                            {
                                id: data.id,
                                name: data.fullName,
                                metadata: data.metadata,
                            },
                        );
                    }

                    // Return modified response
                    return new Response(JSON.stringify(data), {
                        status: response.status,
                        statusText: response.statusText,
                        headers: response.headers,
                    });
                }
            } catch (e) {
                // If JSON parsing fails, return original response
                if (DEBUG) {
                    console.error("[DZMM PATCH] Error parsing response:", e);
                }
            }
        }

        return response;
    };

    // Install interceptor at all levels
    window.fetch = interceptedFetch;
    Window.prototype.fetch = interceptedFetch;
    if (typeof globalThis !== 'undefined') {
        globalThis.fetch = interceptedFetch;
    }
    // Also install on unsafeWindow for Tampermonkey
    if (typeof unsafeWindow !== 'undefined' && unsafeWindow !== window) {
        unsafeWindow.fetch = interceptedFetch;
    }

    console.log("✅ [INIT] Fetch interceptor installed at all levels", {
        window: typeof window.fetch,
        prototype: typeof Window.prototype.fetch,
        globalThis: typeof globalThis?.fetch,
        unsafeWindow: typeof unsafeWindow !== 'undefined' ? typeof unsafeWindow.fetch : 'N/A'
    });

    // Log that the patch is active
    console.log(
        "%c🔧 DZMM Admin Patch + Time Travel Active",
        "color: #00ff00; font-weight: bold; font-size: 14px;",
    );
    if (currentUserId) {
        console.log(
            "%c✅ Current user detected:",
            "color: #00ff00; font-size: 12px;",
            currentUserId,
        );
    } else {
        console.log(
            "%c⏳ Waiting to detect current user...",
            "color: #ffaa00; font-size: 12px;",
        );
    }
    console.log(
        "%c✓ Delete button enabled in group chats",
        "color: #00ff00; font-size: 12px;",
    );
    console.log(
        "%c✓ Time Travel: Use setTimeTravel(timestamp) to backtrack messages",
        "color: #3b82f6; font-size: 12px;",
    );
    if (DEBUG) {
        console.log(
            "%cDEBUG MODE ENABLED",
            "color: #ff9900; font-weight: bold;",
        );
    }

    // ===== TIME TRAVEL UI STYLES =====
    if (typeof GM_addStyle !== "undefined") {
        GM_addStyle(`
            .time-travel-modal {
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: white;
                padding: 24px;
                border-radius: 12px;
                box-shadow: 0 4px 20px rgba(0,0,0,0.3);
                z-index: 10000;
                min-width: 400px;
                max-width: 90vw;
            }
            .dark .time-travel-modal {
                background: #1f2937;
                color: #f3f4f6;
            }
            .time-travel-overlay {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0,0,0,0.5);
                z-index: 9999;
            }
            .time-travel-modal h2 {
                margin: 0 0 16px 0;
                font-size: 20px;
                font-weight: 600;
            }
            .time-travel-input-group {
                margin-bottom: 16px;
            }
            .time-travel-input-group label {
                display: block;
                margin-bottom: 8px;
                font-weight: 500;
                font-size: 14px;
            }
            .time-travel-input-group input,
            .time-travel-input-group select {
                width: 100%;
                padding: 8px 12px;
                border: 1px solid #d1d5db;
                border-radius: 6px;
                font-size: 14px;
                box-sizing: border-box;
            }
            .dark .time-travel-input-group input,
            .dark .time-travel-input-group select {
                background: #374151;
                border-color: #4b5563;
                color: #f3f4f6;
            }
            .time-travel-buttons {
                display: flex;
                gap: 8px;
                justify-content: flex-end;
                margin-top: 20px;
            }
            .time-travel-btn {
                padding: 8px 16px;
                border-radius: 6px;
                border: none;
                cursor: pointer;
                font-weight: 500;
                font-size: 14px;
            }
            .time-travel-btn-primary {
                background: #3b82f6;
                color: white;
            }
            .time-travel-btn-primary:hover {
                background: #2563eb;
            }
            .time-travel-btn-secondary {
                background: #e5e7eb;
                color: #374151;
            }
            .dark .time-travel-btn-secondary {
                background: #4b5563;
                color: #f3f4f6;
            }
            .time-travel-info {
                background: #eff6ff;
                padding: 12px;
                border-radius: 6px;
                font-size: 13px;
                margin-top: 12px;
                border-left: 3px solid #3b82f6;
            }
            .dark .time-travel-info {
                background: #1e3a5f;
                border-color: #60a5fa;
            }
            .time-travel-current {
                display: inline-block;
                padding: 4px 8px;
                background: #dcfce7;
                color: #166534;
                border-radius: 4px;
                font-size: 12px;
                font-weight: 500;
            }
            .dark .time-travel-current {
                background: #14532d;
                color: #86efac;
            }
        `);
    }

    // ===== TIME TRAVEL UI FUNCTIONS =====
    function showTimeTravelModal() {
        // Create overlay
        const overlay = document.createElement("div");
        overlay.className = "time-travel-overlay";

        // Create modal
        const modal = document.createElement("div");
        modal.className = "time-travel-modal";

        // Set default value to current timestamp if active
        const defaultValue = timeTravelTimestamp
            ? new Date(parseInt(timeTravelTimestamp)).toISOString().slice(0, 16)
            : "";

        modal.innerHTML = `
            <h2>🕰️ 时光机</h2>
            <div class="time-travel-input-group">
                <label>选择回溯时间：</label>
                <input type="datetime-local" id="tt-datetime" value="${defaultValue}" />
            </div>
            ${
            timeTravelTimestamp
                ? `
                <div class="time-travel-info">
                    <strong>当前设置：</strong>
                    <span class="time-travel-current">${new Date(parseInt(timeTravelTimestamp)).toLocaleString()}</span>
                </div>
            `
                : ""
        }
            <div class="time-travel-buttons">
                <button class="time-travel-btn time-travel-btn-secondary" id="tt-reset">
                    重置
                </button>
                <button class="time-travel-btn time-travel-btn-secondary" id="tt-cancel">
                    取消
                </button>
                <button class="time-travel-btn time-travel-btn-primary" id="tt-apply">
                    应用
                </button>
            </div>
        `;

        document.body.appendChild(overlay);
        document.body.appendChild(modal);

        // Close handlers
        const closeModal = () => {
            overlay.remove();
            modal.remove();
        };

        overlay.addEventListener("click", closeModal);
        modal.querySelector("#tt-cancel").addEventListener("click", closeModal);

        // Reset handler
        modal.querySelector("#tt-reset").addEventListener("click", () => {
            timeTravelTimestamp = null;
            globalScope.__timeTravelState.timestamp = null;
            console.log(
                "%c⏰ [TIME TRAVEL] Reset to real-time",
                "color: #10b981; font-weight: bold;",
            );
            closeModal();
        });

        // Apply handler
        modal.querySelector("#tt-apply").addEventListener("click", () => {
            const datetime = modal.querySelector("#tt-datetime").value;

            if (datetime) {
                // datetime-local returns local time string like "2025-10-01T12:00"
                // We need to treat it as local time and convert to timestamp
                const localDate = new Date(datetime);
                const timestamp = localDate.getTime().toString();

                timeTravelTimestamp = timestamp;
                globalScope.__timeTravelState.timestamp = timestamp;

                console.log(
                    "%c⏰ [TIME TRAVEL] Activated:",
                    "color: #3b82f6; font-weight: bold;",
                    {
                        localTime: localDate.toLocaleString(),
                        utcTime: localDate.toISOString(),
                        timestamp: timestamp
                    }
                );
                closeModal();
            } else {
                alert("请选择日期时间");
            }
        });
    }

    function createTimeTravelButton() {
        const button = document.createElement("button");
        button.className = "h-9 w-9";
        button.style.cssText = `
            display: inline-flex;
            align-items: center;
            justify-content: center;
            border-radius: 0.375rem;
            transition: all 0.15s;
            border: none;
            background: transparent;
            cursor: pointer;
            color: inherit;
        `;
        button.innerHTML = `
            <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                      d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
        `;
        button.title = "时光机 - 消息回溯";
        button.addEventListener("click", showTimeTravelModal);
        button.addEventListener("mouseenter", () => {
            button.style.background = "rgba(0,0,0,0.05)";
        });
        button.addEventListener("mouseleave", () => {
            button.style.background = "transparent";
        });
        return button;
    }

    function injectTimeTravelButton() {
        // Look for button containers in the chat header
        const buttonContainers = document.querySelectorAll(
            '[class*="flex"][class*="gap"]',
        );

        for (const container of buttonContainers) {
            const buttons = container.querySelectorAll("button.h-9.w-9");
            if (buttons.length > 0) {
                // Check if we haven't already added the button
                const existingTimeTravel = container.querySelector(
                    'button[title="时光机 - 消息回溯"]',
                );
                if (!existingTimeTravel) {
                    const timeTravelBtn = createTimeTravelButton();
                    // Insert before the last button
                    if (buttons.length > 1) {
                        buttons[buttons.length - 1].parentNode.insertBefore(
                            timeTravelBtn,
                            buttons[buttons.length - 1],
                        );
                    } else {
                        container.appendChild(timeTravelBtn);
                    }
                    if (DEBUG) {
                        console.log("⏰ [TIME TRAVEL] Button injected!");
                    }
                    return true;
                }
            }
        }
        return false;
    }

    // Try to inject button after page loads
    function tryInjectButton() {
        let attempts = 0;
        const maxAttempts = 20;

        const interval = setInterval(() => {
            if (injectTimeTravelButton() || attempts >= maxAttempts) {
                clearInterval(interval);
            }
            attempts++;
        }, 500);
    }

    // Start injection after DOM is ready
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", () => {
            setTimeout(tryInjectButton, 1000);
        });
    } else {
        setTimeout(tryInjectButton, 1000);
    }

    // Watch for navigation changes (SPA) - more aggressive checking
    const observer = new MutationObserver((mutations) => {
        // Check if button is missing
        if (!document.querySelector('button[title="时光机 - 消息回溯"]')) {
            // Debounce injection attempts
            setTimeout(() => {
                if (
                    !document.querySelector('button[title="时光机 - 消息回溯"]')
                ) {
                    injectTimeTravelButton();
                }
            }, 300);
        }
    });
    observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: false,
    });

    // Also listen to URL changes for SPA navigation
    let lastUrl = location.href;
    new MutationObserver(() => {
        const currentUrl = location.href;
        if (currentUrl !== lastUrl) {
            lastUrl = currentUrl;
            if (DEBUG) {
                console.log(
                    "⏰ [TIME TRAVEL] Navigation detected, re-injecting button",
                );
            }
            setTimeout(tryInjectButton, 500);
        }
    }).observe(document.querySelector("title") || document.head, {
        childList: true,
        subtree: true,
    });

    // ===== TIME TRAVEL HELPER FUNCTIONS =====
    // Make functions available globally IMMEDIATELY
    // Use unsafeWindow if available (Tampermonkey), otherwise use window
    const globalScope = typeof unsafeWindow !== "undefined"
        ? unsafeWindow
        : window;

    // Store timestamp in a way that's accessible across scopes
    globalScope.__timeTravelState = {
        timestamp: null,
    };

    globalScope.setTimeTravel = function (timestamp) {
        timeTravelTimestamp = timestamp;
        globalScope.__timeTravelState.timestamp = timestamp;
        console.log(
            "%c⏰ [TIME TRAVEL] Timestamp set:",
            "color: #3b82f6; font-weight: bold;",
            {
                timestamp,
                date: new Date(parseInt(timestamp)).toLocaleString(),
            },
        );
        console.log(
            "%c✓ Active! Next message fetch will use before=%s",
            "color: #10b981;",
            timestamp,
        );
        // Dispatch event to notify of change
        const event = new CustomEvent("timetravel-changed", {
            detail: { timestamp },
        });
        window.dispatchEvent(event);
        return { timestamp, active: true };
    };

    globalScope.resetTimeTravel = function () {
        timeTravelTimestamp = null;
        console.log(
            "%c⏰ [TIME TRAVEL] Reset to real-time mode",
            "color: #10b981; font-weight: bold;",
        );
        console.log(
            "%c✓ Messages will now load in real-time",
            "color: #10b981;",
        );
        // Dispatch event to notify of change
        const event = new CustomEvent("timetravel-changed", {
            detail: { timestamp: null },
        });
        window.dispatchEvent(event);
        return { timestamp: null, active: false };
    };

    globalScope.getTimeTravelStatus = function () {
        console.log(
            "%c=== Time Travel Status ===",
            "color: #3b82f6; font-weight: bold; font-size: 14px;",
        );
        console.log("Active:", !!timeTravelTimestamp);
        console.log("Timestamp:", timeTravelTimestamp || "(real-time mode)");
        if (timeTravelTimestamp) {
            console.log(
                "Date:",
                new Date(parseInt(timeTravelTimestamp)).toLocaleString(),
            );
        }
        return {
            timestamp: timeTravelTimestamp,
            active: !!timeTravelTimestamp,
        };
    };

    globalScope.getDZMMPatchStatus = function () {
        console.log(
            "%c=== DZMM Patch Status ===",
            "color: #00aaff; font-weight: bold; font-size: 14px;",
        );
        console.log("Current User ID:", currentUserId || "(not detected yet)");
        console.log("Patch Active:", true);
        console.log("Debug Mode:", DEBUG);
        console.log(
            "Time Travel:",
            timeTravelTimestamp ? "Active" : "Inactive",
        );
        if (timeTravelTimestamp) {
            console.log("  - Timestamp:", timeTravelTimestamp);
            console.log(
                "  - Date:",
                new Date(parseInt(timeTravelTimestamp)).toLocaleString(),
            );
        }
        return {
            userId: currentUserId,
            active: true,
            debug: DEBUG,
            timeTravel: {
                active: !!timeTravelTimestamp,
                timestamp: timeTravelTimestamp,
            },
        };
    };

    console.log(
        "%cHelpers: getDZMMPatchStatus(), setTimeTravel(timestamp), resetTimeTravel(), getTimeTravelStatus()",
        "color: #888888; font-style: italic;",
    );
})();
