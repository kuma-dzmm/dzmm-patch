// ==UserScript==
// @name         DZMM Admin Role Patch
// @namespace    https://github.com/kuma-dzmm
// @version      2.1.0
// @description  Auto-inject admin role to enable delete button in group chats for DZMM sites
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
// @grant        none
// @run-at       document-start
// @updateURL    https://raw.githubusercontent.com/kuma-dzmm/dzmm-patch/refs/heads/main/dzmm-admin-patch.user.js
// @downloadURL  https://raw.githubusercontent.com/kuma-dzmm/dzmm-patch/refs/heads/main/dzmm-admin-patch.user.js
// ==/UserScript==

(function () {
    "use strict";

    // ===== CONFIGURATION =====
    // Set to true to enable detailed logging
    const DEBUG = false;

    // ===== CURRENT USER DETECTION =====
    let currentUserId = null;

    // Try to get user ID from cookie (fastest method)
    function getUserIdFromCookie() {
        try {
            const cookieMatch = document.cookie.match(
                /sb-rls-auth-token=([^;]+)/,
            );
            if (cookieMatch) {
                const tokenData = JSON.parse(atob(cookieMatch[1]));
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
    const originalFetch = window.fetch;

    window.fetch = async function (...args) {
        const url = typeof args[0] === "string" ? args[0] : args[0]?.url;
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

    // Log that the patch is active
    console.log(
        "%c🔧 DZMM Admin Patch Active (Auto-detect)",
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
        "%cDelete button will appear in group chats",
        "color: #00ff00; font-size: 12px;",
    );
    if (DEBUG) {
        console.log(
            "%cDEBUG MODE ENABLED",
            "color: #ff9900; font-weight: bold;",
        );
    }

    // Add a helper function to check current status
    window.getDZMMPatchStatus = function () {
        console.log(
            "%c=== DZMM Patch Status ===",
            "color: #00aaff; font-weight: bold; font-size: 14px;",
        );
        console.log("Current User ID:", currentUserId || "(not detected yet)");
        console.log("Patch Active:", true);
        console.log("Debug Mode:", DEBUG);
        return { userId: currentUserId, active: true, debug: DEBUG };
    };

    console.log(
        "%cTo check patch status, run: getDZMMPatchStatus()",
        "color: #888888; font-style: italic;",
    );
})();
