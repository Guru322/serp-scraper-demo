import express from 'express';
import { request } from 'undici';
import * as cheerio from 'cheerio';

const PORT = process.env.PORT || 3000;
const app = express();


async function fetchAndParseSERP(searchQuery) {
  const searchUrl = `https://www.google.com/search?hl=en&q=${encodeURIComponent(searchQuery)}&output=search`;
  
  const headers = {
    'User-Agent': 'Mozilla/4.0 (compatible; MSIE 7.0; Windows Phone OS 7.0; Trident/3.1; IEMobile/7.1; ARM; Touch; LG; LG-E900)'
  };

  let htmlBody;
  try {
    const { statusCode, body } = await request(searchUrl, { headers });

    if (statusCode !== 200) {
      throw new Error(`Request failed with status code ${statusCode}`);
    }
    
    htmlBody = await body.text();
    
  } catch (error) {
    console.error('Error fetching SERP data:', error.message);
    throw new Error(`Failed to fetch SERP: ${error.message}`);
  }

  const $ = cheerio.load(htmlBody);

  const serpData = {
    search_parameters: {
      query: searchQuery,
    },
    organic_results: [],
    related_searches: [],
    pagination: {}
  };

  serpData.search_parameters.location = $('div.HddGcc > span.VYM29').text().trim();

  const nextLink = $('table.uZgmoc a.frGj1b').attr('href');
  if (nextLink) {
    serpData.pagination.next_page_link = `https://www.google.com${nextLink}`;
  }

  $('div.ezO2md').each((index, element) => {
    const container = $(element);

    const titleLinkElement = container.find('a.fuLhoc.ZWRArf');
    const titleTextElement = titleLinkElement.find('span.CVA68e');

    if (titleLinkElement.length > 0 && titleTextElement.length > 0) {
      const organicResult = {};
      organicResult.position = serpData.organic_results.length + 1;
      organicResult.title = titleTextElement.text().trim();
      
      const redirectLink = titleLinkElement.attr('href');
      organicResult.redirect_link = redirectLink;

      try {
        const urlParams = new URLSearchParams(redirectLink.split('?')[1]);
        organicResult.link = urlParams.get('q');
      } catch (e) {
        organicResult.link = redirectLink;
      }

      organicResult.displayed_url = container.find('span.qXLe6d.dXDvrc > span.fYyStc').text().trim();
      organicResult.snippet = container.find('span.qXLe6d.FrIlee > span.fYyStc').first().text().trim();

      serpData.organic_results.push(organicResult);
      return; 
    }

    const relatedHeader = container.find('span.dloBPe.fYyStc');
    if (relatedHeader.length > 0 && relatedHeader.text().trim() === 'Related searches') {
      container.find('table.VeHcBf a.ZWRArf').each((i, el) => {
        const relatedItem = $(el);
        serpData.related_searches.push({
          query: relatedItem.find('span.fYyStc').text().trim(),
          link: `https://www.google.com${relatedItem.attr('href')}` 
        });
      });
    }
  });

  return serpData;
}



app.use(express.json());

/**
 * GET /search
 * Requires a 'q' query parameter.
 * Example: /search?q=Guruai
 */
app.get('/search', async (req, res) => {
  const { q } = req.query;
  if (!q) {
    return res.status(400).json({ 
      error: 'Missing required query parameter "q"' 
    });
  }

  console.log(`Received search request for: ${q}`);

  try {
    const data = await fetchAndParseSERP(q);
    
    res.status(200).json(data);

  } catch (error) {
    console.error('Error in /search route:', error);
    res.status(500).json({ 
      error: 'Internal Server Error', 
      details: error.message 
    });
  }
});


app.listen(PORT, () => {
  console.log(`API server running on http://localhost:${PORT}`);
});
