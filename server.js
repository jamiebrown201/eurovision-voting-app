const express = require('express');
const app = express();
const port = process.env.PORT || 3000;
const AWS = require('aws-sdk');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Configure AWS SDK
AWS.config.update({
  region: 'eu-west-2', // London region
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
});

// Create a DynamoDB client
const dynamodb = new AWS.DynamoDB.DocumentClient();

// Middleware
app.use(express.json());
app.use(express.static('public'));

// Routes
app.post('/api/vote', (req, res) => {
  const { voterName, votes } = req.body;

  // Create a unique ID for the vote entry
  const voteId = Date.now().toString();

  // Create the vote item to be stored in DynamoDB
  const voteItem = {
    id: voteId,
    voterName: voterName,
    votes: votes,
    timestamp: new Date().toISOString(),
  };

  // Save the vote item to DynamoDB
  const params = {
    TableName: 'eurovision-preview-party-2024',
    Item: voteItem,
  };

  dynamodb.put(params, (err, data) => {
    if (err) {
      console.error('Error saving vote to DynamoDB:', err);
      res.status(500).json({ error: 'Failed to save vote' });
    } else {
      console.log('Vote saved to DynamoDB:', data);
      res.json({ message: 'Vote submitted successfully' });
    }
  });
});

app.get('/api/results', (req, res) => {
    const params = {
      TableName: 'eurovision-preview-party-2024',
    };
  
    dynamodb.scan(params, (err, data) => {
      if (err) {
        console.error('Error retrieving votes from DynamoDB:', err);
        res.status(500).json({ error: 'Failed to retrieve results' });
      } else {
        const votes = data.Items;
        const results = aggregateResults(votes, songs);
        res.json({ results });
      }
    });
  });

// Helper function to aggregate the results
function aggregateResults(votes, songs) {
    const pointsMap = {
      1: 12,
      2: 10,
      3: 8,
      4: 7,
      5: 6,
      6: 5,
      7: 4,
      8: 3,
      9: 2,
      10: 1,
    };
  
    const results = {};
  
    votes.forEach((vote) => {
      vote.votes.forEach((entry, index) => {
        const { songId } = entry;
        const points = pointsMap[index + 1];
  
        if (songId) {
          const song = songs.find((s) => s.id === songId);
          if (results[songId]) {
            results[songId].points += points;
          } else {
            results[songId] = {
              points,
              country: song.country,
              artist: song.artist,
              title: song.title,
            };
          }
        }
      });
    });
  
    // Sort the results based on points in ascending order
    const sortedResults = Object.entries(results)
    .sort(([, a], [, b]) => b.points - a.points)
    .map(([songId, result]) => ({ songId, ...result }));
  
  return sortedResults;
  }

// Start the server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});