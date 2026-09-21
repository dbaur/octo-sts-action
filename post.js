/**
 * Resolves the GitHub API base URL used to revoke the token.
 *
 * Precedence:
 *   1. the 'github-api-url' action input, when set
 *   2. the GITHUB_API_URL the runner exports for the current server
 *   3. https://api.github.com
 *
 * Resolving from the runner context rather than hardcoding api.github.com is
 * what makes revocation work on GitHub Enterprise Server, whose installation
 * tokens are only valid against that instance's own API.
 *
 * @param {NodeJS.ProcessEnv} env - Environment to read from.
 * @returns {string} API base URL without a trailing slash.
 */
function resolveApiUrl(env = process.env) {
    // Action inputs keep dashes in their env var name (INPUT_GITHUB-API-URL);
    // the underscore form is accepted too so either spelling works.
    const input = env['INPUT_GITHUB-API-URL'] || env['INPUT_GITHUB_API_URL'];
    const raw = (input || env['GITHUB_API_URL'] || 'https://api.github.com').trim();
    return raw.replace(/\/+$/, '');
}

/**
 * Revokes the installation token minted for this job.
 *
 * @param {string} tok - The installation token to revoke.
 * @param {string} apiUrl - Base URL of the GitHub API to revoke against.
 */
async function revokeToken(tok, apiUrl) {
    const url = `${apiUrl}/installation/token`;
    try {
        const res = await fetch(url, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${tok}`,
                'Accept': 'application/vnd.github+json',
            },
        });

        if (res.status == 204) {
            console.log('Token was revoked!');
        } else {
            let body = '';
            try {
                body = (await res.text()).trim();
            } catch {
                // Body is best-effort context only; ignore read failures.
            }
            const detail = body ? `: ${body}` : '';
            console.log(`::error::Failed to revoke token via ${url}: ${res.status} ${res.statusText}${detail}`);
        }
    } catch (err) {
        console.log(`::error::Failed to revoke token via ${url}: ${err.stack}`);
    }
}

// Only run main code if this script is executed directly (not required for testing)
if (require.main === module) {
    const tok = process.env.STATE_token;

    if (!tok) {
        console.log(`::warning::Token not found in state; nothing to revoke.`);
        process.exit(0);
    }

    revokeToken(tok, resolveApiUrl());
}

module.exports = { resolveApiUrl, revokeToken };
