import express, { Request, Response } from 'express';
import * as movieWebProviders from '@movie-web/providers';
import fetch from 'node-fetch'; // Ensure to have the 'node-fetch' package installed
import { EmbedOutput, SourcererOutput, NotFoundError } from '@movie-web/providers';
// scrape a stream from upcloud

const app = express();
const port = 3000;
const hostname = '0.0.0.0';
const tmdbApiKey = '9cf1f930725481a262d480ede0c1077f'; // Your TMDB API key

const myFetcher = movieWebProviders.makeStandardFetcher(fetch);
// Initialize the providers and fetcher
const providers = movieWebProviders.makeProviders({
  fetcher: myFetcher,
  target: movieWebProviders.targets.BROWSER
});




app.use(express.json());




app.get('/scrape', async (req: Request, res: Response) => {

  const id = req.query.id;
  const url = req.query.url;

  console.log("ID:", id);
  console.log("URL:", url);

  try {
    let output: EmbedOutput;
    try {
      output = await providers.runEmbedScraper({
        id: id,
        url: url,
      })
    } catch (err) {
      console.log('failed to scrape')

    }

    return res.status(200).json({
      streams: output,
    });
  } catch (error) {
    console.error('Error in /scrape route:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
    });
  }
});

// Endpoint for movies
app.get('/movies/:id', async (req: Request, res: Response) => {
  const { id } = req.params;

  if (!id) {
    return res.status(400).json({ error: 'Please provide an ID' });
  }

  try {
    const tmdbResponse = await fetch(`https://api.themoviedb.org/3/movie/${id}?api_key=${tmdbApiKey}`);
    const movieDetails = await tmdbResponse.json();

    const { title, release_date } = movieDetails;

    const media = {
      type: 'movie',
      title,
      releaseYear: new Date(release_date).getFullYear(),
      tmdbId: id,
    };

    const output = await providers.runAll({
      media: media,
      sourceOrder: ['flixhq'],
    });

    if (!output || !output.stream || !output.stream.playlist) {
      return res.status(404).json({ error: 'No stream found' });
    }

    return res.status(200).json({
      streams: output,
      title,
      releaseYear: new Date(release_date).getFullYear(),
    });
  } catch (error) {
    return res.status(500).json({ error: 'Error fetching streams or movie details from TMDB' });
  }
});

// Endpoint for movies
app.get('/movies/all/:id', async (req: Request, res: Response) => {
  const { id } = req.params;

  if (!id) {
    return res.status(400).json({ error: 'Please provide an ID' });
  }

  try {
    console.log(`Fetching movie details for ID: ${id}`);
    const tmdbResponse = await fetch(`https://api.themoviedb.org/3/movie/${id}?api_key=${tmdbApiKey}`);
    const movieDetails = await tmdbResponse.json();

    const { title, release_date } = movieDetails;

    console.log(`Movie details fetched: ${title}, Release Date: ${release_date}`);

    const media = {
      type: 'movie',
      title,
      releaseYear: new Date(release_date).getFullYear(),
      tmdbId: id,
    };

    const scraperIds = ["superstream", "zoechip", "gomovies", "flixhq", "remotestream"];


    const scrapedStreams = [];

    for (const scraperId of scraperIds) {
      let output: SourcererOutput;

      try {
        console.log(`Scraping from source ${scraperId}`);
        output = await providers.runSourceScraper({
          id: scraperId,
          media: media,
        });
        console.log(`Scraping successful for source ${scraperId}`);
      } catch (err) {
        if (err instanceof NotFoundError) {
          console.log(`Source ${scraperId} doesn't have this media`);
        } else {
          console.error(`Failed to scrape from source ${scraperId}`, err);
        }
        continue; // Move on to the next scraper ID
      }

      if (output.stream || output.embeds.length > 0) {
        // Add the scraped stream to the result
        scrapedStreams.push({
          source: scraperId,
          stream: output.stream,
          embeds: output.embeds,
        });
      } else {
        console.log(`No streams found from source ${scraperId}`);
      }
    }

    console.log('Scraping process completed');

    return res.status(200).json({
      streams: scrapedStreams,
      title,
      releaseYear: new Date(release_date).getFullYear(),
    });

  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({ error: 'Error fetching streams or movie details from TMDB' });
  }
});

// Endpoint for TV shows
app.get('/tv/:id', async (req: Request, res: Response) => {
  const { id } = req.params;

  if (!id) {
    return res.status(400).json({ error: 'Please provide an ID' });
  }

  try {
    const tmdbResponse = await fetch(`https://api.themoviedb.org/3/tv/${id}?api_key=${tmdbApiKey}`);
    const tvDetails = await tmdbResponse.json();

    const { name, first_air_date } = tvDetails;

    const media = {
      type: 'show',
      title: name,
      releaseYear: new Date(first_air_date).getFullYear(),
      tmdbId: id,
      season: {
        number: req.query.s
      },
      episode: {
        number: req.query.ep
      }
    };


    const output = await providers.runAll({
      media: media,
    });

    if (!output) {
      return res.status(404).json({ error: 'No stream found' });
    }
    console.log(output)
    return res.status(200).json({
      streams: output,
      title: name,
      releaseYear: new Date(first_air_date).getFullYear(),
    });
  } catch (error) {
    return res.status(500).json({ error: 'Error fetching streams or TV show details from TMDB' });
  }
});

app.listen(port, hostname, () => {
  console.log(`Server is running on port ${port}`);
});
