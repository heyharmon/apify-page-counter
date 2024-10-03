/**
 * Extract all script tags from html
 *
 * @param  {Function} $html Page html as Cheerio function
 * @return {Array} Returns array of script tag objects
 */
const getScripts = ($html) => {
    return $html('script[src]').map(function() {
        return $html(this)
            .text('') // Remove any inner js
            .prop('outerHTML') // Get outer <script> tag
    }).get()
}

export {
    getScripts
}
