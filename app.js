//require express module and create instance of express
const express = require('express');
const app = express();
//port variable that the server will listen on. ie 3000, 8080
const PORT = 3000;
//to serve the favicon
const favicon = require('serve-favicon');
const path = require('path');
app.use(express.static(path.join(__dirname, 'public')));
app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
//firebase
const firebase = require('firebase');
const admin = require('firebase-admin');
const serviceAccount = require('./firebaseServiceAccount.json')

//require SQLite module and set the db variable
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('socialroyale.db');
//requiring the bodyparser module to get values from the html inputs
const bodyParser = require('body-parser');
app.use(bodyParser.urlencoded({
  extended: true
}));
app.use(bodyParser.json());
//require the bcrypt module to encrypt the password and define saltRounds which is a bcypt input which specifies how many times the password is hashed
const bcrypt = require('bcrypt');
const saltRounds = 10;
//require cookieParser which is responsible for all uses of the cookie.
const cookieParser = require('cookie-parser');
app.use(cookieParser());
//this is now many miliseconds the cookie is valid (how long the user can stay logged in without being kicked out and having to log back in)
var maxAge = 1000*60*60;
//setting pug to be the view engine for node. this must be done instead of requiring a pug module
app.set('view engine', 'pug');
//get request when the client wants the front page.
app.get('/', function(req, res){
  //if the cookies show that there is a currentUser (somebody is logged in), it redirects them from the index page to the home page
  if(req.cookies.currentUser){
    res.redirect('home');
  }else{
    //if nobody is currently logged in, they are left to stay on the index page
    res.render('index2');
  };
});
//glogin ajax post from firebaseauth.js
app.post('/glogin', function(req, res){
  //console.log(req.body);
  //a login token is generated and stored in the gUsers table. it will be used later to verify the user.
  var loginToken = "";
  let possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890";
  for (let i = 0; i < 10; i++) loginToken += possible.charAt(Math.random() * possible.length);
  db.all('SELECT * FROM gUsers WHERE email = ?', [req.body.email], function(err, result){
    //if the user has never logged in before (essentially signing up)
    if(result.length == 0){
      db.all('INSERT INTO gUsers (display_name, email, photo_url, login_token) VALUES (?, ?, ?, ?)', [req.body.displayName, req.body.email, req.body.photoURL, loginToken], function(err, result2){
        if(err){
          console.log(err);
        }
      });
    }else{
      //signing in a user that exists
      db.all('UPDATE gUsers SET login_token = ? WHERE email = ?', [loginToken, req.body.email], function(err, result3){
        if(err){
          console.log(err);
        }
      });
    }
  });
  //sending json object back to ajax. it is taking the loginToken in order to pass it through the get request
  res.json({
    status: 'ok',
    token: loginToken
  });
});

//this is to write the cookie from the server side
app.get('/auth', function(req, res){
  //this gets the get parameters and puts them in json form
  var queryParameter = req.query;
  //var data = res.json(queryParameter);
  //console.log('the token is: ' + queryParameter.token + ' and the email is: ' + queryParameter.email);
  //getting the login token from the db where the users email is what was passed in the get
  db.all('SELECT login_token FROM gUsers WHERE email = ?', [queryParameter.email], function(err, result){
    if(result[0].login_token == queryParameter.token){
      //console.log('should be writing the cookies');
      //write cookies
      //stores the users email in the cookie
      res.cookie('currentUser', queryParameter.email, {maxAge: maxAge});
      res.redirect('home');
    }else{
      res.redirect('logout')
    }
  });
});

//the home route is called after the person logs in or signs up
app.get('/home', function(req, res){
  //if there is a value for the currentUser in the cookie, the user is authenticated and allowed to enter.
  if(!req.cookies.currentUser){
    res.redirect('/');
  }else{
    //setting the display name of the user in the cookie
    db.all('SELECT * FROM gUsers WHERE email = ?', [req.cookies.currentUser], function(err, result2){
      res.cookie('currentUserDisplayName', result2[0].display_name, {maxAge: maxAge});
      res.cookie('currentUserPhotoUrl', result2[0].photo_url, {maxAge: maxAge});
    });
    db.all('SELECT * FROM gPlayers WHERE email = ?', [req.cookies.currentUser], function(err, result){
      if(err){
        console.log(err);
      }else{
        if(result.length == 0){
          res.redirect('notingame');
        }else{
          res.redirect('/game');
        };
      };
    });
  };
});

//if the client has been detected that they are not in a game, a get request of notingame is made
app.get('/notingame', function(req, res){
  if(!req.cookies.currentUser){
    res.redirect('/');
  }else{
    //we are selecting the row from players where the username is equal to their username
    db.all('SELECT * FROM gPlayers WHERE email = ?', [req.cookies.currentUser], function(err, result){
      if(err){
        console.log(err);
      }else{
        //if the result does have a value, meaning they are playing in a game, they are redirected to the game page
        if(result.length > 0){
          res.redirect('/game');
        }else{
          //if the length of result is 0 they are not in a game and the notInGame page is rendered.
          res.render('notInGame2', {
            username:req.cookies.currentUserDisplayName.toUpperCase(),
            email: req.cookies.currentUser
          });
        };
      };
    });
  };
});

//if the user wants to create a game, they click that button and a get request is sent and dealt with here
app.get('/create', function(req, res){
  if(!req.cookies.currentUser){
    res.redirect('/');
  }else{
    //if they are valid in the cookies, render the create game page
    res.render('createGame2', {username: req.cookies.currentUserDisplayName.toUpperCase()});
  };
});
//this is what happens when the client is done writing their message and clicks the create game button
app.post('/createGame', function(req, res){
  var startingLifeStatus = 1;
  if(req.body.observer == 'on'){
    startingLifeStatus = 2;
  }
  if(!req.cookies.currentUser){
    res.redirect('/');
  }else{
    //this stores what they wrote in the text field as their message
    var message = req.body.messageForPlayers;
    //declaring the gameCode variable and setting it to 5 of the random characters below
    var gameCode = "";
    let possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890";
    for (let i = 0; i < 5; i++) gameCode += possible.charAt(Math.random() * possible.length);
    res.cookie('currentGameCode', gameCode, {maxAge: maxAge});
    //getting the date created for the game
    let date_ob = new Date();
    let year = date_ob.getFullYear();
    let month = ("0" + (date_ob.getMonth() + 1)).slice(-2);
    let date = ("0" + date_ob.getDate()).slice(-2);
    var dateCreated = (month + "-" + date + "-" + year);
    //this queries the user_id of the creator
    db.all('SELECT user_id FROM gUsers WHERE email = ?', [req.cookies.currentUser], function(err, result1){
      //this query inserts the new game into the games table
      db.all('INSERT INTO games(game_code, creator_id, is_active, message, date_created) VALUES(?, ?, ?, ?, ?)', [gameCode, result1[0].user_id, 0, message, dateCreated], function(err, result2){
        if(err){
          console.log(err);
        }else{
          //this queries the newly made game_id of the game from the games table
          db.all('SELECT game_id FROM games WHERE game_code = ?', [gameCode], function(err, result3){
            if(err){
              console.log(err);
            }else{
              //this query inserts the creator into the players table because they are playing in the game, too
              db.all('INSERT INTO gPlayers(user_id, email, display_name, game_id, is_alive, in_revote, can_vote, nominee_id, votes_against, photo_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [result1[0].user_id, req.cookies.currentUser, req.cookies.currentUserDisplayName, result3[0].game_id, startingLifeStatus, 0, 1, 0, 0, req.cookies.currentUserPhotoUrl], function(err, result4){
                if(err){
                  console.log(err);
                }else{
                  res.redirect('/game');
                }
              });
            };
          });
        };
      });
    });
  };
});

app.post('/editMessage', function(req, res){
  db.all('UPDATE games SET message = ? WHERE game_code = ?', [req.body.newMessageForPlayers, req.cookies.currentGameCode], function(err, result){
    if(err){
      console.log(err);
    }else{
      res.redirect('/game')
    }
  });
});

app.post('/joinGame', function(req, res){
  var startingLifeStatus = 1;
  if(req.body.observer == 'on'){
    startingLifeStatus = 2;
  }
  if(!req.cookies.currentUser){
    res.redirect('/');
  }else{
    //LIKE makes it so they do not have to type the game code in the correct case
    db.all('SELECT is_active, game_id FROM games WHERE game_code LIKE ?', [req.body.gameCode], function(err, result1){
      if(result1.length == 0){
        //they entered the wrong game code
        res.render('notInGame2', {
          username:req.cookies.currentUser.toUpperCase(),
          errorMessage: 'INVALID GAME CODE'
        });
      }else{
        //if the game has already started
        if(result1[0].is_active == 1 && req.body.observer != 'on'){
          //display error message that the game has already started
          res.render('notInGame2', {
            username:req.cookies.currentUser.toUpperCase(),
            errorMessage: 'CANNOT JOIN GAME BECAUSE IT HAS ALREADY STARTED. YOU CAN STILL JOIN AS AN OBSERVER, THOUGH.',
            inputtedGameCode: req.body.gameCode
          });
          //if the game has NOT already started
        }else if (result1[0].is_active == 0 || req.body.observer == 'on'){
          db.all('SELECT user_id FROM gUsers WHERE email = ?', [req.cookies.currentUser], function(err, result2){
            db.all('INSERT INTO gPlayers(user_id, email, display_name, game_id, is_alive, in_revote, can_vote, nominee_id, votes_against, photo_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [result2[0].user_id, req.cookies.currentUser, req.cookies.currentUserDisplayName, result1[0].game_id, startingLifeStatus, 0, 1, 0, 0, req.cookies.currentUserPhotoUrl], function(err, result4){
              if(err){
                console.log(err);
              }else{
                res.redirect('/game');
              };
            });
          });
        };
      };
    });
  };
});
//this route occurs when sombody goes to the page about their game (if they log in and are in a game, if they join a game, or if they create a game)
app.get('/game', function(req, res){
  var allPlayers = [];
  if(!req.cookies.currentUser){
    res.redirect('/');
  }else{
    //the game_id, is_alive, nominee_id, and user_id attributes are queried from the players table.
    db.all('SELECT game_id, is_alive, nominee_id, user_id FROM gPlayers WHERE email = ?', [req.cookies.currentUser], function(err, result2){
      if(err){
        console.log(err);
      }else{
        //check if user is in a game
        if(result2.length == 0){
          res.redirect('notingame');
        }else{
          //using the game_id queried above, the game code of that game is selected. we want this to display it on the page
          db.all('SELECT message, game_code, creator_id, is_active, game_id, date_created FROM games WHERE game_id = ?', [result2[0].game_id], function(err, result3){
            if(err){
              console.log(err);
            }else{
              //here the current game code is thrown into the cookie for easier access later
              res.cookie('currentGameCode', result3[0].game_code, {maxAge: maxAge});
              res.cookie('currentGameId', result3[0].game_id, {maxAge: maxAge});
              //this selects ALL user_ids of players who are in the game the client is in
              db.all('SELECT user_id, email, display_name, is_alive, nominee_id, can_vote, in_revote, photo_url FROM gPlayers WHERE game_id = ? ORDER BY display_name', [result2[0].game_id], function(err, result4){
                if(err){
                  console.log(err);
                }else{
                  var isRevote = 0;
                  var creatorName = "";
                  //this loop is going to go through the results of result4 and push the wanted values into the allplayers array
                  for(var i = 0; i < result4.length; i++){
                    if(result4[i].user_id == result3[0].creator_id){
                      creatorName = result4[i].display_name.toUpperCase();
                    };
                    allPlayers.push({
                      playerUsername: result4[i].display_name.toUpperCase(),
                      playerEmail: result4[i].email,
                      playerPhoto: result4[i].photo_url,
                      playerId: result4[i].user_id,
                      isAlive: result4[i].is_alive,
                      hasVoted: result4[i].nominee_id != 0,
                      canVote: result4[i].can_vote,
                      inRevote: result4[i].in_revote
                    });
                    //this checks to see if any of the players are in a revote. if there are players in a revote, it sets the isRevote varialbe (which is false by default), to true.
                    if(result4[i].in_revote == 1){
                      isRevote = 1;
                    }
                  }
                  //log the allPlayers array into the cookie
                  res.cookie('allPlayers', allPlayers, {maxAge: maxAge});
                  res.cookie('creatorName', creatorName, {maxAge: maxAge})
                  //logging the revote status into the cookie
                  res.cookie('isRevote', isRevote, {maxAge: maxAge});
                  res.render('game2', {
                    username: req.cookies.currentUserDisplayName.toUpperCase(),
                    email: req.cookies.currentUser,
                    creatorMessage: result3[0].message.toUpperCase(),
                    gameCode: result3[0].game_code,
                    creator: (result2[0].user_id == result3[0].creator_id),
                    creatorName: creatorName,
                    dateCreated:result3[0].date_created,
                    isAlive: result2[0].is_alive,
                    nomineeId: result2[0].nominee_id,
                    firstTimeChoice: 0,
                    isRevote: isRevote,
                    isActive: result3[0].is_active,
                    allPlayers: allPlayers
                  });
                };
              });
            };
          });
        };
      };
    });
  };
});

app.post('/cast', function(req, res){
  if(!req.cookies.currentUser){
    res.redirect('/');
  }else{
    db.all('SELECT p.is_alive, g.game_code, p.user_id FROM gPlayers p INNER JOIN games g ON p.game_id = g.game_id WHERE g.game_code = ? AND p.is_alive = 1 AND p.user_id = ? AND p.email != ?', [req.cookies.currentGameCode, req.body.vote, req.cookies.currentUser], function(err, result1){
      if(err){
        console.log(err);
      }else{
        if(result1.length == 0){
          //rerender the page with an error message that the vote was invalid
          db.all('SELECT g.game_id, g.is_active, g.date_created, p.is_alive, p.nominee_id, p.user_id, g.message, g.game_code, g.creator_id FROM gPlayers p INNER JOIN games g ON p.game_id = g.game_id WHERE email = ?', [req.cookies.currentUser], function(err, result){
            if(err){
              console.log(err);
            }else{
              res.render('game2', {
                username: req.cookies.currentUserDisplayName.toUpperCase(),
                email: req.cookies.currentUser,
                creatorMessage: result[0].message.toUpperCase(),
                gameCode: result[0].game_code,
                creator: (result[0].user_id == result[0].creator_id),
                creatorName: req.cookies.creatorName,
                dateCreated: result[0].date_created,
                isAlive: result[0].is_alive,
                nomineeId: result[0].nominee_id,
                voteErrorMessage: 'YOU HAVE CASTED AN INVALID VOTE. PLEASE TRY AGAIN.',
                firstTimeChoice: req.body.vote,
                isRevote: req.cookies.isRevote,
                isActive: result[0].is_active,
                allPlayers: req.cookies.allPlayers
              });
            }
          });
        }else{
          db.all('UPDATE gPlayers SET votes_against = votes_against + 1 WHERE user_id = ?', [req.body.vote], function(err, result2){
            if(err){
              console.log(err);
            }else{
              db.all('UPDATE gPlayers SET nominee_id = ? WHERE email = ? COLLATE NOCASE', [req.body.vote, req.cookies.currentUser], function(err, result3){
                if(err){
                  console.log(err);
                }else{
                  res.redirect('/game');
                }
              });
            };
          });
        };
      };
    });
  };
});

app.post('/countVotesConfirm', function(req, res){
  if(!req.cookies.currentUser){
    res.redirect('/');
  }else{
    //we are querying the database and asking for the player with the highest number of votes against them
    db.all('SELECT MAX(p.votes_against) v FROM gPlayers p INNER JOIN games g ON p.game_id = g.game_id WHERE g.game_code = ?', [req.cookies.currentGameCode], function(err, result1){
      if(err){
        console.log(err);
      }else{
        db.all('UPDATE games SET is_active = 1 WHERE game_code  = ?', [req.cookies.currentGameCode], function(err, result4){
          if(err){
            console.log(err);
          };
        });
        //once we have the highest number of votes, we need to check if only one person is voted the most, or if there is a tie.
        db.all('SELECT * FROM gPlayers p INNER JOIN games g ON p.game_id = g.game_id WHERE g.game_code = ? AND p.votes_against = ?', [req.cookies.currentGameCode, result1[0].v], function(err, result2){
          if(err){
            console.log(err);
          }else{
            //here we are checking if there is more than one person who has the most amount of votes
            if(result2.length > 1){
              //we must keep an array of the tied players. we do not know if it is two players, or three, or even four.
              var tiedPlayers = [];
              //we are pushing the user_id of every tied player into an array that will be passed into the query.
              for(var i = 0; i<result2.length; i++){
                tiedPlayers.push(result2[i].user_id);
              }
              //there is a tie in the votes and a revote must be executed
              //must change those who are tied to have their in_revote set to 1
              //also must reset everybody's nominee_id and their votes_agaisnt
              //use the IN mysql clause to pass in an array to a where clause
              db.all('UPDATE gPlayers SET in_revote = 0 WHERE game_id = ?', [req.cookies.currentGameId], function(err, result7){
                if(err){
                  console.log(err);
                }else{
                  //console.log('this point has been reached and the tied players are: ' + tiedPlayers + 'and the game ID is: ' + req.cookies.currentGameId);
                  db.all('UPDATE gPlayers SET in_revote = 1 WHERE votes_against = ?', [result1[0].v], function(err, result5){
                    if(err){
                      console.log(err);
                    }else{
                      //here we are reseting everybodys votes against and nominee id field. this is basically a new vote but we are only including those who are in a tie.
                      db.all('UPDATE gPlayers SET nominee_id = 0, votes_against = 0 WHERE game_id = ?', [req.cookies.currentGameId], function(err, result6){
                          if(err){
                            console.log(err);
                          }else{
                            //now we must redirect back to the /game page
                            res.redirect('/game');
                          };
                      });
                    };
                  });
                }
              });

            }else{
              //there is only one person with the max amount of votes, therefore we need to kick them out of the game
              //on top of kicking them out of the game, we need to reset everybody's nominee_id and their votes_against column
              db.all('UPDATE gPlayers SET is_alive = 0 WHERE user_id = ?', [result2[0].user_id], function(err, result3){
                if(err){
                  console.log(err);
                }else{
                  //the player has been changed to dead, now we must reset everybody's nominee_id and their votes_against to 0
                  db.all('UPDATE gPlayers SET nominee_id = 0, votes_against = 0, in_revote = 0 WHERE game_id = ?', [req.cookies.currentGameId], function(err, result4){
                    if(err){
                      console.log(err);
                    }else{
                      //everybody has been changed
                      res.redirect('/game');
                    }
                  });
                };
              });
            };
          };
        });
      };
    });
  };
});

app.post('/leaveGameConfirm', function(req, res){
  db.all('DELETE FROM gPlayers WHERE email = ?', [req.cookies.currentUser], function(err, result2){
    if(err){
      console.log(err);
    }else{
      res.redirect('notingame');
    };
  });
});

app.post('/deleteGameConfirm', function(req, res){
  db.all('DELETE FROM games where game_id  = ?', [req.cookies.currentGameId], function(err, result){
    if(err){
      console.log(err);
    }else{
      db.all('DELETE FROM gPlayers where game_id = ?', [req.cookies.currentGameId], function(err, result2){
        if(err){
          console.log(err);
        }else {
          res.redirect('notingame');
        };
      });
    };
  });
});

//this is if they click the logout button
app.get('/logout', function(req, res){
  //if the user logs out, it clears the cookie so that they do not get automatically logged back in.
  res.clearCookie('currentUser');
  res.clearCookie('currentUserDisplayName');
  res.clearCookie('currentGameCode');
  res.clearCookie('currentGameId');
  res.clearCookie('allPlayers');
  res.clearCookie('creatorName');
  res.clearCookie('isRevote');
  //after the cookie is cleared they are sent back to the index page.
  res.redirect('/')
});
//listening on the port and logging a message of success.
app.listen(PORT, function(){
  console.log(`listening on port ${PORT}`);
});
