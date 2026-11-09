import {pathToFileURL} from 'node:url';
export async function importPlaywright() {
    for (const name of [process.env.PLAYWRIGHT_IMPORT, 'playwright',
        'C:/Users/Administrator/AppData/Roaming/npm/node_modules/playwright/index.mjs'].filter(Boolean)) {
        try { return await import(/^[A-Za-z]:/.test(name) ? pathToFileURL(name).href : name); }
        catch (error) { if (error.code !== 'ERR_MODULE_NOT_FOUND') throw error; }
    }
    throw new Error('Install Playwright or set PLAYWRIGHT_IMPORT');
}
