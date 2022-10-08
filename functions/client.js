
const request = require('request');
const options = {
  'method': 'GET',
  'url': 'https://us-central1-agile-sanctum-359508.cloudfunctions.net/tweet',
  'headers': {
  }
};
request(options, function (error, response) {
  if (error) throw new Error(error);
  console.log(response.body);
});
