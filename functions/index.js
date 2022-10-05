// http://localhost:5000/agile-sanctum-359508/us-central1/auth
// http://localhost:5000/agile-sanctum-359508/us-central1/callback
// http://localhost:5000/agile-sanctum-359508/us-central1/tweet


const functions = require("firebase-functions");
const admin = require('firebase-admin');
admin.initializeApp();
// require("dotenv").config();

// reference to document in firestore db
const dbRef = admin.firestore().doc('tokens/MOwJ098vHDovmQaKPrSo');

//init twitter api (using OAuth 2.0)
const TwitterApi = require('twitter-api-v2').default;
const twitterClient = new TwitterApi({
    clientId: process.env.CLIENT_ID ,
    clientSecret: process.env.CLIENT_SECRET,


    

}); 

const callbackURL = 'http://127.0.0.1:5000/agile-sanctum-359508/us-central1/callback'

// OpenAI API init
const { Configuration, OpenAIApi } = require('openai');
const configuration = new Configuration({
  organization: process.env.OPENAI_ORG,
  apiKey: process.env.OPENAI_SECRET,
});
const openai = new OpenAIApi(configuration);


// STEP 1 - Auth URL
//generate authentication link
exports.auth = functions.https.onRequest(async (request,response)=>{
    const {url, codeVerifier, state} = twitterClient.generateOAuth2AuthLink(
        callbackURL,
        {scope: ['tweet.read', 'tweet.write','users.read','offline.access']}
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
        return response.status(400).send('Stored tokens do not match!')
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
        model: 'text-davinci-002',
        prompt: 'tweet something cool for #techtwitter',
        temperature:0.6,
    });

    
    const { data } = await refreshedClient.v2.tweet(
        nextTweet.data.choices[0].text
    );

    response.send(data);

});


exports.account = functions.https.onRequest(async (request,response)=>{
    const{refreshToken} = (await dbRef.get()).data();

    const{
        client: refreshedClient,
        accessToken,
        refreshToken: newRefreshToken,
    } = await twitterClient.refreshOAuth2Token(refreshToken);

    await dbRef.set({accessToken,refreshToken:newRefreshToken});

    const { data } = await refreshedClient.v2.me(); // start using the client if you want

    response.send(data);

});


//open ai solo 
exports.openai = functions.https.onRequest(async (request,response)=>{

    const nextTweet = await openai.createCompletion({
        model: 'text-davinci-002',
        prompt: 'tweet something cool for #techtwitter',
        // max_tokens: 64,
        temperature:0.6,
      });

    response.send(nextTweet.data.choices[0].text);

});


// exports.tweetHourly = functions.pubsub
//     .schedule('0 * * * *')
//     .onRun(async(context) =>{

//     })

// Create and Deploy Your First Cloud Functions
// https://firebase.google.com/docs/functions/write-firebase-functions
