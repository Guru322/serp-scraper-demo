import express from 'express';
import { request } from 'undici';
import * as cheerio from 'cheerio';

const app = express();
const PORT = process.env.PORT || 3000;


async function fetchSerpHtml(searchQuery) {
  const searchUrl = `https://www.google.com/search?hl=en&q=${encodeURIComponent(searchQuery)}`;

  const headers = {
    'User-Agent': 'Mozilla/5.0 (Linux; Android 11; sdk_gphone_x86 Build/RSR1.240422.006; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/83.0.4103.106 Mobile Safari/537.36 GSA/11.13.8.21.x86'
  };

  try {
    const { statusCode, body } = await request(searchUrl, { headers });

    if (statusCode !== 200) {
      throw new Error(`Request failed with status code ${statusCode}`);
    }

    return await body.text();
  } catch (error) {
    console.error('Error fetching SERP data:', error.message);
    throw new Error(`Failed to fetch SERP: ${error.message}`);
  }
}


function parseSerpHtml(htmlContent) {
  const $ = cheerio.load(htmlContent);
  const organicResults = [];
  const relatedQuestions = [];

  $('div.Ww4FFb.vt6azd.xpd').each((index, element) => {
    const linkElement = $(element).find('a.rTyHce');
    const title = $(element).find('div.MBeuO').text();
    const rawLink = linkElement.attr('href');
    
    let link = '';
    if (rawLink && rawLink.startsWith('/url?q=')) {
      const urlParams = new URLSearchParams(rawLink.split('?')[1]);
      link = urlParams.get('q');
    }

    const displayed_link = $(element).find('span.nC62wb').text();
    const snippet = $(element).find('div.VwiC3b').text();

    if (title && link) {
      organicResults.push({
        position: organicResults.length + 1,
        title,
        link,
        displayed_link,
        snippet,
      });
    }
  });
  
  $('div.related-question-pair').each((index, element) => {
    const question = $(element).find('span.JCzEY').text();
    if (question) {
        relatedQuestions.push(question);
    }
  });

  return {
    organic_results: organicResults,
    related_questions: relatedQuestions,
  };
}


app.get('/search', async (req, res) => {
  const { q: searchQuery } = req.query;

  if (!searchQuery) {
    return res.status(400).json({ error: 'Search query parameter "q" is required.' });
  }

  console.log(`Received search query: "${searchQuery}"`);

  try {
    const html = await fetchSerpHtml(searchQuery);

    const jsonData = parseSerpHtml(html);

    res.json(jsonData);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
  console.log('Usage: http://localhost:3000/search?q=your-query-here');
});

