// main.js
import { Actor, log } from 'apify';
import { CheerioCrawler, RequestQueue, Dataset } from 'crawlee';
import cheerio from 'cheerio'; // Import cheerio for XML parsing
import { possibleXmlUrls } from './consts.js'; // Ensure this imports correctly

await Actor.init();

// Get input
let { urls, proxy } = (await Actor.getInput()) ?? {};

// Ensure 'urls' is an array
if (!Array.isArray(urls)) {
    throw new Error('Input "urls" must be an array of URLs.');
}

// Open a RequestQueue
const requestQueue = await RequestQueue.open();

// Initialize totalPages counter per URL
let totalPagesPerUrl = {};

// Process each URL in the input array
for (const url of urls) {
    let processedUrl = url;

    if (processedUrl.match(/\/$/) !== null) {
        processedUrl = processedUrl.replace(/\/$/, '');
    }

    // Initialize total pages for this URL
    totalPagesPerUrl[processedUrl] = 0;

    // Add the possible XML sitemap URLs to the RequestQueue
    for (const xmlUrl of possibleXmlUrls) {
        const fullUrl = `${processedUrl}${xmlUrl}`;
        await requestQueue.addRequest({
            url: fullUrl,
            userData: { baseUrl: processedUrl },
        });
    }
}

// Create the crawler
const crawler = new CheerioCrawler({
    requestQueue,
    maxConcurrency: 10, // Adjust based on your needs
    maxRequestRetries: 2,
    maxRequestsPerCrawl: 1000, // Increase if needed
    async requestHandler({ request, response, body }) {
        const responseStatus = response.statusCode;
        const baseUrl = request.userData.baseUrl;

        // Parse the body as XML
        const $ = cheerio.load(body, { xmlMode: true });

        if ($('sitemapindex').length > 0) {
            // It's a sitemap index
            const sitemapLocs = $('sitemapindex > sitemap > loc')
                .map((i, el) => $(el).text())
                .get();

            for (const sitemapUrl of sitemapLocs) {
                await requestQueue.addRequest({
                    url: sitemapUrl,
                    userData: { baseUrl },
                });
            }
            log.info(
                `Found sitemap index at ${request.url}, enqueued ${sitemapLocs.length} sitemaps.`
            );
        } else if ($('urlset').length > 0) {
            // It's a sitemap
            const urls = $('urlset > url > loc')
                .map((i, el) => $(el).text())
                .get();

            totalPagesPerUrl[baseUrl] += urls.length;

            log.info(
                `Found sitemap at ${request.url}, contains ${urls.length} URLs.`
            );
        } else {
            log.info(`Unknown sitemap format at ${request.url}`);
        }
    },
    async failedRequestHandler({ request }, error) {
        log.error(
            `Request ${request.url} failed too many times (${error.message})`
        );
    },
});

await crawler.run();

// Log and store the total pages per URL
for (const [url, totalPages] of Object.entries(totalPagesPerUrl)) {
    log.info(`Total number of pages found for ${url}: ${totalPages}`);
}

// Store the data
await Dataset.pushData({
    totalPagesPerUrl,
});

await Actor.exit();
