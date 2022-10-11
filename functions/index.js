
/* eslint-env es6 */
/* eslint-disable no-console */
const functions = require("firebase-functions");
const admin = require("firebase-admin");
admin.initializeApp();

// reference to document in firestore db
const dbRef = admin.firestore().doc(process.env.DB_REFERENCE);

//init twitter api (using OAuth 2.0)
const TwitterApi = require("twitter-api-v2").default;
const twitterClient = new TwitterApi({
    clientId: process.env.CLIENT_ID ,
    clientSecret: process.env.CLIENT_SECRET,


    

}); 

const callbackURL = process.env.CALLBACK_URL

// OpenAI API init
const { Configuration, OpenAIApi } = require("openai");
const configuration = new Configuration({
  organization: process.env.OPENAI_ORG,
  apiKey: process.env.OPENAI_SECRET,
});
const openai = new OpenAIApi(configuration);

//import request to trigger the tweet at certain intervals (scheduled function call)
const request = require('request');

// STEP 1 - Auth URL
//generate authentication link
exports.auth = functions.https.onRequest(async (request,response) => {

    const {url, codeVerifier, state} = twitterClient.generateOAuth2AuthLink(
        callbackURL,
        {scope: ["tweet.read", "tweet.write","users.read","offline.access"]}
    );

    //store verifier in db
    await dbRef.set({codeVerifier,state })

    response.redirect(url); //redirect to twitter
});


// STEP 2 - Verify callback code, store access_token 
// callback url
exports.callback = functions.https.onRequest(async (request,response) => {

    //grab stat & code form url (url params)
    const {state, code} = request.query;

    // compare the state & code variables above to that stored in db
    const dbSnapshot = await dbRef.get();
    const {codeVerifier, state:storedState} = dbSnapshot.data();

    if (state !== storedState) {
        return response.status(400).send("Stored tokens do not match!")
    }

    const {
        client:loggedClient,
        accessToken,
        refreshToken,
    } = await twitterClient.loginWithOAuth2({
        code,
        codeVerifier,
        redirectUri: callbackURL,
    });

    await dbRef.set({accessToken,refreshToken});

    const { data } = await loggedClient.v2.me(); // start using the client if you want

    response.send(data);

});


// STEP 3 - Refresh tokens and post tweets
// endpoint to do something with api data
exports.tweet = functions.https.onRequest(async (request,response)=>{
    const{refreshToken} = (await dbRef.get()).data();

    const{
        client: refreshedClient,
        accessToken,
        refreshToken: newRefreshToken,
    } = await twitterClient.refreshOAuth2Token(refreshToken);

    await dbRef.set({accessToken,refreshToken:newRefreshToken});

    const nextTweet = await openai.createCompletion({
        model: "text-davinci-002",
        prompt: "tweet something cool about fashion",
        temperature:0.6,
    });

    
    const { data } = await refreshedClient.v2.tweet(
        nextTweet.data.choices[0].text
    );

    response.send(data);

});

// step4
exports.tweetHourly = functions.pubsub
    .schedule("* * * * *") //every minute
    .onRun((context) =>{
        console.log("This new cron job is srating!");
        functions.logger.info("Hello logs!");
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

        return null;
    })









