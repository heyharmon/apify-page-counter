// main.js
import { Actor, log } from 'apify';
import { CheerioCrawler, RequestQueue, Dataset } from 'crawlee';
import cheerio from 'cheerio'; // Import cheerio for XML parsing
import { possibleXmlUrls } from './consts.js'; // Ensure this imports correctly

await Actor.init();

// Structure of input is defined in input_schema.json
const {
    url = 'https://static-scraper-testing-site.netlify.app',
    maxRequestsPerCrawl = 999,
} = await Actor.getInput() ?? {};

// Open a RequestQueue
const requestQueue = await RequestQueue.open();

// Initialize an array to store total pages per URL
let totalPagesArray = [];

// Process each URL in the input array
for (const url of urls) {
    let processedUrl = url;

    if (processedUrl.match(/\/$/) !== null) {
        processedUrl = processedUrl.replace(/\/$/, '');
    }

    // Initialize total pages for this URL
    totalPagesArray.push({ url: processedUrl, totalPages: 0 });

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
    maxRequestRetries: 0,
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

            // Find the object in totalPagesArray with the matching baseUrl
            const totalPagesObj = totalPagesArray.find(obj => obj.url === baseUrl);

            if (totalPagesObj) {
                totalPagesObj.totalPages += urls.length;
            } else {
                // If for some reason the baseUrl is not found, add it
                totalPagesArray.push({ url: baseUrl, totalPages: urls.length });
            }

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

// Log and store the total pages per URL
for (const { url, pages } of totalPagesArray) {
    log.info(`Total number of pages found for ${url}: ${pages}`);
}

// Store the data
await Dataset.pushData(totalPagesArray);

await Actor.exit();
