// main.js
import { Actor } from 'apify';
import { PuppeteerCrawler, Dataset, RequestQueue, sleep, createRequestDebugInfo } from 'crawlee';
import { possibleXmlUrls } from './consts.js'; // Correct import
import { createRequire } from 'module';

const require = createRequire(import.meta.url); // Allow CommonJS imports
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

// Add the stealth plugin to puppeteer-extra
puppeteer.use(StealthPlugin());

await Actor.init();

// Get input
let { url = 'https://youmoveme.com/', proxy } = await Actor.getInput() ?? {};

if (url.match(/\/$/) !== null) {
    url = url.replace(/\/$/, '');
}

// Open a RequestQueue
const requestQueue = await RequestQueue.open();

// Add the possible XML sitemap URLs to the RequestQueue
for (const xmlUrl of possibleXmlUrls) {
    const fullUrl = `${url}${xmlUrl}`;
    await requestQueue.addRequest({ url: fullUrl });
}

// Create the crawler
const crawler = new PuppeteerCrawler({
    requestQueue,
    useSessionPool: true,
    maxConcurrency: 1,
    maxRequestRetries: 2,
    maxRequestsPerCrawl: 100,
    launchContext: {
        launcher: puppeteer, // Use puppeteer-extra as the launcher
        launchOptions: {
            headless: true,
            // Include any additional launch options if necessary
        },
    },
    browserPoolOptions: {
        useFingerprints: true,
        maxOpenPagesPerBrowser: 1,
        retireBrowserAfterPageCount: 80,
        // Remove browserPlugins as it's disallowed
    },
    // proxyConfiguration, // Uncomment if using proxy
    async requestHandler({ request, page, response, session, log }) {
        const responseStatus = response.status();

        if (responseStatus === 403) {
            session.retire();
            request.retryCount--;
            await sleep(5000);
            throw new Error('Session blocked, retiring.');
        }

        const htmlRaw = await page.evaluate(() => document.querySelector('body').innerText.trim());

        const key = `html_${Math.random()}`;
        await Actor.setValue(`${key}.html`, htmlRaw, { contentType: 'text/html' });
        const htmlUrl = `https://api.apify.com/v2/key-value-stores/${Actor.getEnv().defaultKeyValueStoreId}/records/${key}.html?disableRedirect=true`;

        await Dataset.pushData({
            url: request.url,
            loadedUrl: request.loadedUrl,
            statusCode: responseStatus,
            htmlUrl,
        });

        log.info(`${request.url} checked, status ${responseStatus}`);
    },
    async failedRequestHandler({ request }) {
        console.log(`Request ${request.url} failed too many times`);
        await Dataset.pushData({
            '#debug': createRequestDebugInfo(request),
        });
    },
});

await crawler.run();

await Actor.exit();
