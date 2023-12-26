const express = require("express");
const app = express();
app.use(express.json());
const path = require("path");
const dbPath = path.join(__dirname, "twitterClone.db");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

let db = null;
const initializeDbAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server Running at http://localhost:3000");
    });
  } catch (e) {
    console.log(`DB Error: ${e.message}`);
    process.exit(1);
  }
};

initializeDbAndServer();

//API 1

app.post("/register/", async (request, response) => {
  const query = `SELECT * FROM USER`;
  const getDetails = await db.all(query);
  const addId = getDetails.length + 1;

  const { username, password, name, gender } = request.body;
  const query1 = `SELECT * FROM USER WHERE username = '${username}';`;
  const hashedPassword = await bcrypt.hash(password, 10);

  const dataBase = await db.get(query1);
  if (dataBase === undefined) {
    if (password.length < 6) {
      response.status(400);
      response.send("Password is too short");
    } else {
      const addQuery = `INSERT INTO USER (user_id, name, username, password, gender)
                           VALUES(
                               '${addId}', 
                               '${name}',
                               '${username}',
                               '${hashedPassword}',
                               '${gender}'
                           )`;
      const addData = await db.run(addQuery);
      response.send("User created successfully");
    }
  } else {
    response.status(400);
    response.send("User already exists");
  }
});

//API 2

const Authentication = (request, response, next) => {
  const authHeader = request.headers.authorization;
  let jwtToken;
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "MY_SECRET_KEY", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        request.username = payload.username;
        next();
      }
    });
  }
};

app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const twitterQuery = `SELECT * FROM tweet NATURAL JOIN user WHERE username = '${username}';`;
  const twitterDb = await db.get(twitterQuery);
  if (twitterDb === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const checkPassword = await bcrypt.compare(password, twitterDb.password);
    if (checkPassword === true) {
      const payload = { username: username };
      const jwtToken = jwt.sign(payload, "MY_SECRET_KEY");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

//API 3

app.get("/user/tweets/feed/", Authentication, async (request, response) => {
  const query = `SELECT username, tweet, date_time AS dateTime FROM USER NATURAL JOIN TWEET;`;
  const dataDetails = await db.all(query);
  response.send(dataDetails);
});

//API 4

app.get("/user/following/", Authentication, async (request, response) => {
  const query = `SELECT name FROM USER NATURAL JOIN FOLLOWER`;
  const dataDetails = await db.all(query);
  response.send(dataDetails);
});

//API 5

app.get("/user/followers/", Authentication, async (request, response) => {
  const query = `SELECT name FROM USER NATURAL JOIN FOLLOWER`;
  const dataDetails = await db.all(query);
  response.send(dataDetails);
});

//API 6
app.get("/tweets/:tweetId/", Authentication, async (request, response) => {
  const { tweetId } = request.params;
  const query = `SELECT tweet, like_id AS likes,reply_id AS replies , date_time AS dateTime FROM (tweet NATURAL JOIN reply) AS T NATURAL JOIN(like) WHERE tweet_id = '${tweetId}';`;
  const getData = await db.get(query);
  if (getData === undefined) {
    response.status(401);
    response.send("Invalid Request");
  } else {
    response.send(getData);
  }
});

//API 7

app.get(
  "/tweets/:tweetId/likes/",
  Authentication,
  async (request, response) => {
    const { tweetId } = request.params;
    const query = `SELECT * FROM TWEET NATURAL JOIN LIKE AS T NATURAL JOIN (USER) WHERE tweet_id='${tweetId}';`;
    const getData = await db.get(query);
    const { username } = request;

    if (getData === undefined) {
      response.status(401);
      response.send("Invalid Request");
    } else {
      response.send({
        likes: [getData.name],
      });
    }
  }
);

//API 8

app.get(
  "/tweets/:tweetId/replies/",
  Authentication,
  async (request, response) => {
    const { tweetId } = request.params;
    const query = `SELECT * FROM (TWEET NATURAL JOIN REPLY) AS T NATURAL JOIN (USER) WHERE tweet_id = '${tweetId}';`;
    const getData = await db.get(query);

    if (getData === undefined) {
      response.status(401);
      response.send("Invalid Request");
    } else {
      response.send({
        replies: [{ name: getData.name, reply: getData.reply }],
      });
    }
  }
);

//API 9

app.get("/user/tweets/", Authentication, async (request, response) => {
  const query = `SELECT tweet, like_id AS likes, reply_id AS replies, date_time AS dateTime FROM REPLY NATURAL JOIN TWEET AS T NATURAL JOIN(LIKE);`;
  response.send(await db.all(query));
});

//API 10

app.post("/user/tweets/", async (request, response) => {
  const { tweet } = request.body;
  const query = `SELECT * FROM TWEET;`;
  const details = await db.all(query);
  const dataIds = details[details.length - 1];

  const create = `INSERT INTO TWEET (tweet_id, tweet, user_id, date_time)
                   VALUES(
                        '${dataIds.tweet_id + 1}',
                       '${tweet}',
                       '${dataIds.user_id}',
                       '${dataIds.date_time}'
                       );`;
  await db.run(create);
  response.send("Created a Tweet");
});

//API 11
app.delete("/tweets/:tweetId/", Authentication, async (request, response) => {
  const { tweetId } = request.params;

  const getQuery = `SELECT * FROM tweet WHERE tweet_id = '${tweetId}';`;
  const getDetail = await db.get(getQuery);
  if (getDetail === undefined) {
    response.status(401);
    response.send("Invalid Request");
  } else {
    const deleteQuery = `DELETE FROM TWEET WHERE tweet_id = '${tweetId}';`;
    await db.run(deleteQuery);
    response.send("Tweet Removed");
  }
});

module.exports = app;
