var express = require("express");
var path = require("path");
var cookieParser = require("cookie-parser");
var logger = require("morgan");
var mysql = require("mysql2/promise");

var app = express();

app.use(logger("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

let db;

(async () => {
  try {
    // Connect to MySQL without specifying a database
    const connection = await mysql.createConnection({
      host: "localhost",
      user: "root",
      password: "", // Set your MySQL root password
    });

    // Create the database if it doesn't exist
    await connection.query("CREATE DATABASE IF NOT EXISTS DogWalkService");
    await connection.end();

    // Now connect to the created database
    db = await mysql.createConnection({
      host: "localhost",
      user: "root",
      password: "",
      database: "DogWalkService",
    });

    // Create tables if it doesn't exist
    await db.execute(`CREATE TABLE IF NOT EXISTS Users
                      (
                          user_id       INT AUTO_INCREMENT PRIMARY KEY,
                          username      VARCHAR(50) UNIQUE       NOT NULL,
                          email         VARCHAR(100) UNIQUE      NOT NULL,
                          password_hash VARCHAR(255)             NOT NULL,
                          role          ENUM ('owner', 'walker') NOT NULL,
                          created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                      )`);
    await db.execute(`CREATE TABLE IF NOT EXISTS Dogs
                      (
                          dog_id   INT AUTO_INCREMENT PRIMARY KEY,
                          owner_id INT                               NOT NULL,
                          name     VARCHAR(50)                       NOT NULL,
                          size     ENUM ('small', 'medium', 'large') NOT NULL,
                          FOREIGN KEY (owner_id) REFERENCES Users (user_id)
                      )`);
    await db.execute(`CREATE TABLE IF NOT EXISTS WalkRequests
                      (
                          request_id       INT AUTO_INCREMENT PRIMARY KEY,
                          dog_id           INT          NOT NULL,
                          requested_time   DATETIME     NOT NULL,
                          duration_minutes INT          NOT NULL,
                          location         VARCHAR(255) NOT NULL,
                          status           ENUM ('open', 'accepted', 'completed', 'cancelled') DEFAULT 'open',
                          created_at       TIMESTAMP                                           DEFAULT CURRENT_TIMESTAMP,
                          FOREIGN KEY (dog_id) REFERENCES Dogs (dog_id)
                      )`);
    await db.execute(`CREATE TABLE IF NOT EXISTS WalkApplications
                      (
                          application_id INT AUTO_INCREMENT PRIMARY KEY,
                          request_id     INT NOT NULL,
                          walker_id      INT NOT NULL,
                          applied_at     TIMESTAMP                                DEFAULT CURRENT_TIMESTAMP,
                          status         ENUM ('pending', 'accepted', 'rejected') DEFAULT 'pending',
                          FOREIGN KEY (request_id) REFERENCES WalkRequests (request_id),
                          FOREIGN KEY (walker_id) REFERENCES Users (user_id),
                          CONSTRAINT unique_application UNIQUE (request_id, walker_id)
                      )`);
    await db.execute(`CREATE TABLE IF NOT EXISTS WalkRatings
                      (
                          rating_id  INT AUTO_INCREMENT PRIMARY KEY,
                          request_id INT NOT NULL,
                          walker_id  INT NOT NULL,
                          owner_id   INT NOT NULL,
                          rating     INT CHECK (rating BETWEEN 1 AND 5),
                          comments   TEXT,
                          rated_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                          FOREIGN KEY (request_id) REFERENCES WalkRequests (request_id),
                          FOREIGN KEY (walker_id) REFERENCES Users (user_id),
                          FOREIGN KEY (owner_id) REFERENCES Users (user_id),
                          CONSTRAINT unique_rating_per_walk UNIQUE (request_id)
                      )`);

    // Insert data if table is empty
    const [userCount] = await db.execute("SELECT COUNT(*) AS count FROM Users");
    if (userCount[0].count === 0) {
      await db.execute(`INSERT INTO Users (username, email, password_hash, role)
                        VALUES ('alice123', 'alice@example.com', 'hashed123', 'owner'),
                               ('bobwalker', 'bob@example.com', 'hashed456', 'walker'),
                               ('carol123', 'carol@example.com', 'hashed789', 'owner'),
                               ('xiutao', 'xiutao@example.com', 'hashed999', 'owner'),
                               ('icetea', 'icetea@example.com', 'hashed135', 'walker')`);

      await db.execute(`INSERT INTO Dogs (owner_id, name, size)
                        VALUES ((SELECT user_id FROM Users WHERE username = 'alice123'), 'Max', 'medium'),
                               ((SELECT user_id FROM Users WHERE username = 'carol123'), 'Bella', 'small'),
                               ((SELECT user_id FROM Users WHERE username = 'xiutao'), 'xiaoxiutao', 'small'),
                               ((SELECT user_id FROM Users WHERE username = 'xiutao'), 'daxiutao', 'large'),
                               ((SELECT user_id FROM Users WHERE username = 'alice123'), 'xiaoice', 'medium')`);
      await db.execute(`INSERT INTO WalkRequests (dog_id, requested_time, duration_minutes, location, status)
                        VALUES ((SELECT dog_id FROM Dogs WHERE name = 'Max'), '2025-06-10 08:00:00', 30, 'Parklands',
                                'open'),
                               ((SELECT dog_id FROM Dogs WHERE name = 'Bella'), '2025-06-10 09:30:00', 45,
                                'Beachside Ave', 'accepted'),
                               ((SELECT dog_id FROM Dogs WHERE name = 'xiaoxiutao'), '2025-06-12 10:00:00', 50,
                                'Linden Park', 'open'),
                               ((SELECT dog_id FROM Dogs WHERE name = 'daxiutao'), '2025-06-12 11:00:00', 30,
                                'Linden Park', 'accepted'),
                               ((SELECT dog_id FROM Dogs WHERE name = 'xiaoice'), '2025-06-15 06:00:00', 90,
                                'University of Adelaide', 'open')`);
      await db.execute(`INSERT INTO WalkApplications (request_id, walker_id, status)
                        VALUES ((SELECT request_id
                                 FROM WalkRequests
                                 WHERE dog_id = (SELECT dog_id FROM Dogs WHERE name = 'Bella')),
                                (SELECT user_id FROM Users WHERE username = 'bobwalker'), 'accepted'),
                               ((SELECT request_id
                                 FROM WalkRequests
                                 WHERE dog_id = (SELECT dog_id FROM Dogs WHERE name = 'daxiutao')),
                                (SELECT user_id FROM Users WHERE username = 'bobwalker'), 'accepted'),
                               ((SELECT request_id
                                 FROM WalkRequests
                                 WHERE dog_id = (SELECT dog_id FROM Dogs WHERE name = 'xiaoice')),
                                (SELECT user_id FROM Users WHERE username = 'icetea'), 'accepted'),
                               ((SELECT request_id
                                 FROM WalkRequests
                                 WHERE dog_id = (SELECT dog_id FROM Dogs WHERE name = 'Max')),
                                (SELECT user_id FROM Users WHERE username = 'icetea'), 'pending')`);
      await db.execute(`INSERT INTO WalkRatings (request_id, walker_id, owner_id, rating, comments)
                        VALUES ((SELECT request_id
                                 FROM WalkRequests
                                 WHERE dog_id = (SELECT dog_id FROM Dogs WHERE name = 'daxiutao')),
                                (SELECT user_id FROM Users WHERE username = 'bobwalker'),
                                (SELECT user_id FROM Users WHERE username = 'xiutao'),
                                5, 'bobwalker is good for daxiutao!'),
                               ((SELECT request_id
                                 FROM WalkRequests
                                 WHERE dog_id = (SELECT dog_id FROM Dogs WHERE name = 'xiaoice')),
                                (SELECT user_id FROM Users WHERE username = 'icetea'),
                                (SELECT user_id FROM Users WHERE username = 'alice123'),
                                4, 'icetea is good for xiaoice!')`);
    }
  } catch (err) {
    console.error(
      "Error setting up database. Ensure Mysql is running: service mysql start",
      err,
    );
  }
})();

app.get("/api/dogs", async (req, res) => {});

app.get("/api/walkrequests/", async (req, res) => {});

app.get("/api/walkers/summary", async () => {});

app.use(express.static(path.join(__dirname, "public")));

module.exports = app;
