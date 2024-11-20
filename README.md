# Apify Page Counter
Count website pages by crawling sitemap.xml files and counting pages.

## How to use the actor
Input Schema:

The actor expects an input JSON with a urls property.
```json
{
    "urls": [
        "https://foo.com", 
        "https://www.bar.com"
    ]
}
```

Output structure:

The actor will output a data structure that looks like this.
```json
[
    {
        "url": "https://foo.com",
        "pages": 378
    },
    {
        "url": "https://www.bar.com",
        "pages": 12
    }
]
```

## How to use (local development)
Run crawl
```
apify run --purge
```

Login to Apify
```
apify login
```

Deploy to Apify
```
apify push
```
