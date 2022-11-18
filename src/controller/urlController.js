const urlModel = require("../model/model.js")
const shortid = require('shortid');
const validUrl = require('valid-url');    // <=== this package is not working
const redis = require("redis");
const { promisify } = require("util");


// const validUrl = /^(http:\/\/www\.|https:\/\/www\.|http:\/\/|https:\/\/)?[a-z0-9]+([\-\.]{1}[a-z0-9]+)*\.[a-z]{2,5}(:[0-9]{1,5})?(\/.*)?$/

//Connect to redis
const redisClient = redis.createClient(
  17807,                                                                // <=== port number 
  "redis-17807.c301.ap-south-1-1.ec2.cloud.redislabs.com",              // <=== redis account link
  { no_ready_check: true }
);

redisClient.auth("MASbrdL7RJJtrO9aAZ9J1k7Y2N4PRurC", function (err) {   // <=== redis account password
  if (err) throw err;
});

redisClient.on("connect", async function () {                           // <=== telling to redis connect
  console.log("Connected to Redis..");        
});


//1. connect to the server
//2. use the commands :

//Connection setup for redis

const SET_ASYNC = promisify(redisClient.SET).bind(redisClient); // setkey (!binding the set key with redisclient!)
const GET_ASYNC = promisify(redisClient.GET).bind(redisClient); // get key


// ========> create url
const createUrl = async function (req, res) {
  try {
    const {longUrl} = req.body    // <=== when we remove the longUrl it show the wrong URL why ??
    console.log(longUrl)

    if (Object.keys(req.body).length == 0) 
    return res.status(400).send({ status: false, message: "please enter  url" })

    if (!validUrl.isWebUri(longUrl)) {
      return res.status(400).send({ status: false, message: "invalid URL" })
    }

    //If URL already Present 
    // taking from caching memory if there is present if not it will take DB call
    let cachedLongUrl = await GET_ASYNC(`${longUrl}`)     // <== not able to understand line 54 & what is the work of $ if we remove it it will give null
    console.log(cachedLongUrl)

    if (cachedLongUrl) {
      let parseLongUrl = JSON.parse(cachedLongUrl)  // <====== JSON.parse will change string into JS object
      return res.status(200).send({ status: true, message: "Shorten link already generated ", data: parseLongUrl })
    }

    const str = 'http://localhost:3000/'
    const urlCode = shortid.generate()
    const shortUrl = str + urlCode
    const urlData = { longUrl, shortUrl, urlCode }

    //Set cache the newly created url
    if (urlData) { await SET_ASYNC(`${longUrl}`, JSON.stringify(urlData)) }

    await urlModel.create(urlData) 
    return res.status(201).send({ status: true, message: "success", data: urlData })
  }
  catch (err) {
    return res.status(500).send({ status: false, message: err.message })
  }
}

// ========> get url
const getUrl = async function (req, res) {
  try {

    const urlCode = req.params.urlCode

    if (!shortid.isValid(urlCode)) { return res.status(400).send({ status: false, message: "invalid URL" }) }
    
    let cachedUrlCode = await GET_ASYNC(`${urlCode}`)

    if (cachedUrlCode) {
      let parseUrl = JSON.parse(cachedUrlCode)
      let cachedLongUrl = parseUrl.longUrl 
      return res.status(302).redirect(cachedLongUrl)
    }


    // it will do a DB call here if it will not found in cache
    const getUrl = await urlModel.findOne({ urlCode });

    if (!getUrl) { return res.status(404).send({ status: false, message: "URL not found" }) }

    await SET_ASYNC(`${urlCode}`, JSON.stringify(getUrl))

    return res.status(302).redirect(getUrl.longUrl)

  }
  catch (err) {
    return res.status(500).send({ status: false, message: err.message })
  }
}

module.exports.createUrl = createUrl
module.exports.getUrl = getUrl
