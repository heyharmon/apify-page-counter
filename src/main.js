// main.js
import { Actor, log } from 'apify';
import { CheerioCrawler, RequestQueue } from 'crawlee';
import cheerio from 'cheerio'; // Import cheerio for XML parsing
import { possibleXmlUrls } from './consts.js'; // Ensure this imports correctly

await Actor.init();

// Get input
let { url = 'https://youmoveme.com/', proxy } = (await Actor.getInput()) ?? {};

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

// Initialize totalPages counter
let totalPages = 0;

// Create the crawler
const crawler = new CheerioCrawler({
    requestQueue,
    maxConcurrency: 10, // Adjust based on your needs
    maxRequestRetries: 2,
    maxRequestsPerCrawl: 1000, // Increase if needed
    async requestHandler({ request, response, body }) {
        const responseStatus = response.statusCode;

        // Parse the body as XML
        const $ = cheerio.load(body, { xmlMode: true });

        if ($('sitemapindex').length > 0) {
            // It's a sitemap index
            const sitemapLocs = $('sitemapindex > sitemap > loc')
                .map((i, el) => $(el).text())
                .get();

            for (const sitemapUrl of sitemapLocs) {
                await requestQueue.addRequest({ url: sitemapUrl });
            }
            log.info(`Found sitemap index at ${request.url}, enqueued ${sitemapLocs.length} sitemaps.`);
        } else if ($('urlset').length > 0) {
            // It's a sitemap
            const urls = $('urlset > url > loc')
                .map((i, el) => $(el).text())
                .get();

            totalPages += urls.length;

            log.info(`Found sitemap at ${request.url}, contains ${urls.length} URLs.`);
        } else {
            log.info(`Unknown sitemap format at ${request.url}`);
        }
    },
    async failedRequestHandler({ request }, error) {
        log.error(`Request ${request.url} failed too many times (${error.message})`);
    },
});

await crawler.run();

log.info(`Total number of pages found: ${totalPages}`);

await Actor.exit();
