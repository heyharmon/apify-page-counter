/**
 * Extract word count from a string
 *
 * @param  {String} string
 * @return {Number} Returns word count as number
 */
const getWordcount = (string) => {
    // Match on any sequence of non-whitespace characters
    const wordcount = string.match(/\S+/g).length

    if (wordcount) {
        return wordcount
    }

    return null
}

export {
    getWordcount
}
