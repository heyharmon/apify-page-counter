// For more information, see https://crawlee.dev/
import { Actor } from 'apify';
import { CheerioCrawler, Dataset } from 'crawlee';
// import { getTitle } from './helpers/title.js'
import { getLinks } from './helpers/links.js'
// import { getIFrames } from './helpers/iframes.js'
// import { getTables } from './helpers/tables.js'
// import { getScripts } from './helpers/scripts.js'
import { getBodyText } from './helpers/body.js'
// import { getWordcount } from './helpers/count.js'

await Actor.init();
// const input = await Actor.getInput() // The parameters you passed to the actor

// Structure of input is defined in input_schema.json
const {
    startUrls = [{ url: 'https://acme.heyharmon.dev/'}],
    maxRequestsPerCrawl = 100,
} = await Actor.getInput() ?? {};

// const proxyConfiguration = await Actor.createProxyConfiguration();

const crawler = new CheerioCrawler({
    // proxyConfiguration,
    maxRequestsPerCrawl,
    async requestHandler({$, request, enqueueLinks, log}) {
        // log.info(`THE REQUEST`, request);

        // Enqueue discovered links
        await enqueueLinks({
            transformRequestFunction(request) {
                // Ignore urls containing fragments
                const blockedFragments = ['?', '#']
                if (blockedFragments.some(frag => request.url.includes(frag))) return false

                // Ignore urls to media
                const blockedExtensions = ['.pdf', '.jpg', '.jpeg', '.png']
                if (blockedExtensions.some(ext => request.url.endsWith(ext))) return false
                
                return request
            }
        })

        // Get page information
        const title = $('title').text();
        if (title === '') {
            title = 'Title not found'
        }
        
        const links = getLinks($, request.url)

        // const iframes = getIFrames($)

        // const scripts = getScripts($)

        // const tables = getTables($) 

        const body = getBodyText($)

        // const wordcount = getWordcount(body)

        // let redirected = false;
        // if (request.url != request.loadedUrl) {
        //     redirected = true;
        // }

        // Log anything that might be useful to see during crawl.
        log.info('---------');
        log.info(`${title}`, { url: request.loadedUrl });
        // log.info(`Crawling ${request.url}.`);
        // log.info('html: ', $.text())
        // console.log('Scripts: ', scripts)
        // console.log('IFrames: ', iframes)
        // console.log('Tables: ', tables)
        log.info(`Links: `, links);
        log.info('---------');

        // Store the data
        await Dataset.pushData({
            // http_status: status,
            title: title,
            // wordcount: wordcount,
            // redirected: redirected,
            // requested_url: request.url,
            url: request.loadedUrl,
            // scripts: scripts,
            // iframes: iframes,
            links: links
        })
    }
});

// await crawler.run(startUrls);
// await crawler.run(['https://nuxt-scraper-testing-site.netlify.app']);
// await crawler.run(['https://acme.heyharmon.dev']);

// let startUrls = input ? input.startUrls : ['https://acme.heyharmon.dev']
await crawler.run(startUrls)

await Actor.exit();