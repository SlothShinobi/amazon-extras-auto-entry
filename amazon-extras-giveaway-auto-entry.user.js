// ==UserScript==
// @name         Amazon Extras Giveaway Auto-Entry
// @namespace    http://tampermonkey.net/
// @version      6.0
// @description  Automatically enter all Amazon Extras giveaways with one click
// @author       Anthony Nguyen
// @match        https://extrasforamazon.com/app/giveaways*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=extrasforamazon.com
// @updateURL    https://raw.githubusercontent.com/SlothShinobi/amazon-extras-auto-entry/main/amazon-extras-giveaway-auto-entry.user.js
// @downloadURL  https://raw.githubusercontent.com/SlothShinobi/amazon-extras-auto-entry/main/amazon-extras-giveaway-auto-entry.user.js
// @supportURL   https://github.com/SlothShinobi/amazon-extras-auto-entry/issues
// @homepageURL  https://github.com/SlothShinobi/amazon-extras-auto-entry
// @grant        none
// ==/UserScript==

/**
 * MIT License
 * 
 * Copyright (c) 2026 Anthony Nguyen
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 * 
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

(function() {
    'use strict';

    // ============================================================================
    // GLOBAL STATE
    // ============================================================================
    
    /**
     * Flag to prevent multiple simultaneous executions of the auto-entry process.
     * Set to true when processing starts, false when it completes.
     */
    let isProcessing = false;

    // ============================================================================
    // UI CREATION FUNCTIONS
    // ============================================================================

    /**
     * Creates and injects the main "Enter All Giveaways" button into the page.
     * The button is positioned fixed in the top-right corner and includes
     * hover effects for better user experience.
     * 
     * Button states:
     * - Default: Purple gradient, clickable
     * - Processing: Grayed out, disabled
     * - Hover: Slightly enlarged with enhanced shadow
     */
    function createButton() {
        const button = document.createElement('button');
        button.id = 'auto-enter-giveaways';
        button.innerHTML = '🎁 Enter All Giveaways';
        
        // Inline styles for maximum compatibility and to avoid CSS conflicts
        button.style.cssText = `
            position: fixed;
            top: 100px;
            right: 20px;
            z-index: 10000;
            padding: 15px 25px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border: none;
            border-radius: 8px;
            font-size: 16px;
            font-weight: bold;
            cursor: pointer;
            box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
            transition: all 0.3s ease;
        `;

        // Hover effect: Scale up and enhance shadow
        button.onmouseover = function() {
            this.style.transform = 'scale(1.05)';
            this.style.boxShadow = '0 6px 20px rgba(0, 0, 0, 0.3)';
        };

        // Mouse out: Return to normal state
        button.onmouseout = function() {
            this.style.transform = 'scale(1)';
            this.style.boxShadow = '0 4px 15px rgba(0, 0, 0, 0.2)';
        };

        // Attach the main auto-entry function to button click
        button.onclick = startAutoEntry;

        // Inject button into the page
        document.body.appendChild(button);
    }

    /**
     * Creates a progress indicator element that displays:
     * - Current progress (X/Y giveaways processed)
     * - Visual progress bar
     * - Current status message
     * 
     * The indicator is hidden by default and shown when processing begins.
     */
    function createProgressIndicator() {
        const indicator = document.createElement('div');
        indicator.id = 'giveaway-progress';
        
        // Position below the main button
        indicator.style.cssText = `
            position: fixed;
            top: 160px;
            right: 20px;
            z-index: 10000;
            padding: 15px;
            background: white;
            border: 2px solid #667eea;
            border-radius: 8px;
            box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
            font-family: Arial, sans-serif;
            min-width: 250px;
            display: none;
        `;
        
        document.body.appendChild(indicator);
    }

    /**
     * Updates the progress indicator with current status.
     * 
     * @param {number} current - Number of giveaways processed so far
     * @param {number} total - Total number of giveaways to process
     * @param {string} status - Current status message (e.g., "Processing: Fitbit Giveaway")
     */
    function updateProgress(current, total, status) {
        const indicator = document.getElementById('giveaway-progress');
        if (!indicator) return;
        
        // Show the indicator
        indicator.style.display = 'block';
        
        // Calculate progress percentage for the progress bar
        const progressPercent = (current / total) * 100;
        
        // Update indicator content with current progress
        indicator.innerHTML = `
            <div style="font-size: 14px; margin-bottom: 10px;">
                <strong>Progress: ${current}/${total}</strong>
            </div>
            <div style="background: #e0e0e0; border-radius: 10px; height: 20px; overflow: hidden;">
                <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); height: 100%; width: ${progressPercent}%; transition: width 0.3s ease;"></div>
            </div>
            <div style="font-size: 12px; margin-top: 10px; color: #666;">
                ${status}
            </div>
        `;
    }

    // ============================================================================
    // UTILITY FUNCTIONS
    // ============================================================================

    /**
     * Waits for the browser URL to change from the current URL.
     * This is essential for Single Page Applications (SPAs) where navigation
     * happens without full page reloads.
     * 
     * @param {string} currentUrl - The URL to wait to change from
     * @param {number} timeout - Maximum time to wait in milliseconds (default: 5000)
     * @returns {Promise<string>} Resolves with the new URL when it changes
     * @throws {Error} If the URL doesn't change within the timeout period
     */
    function waitForUrlChange(currentUrl, timeout = 5000) {
        return new Promise((resolve, reject) => {
            const startTime = Date.now();
            
            /**
             * Recursive function that checks if URL has changed.
             * Polls every 100ms until URL changes or timeout is reached.
             */
            const checkUrl = () => {
                if (window.location.href !== currentUrl) {
                    // URL has changed - navigation successful
                    resolve(window.location.href);
                } else if (Date.now() - startTime > timeout) {
                    // Timeout reached - navigation failed
                    reject(new Error('Timeout waiting for URL change'));
                } else {
                    // URL hasn't changed yet - check again in 100ms
                    setTimeout(checkUrl, 100);
                }
            };
            
            // Start checking
            checkUrl();
        });
    }

    /**
     * Navigates back to the main giveaways list page.
     * Tries two methods:
     * 1. Look for an "All Giveaways" button/link and click it (preferred)
     * 2. Use browser history.back() as fallback
     * 
     * @returns {Promise<void>} Resolves after navigation completes and page loads
     */
    function goBackToMain() {
        return new Promise((resolve) => {
            // Method 1: Try to find and click the "All Giveaways" button
            const backButton = Array.from(document.querySelectorAll('button, a'))
                .find(el => el.textContent.includes('All Giveaways'));
            
            if (backButton) {
                console.log('✓ Found "All Giveaways" button - clicking');
                backButton.click();
                // Wait 2 seconds for the SPA to navigate and render
                setTimeout(resolve, 2000);
            } else {
                // Method 2: Fallback to browser back button
                console.log('✓ Using browser history.back()');
                window.history.back();
                // Wait 2 seconds for the page to load
                setTimeout(resolve, 2000);
            }
        });
    }

    // ============================================================================
    // MAIN AUTO-ENTRY LOGIC
    // ============================================================================

    /**
     * Main function that orchestrates the automatic giveaway entry process.
     * 
     * Process flow:
     * 1. Validate we're on the correct page
     * 2. Find all eligible giveaway tiles
     * 3. For each giveaway:
     *    a. Click the tile to navigate to detail page
     *    b. Wait for navigation to complete
     *    c. Find and click "Enter Giveaway" button
     *    d. Navigate back to main list
     * 4. Display summary of results
     * 
     * Error handling:
     * - Prevents multiple simultaneous executions
     * - Validates page location before starting
     * - Handles navigation failures gracefully
     * - Attempts to recover from errors by navigating back
     * 
     * @async
     */
    async function startAutoEntry() {
        // ========================================================================
        // VALIDATION & INITIALIZATION
        // ========================================================================
        
        // Prevent multiple simultaneous executions
        if (isProcessing) {
            alert('Already processing giveaways! Please wait for the current process to complete.');
            return;
        }

        // Set processing flag and update button state
        isProcessing = true;
        const button = document.getElementById('auto-enter-giveaways');
        button.disabled = true;
        button.innerHTML = '⏳ Processing...';
        button.style.opacity = '0.6';

        console.log('🎁 Starting Giveaway Auto-Entry Script...');
        console.log('═'.repeat(60));

        // Ensure we're on the main giveaways page, not a detail page
        if (window.location.href.match(/\/app\/giveaways\/\d+/)) {
            alert('⚠️ Please run this script from the main giveaways page!\n\nNavigate back to the giveaways list and try again.');
            isProcessing = false;
            button.disabled = false;
            button.innerHTML = '🎁 Enter All Giveaways';
            button.style.opacity = '1';
            return;
        }

        // ========================================================================
        // FIND ELIGIBLE GIVEAWAYS
        // ========================================================================
        
        /**
         * Query for all eligible giveaway tiles.
         * Eligible tiles have the class "giveaway-tile eligible"
         * Already-entered giveaways have class "giveaway-tile inactive" and are excluded
         */
        const giveawayTiles = Array.from(document.querySelectorAll('button.giveaway-tile.eligible'));

        // Validate that we found giveaways to process
        if (giveawayTiles.length === 0) {
            alert('❌ No eligible giveaways found on this page!\n\nYou may have already entered all available giveaways.');
            isProcessing = false;
            button.disabled = false;
            button.innerHTML = '🎁 Enter All Giveaways';
            button.style.opacity = '1';
            return;
        }

        console.log(`📋 Found ${giveawayTiles.length} eligible giveaway(s) to process`);

        // ========================================================================
        // TRACKING VARIABLES
        // ========================================================================
        
        let entered = 0;    // Successfully entered giveaways
        let skipped = 0;    // Giveaways already entered or without entry button
        let errors = 0;     // Giveaways that encountered errors

        // ========================================================================
        // PROCESS EACH GIVEAWAY
        // ========================================================================
        
        /**
         * Loop through all eligible giveaways.
         * Note: We always query for the FIRST eligible tile in each iteration
         * because the DOM updates after we navigate back (SPA behavior).
         */
        for (let i = 0; i < giveawayTiles.length; i++) {
            try {
                // ------------------------------------------------------------
                // RE-QUERY TILES (Important for SPA)
                // ------------------------------------------------------------
                
                /**
                 * After navigating back, the DOM is re-rendered by the SPA.
                 * We need to re-query for eligible tiles each iteration.
                 * We always click the FIRST eligible tile since previously
                 * processed tiles are no longer marked as "eligible".
                 */
                const currentTiles = Array.from(document.querySelectorAll('button.giveaway-tile.eligible'));
                
                // Check if there are any eligible tiles left
                if (currentTiles.length === 0) {
                    console.log('ℹ️ No more eligible giveaways found - stopping');
                    break;
                }

                // Always select the first eligible tile
                const tile = currentTiles[0];
                
                // Extract giveaway name for logging and progress display
                const giveawayName = tile.querySelector('.giveaway-tile_name')?.textContent || 'Unknown Giveaway';
                
                // Update progress indicator
                updateProgress(i + 1, giveawayTiles.length, `Processing: ${giveawayName}`);
                console.log(`\n[${ i + 1}/${giveawayTiles.length}] Processing: ${giveawayName}`);

                // ------------------------------------------------------------
                // NAVIGATE TO GIVEAWAY DETAIL PAGE
                // ------------------------------------------------------------
                
                // Store current URL to detect when navigation completes
                const currentUrl = window.location.href;
                
                console.log('  → Clicking giveaway tile...');
                tile.click();

                // Wait for URL to change (indicates navigation to detail page)
                try {
                    const newUrl = await waitForUrlChange(currentUrl, 5000);
                    console.log(`  → Navigated to: ${newUrl}`);
                } catch (e) {
                    // Navigation failed - URL didn't change
                    console.log('  ⚠️ Navigation failed - URL did not change');
                    errors++;
                    continue; // Skip to next giveaway
                }

                // Give the detail page time to fully render
                await new Promise(resolve => setTimeout(resolve, 1500));

                // ------------------------------------------------------------
                // ENTER THE GIVEAWAY
                // ------------------------------------------------------------
                
                /**
                 * Look for the "Enter Giveaway" button on the detail page.
                 * If found, the user hasn't entered this giveaway yet.
                 * If not found, they've likely already entered it.
                 */
                const enterButton = Array.from(document.querySelectorAll('button'))
                    .find(btn => btn.textContent.trim() === 'Enter Giveaway');

                if (enterButton) {
                    // Button found - enter the giveaway
                    console.log('  ✅ Found "Enter Giveaway" button - clicking...');
                    enterButton.click();
                    entered++;
                    
                    // Wait for entry to process
                    await new Promise(resolve => setTimeout(resolve, 1500));
                } else {
                    // Button not found - already entered
                    console.log('  ℹ️ "Enter Giveaway" button not found - likely already entered');
                    skipped++;
                }

                // ------------------------------------------------------------
                // NAVIGATE BACK TO MAIN PAGE
                // ------------------------------------------------------------
                
                console.log('  ← Returning to main giveaways page...');
                await goBackToMain();

            } catch (error) {
                // ============================================================
                // ERROR HANDLING
                // ============================================================
                
                console.error(`  ❌ Error processing giveaway: ${error.message}`);
                errors++;
                
                // Attempt to recover by navigating back to main page
                try {
                    console.log('  ↻ Attempting to recover...');
                    await goBackToMain();
                } catch (recoveryError) {
                    console.error('  ❌ Recovery failed - may need manual intervention');
                }
            }

            // Small delay between giveaways to avoid overwhelming the server
            await new Promise(resolve => setTimeout(resolve, 500));
        }

        // ========================================================================
        // COMPLETION & RESULTS
        // ========================================================================
        
        // Hide the progress indicator
        const indicator = document.getElementById('giveaway-progress');
        if (indicator) {
            indicator.style.display = 'none';
        }

        // Prepare results summary
        const totalProcessed = entered + skipped + errors;
        const message = `🎉 GIVEAWAY ENTRY COMPLETE!

✅ Successfully entered: ${entered}
ℹ️ Already entered/skipped: ${skipped}
❌ Errors: ${errors}
📊 Total processed: ${totalProcessed}`;

        // Log results to console
        console.log('\n' + '═'.repeat(60));
        console.log(message);
        console.log('═'.repeat(60));

        // Display results to user
        alert(message);

        // Reset button state
        isProcessing = false;
        button.disabled = false;
        button.innerHTML = '🎁 Enter All Giveaways';
        button.style.opacity = '1';

        // Reload page to show updated giveaway statuses
        console.log('🔄 Reloading page to show updated statuses...');
        window.location.reload();
    }

    // ============================================================================
    // INITIALIZATION
    // ============================================================================

    /**
     * Initialize the script when the page loads.
     * 
     * We wait for the 'load' event to ensure the page is fully rendered,
     * then add an additional 1.5 second delay to account for any dynamic
     * content loading (common in SPAs).
     */
    window.addEventListener('load', function() {
        setTimeout(() => {
            // Create and inject UI elements
            createButton();
            createProgressIndicator();
            
            // Log successful initialization
            console.log('✅ Amazon Extras Giveaway Auto-Entry script loaded successfully!');
            console.log('💡 Click the "🎁 Enter All Giveaways" button to start');
        }, 1500);
    });

})();
