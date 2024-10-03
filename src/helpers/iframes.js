/**
 * Extract all script tags from html
 *
 * @param  {Function} $html Page html as Cheerio function
 * @return {Array} Returns array of script tag objects
 */
const getIFrames = ($html) => {
    return $html('iframe').map(function() {
        return $html(this)
            .prop('src') // Get src property
    }).get()
}

export {
    getIFrames
}
