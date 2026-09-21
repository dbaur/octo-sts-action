const { resolveApiUrl, revokeToken } = require('./post');

describe('resolveApiUrl', () => {
    it('should prefer the github-api-url input over the runner environment', () => {
        const env = {
            'INPUT_GITHUB-API-URL': 'https://ghes.example.com/api/v3',
            GITHUB_API_URL: 'https://api.github.com',
        };

        expect(resolveApiUrl(env)).toBe('https://ghes.example.com/api/v3');
    });

    it('should accept the underscore spelling of the input', () => {
        const env = { INPUT_GITHUB_API_URL: 'https://ghes.example.com/api/v3' };

        expect(resolveApiUrl(env)).toBe('https://ghes.example.com/api/v3');
    });

    it('should fall back to the runner-provided GITHUB_API_URL', () => {
        const env = { GITHUB_API_URL: 'https://ghes.example.com/api/v3' };

        expect(resolveApiUrl(env)).toBe('https://ghes.example.com/api/v3');
    });

    it('should default to api.github.com when nothing is set', () => {
        expect(resolveApiUrl({})).toBe('https://api.github.com');
    });

    it('should ignore an empty input and use the environment', () => {
        const env = {
            'INPUT_GITHUB-API-URL': '',
            GITHUB_API_URL: 'https://ghes.example.com/api/v3',
        };

        expect(resolveApiUrl(env)).toBe('https://ghes.example.com/api/v3');
    });

    it('should strip trailing slashes so the path is not doubled up', () => {
        const env = { GITHUB_API_URL: 'https://ghes.example.com/api/v3///' };

        expect(resolveApiUrl(env)).toBe('https://ghes.example.com/api/v3');
    });

    it('should trim surrounding whitespace', () => {
        const env = { GITHUB_API_URL: '  https://ghes.example.com/api/v3  ' };

        expect(resolveApiUrl(env)).toBe('https://ghes.example.com/api/v3');
    });
});

describe('revokeToken', () => {
    let logSpy;

    beforeEach(() => {
        logSpy = jest.spyOn(console, 'log').mockImplementation(() => { });
    });

    afterEach(() => {
        jest.restoreAllMocks();
        delete global.fetch;
    });

    it('should DELETE the installation token against the resolved API URL', async () => {
        global.fetch = jest.fn().mockResolvedValue({ status: 204, statusText: 'No Content' });

        await revokeToken('test-token', 'https://ghes.example.com/api/v3');

        expect(global.fetch).toHaveBeenCalledWith(
            'https://ghes.example.com/api/v3/installation/token',
            expect.objectContaining({ method: 'DELETE' }),
        );
        expect(logSpy).toHaveBeenCalledWith('Token was revoked!');
    });

    it('should send the token as a bearer credential', async () => {
        global.fetch = jest.fn().mockResolvedValue({ status: 204, statusText: 'No Content' });

        await revokeToken('test-token', 'https://api.github.com');

        const { headers } = global.fetch.mock.calls[0][1];
        expect(headers.Authorization).toBe('Bearer test-token');
        expect(headers.Accept).toBe('application/vnd.github+json');
    });

    it('should report a non-204 response as an error including the URL', async () => {
        global.fetch = jest.fn().mockResolvedValue({
            status: 401,
            statusText: 'Unauthorized',
            text: jest.fn().mockResolvedValue('{"message":"Bad credentials"}'),
        });

        await revokeToken('test-token', 'https://api.github.com');

        expect(logSpy).toHaveBeenCalledWith(
            expect.stringContaining('::error::Failed to revoke token via https://api.github.com/installation/token: 401 Unauthorized'),
        );
        expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Bad credentials'));
    });

    it('should not throw when the response body cannot be read', async () => {
        global.fetch = jest.fn().mockResolvedValue({
            status: 500,
            statusText: 'Internal Server Error',
            text: jest.fn().mockRejectedValue(new Error('stream closed')),
        });

        await expect(revokeToken('test-token', 'https://api.github.com')).resolves.toBeUndefined();
        expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('500 Internal Server Error'));
    });

    it('should not throw when the request itself fails', async () => {
        global.fetch = jest.fn().mockRejectedValue(new Error('fetch failed'));

        await expect(revokeToken('test-token', 'https://api.github.com')).resolves.toBeUndefined();
        expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('fetch failed'));
    });
});
