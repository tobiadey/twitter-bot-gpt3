

//put url in env (check for more)
const request = require('request');
const options = {
  'method': 'GET',
  'url': process.env.TWEET_FUNCTION_TRIGGER,
  'headers': {
  }
};
request(options, function (error, response) {
  if (error) throw new Error(error);
  console.log(response.body);
});
