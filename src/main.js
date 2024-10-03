// main.js
import { Actor } from 'apify';
import { CheerioCrawler, Dataset, RequestQueue, sleep, createRequestDebugInfo } from 'crawlee';
import { possibleXmlUrls } from './consts.js'; // Ensure this imports correctly

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
const crawler = new CheerioCrawler({
    requestQueue,
    maxConcurrency: 10, // Adjust based on your needs
    maxRequestRetries: 2,
    maxRequestsPerCrawl: 100,
    // proxyConfiguration,
    async requestHandler({ request, response, body, $, log }) {
        const responseStatus = response.statusCode;

        // Check if the loadedUrl differs from the original url
        const originalUrl = request.url;
        const loadedUrl = request.loadedUrl;

        let effectiveStatusCode = responseStatus;

        // Logic to detect if the page is actually a 404
        let isPageNotFound = false;

        // Method 1: Check if loadedUrl is a known 404 page
        if (loadedUrl !== originalUrl && loadedUrl.includes('/404')) {
            isPageNotFound = true;
        }

        // Method 2: Analyze page content for 404 indicators
        const pageTitle = $('title').text().toLowerCase();
        const bodyText = $('body').text().toLowerCase();

        if (
            pageTitle.includes('page not found') ||
            bodyText.includes('page not found') ||
            bodyText.includes('404 error')
        ) {
            isPageNotFound = true;
        }

        // If page is not found, set status code to 404
        if (isPageNotFound) {
            effectiveStatusCode = 404;
        }

        // Save the body content
        const htmlRaw = body.toString();

        // Save the content to the key-value store
        const key = `html_${Math.random()}`;
        await Actor.setValue(`${key}.html`, htmlRaw, { contentType: 'text/html' });
        const htmlUrl = `https://api.apify.com/v2/key-value-stores/${Actor.getEnv().defaultKeyValueStoreId}/records/${key}.html?disableRedirect=true`;

        // Save the data to the dataset
        await Dataset.pushData({
            url: originalUrl,
            loadedUrl,
            statusCode: effectiveStatusCode,
            htmlUrl,
        });

        log.info(`${originalUrl} checked, status ${effectiveStatusCode}`);
    },
    async failedRequestHandler({ request }, error) {
        console.log(`Request ${request.url} failed too many times (${error.message})`);
        await Dataset.pushData({
            url: request.url,
            errorMessage: error.message,
            '#debug': createRequestDebugInfo(request),
        });
    },
});

await crawler.run();

await Actor.exit();
